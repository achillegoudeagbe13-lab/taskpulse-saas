import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrgAdmin } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { writeAudit } from '../../../../lib/audit';

/** Membres de l'organisation active uniquement. */
export async function GET() {
  const auth = await requireOrgAdmin();
  if (auth.error) return auth.error;

  const memberships = await prisma.membership.findMany({
    where: { organizationId: auth.ctx.organizationId },
    include: { user: { include: { department: true, profile: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({
    members: memberships.map((membership) => ({
      membershipId: membership.id,
      role: membership.role,
      joinedAt: membership.createdAt.toISOString(),
      user: {
        id: membership.user.id,
        firstName: membership.user.firstName,
        lastName: membership.user.lastName,
        username: membership.user.username,
        email: membership.user.email,
        phone: membership.user.phone,
        status: membership.user.status,
        department: membership.user.department?.name ?? '',
        photoUrl: membership.user.photoUrl,
        createdAt: membership.user.createdAt.toISOString(),
        lastLoginAt: membership.user.lastLoginAt?.toISOString() ?? null,
      },
    })),
  });
}

/** Modifie le rôle dans l'organisation et/ou le statut du compte. */
export async function PATCH(request: Request) {
  const auth = await requireOrgAdmin();
  if (auth.error) return auth.error;
  try {
    const input = z.object({ id: z.string(), status: z.enum(['ACTIF', 'INACTIF', 'SUSPENDU']).optional(), role: z.enum(['ORGANIZATION_ADMIN', 'EMPLOYEE', 'INTERN']).optional(), department: z.string().trim().max(100).optional() }).parse(await request.json());
    if (!input.status && !input.role && !input.department) return NextResponse.json({ error: 'Modification invalide.' }, { status: 400 });
    if (input.id === auth.ctx.user.id && input.role && input.role !== 'ORGANIZATION_ADMIN') return NextResponse.json({ error: 'Vous ne pouvez pas retirer vos propres permissions administrateur.' }, { status: 400 });

    // La cible doit être membre de L'ORGANISATION ACTIVE.
    const membership = await prisma.membership.findFirst({ where: { userId: input.id, organizationId: auth.ctx.organizationId } });
    if (!membership) return NextResponse.json({ error: 'Ce membre n’appartient pas à votre organisation.' }, { status: 404 });

    let departmentId: string | undefined;
    if (input.department) {
      const department = await prisma.department.upsert({ where: { organizationId_name: { organizationId: auth.ctx.organizationId, name: input.department } }, update: {}, create: { name: input.department, organizationId: auth.ctx.organizationId } });
      departmentId = department.id;
    }

    if (input.role) await prisma.membership.update({ where: { id: membership.id }, data: { role: input.role } });
    if (input.status || departmentId) {
      await prisma.user.update({ where: { id: input.id }, data: { ...(input.status ? { status: input.status } : {}), ...(departmentId ? { departmentId } : {}) } });
    }
    await writeAudit(auth.ctx.user.id, 'MODIFICATION_MEMBRE', 'User', input.id, { role: input.role, status: input.status, organizationId: auth.ctx.organizationId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? 'Données invalides.' }, { status: 400 });
    return NextResponse.json({ error: 'Impossible de modifier ce membre.' }, { status: 400 });
  }
}

/** Retire le membre de l'organisation (le compte utilisateur est conservé). */
export async function DELETE(request: Request) {
  const auth = await requireOrgAdmin();
  if (auth.error) return auth.error;
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Membre manquant.' }, { status: 400 });
  if (id === auth.ctx.user.id) return NextResponse.json({ error: 'Vous ne pouvez pas vous retirer vous-même de votre organisation.' }, { status: 400 });

  const removed = await prisma.membership.deleteMany({ where: { userId: id, organizationId: auth.ctx.organizationId } });
  if (!removed.count) return NextResponse.json({ error: 'Ce membre n’appartient pas à votre organisation.' }, { status: 404 });
  await writeAudit(auth.ctx.user.id, 'RETRAIT_MEMBRE', 'User', id, { organizationId: auth.ctx.organizationId });
  return NextResponse.json({ ok: true });
}
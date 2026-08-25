import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePlatformSuperAdmin } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/prisma';
import { writeAudit } from '../../../../../lib/audit';

type Params = { params: { id: string } };

/**
 * GET — Vue de supervision GLOBALE d'une organisation.
 * Agrégats uniquement : aucune donnée privée nominative n'est exposée
 * (conformément au rôle de supervision du super admin plateforme).
 */
export async function GET(request: Request, { params }: Params) {
  const auth = await requirePlatformSuperAdmin();
  if (auth.error) return auth.error;

  const organization = await prisma.organization.findUnique({ where: { id: params.id } });
  if (!organization) return NextResponse.json({ error: 'Organisation introuvable.' }, { status: 404 });

  const orgId = organization.id;
  const [members, membershipsByRole, activeUsers, tasksByStatus, activities, announcements, messages, pendingInvitations, journalEntries, attendancesToday] = await Promise.all([
    prisma.membership.count({ where: { organizationId: orgId } }),
    prisma.membership.groupBy({ by: ['role'], where: { organizationId: orgId }, _count: { _all: true } }),
    prisma.user.count({ where: { status: 'ACTIF', memberships: { some: { organizationId: orgId } } } }),
    prisma.task.groupBy({ by: ['status'], where: { organizationId: orgId }, _count: { _all: true } }),
    prisma.activity.count({ where: { organizationId: orgId } }),
    prisma.announcement.count({ where: { organizationId: orgId } }),
    prisma.message.count({ where: { organizationId: orgId } }),
    prisma.invitation.count({ where: { organizationId: orgId, status: 'PENDING' } }),
    prisma.journalEntry.count({ where: { organizationId: orgId } }),
    prisma.attendance.count({ where: { organizationId: orgId, clockIn: { gte: startOfToday() } } }),
  ]);

  const roleOf = (role: string) => membershipsByRole.find((r) => r.role === role)?._count._all ?? 0;
  const taskOf = (status: string) => tasksByStatus.find((t) => t.status === status)?._count._all ?? 0;

  return NextResponse.json({
    organization: { id: organization.id, name: organization.name, slug: organization.slug, status: organization.status, createdAt: organization.createdAt },
    supervision: {
      members: {
        total: members,
        admins: roleOf('ORGANIZATION_ADMIN'),
        employees: roleOf('EMPLOYEE'),
        interns: roleOf('INTERN'),
        activeUsers,
      },
      tasks: {
        total: taskOf('EN_ATTENTE') + taskOf('EN_COURS') + taskOf('BLOQUE') + taskOf('TERMINE'),
        enAttente: taskOf('EN_ATTENTE'),
        enCours: taskOf('EN_COURS'),
        bloque: taskOf('BLOQUE'),
        termine: taskOf('TERMINE'),
      },
      activities,
      announcements,
      messages,
      journalEntries,
      invitationsPending,
      attendancesToday,
    },
  });
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * PATCH — Suspendre ou réactiver une organisation.
 * Une organisation suspendue reste consultable mais ne doit plus être opérationnelle.
 */
const patchSchema = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']) });

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requirePlatformSuperAdmin();
  if (auth.error) return auth.error;

  try {
    const input = patchSchema.parse(await request.json());
    const existing = await prisma.organization.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: 'Organisation introuvable.' }, { status: 404 });

    const updated = await prisma.organization.update({ where: { id: params.id }, data: { status: input.status } });
    await writeAudit(auth.ctx.user.id, input.status === 'SUSPENDED' ? 'SUSPENSION_ORGANISATION' : 'REACTIVATION_ORGANISATION', 'Organization', params.id, { name: existing.name });

    return NextResponse.json({ ok: true, organization: { id: updated.id, status: updated.status } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Statut invalide.' }, { status: 400 });
    return NextResponse.json({ error: 'Impossible de modifier le statut.' }, { status: 500 });
  }
}

/**
 * DELETE — Suppression définitive de l'organisation.
 * Les memberships et invitations sont supprimés (cascade), les données
 * métier sont détachées (organizationId → NULL via FK ON DELETE SET NULL).
 */
export async function DELETE(request: Request, { params }: Params) {
  const auth = await requirePlatformSuperAdmin();
  if (auth.error) return auth.error;

  try {
    const existing = await prisma.organization.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: 'Organisation introuvable.' }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      // Détacher les utilisateurs dont c'était l'organisation active.
      await tx.user.updateMany({ where: { activeOrganizationId: params.id }, data: { activeOrganizationId: null } });
      await tx.organization.delete({ where: { id: params.id } });
    });

    await writeAudit(auth.ctx.user.id, 'SUPPRESSION_ORGANISATION', 'Organization', params.id, { name: existing.name, slug: existing.slug });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Impossible de supprimer cette organisation.' }, { status: 500 });
  }
}
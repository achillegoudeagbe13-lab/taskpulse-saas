import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { requireOrgAdmin } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { writeAudit } from '../../../lib/audit';

const INVITE_DAYS = 7;

/** Liste les invitations de l'organisation active. */
export async function GET() {
  const auth = await requireOrgAdmin();
  if (auth.error) return auth.error;
  const invitations = await prisma.invitation.findMany({
    where: { organizationId: auth.ctx.organizationId },
    include: { invitedBy: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return NextResponse.json({ invitations });
}

/** Crée une invitation EMPLOYEE ou INTERN : le compte recevra l'organizationId de l'admin. */
export async function POST(request: Request) {
  const auth = await requireOrgAdmin();
  if (auth.error) return auth.error;
  try {
    const input = z.object({
      email: z.string().trim().toLowerCase().email().optional(),
      firstName: z.string().trim().max(80).optional(),
      lastName: z.string().trim().max(80).optional(),
      role: z.enum(['EMPLOYEE', 'INTERN']),
    }).parse(await request.json());

    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000);
    const invitation = await prisma.invitation.create({
      data: {
        token,
        organizationId: auth.ctx.organizationId,
        email: input.email || null,
        firstName: input.firstName || null,
        lastName: input.lastName || null,
        role: input.role,
        invitedById: auth.ctx.user.id,
        expiresAt,
      },
    });
    await writeAudit(auth.ctx.user.id, 'CREATION_INVITATION', 'Invitation', invitation.id, { role: input.role, organizationId: auth.ctx.organizationId });

    return NextResponse.json({
      invitation,
      // Lien de join à transmettre au futur membre (pas d'envoi d'email dans cette itération).
      inviteUrl: `/rejoindre?token=${invitation.token}`,
      expiresAt: invitation.expiresAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? 'Invitation invalide.' }, { status: 400 });
    return NextResponse.json({ error: 'Impossible de créer cette invitation.' }, { status: 400 });
  }
}

/** Révoque une invitation en attente de l'organisation active. */
export async function DELETE(request: Request) {
  const auth = await requireOrgAdmin();
  if (auth.error) return auth.error;
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Invitation manquante.' }, { status: 400 });
  const updated = await prisma.invitation.updateMany({
    where: { id, organizationId: auth.ctx.organizationId, status: 'PENDING' },
    data: { status: 'REVOKED' },
  });
  if (!updated.count) return NextResponse.json({ error: 'Invitation introuvable ou déjà traitée.' }, { status: 404 });
  await writeAudit(auth.ctx.user.id, 'REVOCATION_INVITATION', 'Invitation', id);
  return NextResponse.json({ ok: true });
}
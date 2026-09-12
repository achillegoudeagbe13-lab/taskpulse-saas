import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { requireOrgAdmin } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { writeAudit } from '../../../lib/audit';
import { checkInviteSeatCapacity, subscriptionExpired } from '../../../lib/billing';

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

  // --- Monétisation : blocage en cas d'abonnement verrouillé ou expiré ---
  // On combine planStatus ET l'expiration réelle (planExpiresAt), sinon une
  // organisation dont l'abonnement a expiré peut continuer à inviter.
  if (
    auth.ctx.organization.planStatus !== 'ACTIVE' ||
    subscriptionExpired(auth.ctx.organization)
  ) {
    return NextResponse.json({
      error: 'Votre abonnement est expiré ou verrouillé. Saisissez un code d’activation pour continuer.',
      locked: true,
    }, { status: 402 });
  }
  // --- Monétisation : blocage en cas de dépassement de palier ---
  const seatBlock = await checkInviteSeatCapacity(auth.ctx.organizationId, auth.ctx.organization.planTier);
  if (seatBlock) {
    return NextResponse.json({ ...seatBlock, error: seatBlock.error, upgradeRequired: true }, { status: 402 });
  }

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

    // Lien d'invitation absolu (base = origine de la requête).
    const base = process.env.NEXT_PUBLIC_APP_URL?.trim() || new URL(request.url).origin;
    const inviteUrl = `${base.replace(/\/+$/, '')}/rejoindre?token=${invitation.token}`;

    // Envoi de l'invitation par e-mail si une adresse est fournie et SMTP configuré.
    let emailed = false;
    if (input.email) {
      const { sendMail, mailTemplate, isMailConfigured } = await import('../../../lib/mailer');
      if (isMailConfigured()) {
        const name = [input.firstName, input.lastName].filter(Boolean).join(' ');
        const result = await sendMail(
          input.email,
          'Invitation à rejoindre votre équipe sur MAR-CI FLOW',
          mailTemplate(
            'Vous êtes invité(e) à rejoindre une équipe',
            `<p>Bonjour ${name ? `<strong>${name}</strong>` : ''},</p>
             <p><strong>${auth.ctx.user.firstName} ${auth.ctx.user.lastName}</strong> vous invite à rejoindre son espace <strong>${auth.ctx.organization?.name ?? 'MAR-CI FLOW'}</strong> sur MAR-CI FLOW (rôle : ${input.role === 'INTERN' ? 'stagiaire' : 'employé'}).</p>
             <p>Ce lien d'invitation est valable 7 jours.</p>`,
            { label: 'Rejoindre l’équipe', url: inviteUrl },
          ),
        );
        emailed = result.sent;
      }
    }

    return NextResponse.json({
      invitation,
      // Lien de join à transmettre au futur membre si l'e-mail n'a pas pu être envoyé.
      inviteUrl: emailed ? undefined : `/rejoindre?token=${invitation.token}`,
      emailed,
      expiresAt: invitation.expiresAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? 'Invitation invalide.' }, { status: 400 });
    console.error('[invitations:POST] échec création:', error instanceof Error ? error.message : error);
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
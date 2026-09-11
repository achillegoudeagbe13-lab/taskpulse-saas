import { NextResponse } from 'next/server';
import { requireOrgMember } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { tierInfo } from '../../../../lib/billing';

/**
 * GET /api/org/plan — état de l'abonnement de l'organisation active.
 * Permet au client de savoir si l'organisation est verrouillée (expiration ou
 * dépassement de palier) et de déclencher l'écran d'activation / mise à niveau.
 */
export async function GET() {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;
  const orgId = auth.ctx.organizationId;

  const [organization, members, pendingInvites] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId }, include: { license: true } }),
    prisma.membership.count({ where: { organizationId: orgId } }),
    prisma.invitation.count({ where: { organizationId: orgId, status: 'PENDING' } }),
  ]);
  if (!organization) return NextResponse.json({ error: 'Organisation introuvable.' }, { status: 404 });

  const now = new Date();
  // Geler automatiquement si la période payée est dépassée.
  const expired = organization.planExpiresAt ? organization.planExpiresAt <= now : false;
  let status = organization.planStatus;
  if (status === 'ACTIVE' && expired) status = 'EXPIRED';

  const tier = tierInfo(organization.planTier);
  const projectedSeats = members + pendingInvites;
  const overLimit = tier.maxSeats !== null && projectedSeats > tier.maxSeats;
  const locked = status === 'EXPIRED' || status === 'LOCKED' || overLimit;

  return NextResponse.json({
    tier: organization.planTier,
    planStatus: status,
    expired,
    expiresAt: organization.planExpiresAt?.toISOString() ?? null,
    seatLimit: tier.maxSeats,
    currentMembers: members,
    pendingInvites,
    projectedSeats,
    overLimit,
    locked,
    lockReason: overLimit ? 'DEPASSEMENT_PALIER' : status === 'EXPIRED' ? 'EXPIRATION' : status === 'LOCKED' ? 'VERROUILLE' : null,
    planLabel: tier.label,
    planPrice: tier.price,
    licenseCode: organization.licenseCodeId ? String(organization.license?.code ?? '') : null,
  });
}
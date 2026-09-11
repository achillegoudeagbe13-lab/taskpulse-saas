import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrgAdmin } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { writeAudit } from '../../../../lib/audit';
import { tierInfo } from '../../../../lib/billing';

/**
 * POST /api/org/activate — applique un code d'activation de licence pour
 * débloquer (ou mettre à niveau) l'organisation. Strictement réservé à
 * l'administrateur de l'organisation.
 */
const schema = z.object({ code: z.string().trim().toUpperCase().min(8).max(64) });

export async function POST(request: Request) {
  const auth = await requireOrgAdmin();
  if (auth.error) return auth.error;
  const orgId = auth.ctx.organizationId;

  try {
    const input = schema.parse(await request.json());
    const code = input.code;

    const license = await prisma.licenseCode.findUnique({ where: { code } });
    if (!license) return NextResponse.json({ error: 'Code d’activation invalide ou inconnu.' }, { status: 404 });
    if (license.status === 'USED') return NextResponse.json({ error: 'Ce code d’activation a déjà été utilisé.' }, { status: 409 });
    if (license.status === 'REVOKED') return NextResponse.json({ error: 'Ce code d’activation a été révoqué.' }, { status: 409 });
    if (license.expiresAt && license.expiresAt <= new Date()) {
      return NextResponse.json({ error: 'Ce code d’activation est expiré.' }, { status: 410 });
    }

    const tier = tierInfo(license.tier);
    const planExpiresAt = license.expiresAt ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    const updated = await prisma.$transaction(async (tx) => {
      // Révocation du code éventuellement déjà actif, puis liaison du nouveau.
      if (auth.ctx.user) {
        const current = await tx.organization.findUnique({ where: { id: orgId } });
        if (current?.licenseCodeId) {
          await tx.licenseCode.update({ where: { id: current.licenseCodeId }, data: { status: 'UNUSED' } });
        }
      }
      await tx.licenseCode.update({ where: { id: license.id }, data: { status: 'USED', activatedAt: new Date() } });
      return tx.organization.update({
        where: { id: orgId },
        data: {
          licenseCodeId: license.id,
          planTier: license.tier,
          planStatus: 'ACTIVE',
          planExpiresAt,
        },
      });
    });

    const members = await prisma.membership.count({ where: { organizationId: orgId } });
    const pendingInvites = await prisma.invitation.count({ where: { organizationId: orgId, status: 'PENDING' } });
    const projectedSeats = members + pendingInvites;

    await writeAudit(auth.ctx.user.id, 'ACTIVATION_LICENCE', 'Organization', orgId, { code: license.code, tier: license.tier });

    return NextResponse.json({
      ok: true,
      plan: {
        tier: updated.planTier,
        planStatus: updated.planStatus,
        planExpiresAt: updated.planExpiresAt?.toISOString() ?? null,
        planLabel: tier.label,
        seatLimit: tier.maxSeats,
        projectedSeats,
        canAccess: projectedSeats <= (tier.maxSeats ?? Infinity),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Code d’activation invalide.' }, { status: 400 });
    return NextResponse.json({ error: 'Activation impossible.' }, { status: 400 });
  }
}
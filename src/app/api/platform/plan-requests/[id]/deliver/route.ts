import { NextResponse } from 'next/server';
import { requirePlatformSuperAdmin } from '../../../../../../lib/auth';
import { prisma } from '../../../../../../lib/prisma';
import { writeAudit } from '../../../../../../lib/audit';
import { sendMail, isMailConfigured, mailTemplate } from '../../../../../../lib/mailer';
import { tierInfo, formatPrice } from '../../../../../../lib/billing';
import { serializePlanRequest } from '../../../../../../lib/plan-requests';
import { generateLicenseKey } from '../../../../../../lib/license-keys';

type Params = { params: { id: string } };

const messageInclude = {
  orderBy: { createdAt: 'asc' as const },
  include: { author: { select: { firstName: true, lastName: true } } },
};

/**
 * POST /api/platform/plan-requests/[id]/deliver — délivre en une action la clé
 * d'activation du palier demandé : génération d'un code unique
 * (MCF-<PALIER>-XXXX-XXXX), message de livraison dans la conversation, passage
 * du dossier en « Approuvée » et e-mail à l'administrateur de l'organisation.
 */
export async function POST(_request: Request, { params }: Params) {
  const auth = await requirePlatformSuperAdmin();
  if (auth.error) return auth.error;

  const existing = await prisma.planRequest.findUnique({
    where: { id: params.id },
    include: { organization: { select: { id: true, name: true, slug: true } } },
  });
  if (!existing) return NextResponse.json({ error: 'Demande introuvable.' }, { status: 404 });
  if (existing.status === 'APPROVED') {
    return NextResponse.json({ error: 'Ce dossier est déjà approuvé.' }, { status: 409 });
  }

  const tier = tierInfo(existing.requestedTier);

  // Clé unique dont le préfixe identifie le palier (ex : MCF-10K-AB12-CD34).
  let code = generateLicenseKey(existing.requestedTier);
  while (await prisma.licenseCode.findUnique({ where: { code } })) {
    code = generateLicenseKey(existing.requestedTier);
  }

  const result = await prisma.$transaction(async (tx) => {
    const license = await tx.licenseCode.create({
      data: {
        code,
        tier: existing.requestedTier,
        maxSeats: tier.maxSeats ?? 9999,
        note: `Demande ${existing.id.slice(0, 8)} · ${existing.organization.name}`,
      },
    });

    await tx.supportMessage.create({
      data: {
        requestId: existing.id,
        authorId: auth.ctx.user.id,
        isSuperAdmin: true,
        body: `Votre paiement pour le palier ${tier.label} (${formatPrice(tier.price)}) a été confirmé. Voici votre clé d’activation à saisir dans Paramètres → Plan & licence.`,
        licenseKey: code,
      },
    });

    const updated = await tx.planRequest.update({
      where: { id: existing.id },
      data: { status: 'APPROVED', decidedAt: new Date() },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        messages: messageInclude,
      },
    });

    return { license, updated };
  });

  await writeAudit(auth.ctx.user.id, 'GENERATION_LICENCE', 'LicenseCode', result.license.id, {
    tier: existing.requestedTier,
    code,
    requestId: existing.id,
  });

  if (isMailConfigured()) {
    await sendMail(
      existing.contactEmail,
      `✅ Votre code d’activation ${tier.label} — ${formatPrice(tier.price)}`,
      mailTemplate(
        'Votre abonnement est activé',
        `<p>Bonjour ${existing.contactName},</p>
         <p>Votre demande pour le palier <strong>${tier.label}</strong> (${formatPrice(tier.price)}) a été traitée.</p>
         <p>Voici votre code d’activation :</p>
         <p style="font-family:monospace;font-size:18px;font-weight:700;letter-spacing:.08em;background:#f1f5f9;padding:12px;border-radius:8px;text-align:center">${code}</p>
         <p>Rendez-vous dans <strong>Paramètres → Plan &amp; licence</strong> pour l’activer.</p>`,
      ),
    );
  }

  return NextResponse.json({
    ok: true,
    license: { code, tier: result.license.tier, maxSeats: result.license.maxSeats },
    request: serializePlanRequest(result.updated, { withOrganization: true }),
  }, { status: 201 });
}
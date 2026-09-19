import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePlatformSuperAdmin } from '../../../../../../lib/auth';
import { prisma } from '../../../../../../lib/prisma';
import { writeAudit } from '../../../../../../lib/audit';
import { sendMail, isMailConfigured, mailTemplate } from '../../../../../../lib/mailer';
import { tierInfo, formatPrice } from '../../../../../../lib/billing';
import { serializePlanRequest } from '../../../../../../lib/plan-requests';
import { isValidKeyShape } from '../../../../../../lib/license-keys';

type Params = { params: { id: string } };

const messageInclude = {
  orderBy: { createdAt: 'asc' as const },
  include: { author: { select: { firstName: true, lastName: true } } },
};

const schema = z.object({
  body: z.string().trim().min(1).max(2000),
  licenseKey: z.string().trim().max(64).optional().nullable(),
});

/**
 * POST /api/platform/plan-requests/[id]/messages — le super-admin répond dans
 * la conversation. Il peut y joindre une clé d'activation existante
 * (générée au préalable dans la console Licences) : le dossier passe alors
 * automatiquement en « Approuvée » et l'admin de l'organisation est notifié.
 */
export async function POST(request: Request, { params }: Params) {
  const auth = await requirePlatformSuperAdmin();
  if (auth.error) return auth.error;

  try {
    const input = schema.parse(await request.json());
    const existing = await prisma.planRequest.findUnique({
      where: { id: params.id },
      include: { organization: { select: { id: true, name: true } } },
    });
    if (!existing) return NextResponse.json({ error: 'Demande introuvable.' }, { status: 404 });

    let licenseKey: string | null = null;
    const tier = tierInfo(existing.requestedTier);

    if (input.licenseKey && input.licenseKey.length > 0) {
      const code = input.licenseKey.toUpperCase();
      if (!isValidKeyShape(code)) {
        return NextResponse.json({ error: 'Format de clé invalide (attendu MCF-<PALIER>-XXXX-XXXX).' }, { status: 400 });
      }
      const license = await prisma.licenseCode.findUnique({ where: { code } });
      if (!license) return NextResponse.json({ error: 'Aucune clé d’activation ne correspond à ce code.' }, { status: 404 });
      if (license.status !== 'UNUSED') {
        return NextResponse.json({ error: 'Cette clé n’est plus disponible (déjà utilisée ou révoquée).' }, { status: 409 });
      }
      if (license.tier !== existing.requestedTier) {
        return NextResponse.json(
          { error: `Cette clé correspond à un autre palier (${tierInfo(license.tier).label}) que celui demandé (${tier.label}).` },
          { status: 400 },
        );
      }
      licenseKey = code;
    }

    await prisma.supportMessage.create({
      data: {
        requestId: existing.id,
        authorId: auth.ctx.user.id,
        isSuperAdmin: true,
        body: input.body,
        licenseKey,
      },
    });

    const nextStatus = licenseKey ? 'APPROVED' : existing.status === 'PENDING' ? 'PROCESSING' : existing.status;
    const updated = await prisma.planRequest.update({
      where: { id: existing.id },
      data: { status: nextStatus, decidedAt: licenseKey ? new Date() : existing.decidedAt },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        messages: messageInclude,
      },
    });

    await writeAudit(auth.ctx.user.id, licenseKey ? 'LIVRAISON_LICENCE' : 'MESSAGE_ABONNEMENT', 'PlanRequest', existing.id, {
      from: 'PLATFORM',
      tier: existing.requestedTier,
      code: licenseKey,
    });

    // Prévenir l'admin de l'organisation lorsque la clé est délivrée.
    if (licenseKey && isMailConfigured()) {
      await sendMail(
        existing.contactEmail,
        `✅ Votre code d’activation ${tier.label} — ${formatPrice(tier.price)}`,
        mailTemplate(
          'Votre abonnement est activé',
          `<p>Bonjour ${existing.contactName},</p>
           <p>Votre demande pour le palier <strong>${tier.label}</strong> (${formatPrice(tier.price)}) a été traitée.</p>
           <p>Voici votre code d’activation :</p>
           <p style="font-family:monospace;font-size:18px;font-weight:700;letter-spacing:.08em;background:#f1f5f9;padding:12px;border-radius:8px;text-align:center">${licenseKey}</p>
           <p>Rendez-vous dans <strong>Paramètres → Plan &amp; licence</strong> pour l’activer.</p>`,
        ),
      );
    }

    return NextResponse.json({ ok: true, request: serializePlanRequest(updated, { withOrganization: true }) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Message vide ou trop long.' }, { status: 400 });
    return NextResponse.json({ error: 'Envoi du message impossible.' }, { status: 400 });
  }
}
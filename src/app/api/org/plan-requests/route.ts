import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrgAdmin } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { writeAudit } from '../../../../lib/audit';
import { sendMail, isMailConfigured, mailTemplate } from '../../../../lib/mailer';
import { TIERS, tierInfo, formatPrice } from '../../../../lib/billing';
import { PAYMENT_METHODS, PAYMENT_METHOD_VALUES, serializePlanRequest } from '../../../../lib/plan-requests';

const messageInclude = {
  orderBy: { createdAt: 'asc' as const },
  include: { author: { select: { firstName: true, lastName: true } } },
};

/**
 * GET /api/org/plan-requests — demandes d'abonnement de l'organisation active
 * (administrateur uniquement), avec la conversation de suivi.
 */
export async function GET() {
  const auth = await requireOrgAdmin();
  if (auth.error) return auth.error;

  const requests = await prisma.planRequest.findMany({
    where: { organizationId: auth.ctx.organizationId },
    include: { messages: messageInclude },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  return NextResponse.json({
    requests: requests.map((request) => serializePlanRequest(request)),
    tiers: TIERS,
    paymentMethods: PAYMENT_METHODS,
    contact: {
      name: `${auth.ctx.user.firstName} ${auth.ctx.user.lastName}`.trim(),
      email: auth.ctx.user.email,
      phone: auth.ctx.user.phone ?? '',
    },
  });
}

const createSchema = z.object({
  requestedTier: z.enum(['T1', 'T2', 'T3', 'T4']),
  contactName: z.string().trim().min(2).max(120),
  contactEmail: z.string().trim().email().max(160),
  contactPhone: z.string().trim().max(40).optional().nullable(),
  paymentMethod: z.enum(PAYMENT_METHOD_VALUES),
  needs: z.string().trim().max(1000).optional().nullable(),
});

/**
 * POST /api/org/plan-requests — envoie une demande d'activation au
 * super-admin plateforme depuis la grille tarifaire. Une seule demande
 * ouverte (PENDING/PROCESSING) à la fois par organisation.
 */
export async function POST(request: Request) {
  const auth = await requireOrgAdmin();
  if (auth.error) return auth.error;
  const orgId = auth.ctx.organizationId;

  try {
    const input = createSchema.parse(await request.json());

    const open = await prisma.planRequest.findFirst({
      where: { organizationId: orgId, status: { in: ['PENDING', 'PROCESSING'] } },
      include: { messages: messageInclude },
      orderBy: { createdAt: 'desc' },
    });
    if (open) {
      return NextResponse.json(
        { error: 'Une demande est déjà en cours pour votre organisation. Poursuivez la conversation ci-dessous.', request: serializePlanRequest(open) },
        { status: 409 },
      );
    }

    const tier = tierInfo(input.requestedTier);
    const created = await prisma.planRequest.create({
      data: {
        organizationId: orgId,
        requestedTier: input.requestedTier,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone ?? null,
        paymentMethod: input.paymentMethod,
        needs: input.needs ?? null,
      },
      include: { messages: messageInclude },
    });

    await writeAudit(auth.ctx.user.id, 'DEMANDE_ABONNEMENT', 'PlanRequest', created.id, {
      tier: input.requestedTier,
      paymentMethod: input.paymentMethod,
      price: tier.price,
    });

    // Notification du super-admin plateforme (dégradation gracieuse si SMTP absent).
    const adminEmail = (process.env.TASKPULSE_ADMIN_EMAIL ?? '').trim();
    if (adminEmail && isMailConfigured()) {
      await sendMail(
        adminEmail,
        `💳 Demande d'abonnement — ${auth.ctx.organization.name} (${tier.label})`,
        mailTemplate(
          'Nouvelle demande d’abonnement',
          `<p><strong>${auth.ctx.organization.name}</strong> souhaite activer le palier <strong>${tier.label}</strong> (${formatPrice(tier.price)}).</p>
           <p>Contact : ${input.contactName} · ${input.contactEmail}${input.contactPhone ? ` · ${input.contactPhone}` : ''}<br/>
           Moyen de paiement : ${input.paymentMethod}</p>
           ${input.needs ? `<p>Message : ${input.needs}</p>` : ''}`,
        ),
      );
    }

    return NextResponse.json({ ok: true, request: serializePlanRequest(created), tiers: TIERS, paymentMethods: PAYMENT_METHODS }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Formulaire incomplet ou invalide.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Envoi de la demande impossible.' }, { status: 400 });
  }
}
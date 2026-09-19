import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePlatformSuperAdmin } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/prisma';
import { writeAudit } from '../../../../../lib/audit';
import { serializePlanRequest } from '../../../../../lib/plan-requests';

type Params = { params: { id: string } };

const messageInclude = {
  orderBy: { createdAt: 'asc' as const },
  include: { author: { select: { firstName: true, lastName: true } } },
};

const patchSchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'APPROVED', 'REJECTED']),
});

/** GET /api/platform/plan-requests/[id] — dossier complet (super-admin). */
export async function GET(request: Request, { params }: Params) {
  const auth = await requirePlatformSuperAdmin();
  if (auth.error) return auth.error;

  const planRequest = await prisma.planRequest.findUnique({
    where: { id: params.id },
    include: {
      organization: { select: { id: true, name: true, slug: true } },
      messages: messageInclude,
    },
  });
  if (!planRequest) return NextResponse.json({ error: 'Demande introuvable.' }, { status: 404 });

  return NextResponse.json({ request: serializePlanRequest(planRequest, { withOrganization: true }) });
}

/**
 * PATCH /api/platform/plan-requests/[id] — change le statut du dossier
 * (en traitement / approuvée / refusée). La livraison d'une clé se fait via
 * POST .../deliver ou .../messages avec `licenseKey`.
 */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await requirePlatformSuperAdmin();
  if (auth.error) return auth.error;

  try {
    const input = patchSchema.parse(await request.json());
    const existing = await prisma.planRequest.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: 'Demande introuvable.' }, { status: 404 });

    const decided = input.status === 'APPROVED' || input.status === 'REJECTED';
    const updated = await prisma.planRequest.update({
      where: { id: existing.id },
      data: { status: input.status, decidedAt: decided ? new Date() : null },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        messages: messageInclude,
      },
    });

    await writeAudit(auth.ctx.user.id, 'STATUT_DEMANDE_ABONNEMENT', 'PlanRequest', existing.id, {
      from: existing.status,
      to: input.status,
    });

    return NextResponse.json({ ok: true, request: serializePlanRequest(updated, { withOrganization: true }) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Statut invalide.' }, { status: 400 });
    return NextResponse.json({ error: 'Mise à jour impossible.' }, { status: 400 });
  }
}
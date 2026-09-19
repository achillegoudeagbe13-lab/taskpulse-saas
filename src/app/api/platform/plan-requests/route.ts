import { NextResponse } from 'next/server';
import { requirePlatformSuperAdmin } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { TIERS } from '../../../../lib/billing';
import { PAYMENT_METHODS, serializePlanRequest, isOpenPlanRequest } from '../../../../lib/plan-requests';

const messageInclude = {
  orderBy: { createdAt: 'asc' as const },
  include: { author: { select: { firstName: true, lastName: true } } },
};

const VALID_STATUSES = ['PENDING', 'PROCESSING', 'APPROVED', 'REJECTED'];

/**
 * GET /api/platform/plan-requests — file d'attente des demandes
 * d'abonnement de toutes les organisations (super-admin plateforme).
 * Filtre optionnel : ?status=PENDING|PROCESSING|APPROVED|REJECTED
 */
export async function GET(request: Request) {
  const auth = await requirePlatformSuperAdmin();
  if (auth.error) return auth.error;

  const status = new URL(request.url).searchParams.get('status');
  const where = status && VALID_STATUSES.includes(status) ? { status: status as never } : {};

  const requests = await prisma.planRequest.findMany({
    where,
    include: {
      organization: { select: { id: true, name: true, slug: true } },
      messages: messageInclude,
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 200,
  });

  const views = requests.map((request) => serializePlanRequest(request, { withOrganization: true }));
  const openCount = views.filter((view) => isOpenPlanRequest(view.status)).length;

  return NextResponse.json({ requests: views, openCount, tiers: TIERS, paymentMethods: PAYMENT_METHODS });
}
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrgAdmin } from '../../../../../../lib/auth';
import { prisma } from '../../../../../../lib/prisma';
import { writeAudit } from '../../../../../../lib/audit';
import { serializePlanRequest } from '../../../../../../lib/plan-requests';

type Params = { params: { id: string } };

const messageInclude = {
  orderBy: { createdAt: 'asc' as const },
  include: { author: { select: { firstName: true, lastName: true } } },
};

const schema = z.object({ body: z.string().trim().min(1).max(2000) });

/**
 * POST /api/org/plan-requests/[id]/messages — l'administrateur de
 * l'organisation répond dans la conversation de suivi. Une réponse à une
 * demande refusée la remet en traitement (réouverture du dossier).
 */
export async function POST(request: Request, { params }: Params) {
  const auth = await requireOrgAdmin();
  if (auth.error) return auth.error;

  try {
    const input = schema.parse(await request.json());

    const existing = await prisma.planRequest.findFirst({
      where: { id: params.id, organizationId: auth.ctx.organizationId },
    });
    if (!existing) return NextResponse.json({ error: 'Demande introuvable.' }, { status: 404 });

    await prisma.supportMessage.create({
      data: { requestId: existing.id, authorId: auth.ctx.user.id, isSuperAdmin: false, body: input.body },
    });

    if (existing.status !== 'PROCESSING' && existing.status !== 'APPROVED') {
      await prisma.planRequest.update({ where: { id: existing.id }, data: { status: 'PROCESSING', decidedAt: null } });
    }

    const refreshed = await prisma.planRequest.findUniqueOrThrow({
      where: { id: existing.id },
      include: { messages: messageInclude },
    });

    await writeAudit(auth.ctx.user.id, 'MESSAGE_ABONNEMENT', 'PlanRequest', existing.id, { from: 'ORGANIZATION' });

    return NextResponse.json({ ok: true, request: serializePlanRequest(refreshed) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Message vide ou trop long.' }, { status: 400 });
    return NextResponse.json({ error: 'Envoi du message impossible.' }, { status: 400 });
  }
}
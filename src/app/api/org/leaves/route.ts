import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrgMember, requireOrgAdmin } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';

const leaveSchema = z.object({
  type: z.string().min(1).max(32).default('CONGE'),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().max(500).optional(),
});

/**
 * GET — liste des demandes de congé.
 * Admin : toute l'organisation. Membre : uniquement les siennes.
 */
export async function GET(request: Request) {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;

  const isAdmin = auth.ctx.orgRole === 'ORGANIZATION_ADMIN';
  const where: { organizationId: string; userId?: string } = { organizationId: auth.ctx.organizationId };
  if (!isAdmin) where.userId = auth.ctx.user.id;

  const leaves = await prisma.leaveRequest.findMany({
    where,
    select: {
      id: true, type: true, startDate: true, endDate: true, reason: true, status: true,
      user: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ leaves, isAdmin });
}

/** POST — création d'une demande de congé par un employé. */
export async function POST(request: Request) {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;
  try {
    const input = leaveSchema.parse(await request.json());
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    if (end < start) return NextResponse.json({ error: 'La date de fin est antérieure à la date de début.' }, { status: 400 });
    if (start > end) return NextResponse.json({ error: 'Dates invalides.' }, { status: 400 });

    // Garde-fou : pas de doublon sur une période déjà couverte par une demande en cours (envoyée ou approuvée).
    const overlap = await prisma.leaveRequest.findFirst({
      where: {
        userId: auth.ctx.user.id,
        status: { in: ['PENDING', 'APPROVED'] },
        startDate: { lte: end },
        endDate: { gte: start },
      },
      select: { id: true },
    });
    if (overlap) {
      return NextResponse.json(
        { error: 'Vous avez déjà une demande (envoyée ou approuvée) qui chevauche cette période.' },
        { status: 409 },
      );
    }

    const created = await prisma.leaveRequest.create({
      data: {
        userId: auth.ctx.user.id, organizationId: auth.ctx.organizationId,
        type: input.type, startDate: start, endDate: end, reason: input.reason,
      },
      select: { id: true, type: true, startDate: true, endDate: true, status: true },
    });
    // Notification aux administrateurs de l'organisation (sauf l'auteur s'il est admin).
    const admins = await prisma.membership.findMany({
      where: { organizationId: auth.ctx.organizationId, role: 'ORGANIZATION_ADMIN' },
      select: { userId: true },
    });
    const requesterName = `${[auth.ctx.user.firstName, auth.ctx.user.lastName].filter(Boolean).join(' ')}`.trim();
    const typeLabel = input.type === 'RTT' ? 'RTT' : input.type === 'MALADIE' ? 'maladie' : input.type === 'PERMISSION' ? 'permission' : input.type === 'ABSENCE' ? 'absence' : 'congé';
    for (const admin of admins) {
      if (admin.userId === auth.ctx.user.id) continue;
      prisma.notification.create({
        data: {
          user: { connect: { id: admin.userId } },
          organization: { connect: { id: auth.ctx.organizationId } },
          title: `Nouvelle demande de ${typeLabel}`,
          content: `${requesterName || 'Un employé'} a déposé une demande de ${typeLabel} du ${start.toLocaleDateString('fr-FR')} au ${end.toLocaleDateString('fr-FR')}.`,
        },
      }).catch(() => {});
    }
    return NextResponse.json({ leave: created, message: "Demande envoyée aux administrateurs." }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Données de demande invalides.' }, { status: 400 });
  }
}
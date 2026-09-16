import { NextResponse } from 'next/server';
import { requireOrgMember } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/prisma';
import { recordActivity } from '../../../../../lib/activity';

/** POST — arrêt du chronomètre courant (calcul de la durée écoulée). */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;

  const entry = await prisma.timeEntry.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true, organizationId: true, endedAt: true, startedAt: true, taskTitle: true, projectName: true },
  });
  if (!entry || entry.organizationId !== auth.ctx.organizationId || entry.userId !== auth.ctx.user.id) {
    return NextResponse.json({ error: 'Chrono introuvable.' }, { status: 404 });
  }
  if (entry.endedAt) return NextResponse.json({ error: 'Ce chrono est déjà arrêté.' }, { status: 409 });

  const endedAt = new Date();
  const minutes = Math.max(0, Math.round((endedAt.getTime() - entry.startedAt.getTime()) / 60000));
  const updated = await prisma.timeEntry.update({
    where: { id: entry.id },
    data: { endedAt },
    select: { id: true, startedAt: true, endedAt: true, taskTitle: true, projectName: true },
  });
  recordActivity({
    organizationId: auth.ctx.organizationId, actorId: auth.ctx.user.id,
    action: 'TIME_STOPPED', entityType: 'TimeEntry', entityId: entry.id,
    summary: `a arrêté un chrono de ${minutes} min sur « ${entry.taskTitle ?? 'une tâche'} »`,
    projectName: entry.projectName, metadata: { minutes },
  });
  return NextResponse.json({ entry: updated, minutes });
}

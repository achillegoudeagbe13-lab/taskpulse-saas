import { NextResponse } from 'next/server';
import { requireOrgMember } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';

/**
 * GET — fil d'activité de l'équipe (organisation active).
 * `since` (ISO) : uniquement les événements postérieurs (polling).
 * `project` : filtre par nom de projet.
 */
export async function GET(request: Request) {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const since = searchParams.get('since');
  const project = searchParams.get('project');

  const events = await prisma.activityEvent.findMany({
    where: {
      organizationId: auth.ctx.organizationId,
      ...(since ? { createdAt: { gt: new Date(since) } } : {}),
      ...(project ? { projectName: project } : {}),
    },
    select: {
      id: true, action: true, entityType: true, entityId: true, summary: true,
      projectName: true, createdAt: true,
      actor: { select: { id: true, firstName: true, lastName: true, photoUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: since ? 50 : 100,
  });

  return NextResponse.json({ events, serverTime: new Date().toISOString() });
}

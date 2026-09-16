import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrgMember } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { recordActivity } from '../../../lib/activity';

const docSchema = z.object({
  name: z.string().trim().min(1).max(160),
  url: z.string().trim().min(1).max(2000),
  kind: z.enum(['LINK', 'FILE']).default('LINK'),
  description: z.string().max(1000).optional(),
  projectName: z.string().max(120).optional(),
  taskId: z.string().optional(),
});

/** GET — livrables de l'organisation, filtrables par projet. */
export async function GET(request: Request) {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const project = searchParams.get('project');

  const documents = await prisma.projectDocument.findMany({
    where: {
      organizationId: auth.ctx.organizationId,
      ...(project ? { projectName: project } : {}),
    },
    select: {
      id: true, name: true, url: true, kind: true, description: true,
      projectName: true, taskId: true, createdAt: true,
      task: { select: { title: true } },
      uploadedBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ documents });
}

/** POST — partage d'un livrable (lien ou fichier via URL). */
export async function POST(request: Request) {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;
  try {
    const input = docSchema.parse(await request.json());

    let taskId: string | undefined;
    if (input.taskId) {
      const task = await prisma.task.findUnique({ where: { id: input.taskId }, select: { id: true, organizationId: true } });
      if (!task || task.organizationId !== auth.ctx.organizationId) {
        return NextResponse.json({ error: 'Tâche introuvable.' }, { status: 404 });
      }
      taskId = task.id;
    }

    const document = await prisma.projectDocument.create({
      data: {
        name: input.name, url: input.url, kind: input.kind,
        description: input.description, projectName: input.projectName, taskId,
        uploadedById: auth.ctx.user.id, organizationId: auth.ctx.organizationId,
      },
      select: { id: true, name: true, kind: true },
    });
    recordActivity({
      organizationId: auth.ctx.organizationId, actorId: auth.ctx.user.id,
      action: 'DOCUMENT_ADDED', entityType: 'ProjectDocument', entityId: document.id,
      summary: `a partagé le livrable « ${document.name} »`, projectName: input.projectName,
    });
    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof z.ZodError ? error.issues[0]?.message : 'Données invalides.' },
      { status: 400 },
    );
  }
}

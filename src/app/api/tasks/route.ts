import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isMemberOf, requireOrgAdmin, requireOrgMember } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const taskSchema = z.object({ title: z.string().trim().min(1).max(160), description: z.string().max(4000).optional(), assigneeId: z.string().optional(), dueDate: z.string().optional(), priority: z.enum(['BASSE', 'MOYENNE', 'HAUTE']).default('MOYENNE'), status: z.enum(['TERMINE', 'EN_COURS', 'BLOQUE', 'EN_ATTENTE']).default('EN_ATTENTE'), progress: z.coerce.number().int().min(0).max(100).default(0) });

export async function GET() {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;
  // Isolation : seules les tâches de l'organisation active. Un membre voit ses tâches + les tâches ouvertes.
  const scope = auth.ctx.orgRole === 'ORGANIZATION_ADMIN' ? {} : { OR: [{ assigneeId: auth.ctx.user.id }, { assigneeId: null }] };
  const tasks = await prisma.task.findMany({
    where: { organizationId: auth.ctx.organizationId, ...scope },
    include: { assignee: { select: { id: true, firstName: true, lastName: true, username: true } }, creator: { select: { id: true, firstName: true, lastName: true } }, comments: { include: { author: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ tasks });
}

export async function POST(request: Request) {
  const auth = await requireOrgAdmin();
  if (auth.error) return auth.error;
  try {
    const input = taskSchema.parse(await request.json());
    // Assignation optionnelle, restreinte aux membres ACTIFS de la même organisation.
    let assignee = null;
    const targetId = input.assigneeId?.trim();
    if (targetId) {
      if (!(await isMemberOf(targetId, auth.ctx.organizationId))) return NextResponse.json({ error: 'Utilisateur assigné introuvable.' }, { status: 404 });
      assignee = await prisma.user.findUnique({ where: { id: targetId } });
    }
    const progress = input.status === 'TERMINE' ? 100 : input.progress;
    const task = await prisma.task.create({ data: { title: input.title, description: input.description, assigneeId: assignee?.id ?? null, creatorId: auth.ctx.user.id, organizationId: auth.ctx.organizationId, dueDate: input.dueDate ? new Date(input.dueDate) : null, priority: input.priority, status: input.status, progress } });
    if (assignee) await prisma.notification.create({ data: { userId: assignee.id, organizationId: auth.ctx.organizationId, title: 'Nouvelle tâche', content: `La tâche « ${task.title} » vous a été attribuée.` } });
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof z.ZodError ? error.issues[0]?.message : 'Impossible de créer la tâche.' }, { status: 400 }); }
}

export async function PATCH(request: Request) {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;
  try {
    const input = z.object({ id: z.string(), action: z.enum(['CLAIM']).optional(), status: z.enum(['TERMINE', 'EN_COURS', 'BLOQUE', 'EN_ATTENTE']).optional(), progress: z.coerce.number().int().min(0).max(100).optional(), comment: z.string().max(2000).optional() }).parse(await request.json());
    const existing = await prisma.task.findUnique({ where: { id: input.id } });
    // Anti-énumération inter-organisations.
    if (!existing || existing.organizationId !== auth.ctx.organizationId) return NextResponse.json({ error: 'Tâche introuvable.' }, { status: 404 });

    // Prise en charge d'une tâche ouverte par un membre de l'équipe.
    if (input.action === 'CLAIM') {
      if (auth.ctx.orgRole === 'ORGANIZATION_ADMIN') return NextResponse.json({ error: 'Les tâches ouvertes sont prises en charge par les membres de l’équipe.' }, { status: 403 });
      if (existing.assigneeId) return NextResponse.json({ error: 'Cette tâche est déjà prise en charge.' }, { status: 409 });
      const task = await prisma.task.update({ where: { id: input.id }, data: { assigneeId: auth.ctx.user.id, status: existing.status === 'EN_ATTENTE' ? 'EN_COURS' : existing.status } });
      if (existing.creatorId !== auth.ctx.user.id && (await isMemberOf(existing.creatorId, auth.ctx.organizationId))) {
        await prisma.notification.create({ data: { userId: existing.creatorId, organizationId: auth.ctx.organizationId, title: 'Tâche prise en charge', content: `${auth.ctx.user.firstName} ${auth.ctx.user.lastName} a commencé la tâche « ${existing.title} ».` } });
      }
      return NextResponse.json({ task });
    }

    if (auth.ctx.orgRole !== 'ORGANIZATION_ADMIN' && existing.assigneeId !== auth.ctx.user.id) return NextResponse.json({ error: 'Tâche inaccessible.' }, { status: 403 });
    const status = input.status ?? existing.status;
    const task = await prisma.task.update({ where: { id: input.id }, data: { status, progress: status === 'TERMINE' ? 100 : input.progress ?? existing.progress, comments: input.comment ? { create: { content: input.comment, authorId: auth.ctx.user.id } } : undefined } });
    if (existing.assigneeId && existing.assigneeId !== auth.ctx.user.id) await prisma.notification.create({ data: { userId: existing.assigneeId, organizationId: auth.ctx.organizationId, title: 'Tâche modifiée', content: `La tâche « ${existing.title} » a été mise à jour.` } });
    return NextResponse.json({ task });
  } catch { return NextResponse.json({ error: 'Mise à jour invalide.' }, { status: 400 }); }
}
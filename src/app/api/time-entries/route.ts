import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrgMember } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { recordActivity } from '../../../lib/activity';
import { enforcePlanActive } from '../../../lib/plan-guard';

const entrySchema = z
  .object({
    mode: z.enum(['TIMER', 'MANUAL']).default('TIMER'),
    taskId: z.string().optional(),
    minutes: z.coerce.number().int().min(1).max(24 * 60).optional(),
    note: z.string().max(500).optional(),
  })
  .refine((v) => v.mode !== 'MANUAL' || (v.minutes != null && v.minutes > 0), {
    message: 'La durée manuelle (minutes) est requise.',
  });

/**
 * GET — entrées de temps de l'organisation (toutes pour l'admin, personnelles
 * sinon) + agrégats par tâche et par projet. `running=1` : uniquement l'entrée
 * en cours (chronomètre non arrêté) de l'utilisateur courant.
 */
export async function GET(request: Request) {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const isAdmin = auth.ctx.orgRole === 'ORGANIZATION_ADMIN';
  const userScope = isAdmin ? {} : { userId: auth.ctx.user.id };
  const running = searchParams.get('running') === '1';

  if (running) {
    const entry = await prisma.timeEntry.findFirst({
      where: { organizationId: auth.ctx.organizationId, userId: auth.ctx.user.id, endedAt: null, mode: 'TIMER' },
      select: { id: true, startedAt: true, taskId: true, taskTitle: true, projectName: true },
    });
    return NextResponse.json({ running: entry });
  }

  const entries = await prisma.timeEntry.findMany({
    where: { organizationId: auth.ctx.organizationId, ...userScope },
    select: {
      id: true, mode: true, taskId: true, taskTitle: true, projectName: true,
      startedAt: true, endedAt: true, minutes: true, note: true,
      user: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { startedAt: 'desc' },
    take: 200,
  });


  // Agrégats : minutes totales par tâche et par projet (les chronos en cours
  // sont comptés au prorata du temps déjà écoulé).
  const now = Date.now();
  const byTask = new Map<string, { key: string; label: string; minutes: number }>();
  const byProject = new Map<string, { key: string; label: string; minutes: number }>();
  for (const e of entries) {
    const mins = e.endedAt
      ? Math.round(((e.endedAt.getTime() - e.startedAt.getTime()) / 60000) || e.minutes || 0)
      : e.minutes ?? Math.round((now - e.startedAt.getTime()) / 60000);
    if (e.taskId) {
      const cur = byTask.get(e.taskId) ?? { key: e.taskId, label: e.taskTitle ?? 'Tâche', minutes: 0 };
      cur.minutes += mins;
      byTask.set(e.taskId, cur);
    }
    if (e.projectName) {
      const cur = byProject.get(e.projectName) ?? { key: e.projectName, label: e.projectName, minutes: 0 };
      cur.minutes += mins;
      byProject.set(e.projectName, cur);
    }
  }

  return NextResponse.json({
    entries,
    totals: {
      byTask: [...byTask.values()].sort((a, b) => b.minutes - a.minutes),
      byProject: [...byProject.values()].sort((a, b) => b.minutes - a.minutes),
    },
  });
}

/** POST — démarrage d'un chronomètre (TIMER) ou saisie manuelle (MANUAL). */
export async function POST(request: Request) {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;
  const planLock = await enforcePlanActive(auth.ctx);
  if (planLock) return planLock;
  try {
    const input = entrySchema.parse(await request.json());

    let taskId: string | undefined;
    let taskTitle: string | undefined;
    let projectName: string | undefined;
    if (input.taskId) {
      const task = await prisma.task.findUnique({ where: { id: input.taskId }, select: { id: true, title: true, project: true, organizationId: true } });
      if (!task || task.organizationId !== auth.ctx.organizationId) {
        return NextResponse.json({ error: 'Tâche introuvable.' }, { status: 404 });
      }
      taskId = task.id;
      taskTitle = task.title;
      projectName = task.project ?? undefined;
    }

    if (input.mode === 'TIMER') {
      // Un seul chrono actif à la fois : on stoppe proprement l'existant.
      const running = await prisma.timeEntry.findFirst({
        where: { userId: auth.ctx.user.id, endedAt: null, mode: 'TIMER' },
        select: { id: true },
      });
      if (running) await prisma.timeEntry.update({ where: { id: running.id }, data: { endedAt: new Date() } });

      const created = await prisma.timeEntry.create({
        data: {
          mode: 'TIMER', taskId, taskTitle, projectName,
          userId: auth.ctx.user.id, organizationId: auth.ctx.organizationId,
          startedAt: new Date(), note: input.note,
        },
        select: { id: true, startedAt: true, taskTitle: true, projectName: true },
      });
      recordActivity({
        organizationId: auth.ctx.organizationId, actorId: auth.ctx.user.id,
        action: 'TIME_STARTED', entityType: 'TimeEntry', entityId: created.id,
        summary: `a démarré un chrono sur « ${taskTitle ?? 'une tâche'} »`, projectName,
      });
      return NextResponse.json({ entry: created }, { status: 201 });
    }

    const created = await prisma.timeEntry.create({
      data: {
        mode: 'MANUAL', taskId, taskTitle, projectName,
        userId: auth.ctx.user.id, organizationId: auth.ctx.organizationId,
        startedAt: new Date(), endedAt: new Date(), minutes: input.minutes, note: input.note,
      },
      select: { id: true, minutes: true, taskTitle: true, projectName: true },
    });
    recordActivity({
      organizationId: auth.ctx.organizationId, actorId: auth.ctx.user.id,
      action: 'TIME_LOGGED', entityType: 'TimeEntry', entityId: created.id,
      summary: `a enregistré ${input.minutes} min sur « ${taskTitle ?? 'une tâche'} »`, projectName,
    });
    return NextResponse.json({ entry: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof z.ZodError ? error.issues[0]?.message : 'Données invalides.' },
      { status: 400 },
    );
  }
}

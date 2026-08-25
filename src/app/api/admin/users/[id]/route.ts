import { NextResponse } from 'next/server';
import { requireOrgAdmin } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/prisma';

/**
 * GET — Historique de travail d'un membre de l'organisation active :
 * pointages (arrivée/départ), tâches assignées et activités publiées.
 *
 * 🔒 CONFIDENTIALITÉ STRICTE : la messagerie privée n'est JAMAIS exposée ici,
 * ni le contenu détaillé des messages échangés.
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireOrgAdmin();
  if (auth.error) return auth.error;

  const userId = params.id;
  const membership = await prisma.membership.findFirst({
    where: { userId, organizationId: auth.ctx.organizationId },
    include: { user: { include: { department: true, profile: true } } },
  });
  // Le membre doit appartenir à L'ORGANISATION ACTIVE de l'admin.
  if (!membership) return NextResponse.json({ error: 'Ce membre n’appartient pas à votre organisation.' }, { status: 404 });

  const since = new Date();
  since.setDate(since.getDate() - 60);

  const [taskGroups, tasksRecent, activitiesCount, activitiesRecent, journalEntries, attendances] = await Promise.all([
    prisma.task.groupBy({ by: ['status'], where: { organizationId: auth.ctx.organizationId, assigneeId: userId }, _count: { _all: true } }),
    prisma.task.findMany({
      where: { organizationId: auth.ctx.organizationId, assigneeId: userId },
      orderBy: { createdAt: 'desc' }, take: 10,
      select: { id: true, title: true, status: true, priority: true, dueDate: true, progress: true, createdAt: true },
    }),
    prisma.activity.count({ where: { organizationId: auth.ctx.organizationId, userId } }),
    prisma.activity.findMany({
      where: { organizationId: auth.ctx.organizationId, userId },
      orderBy: { createdAt: 'desc' }, take: 10,
      select: { id: true, title: true, status: true, createdAt: true },
    }),
    prisma.journalEntry.count({ where: { organizationId: auth.ctx.organizationId, journal: { userId } } }),
    prisma.attendance.findMany({
      where: { userId, clockIn: { gte: since } },
      orderBy: { clockIn: 'desc' }, take: 30,
      select: { id: true, clockIn: true, clockOut: true },
    }),
  ]);

  const taskOf = (status: string) => taskGroups.find((g) => g.status === status)?._count._all ?? 0;
  const totalTasks = taskOf('EN_ATTENTE') + taskOf('EN_COURS') + taskOf('BLOQUE') + taskOf('TERMINE');

  return NextResponse.json({
    member: {
      id: membership.user.id,
      firstName: membership.user.firstName,
      lastName: membership.user.lastName,
      username: membership.user.username,
      role: membership.role,
      status: membership.user.status,
      department: membership.user.department?.name ?? '',
      position: membership.user.profile?.position ?? '',
      joinedAt: membership.createdAt.toISOString(),
      lastLoginAt: membership.user.lastLoginAt?.toISOString() ?? null,
    },
    work: {
      tasks: {
        total: totalTasks,
        termine: taskOf('TERMINE'),
        enCours: taskOf('EN_COURS'),
        bloque: taskOf('BLOQUE'),
        enAttente: taskOf('EN_ATTENTE'),
        recent: tasksRecent.map((task) => ({ ...task, createdAt: task.createdAt.toISOString(), dueDate: task.dueDate?.toISOString() ?? null })),
      },
      activities: {
        count: activitiesCount,
        recent: activitiesRecent.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
      },
      journalEntries,
      attendance: {
        last30days: attendances.length,
        records: attendances.map((record) => ({
          id: record.id,
          clockIn: record.clockIn.toISOString(),
          clockOut: record.clockOut?.toISOString() ?? null,
        })),
      },
    },
    privacy: 'Messagerie privée exclue de la supervision.',
  });
}
import { NextResponse } from 'next/server';
import { requireOrgMember } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';

export async function GET() {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;
  const orgId = auth.ctx.organizationId;
  const isAdmin = auth.ctx.orgRole === 'ORGANIZATION_ADMIN';

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const taskScope = isAdmin ? {} : { OR: [{ assigneeId: auth.ctx.user.id }, { assigneeId: null }] };
  const activityScope = isAdmin ? {} : { userId: auth.ctx.user.id };

  // Début de semaine (lundi) pour le cumul des heures de pointage.
  const weekStart = new Date(today);
  const day = (weekStart.getDay() + 6) % 7; // 0 = lundi
  weekStart.setDate(weekStart.getDate() - day);
  // Début du mois pour les tâches terminées « du mois ».
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  // Stats agrégées au niveau organisation (utiles à l'admin).
  const employeesCount = isAdmin
    ? prisma.membership.count({ where: { organizationId: orgId, role: 'EMPLOYEE', user: { status: 'ACTIF' } } })
    : Promise.resolve(0);
  const internsCount = isAdmin
    ? prisma.membership.count({ where: { organizationId: orgId, role: 'INTERN', user: { status: 'ACTIF' } } })
    : Promise.resolve(0);
  const presentCount = isAdmin
    ? prisma.attendance.count({ where: { organizationId: orgId, clockIn: { gte: today } } })
    : Promise.resolve(0);
  const blockedTasks = isAdmin
    ? prisma.task.count({ where: { organizationId: orgId, status: 'BLOQUE' } })
    : Promise.resolve(0);

  const [openTasks, completedMonth, attendances, recentActivities, notifications, latestAnnouncement, upcomingTasks, weekTasks, unreadNotifications, byDayTasks, byDayActivities, employees, interns, present, blocked] = await Promise.all([
    // Tâches en cours (non terminées) dans le périmètre de l'utilisateur.
    prisma.task.count({ where: { organizationId: orgId, status: { not: 'TERMINE' }, ...taskScope } }),
    // Tâches terminées du mois.
    prisma.task.count({ where: { organizationId: orgId, status: 'TERMINE', updatedAt: { gte: monthStart }, ...taskScope } }),
    // Pointages de la semaine (durées calculées depuis clockIn/clockOut).
    prisma.attendance.findMany({ where: { organizationId: orgId, userId: auth.ctx.user.id, clockIn: { gte: weekStart } }, select: { clockIn: true, clockOut: true } }),
    prisma.activity.findMany({ where: { organizationId: orgId, ...activityScope }, include: { user: { select: { firstName: true, lastName: true, photoUrl: true } } }, orderBy: { createdAt: 'desc' }, take: 6 }),
    prisma.notification.findMany({ where: { userId: auth.ctx.user.id }, orderBy: { createdAt: 'desc' }, take: 5 }),
    prisma.announcement.findFirst({ where: { organizationId: orgId }, include: { author: { select: { firstName: true, lastName: true, photoUrl: true } } }, orderBy: { createdAt: 'desc' } }),
    // Échéances à venir : tâches non terminées avec une échéance future proche.
    prisma.task.findMany({ where: { organizationId: orgId, status: { not: 'TERMINE' }, dueDate: { gte: today }, ...taskScope }, orderBy: { dueDate: 'asc' }, take: 5, select: { id: true, title: true, dueDate: true } }),
    prisma.task.findMany({ where: { organizationId: orgId, ...taskScope }, orderBy: { updatedAt: 'desc' }, take: 6, select: { id: true, title: true, status: true, priority: true } }),
    prisma.notification.count({ where: { userId: auth.ctx.user.id, readAt: null } }),
    // Répartition des 7 derniers jours (tâches créées / activités) pour le mini-graphique.
    prisma.task.findMany({ where: { organizationId: orgId, createdAt: { gte: weekStart }, ...taskScope }, select: { createdAt: true } }),
    prisma.activity.findMany({ where: { organizationId: orgId, createdAt: { gte: weekStart }, ...activityScope }, select: { createdAt: true } }),
    // Stats agrégées organisation (admin only).
    employeesCount,
    internsCount,
    presentCount,
    blockedTasks,
  ]);

  // Construction du mini-graphique par jour (7 derniers jours).
  const dayLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const byDay = dayLabels.map((label, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i);
    const next = new Date(d); next.setDate(d.getDate() + 1);
    const inDay = (arr: { createdAt: Date }[]) => arr.filter((x) => x.createdAt >= d && x.createdAt < next).length;
    return { label, tasks: inDay(byDayTasks), activities: inDay(byDayActivities) };
  });

  // Heures travaillées cette semaine (somme des durées clockIn → clockOut).
  const weeklyHours = Math.round((attendances.reduce((total, attendance) => {
    if (!attendance.clockOut) return total;
    const minutes = Math.round((attendance.clockOut.getTime() - attendance.clockIn.getTime()) / 60000);
    return total + (minutes > 0 ? minutes : 0);
  }, 0) / 60) * 10) / 10;

  return NextResponse.json({
    recentActivities,
    latestAnnouncement,
    notifications,
    weekTasks,
    upcomingTasks,
    unreadNotifications,
    byDay,
    stats: {
      totalTasks: openTasks,          // Tâches en cours (non terminées)
      completedTasks: completedMonth, // Tâches terminées du mois
      hours: weeklyHours,             // Heures pointées cette semaine
      totalActivities: recentActivities.length,
      ...(isAdmin ? {
        employees,          // EMPLOYÉ·E·S actifs
        interns,            // STAGIAIRE·S actifs
        present,            // Présents aujourd'hui
        blocked,            // Tâches bloquées
      } : {}),
    },
  });
}

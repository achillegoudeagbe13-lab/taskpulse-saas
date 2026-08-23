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

  const [tasks, activitiesToday, attendance, notifications, employees, interns, present, activities, blocked, latestAnnouncement, recentActivities, weekTasks] = await Promise.all([
    prisma.task.findMany({ where: { organizationId: orgId, ...taskScope }, include: { assignee: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' }, take: 6 }),
    prisma.activity.count({ where: { organizationId: orgId, userId: auth.ctx.user.id, createdAt: { gte: today } } }),
    prisma.attendance.findFirst({ where: { userId: auth.ctx.user.id, clockIn: { gte: today } }, orderBy: { clockIn: 'desc' } }),
    prisma.notification.findMany({ where: { userId: auth.ctx.user.id }, orderBy: { createdAt: 'desc' }, take: 5 }),
    prisma.membership.count({ where: { organizationId: orgId, role: 'EMPLOYEE', user: { status: 'ACTIF' } } }),
    prisma.membership.count({ where: { organizationId: orgId, role: 'INTERN', user: { status: 'ACTIF' } } }),
    prisma.attendance.count({ where: { organizationId: orgId, clockIn: { gte: today } } }),
    prisma.activity.count({ where: { organizationId: orgId, createdAt: { gte: today } } }),
    prisma.task.count({ where: { organizationId: orgId, status: 'BLOQUE' } }),
    prisma.announcement.findFirst({ where: { organizationId: orgId }, include: { author: { select: { firstName: true, lastName: true, photoUrl: true } } }, orderBy: { createdAt: 'desc' } }),
    prisma.activity.findMany({ where: { organizationId: orgId, ...activityScope }, include: { user: { select: { firstName: true, lastName: true, photoUrl: true } } }, orderBy: { createdAt: 'desc' }, take: 6 }),
    prisma.task.findMany({ where: { organizationId: orgId, ...taskScope }, orderBy: { updatedAt: 'desc' }, take: 6 }),
  ]);

  return NextResponse.json({
    tasks,
    recentActivities,
    latestAnnouncement,
    weekTasks,
    activitiesToday,
    attendance,
    notifications,
    stats: { employees, interns, present, activities, blocked, tasks: tasks.length },
  });
}
import { NextResponse } from 'next/server';
import { requireOrgAdmin } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';

function range(value: string | null) {
  const end = new Date();
  const start = new Date(end);
  if (value === 'today') start.setHours(0, 0, 0, 0);
  else if (value === 'week') { start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0); }
  else { start.setDate(1); start.setHours(0, 0, 0, 0); }
  return { gte: start, lte: end };
}

export async function GET(request: Request) {
  const auth = await requireOrgAdmin();
  if (auth.error) return auth.error;
  const orgId = auth.ctx.organizationId;
  const params = new URL(request.url).searchParams;
  const createdAt = range(params.get('period'));
  const departmentId = params.get('departmentId') || undefined;
  const userId = params.get('userId') || undefined;
  // Toutes les métriques sont confinées à l'organisation active.
  const taskWhere = { organizationId: orgId, createdAt, ...(userId ? { assigneeId: userId } : {}), ...(departmentId ? { departmentId } : {}) };
  const activityWhere = { organizationId: orgId, createdAt, ...(userId ? { userId } : {}) };
  const attendanceWhere = { organizationId: orgId, clockIn: createdAt, ...(userId ? { userId } : {}) };
  const [tasks, activities, attendances, members] = await Promise.all([
    prisma.task.findMany({ where: taskWhere, select: { status: true, progress: true, createdAt: true, updatedAt: true } }),
    prisma.activity.findMany({ where: activityWhere, select: { status: true, createdAt: true } }),
    prisma.attendance.findMany({ where: attendanceWhere, select: { clockIn: true, clockOut: true, userId: true } }),
    prisma.membership.findMany({ where: { organizationId: orgId, user: { status: 'ACTIF' } }, select: { id: true, userId: true } }),
  ]);
  const hours = attendances.reduce((sum, item) => sum + (item.clockOut ? item.clockOut.getTime() - item.clockIn.getTime() : 0), 0) / 3600000;
  const byDay = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - (6 - index)); return { label: date.toLocaleDateString('fr-FR', { weekday: 'short' }), tasks: tasks.filter((item) => item.createdAt.toDateString() === date.toDateString()).length, activities: activities.filter((item) => item.createdAt.toDateString() === date.toDateString()).length }; });
  const stats = { totalTasks: tasks.length, completedTasks: tasks.filter((item) => item.status === 'TERMINE').length, blockedTasks: tasks.filter((item) => item.status === 'BLOQUE').length, totalActivities: activities.length, hours: Math.round(hours * 10) / 10, attendance: attendances.length, absent: Math.max(0, members.length - new Set(attendances.map((item) => item.userId)).size) };
  if (params.get('format') === 'csv') { const rows = [['Indicateur', 'Valeur'], ...Object.entries(stats).map(([key, value]) => [key, String(value)])]; return new Response(rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(';')).join('\n'), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="taskpulse-rapport.csv"' } }); }
  return NextResponse.json({ stats, byDay });
}
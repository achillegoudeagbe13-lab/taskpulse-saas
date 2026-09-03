import { NextResponse } from 'next/server';
import { requireOrgMember } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';

type CalendarEvent = {
  id: string;
  type: 'task' | 'meeting' | 'leave';
  title: string;
  description?: string;
  startAt: string;
  endAt?: string | null;
  color: string;
  allDay: boolean;
  userId?: string | null;
  user?: { name?: string; email?: string };
  meta?: Record<string, unknown>;
};

/** Événements unifiés de l'organisation (tâches, réunions, congés). */
export async function GET(request: Request) {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const start = new Date(searchParams.get('start') ?? '');
  const end = new Date(searchParams.get('end') ?? '');
  const startGte = !isNaN(start.getTime()) ? start : undefined;
  const endLt = !isNaN(end.getTime()) ? end : undefined;

  const events: CalendarEvent[] = [];

  // a) Tâches — deadlines (exclut celles déjà terminées du code couleur principal, mais les garde).
  const taskWhere: any = { organizationId: auth.ctx.organizationId };
  const taskSelect = { id: true, title: true, dueDate: true, status: true, priority: true, assignee: { select: { firstName: true, lastName: true } } };
  const tasks = await prisma.task.findMany({ where: taskWhere, select: taskSelect });
  for (const t of tasks) {
    if (!t.dueDate) continue;
    const d = t.dueDate;
    if (startGte && d < startGte) continue;
    if (endLt && d >= endLt) continue;
    const color = t.status === 'TERMINE' ? '#22c55e' : t.priority === 'HAUTE' ? '#ef4444' : t.priority === 'BASSE' ? '#3b82f6' : '#f59e0b';
    events.push({
      id: `task_${t.id}`, type: 'task', title: t.title,
      startAt: d.toISOString(), color, allDay: true,
      user: { name: t.assignee ? `${t.assignee.firstName ?? ''} ${t.assignee.lastName ?? ''}`.trim() : undefined },
      meta: { status: t.status, priority: t.priority },
    });
  }

  // b) Réunions d'équipe.
  const meetingWhere: any = { organizationId: auth.ctx.organizationId };
  if (startGte) meetingWhere.startAt = { gte: startGte };
  if (endLt) meetingWhere.OR = [{ startAt: { lt: endLt } }, { endAt: { gt: startGte ?? new Date(0) } }];
  const meetings = await prisma.meeting.findMany({ where: meetingWhere, select: { id: true, title: true, description: true, startAt: true, endAt: true }, take: 300 });
  for (const m of meetings) {
    const inRange = (!startGte || m.endAt > startGte) && (!endLt || m.startAt < endLt);
    if (!inRange) continue;
    events.push({ id: `meeting_${m.id}`, type: 'meeting', title: m.title, description: m.description ?? undefined, startAt: m.startAt.toISOString(), endAt: m.endAt.toISOString(), color: '#8b5cf6', allDay: false });
  }

  // c) Congés / absences approuvée.
  const leaveWhere: any = { organizationId: auth.ctx.organizationId, status: 'APPROVED' };
  if (startGte) leaveWhere.endDate = { gte: startGte };
  if (endLt) leaveWhere.startDate = { lt: endLt };
  const leaves = await prisma.leaveRequest.findMany({
    where: leaveWhere,
    select: { id: true, type: true, startDate: true, endDate: true, user: { select: { firstName: true, lastName: true } } },
    take: 300,
  });
  for (const l of leaves) {
    events.push({
      id: `leave_${l.id}`, type: 'leave', title: `${l.type === 'RTT' ? 'RTT' : l.type === 'MALADIE' ? 'Maladie' : 'Congé'} — ${[l.user.firstName, l.user.lastName].filter(Boolean).join(' ')}`,
      startAt: l.startDate.toISOString(), endAt: l.endDate.toISOString(), color: '#f97316', allDay: true,
      user: { name: [l.user.firstName, l.user.lastName].filter(Boolean).join(' ') },
      meta: { leaveType: l.type },
    });
  }

    events.sort((a, b) => (a.startAt < b.startAt ? -1 : 1));
  const memberRows = await prisma.membership.findMany({
    where: { organizationId: auth.ctx.organizationId, user: { status: 'ACTIF' } },
    select: { user: { select: { id: true, firstName: true, lastName: true } } },
  });
    const members = memberRows.map((m) => ({ id: m.user.id, name: `${m.user.firstName ?? ''} ${m.user.lastName ?? ''}`.trim() })).sort((a, b) => (a.name > b.name ? 1 : -1));
  return NextResponse.json({ events, members, organizationId: auth.ctx.organizationId });
}
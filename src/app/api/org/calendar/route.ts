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

  // a) Tâches — deadlines (filtre la période directement en base).
  const taskWhere: any = { organizationId: auth.ctx.organizationId };
  if (startGte || endLt) {
    const due: any = {};
    if (startGte) due.gte = startGte;
    if (endLt) due.lt = endLt;
    taskWhere.dueDate = due;
  }
  const taskSelect = { id: true, title: true, dueDate: true, status: true, priority: true, assignee: { select: { firstName: true, lastName: true } } };
  const tasks = await prisma.task.findMany({ where: taskWhere, select: taskSelect });
  for (const t of tasks) {
    if (!t.dueDate) continue;
    const d = t.dueDate;
    const color = t.status === 'TERMINE' ? '#22c55e' : t.priority === 'HAUTE' ? '#ef4444' : t.priority === 'BASSE' ? '#3b82f6' : '#f59e0b';
    events.push({
      id: `task_${t.id}`, type: 'task', title: t.title,
      startAt: d.toISOString(), color, allDay: true,
      user: { name: t.assignee ? `${t.assignee.firstName ?? ''} ${t.assignee.lastName ?? ''}`.trim() : undefined },
      meta: { status: t.status, priority: t.priority },
    });
  }

  // b) Réunions d'équipe (intersection temporelle correcte en base).
  const meetingWhere: any = { organizationId: auth.ctx.organizationId };
  const meetingOverlap: any[] = [];
  if (endLt) meetingOverlap.push({ startAt: { lt: endLt } });
  if (startGte) meetingOverlap.push({ endAt: { gt: startGte } });
  if (meetingOverlap.length > 0) meetingWhere.AND = meetingOverlap;
  const meetings = await prisma.meeting.findMany({
    where: meetingWhere,
    select: { id: true, title: true, description: true, startAt: true, endAt: true, createdById: true, createdBy: { select: { firstName: true, lastName: true } } },
    take: 1000,
  });
  for (const m of meetings) {
    const inRange = (!startGte || m.endAt > startGte) && (!endLt || m.startAt < endLt);
    if (!inRange) continue;
    const creatorName = [m.createdBy.firstName, m.createdBy.lastName].filter(Boolean).join(' ');
    events.push({
      id: `meeting_${m.id}`, type: 'meeting', title: m.title, description: m.description ?? undefined,
      startAt: m.startAt.toISOString(), endAt: m.endAt.toISOString(), color: '#8b5cf6', allDay: false,
      userId: m.createdById,
      user: creatorName ? { name: creatorName } : undefined,
    });
  }

  // c) Congés / absences approuvées ou en attente — étalés sur toutes leurs journées (1 entrée par jour).
  const leaveWhere: any = { organizationId: auth.ctx.organizationId, status: { in: ['APPROVED', 'PENDING'] } };
  if (startGte) leaveWhere.endDate = { gte: startGte };
  if (endLt) leaveWhere.startDate = { lt: endLt };
  const leaves = await prisma.leaveRequest.findMany({
    where: leaveWhere,
    select: { id: true, type: true, status: true, userId: true, reason: true, startDate: true, endDate: true, user: { select: { firstName: true, lastName: true } } },
    take: 1000,
  });
  const MAX_SPAN_DAYS = 180; // protection anti dépassement d'une demande
  const MAX_LEAVE_EVENTS = 2000; // protection anti débordement global
  let pushedLeaves = 0;
  for (const l of leaves) {
    const typeLabel = l.type === 'RTT' ? 'RTT' : l.type === 'MALADIE' ? 'Maladie' : l.type === 'PERMISSION' ? 'Permission' : l.type === 'ABSENCE' ? 'Absence' : 'Congé';
    const startKey = l.startDate.toISOString().slice(0, 10);
    const endKey = l.endDate.toISOString().slice(0, 10);
    if (endKey < startKey) continue;
    const [sy, sm, sd] = startKey.split('-').map(Number);
    const [ey, em, ed] = endKey.split('-').map(Number);
    const first = new Date(Date.UTC(sy, sm - 1, sd, 12, 0, 0)); // midi UTC → aucun basculement de jour
    const last = new Date(Date.UTC(ey, em - 1, ed, 12, 0, 0));
    const span = Math.min(MAX_SPAN_DAYS, Math.round((last.getTime() - first.getTime()) / 86400000) + 1);
    for (let i = 0; i < span; i++) {
      const day = new Date(first.getTime() + i * 86400000);
      if (startGte && day < startGte) continue;
      if (endLt && day >= endLt) continue;
      events.push({
        id: `leave_${l.id}_${i}`, type: 'leave', title: `${typeLabel} — ${[l.user.firstName, l.user.lastName].filter(Boolean).join(' ')}`,
        startAt: day.toISOString(), endAt: day.toISOString(), color: '#f97316', allDay: true,
        userId: l.userId,
        user: { name: [l.user.firstName, l.user.lastName].filter(Boolean).join(' ') },
        meta: { leaveType: l.type, status: l.status, reason: l.reason, leaveId: l.id },
      });
      if (++pushedLeaves >= MAX_LEAVE_EVENTS) break;
    }
    if (pushedLeaves >= MAX_LEAVE_EVENTS) break;
  }

  events.sort((a, b) => (a.startAt < b.startAt ? -1 : a.startAt > b.startAt ? 1 : 0));
  const memberRows = await prisma.membership.findMany({
    where: { organizationId: auth.ctx.organizationId, user: { status: 'ACTIF' } },
    select: { user: { select: { id: true, firstName: true, lastName: true } } },
  });
  const members = memberRows.map((m) => ({ id: m.user.id, name: `${m.user.firstName ?? ''} ${m.user.lastName ?? ''}`.trim() })).sort((a, b) => (a.name > b.name ? 1 : -1));
  return NextResponse.json({ events, members, organizationId: auth.ctx.organizationId });
}
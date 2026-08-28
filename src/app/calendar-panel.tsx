'use client';

import { useEffect, useMemo, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Filter, Plus } from './ui-icons';
import LeaveModal from './leave-modal';
import MeetingModal from './meeting-modal';

type CalEvent = { id: string; type: 'task' | 'meeting' | 'leave'; title: string; startAt: string; endAt?: string | null; color: string; allDay: boolean; user?: { name?: string }; };
type Member = { id: string; name: string };
type Mode = 'month' | 'week' | 'day';
const TYPE_COLORS: Record<CalEvent['type'], string> = { task: '#3b82f6', meeting: '#8b5cf6', leave: '#f97316' };
const TYPE_LABELS: Record<CalEvent['type'], string> = { task: 'Tâches / deadlines', meeting: 'Réunions', leave: 'Congés & absences' };

function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function sameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function startOfWeek(d: Date) { const s = new Date(d); s.setDate(s.getDate() - s.getDay()); s.setHours(0, 0, 0, 0); return s; }

export default function CalendarPanel({ user }: { user: any }) {
  const [mode, setMode] = useState<Mode>('month');
  const [current, setCurrent] = useState(new Date());
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [types, setTypes] = useState<Record<CalEvent['type'], boolean>>({ task: true, meeting: true, leave: true });
  const [memberId, setMemberId] = useState<string | 'all'>('all');
  const isAdmin = user?.role === 'ORGANIZATION_ADMIN';

  useEffect(() => {
    let cancelled = false;
    const from = addDays(current, -90); const to = addDays(current, 90);
    fetch(`/api/org/calendar?start=${from.toISOString()}&end=${to.toISOString()}`)
      .then((r) => r.json())
      .then((json) => { if (!cancelled) { setEvents(json.events ?? []); setMembers(json.members ?? []); } })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [current.getMonth(), current.getFullYear()]);

  const days = useMemo(() => {
    if (mode === 'month') { const s = new Date(current.getFullYear(), current.getMonth(), 1); const start = new Date(s.getFullYear(), s.getMonth(), 1 - s.getDay()); return Array.from({ length: 42 }, (_, i) => addDays(start, i)); }
    if (mode === 'week') return Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(current), i));
    return [current];
  }, [mode, current]);

  const visible = useMemo(() => days.map((day) => {
    const inTypes = (Object.keys(types) as CalEvent['type'][]).filter((k) => types[k]);
    const memberName = memberId === 'all' ? null : members.find((m) => m.id === memberId)?.name ?? null;
    return {
      day,
      items: events.filter((e) => inTypes.includes(e.type) && sameDay(new Date(e.startAt), day) && (memberId === 'all' || (memberName && e.user?.name === memberName))).sort((a, b) => (a.startAt < b.startAt ? -1 : 1)),
    };
  }), [days, events, types, memberId, members]);

  if (loading) return <div className="loading-state"><span className="spinner" /> Chargement du calendrier…</div>;

  return (
    <div className="section-page">
      <div className="page-heading"><div><p className="eyebrow">ORGANISATION · PLANIFICATION</p><h1>Calendrier</h1><p className="muted">Tâches, réunions et absences de votre équipe, fusionnées en un agenda.</p></div><CalendarIcon size={28} className="panel-icon" /></div>
      <div className="calendar-toolbar">
        <div className="calendar-modes">{(['month', 'week', 'day'] as Mode[]).map((m) => <button key={m} className={'mode-button' + (mode === m ? ' active' : '')} onClick={() => setMode(m)}>{m === 'month' ? 'Mois' : m === 'week' ? 'Semaine' : 'Jour'}</button>)}</div>
        <div className="calendar-nav"><button className="icon-button" onClick={() => setCurrent(addDays(current, mode === 'month' ? -30 : mode === 'week' ? -7 : -1))}><ChevronLeft size={18} /></button><span className="calendar-title">{mode === 'month' ? current.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : mode === 'week' ? `Sem. du ${startOfWeek(current).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` : current.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span><button className="icon-button" onClick={() => setCurrent(addDays(current, mode === 'month' ? 30 : mode === 'week' ? 7 : 1))}><ChevronRight size={18} /></button></div>
        <div className="calendar-actions"><button className="icon-button" onClick={() => setFilterOpen(!filterOpen)} title="Filtrer"><Filter size={18} /></button></div>
      </div>
      {filterOpen && (
        <div className="calendar-filters">
          <div className="filter-group"><span>Type d’événement</span>{(['task', 'meeting', 'leave'] as CalEvent['type'][]).map((t) => <label key={t}><input type="checkbox" checked={types[t]} onChange={(e) => setTypes({ ...types, [t]: e.target.checked })} /> {TYPE_LABELS[t]}</label>)}</div>
          <div className="filter-group"><span>Membre</span><select value={memberId} onChange={(e) => setMemberId(e.target.value as any)}><option value="all">Toute l’équipe</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
        </div>
      )}
      <section className="calendar-grid">{mode === 'month' && <div className="weekday">{['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d) => <span key={d}>{d}</span>)}</div>}
        {visible.map(({ day, items }) => (
          <div key={day.toISOString()} className={'calendar-day-cell' + (sameDay(day, new Date()) ? ' today' : '')}>
            <span className="calendar-day-num">{day.getDate()}</span>
            {items.length > 0 && (
              <div className="calendar-items">
                {items.slice(0, mode === 'month' ? 3 : 10).map((e) => (
                  <div key={e.id} className={'calendar-event ev-' + e.type} style={{ borderLeftColor: e.color }} title={`${TYPE_LABELS[e.type]} · ${e.title}${e.user?.name ? ' — ' + e.user.name : ''}`}>
                    {!e.allDay && <span className="ev-time">{new Date(e.startAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>}
                    <span className="ev-title">{e.title}</span>
                    {e.user?.name && mode !== 'month' && <span className="ev-user">{e.user.name}</span>}
                  </div>
                ))}
                {mode === 'month' && items.length > 3 && <span className="ev-more">+{items.length - 3} autre(s)</span>}
              </div>
            )}
          </div>
        ))}
      </section>
      <div className="calendar-legend">{(['task', 'meeting', 'leave'] as CalEvent['type'][]).map((t) => <span key={t}><span className="legend-dot" style={{ background: TYPE_COLORS[t] }} />{TYPE_LABELS[t]}</span>)}</div>
    </div>
  );
}

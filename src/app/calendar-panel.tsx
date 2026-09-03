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

/**
 * Sécurité du rendu React (évite l'erreur #130 « Objects are not valid as a React child ») :
 * convertit n'importe quelle valeur en chaîne, même si elle est null, undefined ou un objet brut.
 */
function safeStr(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return isNaN(value.getTime()) ? fallback : value.toISOString();
  if (Array.isArray(value)) return value.map((v) => safeStr(v)).filter(Boolean).join(', ');
  try { return String(value); } catch { return fallback; }
}

/** Construit une Date valide depuis n'importe quelle entrée, ou null si invalide. */
function safeDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  try {
    const parsed = new Date(typeof value === 'string' || typeof value === 'number' ? (value as string | number) : String(value));
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch { return null; }
}

/** Heure locale 'HH:MM' sûre : renvoie '' si la date est absente/invalide. */
function safeTime(value: unknown): string {
  const date = safeDate(value);
  if (!date) return '';
  try { return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}

/** Date locale sûre : renvoie le fallback si la date est absente/invalide. */
function safeDateLabel(value: unknown, fallback = ''): string {
  const date = safeDate(value);
  if (!date) return fallback;
  try { return date.toLocaleDateString('fr-FR'); } catch { return fallback; }
}

/** Normalise un évènement venu de l'API : garantit des chaînes et des dates exploitables. */
function normalizeEvent(raw: any): CalEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const type = safeStr(raw.type) as CalEvent['type'];
  if (!(['task', 'meeting', 'leave'] as CalEvent['type'][]).includes(type)) return null;
  const start = safeDate(raw.startAt);
  if (!start) return null; // date de début absente/invalide → on ignore plutôt que de planter le rendu
  const userName = raw.user && typeof raw.user === 'object' ? safeStr((raw.user as { name?: unknown }).name) : '';
  const normalized: CalEvent = {
    id: safeStr(raw.id),
    type,
    title: safeStr(raw.title, 'Événement'),
    startAt: start.toISOString(),
    endAt: safeDate(raw.endAt)?.toISOString() ?? null,
    color: safeStr(raw.color, '#3b82f6'),
    allDay: raw.allDay === true,
    user: userName ? { name: userName } : undefined,
  };
  return normalized;
}

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
      .then((json) => {
        if (cancelled) return;
        const rawEvents = Array.isArray(json?.events) ? json.events : [];
        const rawMembers = Array.isArray(json?.members) ? json.members : [];
        setEvents(rawEvents.map((raw: any) => normalizeEvent(raw)).filter((e: CalEvent | null): e is CalEvent => e !== null));
        setMembers(rawMembers.map((m: any) => ({ id: safeStr(m?.id), name: safeStr(m?.name, 'Membre') })).filter((m: { id: string; name: string }) => m.id !== ''));
      })
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
      items: events.filter((e) => {
        const start = safeDate(e.startAt);
        if (!start) return false;
        return inTypes.includes(e.type) && sameDay(start, day) && (memberId === 'all' || (memberName && e.user?.name === memberName));
      }).sort((a, b) => (safeStr(a.startAt) < safeStr(b.startAt) ? -1 : 1)),
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
          <button type="button" className="calendar-filters-close" onClick={() => setFilterOpen(false)} aria-label="Fermer les filtres" title="Fermer">×</button>
          <div className="filter-group"><span>Type d’événement</span>{(['task', 'meeting', 'leave'] as CalEvent['type'][]).map((t) => <label key={t}><input type="checkbox" checked={types[t] ?? true} onChange={(event) => setTypes({ ...types, [t]: event.target.checked })} /> {TYPE_LABELS[t]}</label>)}</div>
          <div className="filter-group"><span>Membre</span><select value={memberId} onChange={(event) => setMemberId(event.target.value as any)}><option value="all">Toute l’équipe</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
        </div>
      )}
      {!loading && events.length === 0 && (
        <div className="empty-state calendar-empty"><CalendarIcon size={22} /><h3>Aucun événement sur la période</h3><p className="muted">Les tâches, réunions et congés à venir apparaîtront ici.</p></div>
      )}
      <section className="calendar-grid">{mode === 'month' && <div className="weekday">{['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d) => <span key={d}>{d}</span>)}</div>}
        {visible.map(({ day, items }) => (
          <div key={day.toISOString()} className={'calendar-day-cell' + (sameDay(day, new Date()) ? ' today' : '')}>
            <span className="calendar-day-num">{day.getDate()}</span>
            {items.length > 0 && (
              <div className="calendar-items">
                {items.slice(0, mode === 'month' ? 3 : 10).map((e) => (
                  <div key={safeStr(e.id) || safeStr(e.startAt)} className={'calendar-event ev-' + safeStr(e.type)} style={{ borderLeftColor: safeStr(e.color, '#3b82f6') }} title={`${TYPE_LABELS[e.type] ?? 'Événement'} · ${safeStr(e.title)}${e.user?.name ? ' — ' + e.user.name : ''}`}>
                    {!e.allDay && <span className="ev-time">{safeTime(e.startAt)}</span>}
                    <span className="ev-title">{safeStr(e.title)}</span>
                    {e.user?.name && mode !== 'month' && <span className="ev-user">{safeStr(e.user.name)}</span>}
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

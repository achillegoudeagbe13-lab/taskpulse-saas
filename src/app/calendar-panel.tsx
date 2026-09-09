'use client';

import { useEffect, useMemo, useState } from 'react';
import { Calendar as CalendarIcon, CalendarDays, ChevronLeft, ChevronRight, Filter, Plus, Users, X, Zap } from './ui-icons';
import LeaveModal from './leave-modal';
import MeetingModal from './meeting-modal';

type CalEvent = { id: string; type: 'task' | 'meeting' | 'leave'; title: string; startAt: string; endAt?: string | null; color: string; allDay: boolean; status?: string; description?: string | null; userId?: string | null; leaveId?: string | null; leaveReason?: string | null; user?: { name?: string }; };
type Member = { id: string; name: string };
type Mode = 'month' | 'week' | 'day';
/** Demande de congé telle que renvoyée par GET /api/org/leaves (admin : toute l'org). */
type LeaveRequestItem = {
  id: string; type: string; status: string; startDate: string; endDate: string; reason?: string | null;
  user?: { firstName?: string | null; lastName?: string | null } | null;
};
const TYPE_COLORS: Record<CalEvent['type'], string> = { task: '#3b82f6', meeting: '#8b5cf6', leave: '#f97316' };
const TYPE_LABELS: Record<CalEvent['type'], string> = { task: 'Tâches / deadlines', meeting: 'Réunions', leave: 'Congés, absences & permissions' };

function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
/** Navigue par mois calendaire (positionne au 1er du mois cible). */
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function sameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function startOfWeek(d: Date) { const s = new Date(d); s.setDate(s.getDate() - s.getDay()); s.setHours(0, 0, 0, 0); return s; }

/** Clé locale 'YYYY-MM-DD' d'une date (évite les pièges de fuseau horaire). */
function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
}
/** L'API renvoie les "journées entières" à minuit UTC : on compare la partie date de la chaîne ISO, pas le timestamp local. */
function eventDayKey(e: CalEvent): string {
  return e.startAt.slice(0, 10);
}

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

/** Libellé français des types de demandes (ABSENCE, CONGE, PERMISSION, RTT, MALADIE…). */
const LEAVE_LABELS: Record<string, string> = { ABSENCE: 'Absence', CONGE: 'Congé', PERMISSION: 'Permission', RTT: 'RTT', MALADIE: 'Maladie' };
function leaveLabel(type: string): string { return LEAVE_LABELS[type] ?? type; }
/** Libellé français du statut d'une demande. */
function statusLabel(status: string): string {
  return status === 'APPROVED' ? 'Approuvée' : status === 'REJECTED' ? 'Rejetée' : status === 'PENDING' ? 'En attente' : status;
}
/** Date au format attendu par <input type="date"> (YYYY-MM-DD, locale). */
function toDateInput(d: Date): string { return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`; }

/** Normalise un évènement venu de l'API : garantit des chaînes et des dates exploitables. */
function normalizeEvent(raw: any): CalEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const type = safeStr(raw.type) as CalEvent['type'];
  if (!(['task', 'meeting', 'leave'] as CalEvent['type'][]).includes(type)) return null;
  const start = safeDate(raw.startAt);
  if (!start) return null; // date de début absente/invalide → on ignore plutôt que de planter le rendu
  const userName = raw.user && typeof raw.user === 'object' ? safeStr((raw.user as { name?: unknown }).name) : '';
  const metaRaw = raw.meta && typeof raw.meta === 'object' ? raw.meta as Record<string, unknown> : {};
  const normalized: CalEvent = {
    id: safeStr(raw.id),
    type,
    title: safeStr(raw.title, 'Événement'),
    startAt: start.toISOString(),
    endAt: safeDate(raw.endAt)?.toISOString() ?? null,
    color: safeStr(raw.color, '#3b82f6'),
    allDay: raw.allDay === true,
    status: safeStr(metaRaw.status),
    description: typeof raw.description === 'string' && raw.description ? raw.description : null,
    userId: typeof raw.userId === 'string' && raw.userId ? raw.userId : null,
    leaveId: typeof metaRaw.leaveId === 'string' && metaRaw.leaveId ? metaRaw.leaveId : null,
    leaveReason: typeof metaRaw.reason === 'string' && metaRaw.reason ? metaRaw.reason : null,
    user: userName ? { name: userName } : undefined,
  };
  return normalized;
}

export default function CalendarPanel({ user, orgRole }: { user: any; orgRole?: string | null }) {
  const [mode, setMode] = useState<Mode>('month');
  const [current, setCurrent] = useState(new Date());
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [types, setTypes] = useState<Record<CalEvent['type'], boolean>>({ task: true, meeting: true, leave: true });
  const [memberId, setMemberId] = useState<string | 'all'>('all');
  // Rôle d'organisation (Membership.role) fourni par AppLayout — le champ user.role est l'ancien rôle global.
  const isAdmin = orgRole === 'ORGANIZATION_ADMIN' || user?.role === 'ORGANIZATION_ADMIN';
  const [refreshKey, setRefreshKey] = useState(0);
  const [menuDate, setMenuDate] = useState<Date | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveType, setLeaveType] = useState('CONGE');
  const [leaveDefault, setLeaveDefault] = useState('');
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [meetingDefault, setMeetingDefault] = useState('');
  // Validation admin des demandes.
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestItem[]>([]);
  const [leavesLoading, setLeavesLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
  // Détail d'un événement (cliqué dans la grille).
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);
  const [detailError, setDetailError] = useState('');
  // Panneau admin : onglet demandes en attente / historique.
  const [leaveTab, setLeaveTab] = useState<'pending' | 'history'>('pending');
  const currentUserId = safeStr(user?.id);

  function openLeave(type: string, date?: Date | null) {
    setLeaveType(type);
    setLeaveDefault(date ? localDayKey(date) : '');
    setMenuDate(null);
    setLeaveOpen(true);
  }

  function openMeeting(date?: Date | null) {
    setMeetingDefault(date ? toDateInput(date) : '');
    setMenuDate(null);
    setMeetingOpen(true);
  }

  /** Navigation : mois calendaire en vue Mois, 7 jours en Semaine, 1 jour en Jour. */
  function navTo(delta: number) {
    if (mode === 'month') setCurrent(addMonths(current, delta));
    else if (mode === 'week') setCurrent(addDays(startOfWeek(current), 7 * delta));
    else setCurrent(addDays(current, delta));
  }

  /** Admin : approuve / rejette une demande → rechargé le calendrier. */
  async function decideLeave(id: string, status: string) {
    setAdminError(''); setDetailError('');
    try {
      const res = await fetch(`/api/org/leaves/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      const json = await res.json();
      if (!res.ok) { const msg = json.error ?? 'Erreur inconnue.'; setAdminError(msg); setDetailError(msg); return; }
      setSelectedEvent(null);
      setRefreshKey(refreshKey + 1);
    } catch { const msg = 'Impossible de mettre à jour la demande.'; setAdminError(msg); setDetailError(msg); }
  }

  /** Employé : annule sa propre demande encore en attente (suppression côté serveur). */
  async function cancelLeave(leaveId: string) {
    if (!leaveId) return;
    setAdminError('');
    try {
      const res = await fetch(`/api/org/leaves/${leaveId}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setAdminError(json?.error ?? "Impossible d'annuler la demande."); return; }
      setSelectedEvent(null);
      setRefreshKey(refreshKey + 1);
    } catch { setAdminError("Impossible d'annuler la demande."); }
  }

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
  }, [current.getMonth(), current.getFullYear(), refreshKey]);

  // Liste des demandes : admin → toute l'organisation ; employé → uniquement les siennes (géré côté API).
  useEffect(() => {
    let cancelled = false;
    setLeavesLoading(true);
    fetch('/api/org/leaves')
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (Array.isArray(json?.leaves)) setLeaveRequests(json.leaves);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLeavesLoading(false); });
    return () => { cancelled = true; };
  }, [refreshKey]);

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
        if (!inTypes.includes(e.type)) return false;
        const onDay = e.allDay
          ? eventDayKey(e) === localDayKey(day) // jour entier : comparaison par clé date (indépendante du fuseau horaire)
          : (() => { const s = safeDate(e.startAt); return s ? sameDay(s, day) : false; })();
        if (!onDay) return false;
        return memberId === 'all' || (memberName && e.user?.name === memberName);
      }).sort((a, b) => { if (a.startAt < b.startAt) return -1; if (a.startAt > b.startAt) return 1; return 0; }),
    };
  }), [days, events, types, memberId, members]);

  if (loading) return <div className="loading-state"><span className="spinner" /> Chargement du calendrier…</div>;

  return (
    <div className="section-page">
      <div className="page-heading"><div><p className="eyebrow">ORGANISATION · PLANIFICATION</p><h1>Calendrier</h1><p className="muted">Tâches, réunions et absences de votre équipe, fusionnées en un agenda.</p></div><CalendarIcon size={28} className="panel-icon" /></div>
      <div className="calendar-toolbar">
        <div className="calendar-modes">{(['month', 'week', 'day'] as Mode[]).map((m) => <button key={m} className={'mode-button' + (mode === m ? ' active' : '')} onClick={() => setMode(m)}>{m === 'month' ? 'Mois' : m === 'week' ? 'Semaine' : 'Jour'}</button>)}</div>
        <div className="calendar-nav"><button className="icon-button" onClick={() => navTo(-1)} aria-label="Précédent" title="Précédent"><ChevronLeft size={18} /></button><span className="calendar-title">{mode === 'month' ? current.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : mode === 'week' ? `Sem. du ${startOfWeek(current).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` : current.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span><button className="icon-button" onClick={() => navTo(1)} aria-label="Suivant" title="Suivant"><ChevronRight size={18} /></button><button className="icon-button" onClick={() => setCurrent(new Date())} title="Aujourd'hui"><CalendarDays size={16} /></button></div>
        <div className="calendar-actions">
          <button type="button" className="outline-button" onClick={() => openLeave('CONGE', new Date())}><Plus size={15} /> Absence / Congé</button>
          {isAdmin && <button type="button" className="primary-button" onClick={() => openMeeting(new Date())}><Plus size={15} /> Réunion</button>}
          <button type="button" className="icon-button" onClick={() => setFilterOpen(!filterOpen)} title="Filtrer"><Filter size={18} /></button>
        </div>
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
      <section className={`calendar-grid calendar-view-${mode}`}>{mode === 'month' && <div className="weekday">{['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d) => <span key={d}>{d}</span>)}</div>}
        {visible.map(({ day, items }) => (
          <div key={day.toISOString()} className={'calendar-day-cell' + (sameDay(day, new Date()) ? ' today' : '')} onClick={() => setMenuDate(day)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMenuDate(day); } }} title={`Ajouter un événement le ${localDayKey(day)}`}>
            <span className="calendar-day-num">{day.getDate()}</span>
            <button type="button" className="calendar-add-btn" aria-label={`Ajouter un événement le ${localDayKey(day)}`} onClick={(e) => { e.stopPropagation(); setMenuDate(day); }}>+</button>
            {items.length > 0 && (
              <div className="calendar-items">
                {items.slice(0, mode === 'month' ? 3 : 10).map((e) => (
                  <div key={safeStr(e.id) || safeStr(e.startAt)} className={'calendar-event ev-' + safeStr(e.type)} style={{ borderLeftColor: safeStr(e.color, '#3b82f6') }} title={`${TYPE_LABELS[e.type] ?? 'Événement'} · ${safeStr(e.title)}${e.user?.name ? ' — ' + e.user.name : ''}`} onClick={(event) => { event.stopPropagation(); setDetailError(''); setSelectedEvent(e); }} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); setDetailError(''); setSelectedEvent(e); } }}>
                    {!e.allDay && <span className="ev-time">{safeTime(e.startAt)}</span>}
                    <span className="ev-title">{safeStr(e.title)}</span>
                    {e.user?.name && mode !== 'month' && <span className="ev-user">{safeStr(e.user.name)}</span>}
                    {e.type === 'leave' && e.status === 'APPROVED' && <span className="ev-approved">✓ approuvée</span>}
                    {e.status === 'PENDING' && <span className="ev-pending">En attente de validation</span>}
                  </div>
                ))}
                {mode === 'month' && items.length > 3 && <span className="ev-more">+{items.length - 3} autre(s)</span>}
              </div>
            )}
          </div>
        ))}
      </section>

      {isAdmin && (
        <section className="panel calendar-leaves-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">VALIDATIONS</p><h3>Demandes d’absence, congé &amp; permission</h3></div>
            {leavesLoading && <span className="spinner" />}
          </div>
          {adminError && <div className="notice error">{adminError}</div>}
          <div className="leave-tabs">
            <button type="button" className={'tab-button' + (leaveTab === 'pending' ? ' active' : '')} onClick={() => setLeaveTab('pending')}>En attente ({leaveRequests.filter((r) => r.status === 'PENDING').length})</button>
            <button type="button" className={'tab-button' + (leaveTab === 'history' ? ' active' : '')} onClick={() => setLeaveTab('history')}>Historique</button>
          </div>
          {(() => {
            const items = leaveTab === 'pending'
              ? leaveRequests.filter((r) => r.status === 'PENDING')
              : leaveRequests.filter((r) => r.status !== 'PENDING');
            if (items.length === 0) return <p className="muted">{leaveTab === 'pending' ? 'Aucune demande en attente de validation.' : 'Aucune demande traitée pour le moment.'}</p>;
            return (
              <ul className="leave-request-list">
                {items.map((r) => (
                  <li key={safeStr(r.id)} className="leave-request-item">
                    <div className="leave-request-info">
                      <strong>{[safeStr(r.user?.firstName), safeStr(r.user?.lastName)].filter(Boolean).join(' ') || 'Membre'}</strong>
                      <div><span className="table-badge">{leaveLabel(safeStr(r.type))}</span> <span className={`status-badge ${safeStr(r.status).toLowerCase()}`}>{statusLabel(r.status)}</span></div>
                      <small>{safeDateLabel(r.startDate)} → {safeDateLabel(r.endDate)}{r.reason ? ` · ${safeStr(r.reason)}` : ''}</small>
                    </div>
                    {leaveTab === 'pending' && (
                      <div className="leave-request-actions">
                        <button type="button" className="primary-button" onClick={() => decideLeave(r.id, 'APPROVED')}>Approuver</button>
                        <button type="button" className="outline-button danger" onClick={() => decideLeave(r.id, 'REJECTED')}>Rejeter</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            );
          })()}
        </section>
      )}

      {!isAdmin && (
        <section className="panel calendar-leaves-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">MES DEMANDES</p><h3>Absences, congés &amp; permissions</h3></div>
            {leavesLoading && <span className="spinner" />}
          </div>
          {adminError && <div className="notice error">{adminError}</div>}
          {(() => {
            const mine = leaveRequests.filter((r) => r.status === 'PENDING' || r.status === 'APPROVED' || r.status === 'REJECTED');
            if (mine.length === 0) return <p className="muted">Vous n’avez aucune demande pour le moment.</p>;
            return (
              <ul className="leave-request-list">
                {mine.map((r) => (
                  <li key={safeStr(r.id)} className="leave-request-item">
                    <div className="leave-request-info">
                      <strong>{leaveLabel(safeStr(r.type))}</strong>
                      <div><span className={`status-badge ${safeStr(r.status).toLowerCase()}`}>{statusLabel(r.status)}</span></div>
                      <small>{safeDateLabel(r.startDate)} → {safeDateLabel(r.endDate)}{r.reason ? ` · ${safeStr(r.reason)}` : ''}</small>
                    </div>
                    {r.status === 'PENDING' && (
                      <div className="leave-request-actions">
                        <button type="button" className="outline-button danger" onClick={() => cancelLeave(r.id)}>Annuler</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            );
          })()}
        </section>
      )}

      <div className="calendar-legend">{(['task', 'meeting', 'leave'] as CalEvent['type'][]).map((t) => <span key={t}><span className="legend-dot" style={{ background: TYPE_COLORS[t] }} />{TYPE_LABELS[t]}{t === 'leave' ? ' (✓ approuvée)' : ''}</span>)}{<span className="legend-hint">· cliquez sur un événement pour le détail</span>}</div>

      {menuDate && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setMenuDate(null)}>
          <div className="modal" style={{ maxWidth: 430 }}>
            <div className="modal-header"><h2>{menuDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h2><button type="button" className="icon-button" onClick={() => setMenuDate(null)}><X size={18} /></button></div>
            <div className="modal-body">
              <p className="muted">Que souhaitez-vous faire ce jour-là&nbsp;?</p>
              <div className="quick-actions">
                <button type="button" className="quick-action" onClick={() => openLeave('ABSENCE', menuDate)}><Users size={17} /><span><strong>Signaler une absence</strong><small>Je serai absent(e) ce jour-là</small></span></button>
                <button type="button" className="quick-action" onClick={() => openLeave('CONGE', menuDate)}><CalendarDays size={17} /><span><strong>Demander un congé</strong><small>Congé payé, RTT ou maladie</small></span></button>
                <button type="button" className="quick-action" onClick={() => openLeave('PERMISSION', menuDate)}><Zap size={17} /><span><strong>Demander une permission</strong><small>Permission / sortie autorisée</small></span></button>
                {isAdmin && (
                  <button type="button" className="quick-action" onClick={() => openMeeting(menuDate)}><Plus size={17} /><span><strong>Planifier une réunion</strong><small>Réserver un créneau (admin)</small></span></button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <LeaveModal open={leaveOpen} onClose={() => setLeaveOpen(false)} onCreated={() => setRefreshKey(refreshKey + 1)} initialType={leaveType} defaultDate={leaveDefault} />
      {isAdmin && <MeetingModal open={meetingOpen} onClose={() => setMeetingOpen(false)} onCreated={() => setRefreshKey(refreshKey + 1)} members={members} defaultDate={meetingDefault} />}

      {selectedEvent && (
        <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && setSelectedEvent(null)}>
          <div className="modal" style={{ maxWidth: 470 }}>
            <div className="modal-header">
              <h2>{TYPE_LABELS[selectedEvent.type] ?? 'Événement'}</h2>
              <button type="button" className="icon-button" onClick={() => setSelectedEvent(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {detailError && <div className="notice error">{detailError}</div>}
              <div className="calendar-detail-head">
                <span className="legend-dot" style={{ background: selectedEvent.color }} />
                <h3>{safeStr(selectedEvent.title)}</h3>
              </div>
              <p className="muted calendar-detail-meta">
                {selectedEvent.allDay
                  ? safeDateLabel(selectedEvent.startAt)
                  : `${safeDateLabel(selectedEvent.startAt)} · ${safeTime(selectedEvent.startAt)}`}
                {selectedEvent.endAt && selectedEvent.endAt.slice(0, 10) !== selectedEvent.startAt.slice(0, 10) && ` → ${safeDateLabel(selectedEvent.endAt)}`}
              </p>
              {selectedEvent.user?.name && <p className="muted">👤 {safeStr(selectedEvent.user.name)}</p>}
              {selectedEvent.type === 'leave' && selectedEvent.status && (
                <p className="calendar-detail-status"><span className={`status-badge ${selectedEvent.status === 'APPROVED' ? 'approved' : selectedEvent.status === 'REJECTED' ? 'rejected' : 'pending'}`}>{statusLabel(selectedEvent.status)}</span></p>
              )}
              {selectedEvent.leaveReason && <p className="muted"><strong>Motif :</strong> {safeStr(selectedEvent.leaveReason)}</p>}
              {selectedEvent.description && <p className="muted">{safeStr(selectedEvent.description)}</p>}
              <div className="calendar-detail-actions">
                {isAdmin && selectedEvent.type === 'leave' && selectedEvent.status === 'PENDING' && selectedEvent.leaveId && (
                  <>
                    <button type="button" className="primary-button" onClick={() => decideLeave(selectedEvent.leaveId as string, 'APPROVED')}>Approuver</button>
                    <button type="button" className="outline-button danger" onClick={() => decideLeave(selectedEvent.leaveId as string, 'REJECTED')}>Rejeter</button>
                  </>
                )}
                {selectedEvent.type === 'leave' && selectedEvent.status === 'PENDING' && selectedEvent.userId && selectedEvent.userId === currentUserId && (
                  <button type="button" className="secondary-button" onClick={() => cancelLeave(selectedEvent.leaveId as string)}>Annuler ma demande</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock3, PlayCircle, Plus, Trash2 } from './ui-icons';

type Entry = {
  id: string; mode: string; taskId: string | null; taskTitle: string | null; projectName: string | null;
  startedAt: string; endedAt: string | null; minutes: number | null; note: string | null;
  user: { id: string; firstName: string; lastName: string };
};
type Total = { key: string; label: string; minutes: number };
type Task = { id: string; title: string; project: string | null };

const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`);
const fmtDate = (d: string) => new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const hhmmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':');
};

/** Panneau de suivi du temps : chrono sur tâche, saisie manuelle, totaux par tâche/projet. */
export default function TimeTrackingPanel({ isAdmin }: { isAdmin: boolean }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [byTask, setByTask] = useState<Total[]>([]);
  const [byProject, setByProject] = useState<Total[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [running, setRunning] = useState<{ id: string; startedAt: string; taskTitle: string | null } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const taskRef = useRef<HTMLSelectElement>(null);
  const minutesRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const [listRes, runRes, tasksRes] = await Promise.all([
        fetch('/api/time-entries'),
        fetch('/api/time-entries?running=1'),
        fetch('/api/tasks'),
      ]);
      const list = await listRes.json();
      const run = await runRes.json();
      if (tasksRes.ok) setTasks((await tasksRes.json()).tasks ?? []);
      setEntries(list.entries ?? []);
      setByTask(list.totals?.byTask ?? []);
      setByProject(list.totals?.byProject ?? []);
      setRunning(run.running ?? null);
    } catch {
      setError('Chargement impossible.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Ticker local du chrono en cours.
  useEffect(() => {
    if (!running) { setElapsed(0); return; }
    const start = new Date(running.startedAt).getTime();
    const tick = () => setElapsed(Date.now() - start);
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [running]);

  const act = async (fn: () => Promise<Response>, ok: () => void) => {
    setError('');
    setBusy(true);
    try {
      const res = await fn();
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Erreur inattendue.');
      ok();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inattendue.');
    } finally {
      setBusy(false);
    }
  };

  const startTimer = () => act(
    () => fetch('/api/time-entries', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'TIMER', taskId: taskRef.current?.value || undefined }),
    }),
    load,
  );

  const stopTimer = () => {
    if (!running) return;
    act(() => fetch(`/api/time-entries/${running.id}/stop`, { method: 'POST' }), load);
  };

  const addManual = () => {
    const minutes = Number(minutesRef.current?.value ?? 0);
    if (!minutes || minutes <= 0) { setError('Indiquez une duree en minutes.'); return; }
    act(
      () => fetch('/api/time-entries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'MANUAL', minutes, taskId: taskRef.current?.value || undefined,
          note: noteRef.current?.value || undefined,
        }),
      }),
      () => {
        if (minutesRef.current) minutesRef.current.value = '';
        if (noteRef.current) noteRef.current.value = '';
        load();
      },
    );
  };

  const remove = (id: string) => act(() => fetch(`/api/time-entries/${id}`, { method: 'DELETE' }), load);

  const btnStyle = { padding: '0 16px', display: 'inline-flex', alignItems: 'center', gap: 6 } as const;

  return (
    <div>
      <div className="page-heading">
        <div>
          <p className="eyebrow">COLLABORATION</p>
          <h1>Suivi du temps</h1>
          <p className="muted">
            {'Chronométrez vos tâches ou saisissez du temps manuellement. Les totaux sont agrégés par tâche et par projet'}
            {isAdmin ? " pour toute l'équipe" : ''}.
          </p>
        </div>
      </div>

      {/* Chrono en cours */}
      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panel-heading"><h3>{running ? 'Chrono en cours' : 'Démarrer un chrono'}</h3></div>
        {running ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ font: '700 30px "Space Grotesk", monospace', color: 'var(--green)' }}>{hhmmss(elapsed)}</span>
            <span className="muted">— {running.taskTitle ?? 'Sans tâche'}</span>
            <button className="btn confirm" disabled={busy} onClick={stopTimer} style={btnStyle}>
              <Clock3 size={14} /> Arrêter
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <select ref={taskRef} defaultValue="" style={{ flex: '1 1 260px' }}>
              <option value="">— Sans tâche —</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>{t.title}{t.project ? ` · ${t.project}` : ''}</option>
              ))}
            </select>
            <button className="btn" disabled={busy} onClick={startTimer} style={btnStyle}>
              <PlayCircle size={14} /> Démarrer
            </button>
          </div>
        )}
      </section>

      {/* Saisie manuelle */}
      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panel-heading"><div><p className="eyebrow">SAISIE</p><h3>Ajouter du temps manuellement</h3></div></div>
        <form
          onSubmit={(e) => { e.preventDefault(); addManual(); }}
          style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}
        >
          <input ref={minutesRef} type="number" min={1} max={1440} placeholder="Durée (minutes)" style={{ width: 160 }} />
          <input ref={noteRef} type="text" placeholder="Note (optionnel)" style={{ flex: '1 1 200px' }} />
          <button type="submit" className="btn" disabled={busy} style={btnStyle}>
            <Plus size={14} /> Ajouter
          </button>
        </form>
        <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
          {'La tâche sélectionnée dans le bloc chrono est réutilisée pour la saisie manuelle.'}
        </p>
      </section>

      {/* Totaux */}
      <div className="admin-grid" style={{ marginTop: 18 }}>
        <section className="panel">
          <div className="panel-heading"><div><p className="eyebrow">PAR TÂCHE</p><h3>Temps total par tâche</h3></div></div>
          {byTask.length === 0 ? (
            <p className="muted">Aucun temps enregistré.</p>
          ) : (
            byTask.map((t) => (
              <div key={t.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{t.label}</span>
                <span className="muted" style={{ whiteSpace: 'nowrap' }}>{fmtMin(t.minutes)}</span>
              </div>
            ))
          )}
        </section>
        <section className="panel">
          <div className="panel-heading"><div><p className="eyebrow">PAR PROJET</p><h3>Temps total par projet</h3></div></div>
          {byProject.length === 0 ? (
            <p className="muted">Aucun temps enregistré.</p>
          ) : (
            byProject.map((t) => (
              <div key={t.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{t.label}</span>
                <span className="muted" style={{ whiteSpace: 'nowrap' }}>{fmtMin(t.minutes)}</span>
              </div>
            ))
          )}
        </section>
      </div>

      {/* Historique */}
      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panel-heading"><div><p className="eyebrow">HISTORIQUE</p><h3>Entrées récentes</h3></div></div>
        {entries.length === 0 ? (
          <p className="muted">Aucune entrée pour le moment.</p>
        ) : (
          entries.map((e) => {
            const mins = e.endedAt
              ? Math.round(((new Date(e.endedAt).getTime() - new Date(e.startedAt).getTime()) / 60000) || e.minutes || 0)
              : e.minutes ?? 0;
            return (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
                <Clock3 size={15} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {e.taskTitle ?? 'Sans tâche'}
                    {e.projectName ? <span className="muted"> · {e.projectName}</span> : null}
                  </div>
                  <div className="muted" style={{ fontSize: 11.5 }}>
                    {fmtDate(e.startedAt)}
                    {e.mode === 'MANUAL' ? ' · saisie manuelle' : ''}
                    {isAdmin ? ` · ${e.user.firstName} ${e.user.lastName}` : ''}
                    {e.note ? ` · ${e.note}` : ''}
                  </div>
                </div>
                <span style={{ fontWeight: 700, fontSize: 12.5, whiteSpace: 'nowrap' }}>{fmtMin(mins)}</span>
                <button className="nav-link" style={{ color: 'var(--red)', padding: 6 }} title="Supprimer" onClick={() => remove(e.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}

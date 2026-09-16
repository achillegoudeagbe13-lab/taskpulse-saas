'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, RefreshCw } from './ui-icons';

type Event = {
  id: string; action: string; entityType: string; summary: string; projectName: string | null; createdAt: string;
  actor: { id: string; firstName: string; lastName: string; photoUrl: string | null };
};

const ACTION_COLORS: Record<string, string> = {
  TASK_CREATED: 'var(--green)', TASK_UPDATED: 'var(--blue)', TIME_STARTED: 'var(--blue)',
  TIME_LOGGED: 'var(--blue)', TIME_STOPPED: 'var(--blue)', NOTE_CREATED: 'var(--orange)',
  NOTE_UPDATED: 'var(--orange)', DOCUMENT_ADDED: 'var(--green)',
};
const fmt = (d: string) =>
  new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Fil d'activité d'équipe : actions clés tracées automatiquement, rafraîchies en continu. */
export default function ActivityFeedPanel() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const lastFetch = useRef<string>(new Date(0).toISOString());

  const load = useCallback(async (reset = false) => {
    try {
      if (reset) lastFetch.current = new Date(0).toISOString();
      const res = await fetch(`/api/activity-feed?since=${encodeURIComponent(lastFetch.current)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Chargement impossible.');
      lastFetch.current = json.serverTime;
      setEvents((prev) => {
        const merged = reset ? (json.events ?? []) : [...(json.events ?? []), ...prev];
        // Déduplication + tri chronologique descendant.
        const seen = new Set<string>();
        return merged
          .filter((e: Event) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
          .sort((a: Event, b: Event) => (a.createdAt < b.createdAt ? 1 : -1))
          .slice(0, 100);
      });
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Chargement initial + polling « temps réel » toutes les 15 s.
  useEffect(() => {
    load(true);
    const t = setInterval(() => load(), 15000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ÉQUIPE</p>
          <h1>Fil d'activité</h1>
          <p className="muted">Les actions clés de l'équipe sur les tâches, le temps, les notes et les livrables — mises à jour automatiquement.</p>
        </div>
        <button className="outline-button" onClick={() => { setLoading(true); load(true); }} disabled={loading}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><RefreshCw size={14} /> Actualiser</span>
        </button>
      </div>

      {error && <p className="notice" style={{ color: 'var(--red)' }}>{error}</p>}

      <section className="panel" style={{ marginTop: 18 }}>
        {loading && events.length === 0 ? (
          <p className="muted">Chargement du fil…</p>
        ) : events.length === 0 ? (
          <p className="muted">Aucune activité pour le moment. Les créations de tâches, chronos, notes et livrables apparaîtront ici.</p>
        ) : (
          events.map((e) => (
            <div key={e.id} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--line)', alignItems: 'flex-start' }}>
              <Activity size={16} style={{ color: ACTION_COLORS[e.action] ?? 'var(--muted)', flexShrink: 0, marginTop: 2 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13 }}>
                  <strong>{e.actor.firstName} {e.actor.lastName}</strong> {e.summary}
                </div>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                  {fmt(e.createdAt)}
                  {e.projectName ? ` · projet ${e.projectName}` : ''}
                </div>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

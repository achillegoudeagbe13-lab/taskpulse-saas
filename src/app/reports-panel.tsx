'use client';

import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Download } from './ui-icons';

type Stats = { totalTasks: number; completedTasks: number; blockedTasks: number; totalActivities: number; hours: number; attendance: number; absent: number };
type ByDay = { label: string; tasks: number; activities: number };

export default function ReportsPanel() {
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');
  const [stats, setStats] = useState<Stats | null>(null);
  const [byDay, setByDay] = useState<ByDay[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reports?period=${period}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Rapport indisponible.');
      setStats(json.stats);
      setByDay(json.byDay ?? []);
    } catch { /* silencieux */ } finally { setLoading(false); }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="section-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ADMINISTRATION · ANALYSE</p>
          <h1>Rapports</h1>
          <p className="muted">Indicateurs agrégés de l’organisation sur la période choisie.</p>
        </div>
        <div className="page-actions">
          <a className="outline-button" href={`/api/admin/reports?period=${period}&format=csv`} download><Download size={16} /> Export CSV</a>
          <button className="primary-button" onClick={load}><BarChart3 size={16} /> Actualiser</button>
        </div>
      </div>

      <div className="plat-toolbar">
        {(['today', 'week', 'month'] as const).map((value) => (
          <button key={value} className={'plat-chip' + (period === value ? ' on' : '')} onClick={() => setPeriod(value)}>
            {value === 'today' ? 'Aujourd’hui' : value === 'week' ? '7 derniers jours' : 'Ce mois'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-state"><span className="spinner" /> Calcul du rapport…</div>
      ) : stats ? (
        <>
          <div className="stats-grid">
            <Stat label="Tâches créées" value={stats.totalTasks} />
            <Stat label="Tâches terminées" value={stats.completedTasks} />
            <Stat label="Tâches bloquées" value={stats.blockedTasks} />
            <Stat label="Activités publiées" value={stats.totalActivities} />
            <Stat label="Heures pointées" value={stats.hours} suffix=" h" />
            <Stat label="Présences" value={stats.attendance} />
            <Stat label="Absents du jour" value={stats.absent} />
          </div>

          {byDay.length > 0 && (
            <section className="panel">
              <div className="panel-heading"><h3>Répartition par jour (7 derniers jours)</h3></div>
              <div className="chart-mini">
                {byDay.map((day) => (
                  <div key={day.label} className="cell">
                    <small>{day.label}</small>
                    <strong>{day.tasks}</strong>
                    <em>{day.activities} act.</em>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <div className="notice error">Rapport indisponible.</div>
      )}
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="stat-card">
      <strong>{value}{suffix}</strong>
      <span className="stat-label">{label}</span>
    </div>
  );
}
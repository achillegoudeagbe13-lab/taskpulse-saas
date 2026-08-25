'use client';

import { useCallback, useEffect, useState } from 'react';
import { Clock3 } from './ui-icons';

type Record_ = { id: string; clockIn: string; clockOut: string | null; user: { name: string; username: string } };

function fmt(dateIso: string) { return new Date(dateIso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }); }
function duration(clockIn: string, clockOut: string | null) {
  if (!clockOut) return '—';
  const minutes = Math.max(0, Math.round((new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 60000));
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}

export default function AdminAttendancePanel() {
  const [records, setRecords] = useState<Record_[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/attendance?limit=200', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Chargement impossible.');
      setRecords(json.records ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="section-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ADMINISTRATION · PRÉSENCES</p>
          <h1>Pointages de l’équipe</h1>
          <p className="muted">Historique des arrivées et départs de tous les membres.</p>
        </div>
        <Clock3 size={30} className="panel-icon" />
      </div>

      {error && <div className="notice error">{error}<button onClick={load}><Clock3 size={14} /> Réessayer</button></div>}

      {loading ? (
        <div className="loading-state"><span className="spinner" /> Chargement des pointages…</div>
      ) : records.length === 0 ? (
        <section className="panel"><div className="empty-state"><Clock3 size={24} /><h3>Aucun pointage</h3><p className="muted">Les pointages de l’équipe apparaîtront ici.</p></div></section>
      ) : (
        <section className="panel">
          <div className="responsive-table">
            <table>
              <thead><tr><th>Membre</th><th>Date & arrivée</th><th>Départ</th><th>Durée</th></tr></thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td><strong>{record.user.name}</strong><small>@{record.user.username}</small></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmt(record.clockIn)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{record.clockOut ? fmt(record.clockOut) : <span className="status-badge en_cours">● En journée</span>}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{duration(record.clockIn, record.clockOut)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
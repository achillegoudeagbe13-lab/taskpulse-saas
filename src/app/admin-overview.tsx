'use client';

import { useEffect, useState } from 'react';
import { Activity, BarChart3, BookOpen, ChevronRight, Clock3, RefreshCw, ShieldCheck, Users } from './ui-icons';
import { safeStr, safeDateTime, safeFullName, asArray } from '../lib/render-safe';

type Dashboard = {
  recentActivities: { id: string; title: string; status: string; createdAt: string; user: { firstName: string; lastName: string } }[];
  stats: { employees: number; interns: number; present: number; activities: number; blocked: number; tasks: number };
};
type Log = { id: string; action: string; entity: string; createdAt: string; user?: { firstName: string; lastName: string; username: string } | null };

const sections: { page: string; icon: string; label: string; text: string }[] = [
  { page: 'Utilisateurs', icon: 'users', label: 'Utilisateurs', text: 'Gérer les comptes et les accès' },
  { page: 'Rapports', icon: 'chart', label: 'Rapports', text: 'Analyser l’activité réelle' },
  { page: 'Pointages', icon: 'clock', label: 'Pointages', text: 'Suivre les présences' },
  { page: 'Tâches', icon: 'tasks', label: 'Tâches', text: 'Créer et superviser les tâches' },
  { page: 'Activités', icon: 'activity', label: 'Activités', text: 'Voir les publications d’équipe' },
  { page: 'Paramètres', icon: 'settings', label: 'Paramètres', text: 'Configurer la plateforme' },
];

export default function AdminOverview({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [dashboardRes, auditRes] = await Promise.all([fetch('/api/dashboard'), fetch('/api/admin/audit')]);
      const dashboard = await dashboardRes.json();
      const audit = await auditRes.json();
      if (!dashboardRes.ok) throw new Error(dashboard.error);
      setData(dashboard);
      if (auditRes.ok) setLogs(asArray<Log>(audit.logs));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de charger le tableau de bord administrateur.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="section-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h1>Administrateur</h1>
          <p className="muted">Pilotez la plateforme : équipes, activités et paramètres.</p>
        </div>
        <div className="page-actions"><button className="outline-button" onClick={load}><RefreshCw size={17} /> Actualiser</button></div>
      </div>

      {error && <div className="notice error">{error}<button onClick={load}><RefreshCw size={15} /> Réessayer</button></div>}
      {loading ? (
        <div className="loading-state"><span className="spinner" /> Chargement du panneau administrateur…</div>
      ) : data && (
        <>
          <div className="stats-grid">
            {[['Employés actifs', data.stats.employees], ['Stagiaires actifs', data.stats.interns], ['Présents aujourd’hui', data.stats.present], ['Tâches en cours', data.stats.tasks - data.stats.blocked]].map(([label, value]) => (
              <div className="stat-card" key={String(label)}><span className="stat-icon"><Users size={17} /></span><strong>{value}</strong><span className="stat-label">{label}</span></div>
            ))}
          </div>
          <section className="admin-sections">
            {sections.map((section) => (
              <button className="admin-tile panel" key={section.page} onClick={() => onNavigate(section.page)}>
                <span className="admin-tile-icon">{section.icon === 'users' ? <Users size={18} /> : section.icon === 'chart' ? <BarChart3 size={18} /> : section.icon === 'clock' ? <Clock3 size={18} /> : section.icon === 'tasks' ? <BookOpen size={18} /> : section.icon === 'activity' ? <Activity size={18} /> : <ShieldCheck size={18} />}</span>
                <span><strong>{section.label}</strong><small>{section.text}</small></span>
                <ChevronRight size={17} />
              </button>
            ))}
          </section>
          <div className="admin-grid">
            <section className="panel tasks-panel">
              <div className="panel-heading"><div><p className="eyebrow">TEMPS RÉEL</p><h3>Dernières activités</h3></div><button className="link-button" onClick={() => onNavigate('Activités')}>Voir tout <ChevronRight size={15} /></button></div>
              {data.recentActivities.length === 0 ? (
                <div className="empty-state"><Activity size={22} /><h3>Aucune activité</h3><p className="muted">Les publications récentes apparaîtront ici.</p></div>
              ) : (
                <div className="activity-feed">{data.recentActivities.map((activity) => (
                  <div className="activity-row" key={safeStr(activity.id)}><span className={`activity-icon ${activity.status === 'TERMINE' ? 'green' : activity.status === 'BLOQUE' ? 'red' : 'blue'}`}>{activity.status === 'TERMINE' ? '✓' : activity.status === 'BLOQUE' ? '!' : '→'}</span><div><strong>{safeStr(activity.title)}</strong><small>{safeFullName(activity.user)}</small></div><time>Il y a un instant</time></div>
                ))}</div>
              )}
            </section>
            <section className="panel audit-panel">
              <div className="panel-heading"><div><p className="eyebrow">TRACE</p><h3>Journal d’audit</h3></div></div>
              {logs.length === 0 ? (
                <p className="muted">Aucune action enregistrée.</p>
              ) : (
                <div className="notification-list">{logs.slice(0, 6).map((log) => (
                  <button className="notification-row" key={safeStr(log.id)}><span className="notification-icon"><ShieldCheck size={16} /></span><span><strong>{safeStr(log.action)}</strong><small>{safeStr(log.entity)} · {log.user ? safeFullName(log.user) : 'Système'}</small><time>{safeDateTime(log.createdAt)}</time></span></button>
                ))}</div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
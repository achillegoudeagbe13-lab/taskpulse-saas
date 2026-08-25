'use client';

import { useEffect, useState } from 'react';
import { BarChart3, Clock3, CheckCircle2, Send } from '../../ui-icons';

type DashboardData = {
  stats: {
    totalTasks: number;
    completedTasks: number;
    blockedTasks: number;
    totalActivities: number;
    hours: number;
    attendance: number;
    absent: number;
  };
  byDay: Array<{ label: string; tasks: number; activities: number }>;
  weekTasks: Array<{ id: string; title: string; status: string; priority: string }>;
  latestAnnouncement: { title: string; content: string; author: string } | null;
  unreadNotifications: number;
};

export default function Dashboard({ ctx }: { ctx: any }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(async (res) => {
        if (!res.ok) throw new Error('Erreur chargement tableau de bord');
        return res.json();
      })
      .then((d) => setData(d))
      .catch(() => setLoading(false))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6">Chargement du tableau de bord…</div>;
  if (!data) return <div className="p-6">Aucune donnée disponible.</div>;

  return (
    <div className="section-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">TABLEAU DE BORD</p>
          <h1>Bienvenue{ctx.user?.firstName ? ', ' + ctx.user.firstName : ''} !</h1>
        </div>
        <BarChart3 size={32} className="panel-icon" />
      </div>

      <section className="stats-grid">
        <StatCard icon={<BarChart3 size={24} />} label="Tâches" value={data.stats.totalTasks} />
        <StatCard icon={<CheckCircle2 size={24} />} label="Terminées" value={data.stats.completedTasks} />
        <StatCard icon={<Clock3 size={24} />} label="Heures travaillées" value={data.stats.hours} />
        <StatCard icon={<Send size={24} />} label="Activités" value={data.stats.totalActivities} />
      </section>

      {/* Carte Annonce de l'équipe */}
      {data.latestAnnouncement && (
        <section className="dash-section">
          <a href="#" className="dash-announce" onClick={(e) => e.preventDefault()}>
            <p className="eyebrow">📢 ANNONCE DE L’ÉQUIPE</p>
            <h3>{data.latestAnnouncement.title}</h3>
            <p>{data.latestAnnouncement.content}</p>
            <p style={{ marginBottom: 0 }}>Par {data.latestAnnouncement.author}</p>
          </a>
        </section>
      )}

      {/* Tâches de la semaine */}
      {data.weekTasks && data.weekTasks.length > 0 && (
        <section className="dash-section">
          <h2>Tâches de la semaine</h2>
          <ul className="dash-list">
            {data.weekTasks.map((t) => (
              <li key={t.id}>
                <span>{t.title}</span>
                <span className={'status-badge ' + (
                  t.status === 'TERMINE' ? 'termine' :
                  t.status === 'EN_COURS' ? 'en_cours' :
                  t.status === 'BLOQUE' ? 'bloque' : 'en_attente'
                )}>
                  {t.status === 'TERMINE' ? 'Terminée' : t.status === 'EN_COURS' ? 'En cours' : t.status === 'BLOQUE' ? 'Bloquée' : 'En attente'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Graphique par jour */}
      {data.byDay && data.byDay.length > 0 && (
        <section className="dash-section">
          <h2>Activité par jour</h2>
          <div className="chart-mini">
            {data.byDay.map((d) => (
              <div key={d.label} className="cell">
                <small>{d.label}</small>
                <strong>{d.tasks}</strong>
                <em>{d.activities} act.</em>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="plat-stat">
      <span className="plat-stat-icon">{icon}</span>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

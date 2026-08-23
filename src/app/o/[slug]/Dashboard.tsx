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
        <section className="mb-6">
          <a href="/o/[slug]/annonces" className="block p-4 bg-white rounded-xl shadow hover:shadow-md transition">
            <h2 className="font-bold mb-2 text-blue-800">📢 Annonce de l'équipe</h2>
            <h3 className="font-semibold mb-1">{data.latestAnnouncement.title}</h3>
            <p className="text-gray-600 text-sm mb-2 line-clamp-2">{data.latestAnnouncement.content}</p>
            <p className="text-xs text-gray-500">Par {data.latestAnnouncement.author}</p>
          </a>
        </section>
      )}

      {/* Tâches de la semaine */}
      {data.weekTasks && data.weekTasks.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Tâches de la semaine</h2>
          <ul className="space-y-2">
            {data.weekTasks.map((t) => (
              <li key={t.id} className="p-3 bg-white rounded-lg border flex justify-between">
                <span>{t.title}</span>
                <span className={'text-xs px-2 py-1 rounded ' + (
                  t.status === 'TERMINE' ? 'bg-green-100 text-green-800' :
                  t.status === 'EN_COURS' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-600'
                )}>
                  {t.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Graphique par jour */}
      {data.byDay && data.byDay.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Activité par jour</h2>
          <div className="grid grid-cols-7 gap-2 text-center">
            {data.byDay.map((d) => (
              <div key={d.label} className="p-2 bg-white rounded-lg shadow">
                <div className="text-xs text-gray-500">{d.label}</div>
                <div className="text-lg font-bold">{d.tasks}</div>
                <div className="text-xs text-gray-400">{d.activities} activités</div>
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
    <div className="bg-white p-4 rounded-xl shadow flex items-center gap-4">
      <div className="bg-blue-50 p-2 rounded-lg">{icon}</div>
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-sm text-gray-600">{label}</div>
      </div>
    </div>
  );
}

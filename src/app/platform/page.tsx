'use client';
import { useState, useEffect } from 'react';
import { ShieldCheck, BarChart3, Users, Building2 } from '../ui-icons';
type Organization = {
  id: string; name: string; slug: string;
  sector: string | null; country: string | null;
  status: 'ACTIVE' | 'SUSPENDED'; createdAt: string;
};
type PlatformData = {
  totals: { organizations: number; activeOrganizations: number; users: number; tasks: number; activities: number };
  organizations: Organization[];
  viewerEmail: string;
};
export default function PlatformPage() {
  const [data, setData] = useState<PlatformData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  useEffect(() => {
    fetch('/api/platform/overview')
      .then(async (res) => { if (!res.ok) throw new Error('Non autorisé'); return res.json(); })
      .then(setData)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);
  if (loading) return <div className="p-6">Chargement…</div>;
  if (err) return <div className="p-6 text-red-600">{err}</div>;
  if (!data) return null;
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2"><ShieldCheck size={24} /> Administration de la plateforme</h1>
      <p className="text-gray-600 mb-6">Connecté en tant que : {data.viewerEmail}</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Organisations" value={data.totals.organizations} icon={Building2} />
        <StatCard label="Orgs actives" value={data.totals.activeOrganizations} icon={BarChart3} />
        <StatCard label="Utilisateurs" value={data.totals.users} icon={Users} />
        <StatCard label="Tâches" value={data.totals.tasks} icon={Building2} />
      </div>
      <table className="w-full text-sm">
        <thead><tr><th className="text-left p-3">Nom</th><th className="text-left p-3">Secteur</th><th className="text-left p-3">Pays</th><th className="text-left p-3">Statut</th><th className="text-left p-3">Créée le</th></tr></thead>
        <tbody>
          {data.organizations.map((org) => (
            <tr key={org.id} className="border-t">
              <td className="p-3"><a href={'/o/' + org.slug} className="text-blue-600 hover:underline">{org.name}</a></td>
              <td className="p-3">{org.sector ?? '—'}</td>
              <td className="p-3">{org.country ?? '—'}</td>
              <td className="p-3"><span className={'px-2 py-1 text-xs rounded ' + (org.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')}>{org.status === 'ACTIVE' ? 'Actif' : 'Suspendu'}</span></td>
              <td className="p-3">{new Date(org.createdAt).toLocaleDateString('fr-FR')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: React.ComponentType<any> }) {
  return (
    <div className="bg-white p-4 rounded-lg shadow flex items-center gap-3">
      <div className="bg-blue-100 p-2 rounded-lg"><Icon size={20} /></div>
      <div><div className="text-2xl font-bold">{value}</div><div className="text-sm text-gray-600">{label}</div></div>
    </div>
  );
}

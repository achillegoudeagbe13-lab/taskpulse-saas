'use client';

import { useEffect, useState } from 'react';
import { Building2, RefreshCw, ShieldCheck, Users } from './ui-icons';

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  sector: string | null;
  country: string | null;
  status: string;
  createdAt: string;
  _count: { memberships: number; tasks: number; announcements: number; activities: number };
};

type Overview = {
  totals: { organizations: number; activeOrganizations: number; users: number; tasks: number; activities: number };
  organizations: OrgRow[];
  viewerEmail: string;
};

/** Console réservée au PLATFORM_SUPER_ADMIN : métriques agrégées, sans données privées des organisations. */
export default function PlatformOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/platform/overview');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setData(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de charger la plateforme.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="section-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">PLATEFORME</p>
          <h1>Administrateur plateforme</h1>
          <p className="muted">Vue globale de Mar-ci Flow. Les données privées des organisations restent inaccessibles depuis cette console.</p>
        </div>
        <button className="outline-button" onClick={load}><RefreshCw size={17} /> Actualiser</button>
      </div>

      {error && <div className="notice error">{error}<button className="link-button" onClick={load}>Réessayer</button></div>}

      {loading ? (
        <div className="loading-state"><span className="spinner" /> Chargement de la plateforme…</div>
      ) : data ? (
        <>
          <div className="stats-grid">
            {[
              { value: String(data.totals.organizations), label: 'Organisations', note: `${data.totals.activeOrganizations} actives` },
              { value: String(data.totals.users), label: 'Comptes utilisateurs', note: 'toutes organisations' },
              { value: String(data.totals.tasks), label: 'Tâches créées', note: 'volume cumulé' },
              { value: String(data.totals.activities), label: 'Activités publiées', note: 'volume cumulé' },
            ].map((item) => (
              <div className="stat-card" key={item.label}>
                <span className="stat-icon">{item.label === 'Organisations' ? <Building2 size={17} /> : <Users size={17} />}</span>
                <strong>{item.value}</strong>
                <span className="stat-label">{item.label}</span>
                <small>{item.note}</small>
              </div>
            ))}
          </div>

          <section className="panel">
            <div className="panel-heading">
              <div><p className="eyebrow">PORTEFEUILLE</p><h3>Organisations</h3></div>
              <span className="table-badge"><ShieldCheck size={13} /> Accès métadonnées uniquement</span>
            </div>
            {data.organizations.length === 0 ? (
              <div className="empty-state"><Building2 size={24} /><h3>Aucune organisation</h3><p className="muted">Les organisations créées apparaîtront ici.</p></div>
            ) : (
              <div className="responsive-table">
                <table>
                  <thead><tr><th>Organisation</th><th>Secteur</th><th>Pays</th><th>Statut</th><th>Membres</th><th>Tâches</th><th>Activités</th><th>Créée le</th></tr></thead>
                  <tbody>
                    {data.organizations.map((org) => (
                      <tr key={org.id}>
                        <td><strong>{org.name}</strong><small>/{org.slug}</small></td>
                        <td>{org.sector || '—'}</td>
                        <td>{org.country || '—'}</td>
                        <td><span className={`status-badge ${org.status === 'ACTIVE' ? 'active' : ''}`}>{org.status === 'ACTIVE' ? 'Active' : 'Suspendue'}</span></td>
                        <td>{org._count.memberships}</td>
                        <td>{org._count.tasks}</td>
                        <td>{org._count.activities}</td>
                        <td>{new Date(org.createdAt).toLocaleDateString('fr-FR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
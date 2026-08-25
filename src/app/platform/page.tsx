'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, BarChart3, Users, Building2, LogOut, Search, Settings, Ban, PlayCircle, Trash2, X } from '../ui-icons';

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

type Supervision = {
  organization: { id: string; name: string; slug: string; status: string; createdAt: string };
  supervision: {
    members: { total: number; admins: number; employees: number; interns: number; activeUsers: number };
    tasks: { total: number; enAttente: number; enCours: number; bloque: number; termine: number };
    activities: number; announcements: number; messages: number;
    journalEntries: number; invitationsPending: number; attendancesToday: number;
  };
};

export default function PlatformPage() {
  const router = useRouter();
  const [data, setData] = useState<PlatformData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [supervision, setSupervision] = useState<Supervision | null>(null);
  const [supLoading, setSupLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/platform/overview', { cache: 'no-store' })
      .then(async (res) => { if (!res.ok) throw new Error('Non autorisé'); return res.json(); })
      .then((d) => { setData(d); setErr(''); })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleStatus(org: Organization) {
    setBusyId(org.id); setNotice(''); setErr('');
    const next = org.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const res = await fetch(`/api/platform/orgs/${org.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }) });
    const json = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) { setErr(json.error ?? 'Action impossible.'); return; }
    setNotice(next === 'SUSPENDED' ? `« ${org.name} » a été suspendue.` : `« ${org.name} » a été réactivée.`);
    load();
  }

  async function removeOrg(org: Organization) {
    setBusyId(org.id); setNotice(''); setErr('');
    const res = await fetch(`/api/platform/orgs/${org.id}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    setBusyId(null);
    setConfirmDeleteId(null);
    if (!res.ok) { setErr(json.error ?? 'Suppression impossible.'); return; }
    setNotice(`« ${org.name} » a été supprimée définitivement.`);
    if (supervision?.organization.id === org.id) setSupervision(null);
    load();
  }

  async function openSupervision(org: Organization) {
    setSupLoading(true); setNotice(''); setErr('');
    try {
      const res = await fetch(`/api/platform/orgs/${org.id}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Supervision indisponible.');
      setSupervision(json);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur de supervision.');
    } finally {
      setSupLoading(false);
    }
  }

  const filtered = (data?.organizations ?? []).filter((org) =>
    (statusFilter === 'ALL' || org.status === statusFilter) &&
    (query.trim() === '' || org.name.toLowerCase().includes(query.trim().toLowerCase()) || (org.sector ?? '').toLowerCase().includes(query.trim().toLowerCase())),
  );

  return (
    <div className="section-page" style={{ paddingTop: 22 }}>
      <div className="plat-hero">
        <div>
          <span className="plat-brand"><ShieldCheck size={17} /> TASKPULSE · PLATEFORME</span>
          <h1>Administration globale</h1>
          <p>Connecté en tant que {data?.viewerEmail ?? '…'} — supervision de toutes les organisations.</p>
        </div>
        <div className="plat-hero-actions">
          <button className="plat-ghost-btn" onClick={load}><BarChart3 size={15} /> Actualiser</button>
          <button
            className="plat-ghost-btn"
            onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login'; }}
          >
            <LogOut size={15} /> Déconnexion
          </button>
        </div>
      </div>

      {(err || notice) && (
        <div className={'notice ' + (err ? 'error' : 'success')} style={{ marginBottom: 16 }}>
          {err || notice}
        </div>
      )}

      <div className="plat-stats">
        <StatCard icon={<Building2 size={19} />} label="Organisations" value={data?.totals.organizations ?? 0} />
        <StatCard icon={<PlayCircle size={19} />} label="Organisations actives" value={data?.totals.activeOrganizations ?? 0} />
        <StatCard icon={<Users size={19} />} label="Utilisateurs" value={data?.totals.users ?? 0} />
        <StatCard icon={<BarChart3 size={19} />} label="Tâches suivies" value={data?.totals.tasks ?? 0} />
      </div>

      <div className="panel" style={{ padding: 20 }}>
        <div className="panel-heading">
          <h3>Organisations</h3>
          <span className="muted" style={{ fontSize: 12 }}>{filtered.length} résultat(s)</span>
        </div>

        <div className="plat-toolbar">
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#98a2b3' }} />
            <input
              placeholder="Rechercher par nom ou secteur…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ width: '100%', paddingLeft: 36 }}
            />
          </div>
          <button className={'plat-chip' + (statusFilter === 'ALL' ? ' on' : '')} onClick={() => setStatusFilter('ALL')}>Toutes</button>
          <button className={'plat-chip' + (statusFilter === 'ACTIVE' ? ' on' : '')} onClick={() => setStatusFilter('ACTIVE')}>Actives</button>
          <button className={'plat-chip' + (statusFilter === 'SUSPENDED' ? ' on' : '')} onClick={() => setStatusFilter('SUSPENDED')}>Suspendues</button>
        </div>

        {loading ? (
          <div className="loading-state"><span className="spinner" /> Chargement des organisations…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><Building2 size={24} /><h3>Aucune organisation</h3><p className="muted">Aucun résultat pour ce filtre.</p></div>
        ) : (
          <div className="plat-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Organisation</th><th>Secteur</th><th>Pays</th><th>Statut</th><th>Créée le</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((org) => (
                  <tr key={org.id}>
                    <td>
                      <div className="plat-org-name">
                        <span className="plat-org-logo">{org.name.slice(0, 2).toUpperCase()}</span>
                        <div style={{ minWidth: 0 }}>
                          <strong>{org.name}</strong>
                          <small>/o/{org.slug}</small>
                        </div>
                      </div>
                    </td>
                    <td>{org.sector ?? '—'}</td>
                    <td>{org.country ?? '—'}</td>
                    <td>
                      <span className={'status-badge ' + (org.status === 'ACTIVE' ? 'active' : 'bloque')}>
                        {org.status === 'ACTIVE' ? '● Active' : '● Suspendue'}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(org.createdAt).toLocaleDateString('fr-FR')}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="btn"
                          disabled={busyId === org.id || supLoading}
                          onClick={() => (supervision?.organization.id === org.id ? setSupervision(null) : openSupervision(org))}
                          title="Vue de supervision globale (métriques agrégées)"
                        >
                          <Settings size={13} /> Superviser
                        </button>
                        <button
                          className={'btn' + (org.status === 'ACTIVE' ? ' warn' : '')}
                          disabled={busyId === org.id}
                          onClick={() => toggleStatus(org)}
                          title={org.status === 'ACTIVE' ? 'Suspendre cette organisation' : 'Réactiver cette organisation'}
                        >
                          {org.status === 'ACTIVE' ? <><Ban size={13} /> Suspendre</> : <><PlayCircle size={13} /> Réactiver</>}
                        </button>
                        <button
                          className={'btn danger' + (confirmDeleteId === org.id ? ' confirm' : '')}
                          disabled={busyId === org.id}
                          onClick={() => { if (confirmDeleteId === org.id) removeOrg(org); else setConfirmDeleteId(org.id); }}
                          onBlur={() => { if (confirmDeleteId === org.id) setConfirmDeleteId(null); }}
                          title="Supprimer définitivement cette organisation"
                        >
                          {confirmDeleteId === org.id ? 'Confirmer la suppression ?' : <><Trash2 size={13} /> Supprimer</>}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {supervision && (
        <div className="supervision">
          <div className="supervision-head">
            <ShieldCheck size={20} style={{ color: 'var(--blue)' }} />
            <div>
              <strong>Supervision — {supervision.organization.name}</strong>
              <small>
                Vue d’ensemble agrégée · créée le {new Date(supervision.organization.createdAt).toLocaleDateString('fr-FR')} ·{' '}
                statut {supervision.organization.status === 'ACTIVE' ? 'Active' : 'Suspendue'}
              </small>
            </div>
            <button className="close-x" onClick={() => setSupervision(null)} aria-label="Fermer la supervision"><X size={16} /></button>
          </div>

          <div className="supervision-grid">
            <SupCell label="Membres" strong={String(supervision.supervision.members.total)}
              em={`${supervision.supervision.members.admins} admin · ${supervision.supervision.members.employees} emp. · ${supervision.supervision.members.interns} stag.`} />
            <SupCell label="Comptes actifs" strong={String(supervision.supervision.members.activeUsers)} em="utilisateurs au statut ACTIF" />
            <SupCell label="Présences du jour" strong={String(supervision.supervision.attendancesToday)} em="pointages enregistrés aujourd’hui" />
            <SupCell label="Journal de travail" strong={String(supervision.supervision.journalEntries)} em="entrées cumulées" />
            <SupCell label="Invitations en attente" strong={String(supervision.supervision.invitationsPending)} em="jetons non consommés" />
          </div>
          <div className="supervision-grid" style={{ paddingTop: 0 }}>
            <SupCell label="Tâches" strong={String(supervision.supervision.tasks.total)}
              em={`${supervision.supervision.tasks.enAttente} attente · ${supervision.supervision.tasks.enCours} cours`} />
            <SupCell label="Tâches terminées" strong={String(supervision.supervision.tasks.termine)} em={`${supervision.supervision.tasks.bloque} bloquée(s)`} />
            <SupCell label="Activités" strong={String(supervision.supervision.activities)} em="rapports d’activité publiés" />
            <SupCell label="Annonces" strong={String(supervision.supervision.announcements)} em="communications internes" />
            <SupCell label="Messages échangés" strong={String(supervision.supervision.messages)} em="volume total" />
          </div>
          <p className="sup-note">
            🔒 Vue de supervision : seules des métriques agrégées sont affichées. Les contenus privés
            des membres ne sont pas exposés au super admin plateforme.
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="plat-stat">
      <span className="plat-stat-icon">{icon}</span>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function SupCell({ label, strong, em }: { label: string; strong: string; em: string }) {
  return (
    <div className="sup-cell">
      <small>{label}</small>
      <strong>{strong}</strong>
      <em>{em}</em>
    </div>
  );
}

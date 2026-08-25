'use client';

import { FormEvent, useEffect, useState } from 'react';
import { UserRound, RefreshCw } from './ui-icons';

type Me = {
  id: string; firstName: string | null; lastName: string | null;
  username: string; email: string; phone?: string | null;
  department: string;
  profile: { position?: string | null; bio?: string | null } | null;
  role: string | null; status: string;
  createdAt: string; lastLoginAt: string | null;
};

const roleLabels: Record<string, string> = { ORGANIZATION_ADMIN: 'Administrateur', EMPLOYEE: 'Employé', INTERN: 'Stagiaire' };

export default function ProfilePanel() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Session expirée.');
      setMe(json.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger le profil.');
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(''); setNotice('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Mise à jour impossible.');
      setNotice('Profil mis à jour avec succès.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inattendue.');
    } finally { setSaving(false); }
  }

  if (loading) return <div className="loading-state"><span className="spinner" /> Chargement du profil…</div>;
  if (!me) return <div className="notice error">{error || 'Profil indisponible.'}<button onClick={load}><RefreshCw size={14} /> Réessayer</button></div>;

  return (
    <div className="section-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">MON COMPTE</p>
          <h1>Mon profil</h1>
          <p className="muted">Consultez et mettez à jour vos informations personnelles.</p>
        </div>
        <UserRound size={30} className="panel-icon" />
      </div>

      {notice && <div className="notice success" style={{ marginBottom: 16 }}>{notice}</div>}
      {error && !loading && <div className="notice error" style={{ marginBottom: 16 }}>{error}</div>}

      <section className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-heading"><h3>Informations du compte</h3><span className={'status-badge ' + (me.status === 'ACTIF' ? 'active' : 'bloque')}>{me.status === 'ACTIF' ? '● Compte actif' : '● ' + me.status}</span></div>
        <div className="profile-facts">
          <div><small>Rôle dans l’organisation</small><strong>{roleLabels[me.role ?? ''] ?? me.role ?? '—'}</strong></div>
          <div><small>Département</small><strong>{me.department || '—'}</strong></div>
          <div><small>Membre depuis</small><strong>{new Date(me.createdAt).toLocaleDateString('fr-FR')}</strong></div>
          <div><small>Dernière connexion</small><strong>{me.lastLoginAt ? new Date(me.lastLoginAt).toLocaleString('fr-FR') : '—'}</strong></div>
        </div>
      </section>

      <form className="panel profile-form" onSubmit={submit}>
        <div className="panel-heading"><h3>Modifier mes informations</h3></div>
        <div className="two-col">
          <label>Prénom<input name="firstName" defaultValue={me.firstName ?? ''} required maxLength={80} /></label>
          <label>Nom<input name="lastName" defaultValue={me.lastName ?? ''} required maxLength={80} /></label>
        </div>
        <div className="two-col">
          <label>Email<input name="email" type="email" defaultValue={me.email} required /></label>
          <label>Nom d’utilisateur<input name="username" defaultValue={me.username} required pattern="[a-z0-9._-]{3,30}" title="3 à 30 caractères : lettres minuscules, chiffres, . _ -" /></label>
        </div>
        <div className="two-col">
          <label>Téléphone (optionnel)<input name="phone" defaultValue={me.phone ?? ''} maxLength={30} placeholder="+33 …" /></label>
          <label>Poste (optionnel)<input name="position" defaultValue={me.profile?.position ?? ''} maxLength={120} placeholder="Ex. Chargé de projet" /></label>
        </div>
        <label>Bio (optionnel)
          <textarea name="bio" defaultValue={me.profile?.bio ?? ''} maxLength={2000} rows={4} placeholder="Quelques mots à propos de vous…" />
        </label>

        <div className="modal-actions">
          <button type="button" className="outline-button" onClick={load} disabled={saving}><RefreshCw size={15} /> Réinitialiser</button>
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? 'Enregistrement…' : <>Enregistrer les modifications</>}
          </button>
        </div>
      </form>
    </div>
  );
}
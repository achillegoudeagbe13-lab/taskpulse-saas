'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { UserRound, RefreshCw, Trash2 } from './ui-icons';
import { safeStr, safeDateLabel, safeDateTime } from '../lib/render-safe';

type Me = {
  id: string; firstName: string | null; lastName: string | null;
  username: string; email: string; phone?: string | null;
  department: string;
  profile: { position?: string | null; bio?: string | null } | null;
  role: string | null; status: string;
  photoUrl?: string | null;
  createdAt: string; lastLoginAt: string | null;
};

const roleLabels: Record<string, string> = { ORGANIZATION_ADMIN: 'Administrateur', EMPLOYEE: 'Employé', INTERN: 'Stagiaire' };

export default function ProfilePanel() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [photo, setPhoto] = useState<string>('');
  const [photoError, setPhotoError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function pickPhoto() { setPhotoError(''); fileRef.current?.click(); }

  function onPhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) { setPhotoError('Formats acceptés : PNG, JPEG ou WebP.'); return; }
    if (file.size > 1_500_000) { setPhotoError('Photo trop volumineuse (1,5 Mo maximum).'); return; }
    const reader = new FileReader();
    reader.onload = () => setPhoto(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function load() {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Session expirée.');
      setMe(json.user);
      setPhoto('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger le profil.');
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(''); setNotice(''); setPhotoError('');
    const data: Record<string, string> = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    if (photo && photo !== '<remove>') data.photoUrl = photo;
    if (photo === '<remove>') data.photoUrl = '';
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
        <div className="avatar-upload-row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {(photo || me.photoUrl) ? (
            <img className="avatar avatar-lg" src={photo || me.photoUrl || ''} alt="Photo de profil" />
          ) : (
            <span className="avatar avatar-lg">{(me.firstName?.[0] ?? '') + (me.lastName?.[0] ?? '') || '?'}</span>
          )}
          <div className="avatar-upload-actions">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onPhotoChange} />
            <button type="button" className="outline-button" onClick={pickPhoto}>{photo ? 'Changer la photo' : 'Choisir une photo'}</button>
            {(photo || me.photoUrl) && (
              <button type="button" className="link-button" style={{ color: 'var(--red)' }} onClick={() => { setPhoto('<remove>'); setPhotoError(''); }}>
                <Trash2 size={14} /> Retirer
              </button>
            )}
          </div>
        </div>
        {photoError && <div className="notice error" style={{ marginBottom: 10 }}>{photoError}</div>}
        <p className="muted" style={{ fontSize: 12.5 }}>PNG, JPEG ou WebP · 1,5 Mo max. La photo remplace vos initiales dans la gestion des membres.</p>
        <div className="profile-facts">
          <div><small>Rôle dans l’organisation</small><strong>{safeStr(roleLabels[me.role ?? ''] ?? me.role) || '—'}</strong></div>
          <div><small>Département</small><strong>{safeStr(me.department) || '—'}</strong></div>
          <div><small>Membre depuis</small><strong>{safeDateLabel(me.createdAt)}</strong></div>
          <div><small>Dernière connexion</small><strong>{me.lastLoginAt ? safeDateTime(me.lastLoginAt) : '—'}</strong></div>
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
'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { Building2, RefreshCw, Trash2 } from './ui-icons';

export default function OrgSettingsPanel({ organizationName }: { organizationName: string | null }) {
  const [settings, setSettings] = useState<{ organizationName?: string; logoUrl?: string }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/settings', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Chargement impossible.');
      setSettings(json.settings ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement.');
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setSaving('name'); setError(''); setNotice('');
    try {
      const res = await fetch('/api/admin/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ organizationName: data.organizationName }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Enregistrement impossible.');
      setNotice('Nom de l’organisation mis à jour.');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inattendue.');
    } finally { setSaving(''); }
  }

  function pickLogo() { fileRef.current?.click(); }

  function onLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(''); setNotice('');
    if (!/^image\/(png|jpe?g|webp|svg\+xml)$/i.test(file.type)) { setError('Formats acceptés : PNG, JPEG, WebP ou SVG.'); return; }
    if (file.size > 1_200_000) { setError('Logo trop volumineux (1,2 Mo maximum).'); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result);
      setSaving('logo');
      try {
        const res = await fetch('/api/admin/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logoUrl: dataUrl }) });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? 'Import impossible.');
        setNotice('Logo importé avec succès.');
        load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur pendant l’import.');
      } finally { setSaving(''); }
    };
    reader.readAsDataURL(file);
  }

  async function removeLogo() {
    setSaving('logo-remove'); setError(''); setNotice('');
    try {
      const res = await fetch('/api/admin/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logoUrl: '' }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Suppression impossible.');
      setNotice('Logo supprimé.');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inattendue.');
    } finally { setSaving(''); }
  }

  if (loading) return <div className="loading-state"><span className="spinner" /> Chargement des paramètres…</div>;

  return (
    <div className="section-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ADMINISTRATION · CONFIGURATION</p>
          <h1>Paramètres</h1>
          <p className="muted">Identité de l’organisation : nom et logo visibles par toute l’équipe.</p>
        </div>
        <Building2 size={30} className="panel-icon" />
      </div>

      {notice && <div className="notice success" style={{ marginBottom: 16 }}>{notice}</div>}
      {error && <div className="notice error" style={{ marginBottom: 16 }}>{error}</div>}

      <section className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-heading"><h3>Nom de l’organisation</h3></div>
        <form onSubmit={saveName}>
          <label>Nom affiché<input name="organizationName" defaultValue={settings.organizationName ?? organizationName ?? ''} required minLength={2} maxLength={120} /></label>
          <div style={{ marginTop: 14 }}>
            <button type="submit" className="primary-button" disabled={saving === 'name'}>
              {saving === 'name' ? 'Enregistrement…' : <>Enregistrer le nom</>}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-heading"><h3>Logo de l’entreprise</h3></div>
        <div className="logo-row">
          <div className="logo-preview">
            {settings.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.logoUrl} alt="Logo de l’organisation" />
            ) : (
              <span className="logo-placeholder">{(organizationName ?? 'O').slice(0, 2).toUpperCase()}</span>
            )}
          </div>
          <div className="logo-actions">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={onLogoChange} />
            <button type="button" className="primary-button" onClick={pickLogo} disabled={saving === 'logo'}>
              {saving === 'logo' ? 'Import…' : <>Importer un logo</>}
            </button>
            {settings.logoUrl && (
              <button type="button" className="outline-button logo-remove" onClick={removeLogo} disabled={saving === 'logo-remove'}>
                <Trash2 size={15} /> Retirer le logo
              </button>
            )}
            <small className="muted">PNG, JPEG, WebP ou SVG · 1,2 Mo max.<br />Affiché dans la barre latérale pour tous les membres.</small>
          </div>
        </div>
      </section>
    </div>
  );
}
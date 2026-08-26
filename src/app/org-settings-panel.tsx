'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { Building2, RefreshCw, Trash2 } from './ui-icons';

export default function OrgSettingsPanel({ organizationName }: { organizationName: string | null }) {
  const [settings, setSettings] = useState<{ organizationName?: string; logoUrl?: string }>({});
  const [geo, setGeo] = useState({ enabled: false, lat: '', lng: '', radius: '' });
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
      const g = json.settings ?? {};
      setGeo({ enabled: g.geoEnabled === 'true', lat: g.geoLat ?? '', lng: g.geoLng ?? '', radius: g.geoRadiusMeters ?? '' });
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

  function saveGeo() {
    setSaving('geo'); setError(''); setNotice('');
    const lat = Number(geo.lat); const lng = Number(geo.lng); const radius = Number(geo.radius);
    if (geo.enabled && (Number.isNaN(lat) || Number.isNaN(lng))) { setError('Renseignez les coordonnées GPS (latitude / longitude) du bureau.'); setSaving(''); return; }
    if (geo.enabled && (Number.isNaN(radius) || radius < 5)) { setError('Indiquez un rayon de tolérance valide (en mètres).'); setSaving(''); return; }
    (async () => {
      try {
        const res = await fetch('/api/admin/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          geoEnabled: geo.enabled,
          geoLat: geo.enabled ? lat : undefined,
          geoLng: geo.enabled ? lng : undefined,
          geoRadiusMeters: geo.enabled ? Math.round(radius) : undefined,
        }) });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? 'Enregistrement impossible.');
        setNotice(geo.enabled ? 'Contrôle GPS du pointage activé.' : 'Contrôle GPS désactivé (position toujours enregistrée en audit).');
        load();
      } catch (e) { setError(e instanceof Error ? e.message : 'Erreur inattendue.'); }
      finally { setSaving(''); }
    })();
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

      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panel-heading"><h3>Contrôle GPS du pointage</h3></div>
        <p className="muted" style={{ marginBottom: 12 }}>Exigez la présence des employés sur site au moment de pointer, ou enregistrez leur position pour l’audit du manager.</p>
        <label className="geo-toggle"><input type="checkbox" checked={geo.enabled} onChange={(e) => setGeo({ ...geo, enabled: e.target.checked })} /> Activer le contrôle GPS du pointage</label>
        {geo.enabled && (
          <div className="geo-fields">
            <div className="geo-field"><label>Latitude du bureau</label><input value={geo.lat} onChange={(e) => setGeo({ ...geo, lat: e.target.value })} placeholder="Ex. 48.8566" inputMode="decimal" /></div>
            <div className="geo-field"><label>Longitude du bureau</label><input value={geo.lng} onChange={(e) => setGeo({ ...geo, lng: e.target.value })} placeholder="Ex. 2.3522" inputMode="decimal" /></div>
            <div className="geo-field"><label>Rayon de tolérance (mètres)</label><input value={geo.radius} onChange={(e) => setGeo({ ...geo, radius: e.target.value })} placeholder="Ex. 150" inputMode="numeric" /></div>
          </div>
        )}
        <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="primary-button" onClick={saveGeo} disabled={saving === 'geo'}>{saving === 'geo' ? 'Enregistrement…' : 'Enregistrer le contrôle GPS'}</button>
          {geo.enabled && <a href="https://www.google.com/maps" target="_blank" rel="noreferrer" className="outline-button" style={{ textDecoration: 'none' }}>Ouvrir Google Maps</a>}
        </div>
      </section>
    </div>
  );
}
'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { Building2, Key, RefreshCw, Sparkles, Trash2 } from './ui-icons';
import { TIERS, formatPrice, formatExpiry } from '../lib/plans';
import type { OrgPlan } from './plan-lock';
import PlanRequestsPanel from './plan-requests-panel';

export default function OrgSettingsPanel({ organizationName }: { organizationName: string | null }) {
  const [settings, setSettings] = useState<{ organizationName?: string; logoUrl?: string }>({});
  const [geo, setGeo] = useState({ enabled: false, lat: '', lng: '', radius: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Abonnement / plan
  const [plan, setPlan] = useState<OrgPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [actCode, setActCode] = useState('');
  const [actLoading, setActLoading] = useState(false);
  const [actError, setActError] = useState('');
  const [actNotice, setActNotice] = useState('');

  async function loadPlan() {
    setPlanLoading(true);
    try {
      const res = await fetch('/api/org/plan', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Impossible de charger l’abonnement.');
      setPlan(json);
    } catch (e) {
      setPlan(null);
    } finally { setPlanLoading(false); }
  }

  async function activatePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActLoading(true); setActError(''); setActNotice('');
    try {
      const res = await fetch('/api/org/activate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: actCode }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Activation impossible.');
      setActNotice('Licence activée avec succès. Votre abonnement a été mis à jour.');
      setActCode('');
      loadPlan();
      load();
    } catch (e) {
      setActError(e instanceof Error ? e.message : 'Erreur inattendue.');
    } finally { setActLoading(false); }
  }

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
  useEffect(() => { load(); loadPlan(); }, []);

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
        <div className="panel-heading">
          <div>
            <p className="eyebrow" style={{ marginBottom: 4 }}>ABONNEMENT</p>
            <h3>Plan & licence</h3>
          </div>
          <Key size={20} />
        </div>

        {planLoading ? (
          <p className="muted"><span className="spinner" /> Chargement de l’abonnement…</p>
        ) : plan ? (
          <>
            {plan.inTrial && (
              <div className="trial-banner" role="status" style={{ marginBottom: 14 }}>
                <Sparkles size={15} />
                <span><strong>Période d’essai</strong> — il vous reste <strong>{plan.daysLeft ?? 0} jour(s)</strong>. Saisissez un code de licence ci-dessous pour continuer après l’essai.</span>
              </div>
            )}

            <div className="plan-facts">
              <div className="plan-fact"><small>Palier actuel</small><strong>{plan.planLabel}</strong></div>
              <div className="plan-fact"><small>Tarif</small><strong>{formatPrice(plan.planPrice)}</strong></div>
              <div className="plan-fact"><small>Membres occupés</small><strong>{plan.currentMembers} + {plan.pendingInvites} invitation(s)</strong></div>
              <div className="plan-fact"><small>Expiration</small><strong>{formatExpiry(plan.expiresAt || null)}</strong></div>
            </div>

            <p className="muted" style={{ margin: '6px 0 10px' }}>
              Statut :{' '}
              <strong>
                {plan.inTrial ? 'Essai gratuit' : plan.planStatus === 'EXPIRED' ? 'Expiré' : plan.planStatus === 'LOCKED' ? 'Verrouillé' : 'Actif'}
              </strong>
              {plan.licenseCode ? <> · Licence <strong>{plan.licenseCode}</strong></> : ' · Aucune licence activée'}
            </p>

            <form onSubmit={activatePlan} style={{ display: 'grid', gap: 10, maxWidth: 420 }}>
              <label style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 700 }}>
                ACTIVER OU METTRE À NIVEAU AVEC UN CODE
                <input
                  className="plan-code-input"
                  value={actCode}
                  onChange={(e) => setActCode(e.target.value.toUpperCase())}
                  placeholder="MCF-XXXX-XXXX-XXXX"
                  minLength={8}
                  maxLength={64}
                  required
                  style={{ marginTop: 6 }}
                />
              </label>
              {actError && <div className="notice error">{actError}</div>}
              {actNotice && <div className="notice success">{actNotice}</div>}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button type="submit" className="primary-button" disabled={actLoading}>
                  <Key size={16} /> {actLoading ? 'Activation…' : 'Activer le code'}
                </button>
                <button type="button" className="outline-button" onClick={loadPlan} disabled={planLoading}>
                  <RefreshCw size={15} /> Re-vérifier la licence
                </button>
              </div>
            </form>

            <div style={{ marginTop: 18 }}>
              <p className="muted" style={{ fontWeight: 700, marginBottom: 8 }}>Grille tarifaire (par palier de membres)</p>
              <div className="pricing-grid">
                {TIERS.map((t) => (
                  <div className={'pricing-card' + (t.tier === plan.tier ? ' highlight' : '')} key={t.tier}>
                    <span className="muted" style={{ fontSize: 11 }}>{t.label}</span>
                    <span className="price">{formatPrice(t.price)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <p className="muted">Abonnement indisponible pour le moment.</p>
        )}
      </section>

      <PlanRequestsPanel />

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
'use client';

import { useEffect, useState } from 'react';
import { Key, Plus, RefreshCw, Trash2 } from './ui-icons';
import { safeStr, asArray } from '../lib/render-safe';
import { TIERS, tierInfo, formatPrice } from '../lib/plans';

type LicenseRow = {
  id: string; code: string; tier: string; maxSeats: number; status: string;
  note: string | null; activatedAt: string | null; expiresAt: string | null;
  organization: { id: string; name: string; slug: string } | null;
};

/** Console super-admin : génération, listing et révocation des codes d'activation. */
export default function PlatformLicenses() {
  const [codes, setCodes] = useState<LicenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tier, setTier] = useState<'T1' | 'T2' | 'T3' | 'T4'>('T1');
  const [note, setNote] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/platform/licenses', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Chargement impossible.');
      setCodes(asArray<LicenseRow>(json.codes));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement.');
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function generate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGenerating(true); setError(''); setNotice('');
    try {
      const res = await fetch('/api/platform/licenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier, note: note || undefined }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Génération impossible.');
      setCopied(json.license.code);
      setNotice('Code généré : ' + json.license.code);
      setNote('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inattendue.');
    } finally { setGenerating(false); }
  }

  async function revoke(id: string) {
    if (!window.confirm('Révoquer ce code d’activation ? (Impossible si déjà utilisé)')) return;
    setError(''); setNotice('');
    try {
      const res = await fetch(`/api/platform/licenses/${id}/revoke`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Révocation impossible.');
      setNotice('Code révoqué.');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur.');
    }
  }

  function copy(code: string) {
    navigator.clipboard?.writeText(code).then(() => { setCopied(code); window.setTimeout(() => setCopied(null), 2000); })
      .catch(() => window.prompt('Copiez le code :', code));
  }

  return (
    <section className="panel" style={{ marginTop: 18 }}>
      <div className="panel-heading">
        <div><p className="eyebrow">MONÉTISATION</p><h3>Codes de licence d’activation</h3></div>
        <span className="table-badge"><Key size={13} /> Super-admin uniquement</span>
      </div>

      <form className="plan-gen" onSubmit={generate} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 18 }}>
        <label style={{ display: 'grid', gap: 6, fontSize: 11, fontWeight: 700 }}>PALIER
          <select value={tier} onChange={(e) => setTier(e.target.value as any)}>
            {TIERS.map((t) => <option key={t.tier} value={t.tier}>{t.label} · {formatPrice(t.price)}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 6, fontSize: 11, fontWeight: 700, flex: 1, minWidth: 180 }}>RÉFÉRENCE / NOTE
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. Paiement mobile 15/09" maxLength={200} />
        </label>
        <button type="submit" className="primary-button" disabled={generating}><Plus size={16} /> {generating ? 'Génération…' : 'Générer un code'}</button>
        <button type="button" className="outline-button" onClick={load}><RefreshCw size={15} /></button>
      </form>

      {notice && <div className="notice success">{notice}</div>}
      {error && <div className="notice error">{error}</div>}

      {loading ? (
        <div className="loading-state"><span className="spinner" /> Chargement des codes…</div>
      ) : codes.length === 0 ? (
        <div className="empty-state"><Key size={24} /><h3>Aucun code</h3><p className="muted">Générez un code pour délivrer un palier à une organisation.</p></div>
      ) : (
        <div className="responsive-table">
          <table>
            <thead><tr><th>Code</th><th>Palier</th><th>Statut</th><th>Référence</th><th>Organisation</th><th>Expire</th><th></th></tr></thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.id}>
                  <td><strong style={{ fontFamily: 'monospace', letterSpacing: '.06em' }}>{safeStr(c.code)}</strong>{' '}
                    <button className="link-button" onClick={() => copy(c.code)}>{copied === c.code ? 'Copié ✓' : 'Copier'}</button>
                  </td>
                  <td><span className="table-badge">{tierInfo(c.tier as any).label}</span></td>
                  <td><span className={`status-badge ${c.status === 'USED' ? 'active' : c.status === 'REVOKED' ? 'bloque' : ''}`}>{c.status === 'USED' ? 'Utilisé' : c.status === 'REVOKED' ? 'Révoqué' : 'Disponible'}</span></td>
                  <td>{safeStr(c.note) || '—'}</td>
                  <td>{c.organization ? <strong>{safeStr(c.organization.name)}</strong> : <span className="muted">—</span>}</td>
                  <td>{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('fr-FR') : 'Illimité'}</td>
                  <td>{c.status === 'UNUSED' && <button className="icon-button danger" title="Révoquer" onClick={() => revoke(c.id)}><Trash2 size={15} /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
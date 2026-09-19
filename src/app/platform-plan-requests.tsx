'use client';

import { useCallback, useEffect, useState } from 'react';
import { Key, RefreshCw, Send, Sparkles, X } from './ui-icons';
import { asArray, safeDateTime, safeStr } from '../lib/render-safe';
import { formatPrice } from '../lib/plans';
import { planRequestStatusBadge, planRequestStatusLabel, type PlanRequestView } from '../lib/plan-requests';

type LicenseRow = { id: string; code: string; tier: string; status: string };

const FILTERS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'Toutes' },
  { value: 'PENDING', label: 'En attente' },
  { value: 'PROCESSING', label: 'En traitement' },
  { value: 'APPROVED', label: 'Approuvées' },
  { value: 'REJECTED', label: 'Refusées' },
];

/**
 * Console super-admin : file d'attente du parcours client d'abonnement.
 * Traitement d'un dossier — réponse dans la conversation, remise d'une clé
 * d'activation existante ou génération immédiate, décision (approuvée/refusée).
 */
export default function PlatformPlanRequests() {
  const [requests, setRequests] = useState<PlanRequestView[]>([]);
  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = filter === 'ALL' ? '' : `?status=${filter}`;
      const [requestsRes, licensesRes] = await Promise.all([
        fetch(`/api/platform/plan-requests${query}`, { cache: 'no-store' }),
        fetch('/api/platform/licenses', { cache: 'no-store' }),
      ]);
      const requestsJson = await requestsRes.json();
      if (!requestsRes.ok) throw new Error(requestsJson.error ?? 'Chargement des demandes impossible.');
      setRequests(asArray<PlanRequestView>(requestsJson.requests));
      if (licensesRes.ok) {
        const licensesJson = await licensesRes.json();
        setLicenses(asArray<LicenseRow>(licensesJson.codes));
      }
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erreur de chargement.');
    } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const selected = requests.find((request) => request.id === selectedId) ?? null;
  const availableKeys = selected
    ? licenses.filter((license) => license.status === 'UNUSED' && license.tier === selected.requestedTier)
    : [];

  async function refreshSelected() {
    await load();
  }

  return (
    <section className="panel" style={{ marginTop: 18 }}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow" style={{ marginBottom: 4 }}>MONÉTISATION</p>
          <h3>Demandes d’abonnement</h3>
        </div>
        <button type="button" className="outline-button" onClick={load}><RefreshCw size={15} /> Actualiser</button>
      </div>

      <div className="plat-toolbar" style={{ marginBottom: 14 }}>
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            className={'plat-chip' + (filter === item.value ? ' on' : '')}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && <div className="notice error">{error}</div>}
      {notice && <div className="notice success">{notice}</div>}

      {loading ? (
        <div className="loading-state"><span className="spinner" /> Chargement des demandes…</div>
      ) : requests.length === 0 ? (
        <div className="empty-state"><Key size={24} /><h3>Aucune demande</h3><p className="muted">Aucune demande d’abonnement pour ce filtre.</p></div>
      ) : (
        <div className="responsive-table">
          <table>
            <thead><tr><th>Organisation</th><th>Palier demandé</th><th>Contact</th><th>Paiement</th><th>Statut</th><th>Envoyée le</th><th></th></tr></thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td><strong>{safeStr(request.organization?.name) || '—'}</strong></td>
                  <td><span className="table-badge">{request.requestedTierLabel}</span> {formatPrice(request.requestedPrice)}</td>
                  <td>{safeStr(request.contactName)}<small>{safeStr(request.contactEmail)}</small></td>
                  <td>{request.paymentMethodLabel}</td>
                  <td><span className={`status-badge ${planRequestStatusBadge(request.status)}`}>{planRequestStatusLabel(request.status)}</span></td>
                  <td>{safeDateTime(request.createdAt) || '—'}</td>
                  <td>
                    <button type="button" className="link-button" onClick={() => { setSelectedId(request.id); setNotice(''); setError(''); }}>
                      Ouvrir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <RequestDetail
          request={selected}
          availableKeys={availableKeys}
          onClose={() => setSelectedId(null)}
          onChanged={refreshSelected}
          setError={setError}
          setNotice={setNotice}
        />
      )}
    </section>
  );
}

/** Détail d'un dossier : coordonnées, conversation, remise de clé et décision. */
function RequestDetail({
  request, availableKeys, onClose, onChanged, setError, setNotice,
}: {
  request: PlanRequestView;
  availableKeys: LicenseRow[];
  onClose: () => void;
  onChanged: () => Promise<void>;
  setError: (message: string) => void;
  setNotice: (message: string) => void;
}) {
  const [reply, setReply] = useState('');
  const [licenseChoice, setLicenseChoice] = useState('');
  const [busy, setBusy] = useState('');
  const [deliveredCode, setDeliveredCode] = useState('');

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy('message'); setError(''); setNotice('');
    try {
      const res = await fetch(`/api/platform/plan-requests/${request.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: reply, licenseKey: licenseChoice || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Envoi impossible.');
      setNotice(licenseChoice ? 'Message envoyé avec la clé d’activation — dossier approuvé.' : 'Message envoyé.');
      setReply(''); setLicenseChoice('');
      await onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erreur inattendue.');
    } finally { setBusy(''); }
  }

  async function deliver() {
    if (!window.confirm(`Générer une nouvelle clé ${request.requestedTierLabel} et l’envoyer à l’organisation ?`)) return;
    setBusy('deliver'); setError(''); setNotice(''); setDeliveredCode('');
    try {
      const res = await fetch(`/api/platform/plan-requests/${request.id}/deliver`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Livraison impossible.');
      setDeliveredCode(safeStr(json.license?.code));
      setNotice('Clé générée et livrée dans la conversation.');
      await onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erreur inattendue.');
    } finally { setBusy(''); }
  }

  async function setStatus(status: 'PROCESSING' | 'APPROVED' | 'REJECTED') {
    setBusy(status); setError(''); setNotice('');
    try {
      const res = await fetch(`/api/platform/plan-requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Mise à jour impossible.');
      setNotice(`Dossier marqué « ${planRequestStatusLabel(status)} ».`);
      await onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erreur inattendue.');
    } finally { setBusy(''); }
  }

  return (
    <div className="plan-thread-wrap" style={{ marginTop: 18 }}>
      <div className="plan-thread-top">
        <div>
          <strong>{safeStr(request.organization?.name) || '—'} · {request.requestedTierLabel} ({formatPrice(request.requestedPrice)})</strong>
          <small>Demande du {safeDateTime(request.createdAt)} · {request.paymentMethodLabel}{request.contactPhone ? ` · ${request.contactPhone}` : ''}</small>
          <small>Contact : {request.contactName} · {request.contactEmail}</small>
        </div>
        <span className={`status-badge ${planRequestStatusBadge(request.status)}`}>{planRequestStatusLabel(request.status)}</span>
        <button type="button" className="close-x" onClick={onClose} aria-label="Fermer le dossier"><X size={16} /></button>
      </div>

      {request.needs && <p className="muted" style={{ margin: '0 0 10px' }}><strong>Besoin exprimé :</strong> {request.needs}</p>}
      {deliveredCode && (
        <div className="plan-thread-key" style={{ marginBottom: 10 }}>
          <Key size={14} /><code>{deliveredCode}</code>
          <button type="button" className="link-button" onClick={() => navigator.clipboard?.writeText(deliveredCode).catch(() => window.prompt('Copiez la clé :', deliveredCode))}>Copier</button>
        </div>
      )}

      {request.messages.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>Aucun message échangé pour le moment.</p>
      ) : (
        <div className="plan-thread">
          {request.messages.map((message) => (
            <article className={'plan-thread-msg' + (message.isSuperAdmin ? ' mine' : ' them')} key={message.id}>
              <header>
                <strong>{message.isSuperAdmin ? 'Vous (plateforme)' : safeStr(message.authorName, 'Organisation')}</strong>
                <time>{safeDateTime(message.createdAt)}</time>
              </header>
              <p>{message.body}</p>
              {message.licenseKey && (
                <div className="plan-thread-key">
                  <Key size={14} /><code>{message.licenseKey}</code>
                  <button type="button" className="link-button" onClick={() => navigator.clipboard?.writeText(message.licenseKey ?? '').catch(() => window.prompt('Copiez la clé :', message.licenseKey ?? ''))}>Copier</button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <form onSubmit={sendMessage} className="plan-thread-form">
        <textarea
          value={reply}
          onChange={(event) => setReply(event.target.value)}
          placeholder="Réponse à l’organisation (instructions de paiement, confirmation, précisions…)"
          rows={3}
          maxLength={2000}
          required
        />
        <label>Joindre une clé d’activation disponible (facultatif)
          <select value={licenseChoice} onChange={(event) => setLicenseChoice(event.target.value)}>
            <option value="">— Aucune (message simple) —</option>
            {availableKeys.map((license) => <option key={license.id} value={license.code}>{license.code}</option>)}
          </select>
          {availableKeys.length === 0 && <small className="muted">Aucune clé {request.requestedTierLabel} disponible : utilisez « Générer et délivrer ».</small>}
        </label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="submit" className="primary-button" disabled={busy === 'message'}>
            <Send size={15} /> {busy === 'message' ? 'Envoi…' : 'Envoyer le message'}
          </button>
          <button type="button" className="outline-button" onClick={deliver} disabled={busy === 'deliver'}>
            <Sparkles size={15} /> {busy === 'deliver' ? 'Génération…' : 'Générer et délivrer une clé'}
          </button>
        </div>
      </form>

      <div className="plan-thread-actions">
        <button type="button" className="outline-button" onClick={() => setStatus('PROCESSING')} disabled={busy === 'PROCESSING'}>Marquer en traitement</button>
        <button type="button" className="outline-button" onClick={() => setStatus('APPROVED')} disabled={busy === 'APPROVED'}>Approuver</button>
        <button type="button" className="outline-button danger" onClick={() => setStatus('REJECTED')} disabled={busy === 'REJECTED'}>Refuser</button>
      </div>
    </div>
  );
}
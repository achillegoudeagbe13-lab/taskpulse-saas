'use client';

import { useCallback, useEffect, useState } from 'react';
import { Key, MessageSquare, RefreshCw, Send, Sparkles } from './ui-icons';
import { asArray, safeDateTime, safeStr } from '../lib/render-safe';
import { TIERS, formatPrice } from '../lib/plans';
import { isOpenPlanRequest, planRequestStatusBadge, planRequestStatusLabel, type PlanRequestView } from '../lib/plan-requests';

type PaymentMethod = { value: string; label: string };

/**
 * Parcours client d'abonnement (administrateur d'organisation) :
 * envoi d'une demande d'activation au super-admin plateforme depuis la grille
 * tarifaire, puis conversation de suivi jusqu'à la remise de la clé.
 */
export default function PlanRequestsPanel() {
  const [requests, setRequests] = useState<PlanRequestView[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sending, setSending] = useState(false);
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState('');
  const [selectedTier, setSelectedTier] = useState<'T1' | 'T2' | 'T3' | 'T4'>('T2');
  const [form, setForm] = useState({ contactName: '', contactEmail: '', contactPhone: '', paymentMethod: 'MOBILE_MONEY', needs: '' });

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/org/plan-requests', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Chargement des demandes impossible.');
      setRequests(asArray<PlanRequestView>(json.requests));
      setPaymentMethods(asArray<PaymentMethod>(json.paymentMethods));
      setForm((prev) => ({
        ...prev,
        contactName: prev.contactName || safeStr(json.contact?.name),
        contactEmail: prev.contactEmail || safeStr(json.contact?.email),
        contactPhone: prev.contactPhone || safeStr(json.contact?.phone),
      }));
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openRequest = requests.find((request) => isOpenPlanRequest(request.status)) ?? null;
  const openRequestId = openRequest?.id ?? null;

  // Rafraîchissement périodique tant qu'un dossier est ouvert (réponses du super-admin).
  useEffect(() => {
    if (!openRequestId) return;
    const timer = window.setInterval(() => { load(); }, 30000);
    return () => window.clearInterval(timer);
  }, [openRequestId, load]);

  async function sendRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true); setError(''); setNotice('');
    try {
      const res = await fetch('/api/org/plan-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestedTier: selectedTier,
          contactName: form.contactName,
          contactEmail: form.contactEmail,
          contactPhone: form.contactPhone || null,
          paymentMethod: form.paymentMethod,
          needs: form.needs || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Envoi de la demande impossible.');
      setNotice('Demande envoyée. L’administrateur de la plateforme va vous répondre ici.');
      setForm((prev) => ({ ...prev, needs: '' }));
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erreur inattendue.');
    } finally { setSending(false); }
  }

  async function sendReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!openRequest || reply.trim().length === 0) return;
    setReplying(true); setError(''); setNotice('');
    try {
      const res = await fetch(`/api/org/plan-requests/${openRequest.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: reply }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Envoi du message impossible.');
      setReply('');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erreur inattendue.');
    } finally { setReplying(false); }
  }

  async function activateDelivered(code: string) {
    setError(''); setNotice('');
    try {
      const res = await fetch('/api/org/activate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Activation impossible.');
      setNotice('Licence activée : votre abonnement est à jour.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erreur inattendue.');
    }
  }

  if (loading) {
    return (
      <section className="panel" style={{ marginTop: 18 }}>
        <p className="muted"><span className="spinner" /> Chargement des demandes d’abonnement…</p>
      </section>
    );
  }

  return (
    <section className="panel" style={{ marginTop: 18 }}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow" style={{ marginBottom: 4 }}>ABONNEMENT</p>
          <h3>Demande d’activation</h3>
        </div>
        <span className="table-badge"><MessageSquare size={13} /> Suivi avec la plateforme</span>
      </div>

      <p className="muted" style={{ marginBottom: 14 }}>
        Choisissez un palier, envoyez votre demande (coordonnées et moyen de paiement) puis suivez la
        réponse de l’administrateur de la plateforme dans la conversation ci-dessous. La clé
        d’activation vous y sera remise.
      </p>

      {error && <div className="notice error">{error}</div>}
      {notice && <div className="notice success">{notice}</div>}

      {openRequest ? (
        <div className="plan-thread-wrap">
          <div className="plan-thread-top">
            <div>
              <strong>{openRequest.requestedTierLabel} · {formatPrice(openRequest.requestedPrice)}</strong>
              <small>Demande du {safeDateTime(openRequest.createdAt)} · {openRequest.paymentMethodLabel}</small>
            </div>
            <span className={`status-badge ${planRequestStatusBadge(openRequest.status)}`}>{planRequestStatusLabel(openRequest.status)}</span>
          </div>

          {openRequest.messages.length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>Aucun message pour le moment. La plateforme va prendre contact.</p>
          ) : (
            <div className="plan-thread">
              {openRequest.messages.map((message) => (
                <article className={'plan-thread-msg' + (message.isSuperAdmin ? ' them' : ' mine')} key={message.id}>
                  <header>
                    <strong>{message.isSuperAdmin ? 'Administrateur plateforme' : safeStr(message.authorName, 'Vous')}</strong>
                    <time>{safeDateTime(message.createdAt)}</time>
                  </header>
                  <p>{message.body}</p>
                  {message.licenseKey && (
                    <div className="plan-thread-key">
                      <Key size={14} />
                      <code>{message.licenseKey}</code>
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => navigator.clipboard?.writeText(message.licenseKey ?? '').catch(() => window.prompt('Copiez la clé :', message.licenseKey ?? ''))}
                      >
                        Copier
                      </button>
                      <button type="button" className="link-button" onClick={() => activateDelivered(message.licenseKey ?? '')}>
                        Activer maintenant
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}

          <form onSubmit={sendReply} className="plan-thread-form">
            <textarea
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              placeholder="Écrire à l’administrateur de la plateforme (référence de paiement, disponibilité…)"
              rows={3}
              maxLength={2000}
              required
            />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="submit" className="primary-button" disabled={replying}>
                <Send size={15} /> {replying ? 'Envoi…' : 'Envoyer le message'}
              </button>
              <button type="button" className="outline-button" onClick={load}><RefreshCw size={15} /> Actualiser</button>
            </div>
          </form>
        </div>
      ) : (
        <PlanRequestForm
          selectedTier={selectedTier}
          onSelectTier={setSelectedTier}
          paymentMethods={paymentMethods}
          form={form}
          onChangeForm={setForm}
          onSubmit={sendRequest}
          sending={sending}
        />
      )}

      {requests.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <p className="muted" style={{ fontWeight: 700, marginBottom: 8 }}>Historique des demandes</p>
          <div className="responsive-table">
            <table>
              <thead><tr><th>Palier</th><th>Tarif</th><th>Statut</th><th>Paiement</th><th>Envoyée le</th><th>Décidée le</th></tr></thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td><strong>{request.requestedTierLabel}</strong></td>
                    <td>{formatPrice(request.requestedPrice)}</td>
                    <td><span className={`status-badge ${planRequestStatusBadge(request.status)}`}>{planRequestStatusLabel(request.status)}</span></td>
                    <td>{request.paymentMethodLabel}</td>
                    <td>{safeDateTime(request.createdAt) || '—'}</td>
                    <td>{safeDateTime(request.decidedAt) || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

type FormState = { contactName: string; contactEmail: string; contactPhone: string; paymentMethod: string; needs: string };

/** Formulaire de demande : choix du palier + coordonnées + moyen de paiement. */
function PlanRequestForm({
  selectedTier, onSelectTier, paymentMethods, form, onChangeForm, onSubmit, sending,
}: {
  selectedTier: 'T1' | 'T2' | 'T3' | 'T4';
  onSelectTier: (tier: 'T1' | 'T2' | 'T3' | 'T4') => void;
  paymentMethods: PaymentMethod[];
  form: FormState;
  onChangeForm: (next: FormState) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  sending: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="plan-request-form">
      <p className="muted" style={{ fontWeight: 700, marginBottom: 8 }}>1. Palier souhaité</p>
      <div className="pricing-grid">
        {TIERS.map((tier) => (
          <button
            type="button"
            key={tier.tier}
            className={'pricing-card' + (tier.tier === selectedTier ? ' highlight' : '')}
            onClick={() => onSelectTier(tier.tier)}
            style={{ textAlign: 'left', cursor: 'pointer' }}
          >
            <span className="muted" style={{ fontSize: 11 }}>{tier.label}</span>
            <span className="price">{formatPrice(tier.price)}</span>
            <span className="muted" style={{ fontSize: 11 }}>{selectedTier === tier.tier ? '✓ Sélectionné' : 'Choisir ce palier'}</span>
          </button>
        ))}
      </div>

      <p className="muted" style={{ fontWeight: 700, margin: '18px 0 8px' }}>2. Vos coordonnées et le paiement</p>
      <div className="plan-request-fields">
        <label>Nom du contact
          <input value={form.contactName} onChange={(event) => onChangeForm({ ...form, contactName: event.target.value })} minLength={2} maxLength={120} required />
        </label>
        <label>E-mail de contact
          <input type="email" value={form.contactEmail} onChange={(event) => onChangeForm({ ...form, contactEmail: event.target.value })} maxLength={160} required />
        </label>
        <label>Téléphone (facultatif)
          <input value={form.contactPhone} onChange={(event) => onChangeForm({ ...form, contactPhone: event.target.value })} maxLength={40} />
        </label>
        <label>Moyen de paiement
          <select value={form.paymentMethod} onChange={(event) => onChangeForm({ ...form, paymentMethod: event.target.value })}>
            {paymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
          </select>
        </label>
      </div>
      <label style={{ display: 'block', marginTop: 12 }}>Message (facultatif)
        <textarea value={form.needs} onChange={(event) => onChangeForm({ ...form, needs: event.target.value })} rows={3} maxLength={1000} placeholder="Précisez votre besoin, la date d’effet souhaitée, une référence de transaction…" />
      </label>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14, alignItems: 'center' }}>
        <button type="submit" className="primary-button" disabled={sending}>
          <Sparkles size={15} /> {sending ? 'Envoi…' : 'Envoyer la demande'}
        </button>
        <small className="muted">Une seule demande ouverte à la fois.</small>
      </div>
    </form>
  );
}

'use client';

import { useState } from 'react';
import { Building2, Key, RefreshCw, ShieldCheck } from './ui-icons';
import { TIERS, formatPrice, formatExpiry } from '../lib/plans';

export type OrgPlan = {
  tier: string | null;
  planStatus: string;
  expiresAt: string | null;
  daysLeft?: number;
  inTrial?: boolean;
  seatLimit: number | null;
  currentMembers: number;
  pendingInvites: number;
  projectedSeats: number;
  overLimit: boolean;
  locked: boolean;
  lockReason: string | null;
  planLabel: string;
  planPrice: number;
  licenseCode: string | null;
};

/**
 * Écran de verrouillage / mise à niveau affiché quand l'abonnement de
 * l'organisation est expiré ou que le palier est dépassé. L'administrateur
 * peut saisir un code d'activation pour débloquer (ou mettre à niveau).
 */
export default function PlanLock({ plan, orgName, onActivated }: { plan: OrgPlan; orgName: string; onActivated: () => void }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function activate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/org/activate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Activation impossible.');
      onActivated();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erreur inattendue.');
    } finally { setLoading(false); }
  }

  const reasonLabel =
    plan.lockReason === 'DEPASSEMENT_PALIER'
      ? `Votre équipe dépasse la limite de votre palier (${plan.seatLimit ?? '—'} membre(s) autorisé(s)).`
      : plan.lockReason === 'EXPIRATION'
        ? 'Votre abonnement est arrivé à expiration.'
        : 'Votre espace est verrouillé.';

  return (
    <div className="plan-lock panel">
      <span className="plan-icon"><ShieldCheck size={26} /></span>
      <p className="eyebrow" style={{ marginBottom: 4 }}>ABONNEMENT</p>
      <h2>Accès verrouillé</h2>
      <p className="muted">{reasonLabel}</p>

      <div className="plan-facts">
        <div className="plan-fact"><small>Organisation</small><strong>{orgName || '—'}</strong></div>
        <div className="plan-fact"><small>Palier actuel</small><strong>{plan.planLabel} · {formatPrice(plan.planPrice)}</strong></div>
        <div className="plan-fact"><small>Membres occupés</small><strong>{plan.currentMembers} + {plan.pendingInvites} invitation(s)</strong></div>
        <div className="plan-fact"><small>Expiration</small><strong>{formatExpiry(plan.expiresAt || null)}</strong></div>
      </div>

      <p className="muted" style={{ fontSize: 12.5 }}>
        <Building2 size={13} style={{ verticalAlign: 'middle' }} /> Pour débloquer l’espace (ou passer au palier supérieur), saisissez le
        <strong> code d’activation</strong> reçu après paiement. Contactez l’administrateur de la plateforme pour l’obtenir.
      </p>

      <form onSubmit={activate} style={{ width: '100%', maxWidth: 400, display: 'grid', gap: 10 }}>
        <input
          className="plan-code-input"
          name="code"
          placeholder="MCF-XXXX-XXXX-XXXX"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          required
          minLength={8}
          maxLength={64}
        />
        {error && <div className="notice error">{error}</div>}
        <button type="submit" className="primary-button" disabled={loading}>
          <Key size={16} /> {loading ? 'Activation…' : 'Activer le code'}
        </button>
      </form>

      <div style={{ width: '100%', maxWidth: 520, marginTop: 14 }}>
        <p className="muted" style={{ fontWeight: 700, marginBottom: 8, textAlign: 'left' }}>Grille tarifaire (par palier de membres)</p>
        <div className="pricing-grid">
          {TIERS.map((t) => (
            <div className={'pricing-card' + (t.tier === plan.tier ? ' highlight' : '')} key={t.tier}>
              <span className="muted" style={{ fontSize: 11 }}>{t.label}</span>
              <span className="price">{formatPrice(t.price)}</span>
            </div>
          ))}
        </div>
      </div>

      <button type="button" className="outline-button" onClick={onActivated} style={{ marginTop: 6 }}>
        <RefreshCw size={15} /> Re-vérifier la licence
      </button>
    </div>
  );
}
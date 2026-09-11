'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Send, Zap } from '../ui-icons';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ message: string; resetUrl?: string } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await fetch('/api/auth/forgot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Demande impossible.'); return; }
      setResult(json);
    } catch { setError('Impossible de joindre le serveur.'); }
    finally { setLoading(false); }
  }

  return (
    <main className="auth-page">
      <div className="auth-art">
        <div className="brand"><span className="brand-mark"><Zap size={16} fill="currentColor" /></span> MAR-CI FLOW</div>
        <div className="art-copy">
          <p className="eyebrow">ACCÈS</p>
          <h1>Mot de passe <em>oublié&nbsp;?</em></h1>
          <p>Recevez un lien unique, valable 24 h et à usage unique, pour réinitialiser votre mot de passe.</p>
        </div>
        <div className="art-footer"><span>Lien unique</span><span>•</span><span>Sécurisé</span></div>
      </div>

      <section className="auth-panel">
        {result ? (
          <>
            <h2>Vérifiez votre messagerie</h2>
            <p className="muted">{result.message}</p>
            {result.resetUrl ? (
              <div className="notice" style={{ marginTop: 16, fontSize: 12.5, wordBreak: 'break-all' }}>
                <strong>Lien (mode démo, pas d’e-mail configuré) :</strong><br />
                <Link href={result.resetUrl} style={{ color: 'var(--blue)' }}>{result.resetUrl}</Link>
              </div>
            ) : null}
            <button className="outline-button" style={{ width: '100%', marginTop: 18 }} onClick={() => setResult(null)}>Envoyer à une autre adresse</button>
          </>
        ) : (
          <form onSubmit={submit}>
            <h2>Réinitialiser</h2>
            <p className="muted">Saisissez l’email de votre compte. Un lien unique vous sera transmis.</p>
            <label style={{ display: 'grid', gap: 6, marginTop: 20 }}>
              <span className="field-caption">EMAIL DU COMPTE</span>
              <input name="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            {error && <div className="notice error" style={{ marginTop: 16 }}>{error}</div>}
            <button type="submit" disabled={loading} className="primary-button" style={{ width: '100%', marginTop: 20 }}><Send size={16} /> {loading ? 'Envoi…' : 'Envoyer le lien'}</button>
            <p className="muted" style={{ textAlign: 'center', margin: '18px 0 0', fontSize: 13 }}>
              <Link href="/login" style={{ color: 'var(--blue)', fontWeight: 700 }}>Retour à la connexion</Link>
            </p>
          </form>
        )}
      </section>
    </main>
  );
}
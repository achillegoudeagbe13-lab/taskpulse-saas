'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Key, Zap } from '../ui-icons';

/**
 * Page de réinitialisation du mot de passe via lien unique.
 * Le jeton est validé côté serveur (usage unique, expire après 24 h).
 */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="loading-state"><span className="spinner" /> Vérification du lien…</div>}>
      <ResetContent />
    </Suspense>
  );
}

function ResetContent() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';

  const [valid, setValid] = useState<null | boolean>(null);
  const [owner, setOwner] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) { setValid(false); setLoading(false); return; }
    (async () => {
      try {
        const res = await fetch(`/api/auth/reset?token=${encodeURIComponent(token)}`);
        const json = await res.json();
        if (!res.ok) { setValid(false); setError(json.error ?? 'Lien invalide.'); }
        else { setValid(true); setOwner(json.user?.firstName ?? ''); }
      } catch { setValid(false); setError('Impossible de valider le lien.'); }
      finally { setLoading(false); }
    })();
  }, [token]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    if ((data.password ?? '').length < 8) { setError('Le mot de passe doit contenir au moins 8 caractères.'); return; }
    if (data.password !== data.confirm) { setError('Les deux mots de passe ne correspondent pas.'); return; }
    try {
      const res = await fetch('/api/auth/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password: data.password }) });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Réinitialisation impossible.'); return; }
      setDone(true);
    } catch { setError('Impossible de joindre le serveur.'); }
  }

  return (
    <main className="auth-page">
      <div className="auth-art">
        <div className="brand"><span className="brand-mark"><Zap size={16} fill="currentColor" /></span> MAR-CI FLOW</div>
        <div className="art-copy">
          <p className="eyebrow">SÉCURITÉ</p>
          <h1>Réinitialisation <em>sécurisée.</em></h1>
          <p>Votre mot de passe est réinitialisé via un lien unique à usage unique. Personne ne le connaît ni ne le stocke en clair.</p>
        </div>
        <div className="art-footer"><span>Lien unique</span><span>•</span><span>Zéro-connaissance</span></div>
      </div>

      <section className="auth-panel">
        {done ? (
          <>
            <h2>Mot de passe mis à jour ✓</h2>
            <p className="muted">Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</p>
            <button className="primary-button" style={{ width: '100%', marginTop: 20 }} onClick={() => router.push('/login')}>Se connecter</button>
          </>
        ) : loading ? (
          <div className="loading-state"><span className="spinner" /> Vérification du lien…</div>
        ) : valid ? (
          <form onSubmit={submit}>
            <h2>Nouveau mot de passe</h2>
            <p className="muted">Bonjour{owner ? ` ${owner}` : ''} — définissez votre nouveau mot de passe (8 caractères min.).</p>
            <label style={{ display: 'grid', gap: 6, marginTop: 18 }}>
              <span className="field-caption">NOUVEAU MOT DE PASSE</span>
              <input name="password" type="password" required minLength={8} autoComplete="new-password" />
            </label>
            <label style={{ display: 'grid', gap: 6, marginTop: 14 }}>
              <span className="field-caption">CONFIRMATION</span>
              <input name="confirm" type="password" required minLength={8} autoComplete="new-password" />
            </label>
            {error && <div className="notice error" style={{ marginTop: 16 }}>{error}</div>}
            <button type="submit" className="primary-button" style={{ width: '100%', marginTop: 22 }}><Key size={16} /> Réinitialiser</button>
          </form>
        ) : (
          <div>
            <h2>Lien invalide</h2>
            <p className="muted">{error || 'Ce lien est invalide, expiré ou déjà utilisé.'}</p>
            <p className="muted" style={{ marginTop: 12, fontSize: 13 }}><Link href="/forgot">Demander un nouveau lien</Link></p>
          </div>
        )}
      </section>
    </main>
  );
}
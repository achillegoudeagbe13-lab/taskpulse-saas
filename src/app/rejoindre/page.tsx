'use client';

import { FormEvent, useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Zap } from '../ui-icons';

type InvitePreview = { organization: { id: string; name: string; slug: string }; role: string; email?: string | null; firstName?: string | null; lastName?: string | null; expiresAt: string };

function JoinForm() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) { setError('Jeton d’invitation manquant.'); return; }
    fetch(`/api/join?token=${encodeURIComponent(token)}`).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setPreview(result);
    }).catch((reason: Error) => setError(reason.message));
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch('/api/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, token }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error ?? 'Impossible de rejoindre cette organisation.'); return; }
    // Session créée côté serveur : l'utilisateur est directement connecté.
    setDone(true);
  }

  if (done) {
    const slug = preview?.organization?.slug;
    return (
      <>
        <p className="eyebrow">BIENVENUE</p>
        <h2>Vous avez rejoint {preview?.organization.name}.</h2>
        <p className="muted">Votre compte est actif avec le rôle {preview?.role === 'INTERN' ? 'Stagiaire' : 'Employé'}.</p>
        {slug ? (
          <Link className="primary-button" href={`/o/${slug}`}>Accéder à mon espace <ChevronRight size={17} /></Link>
        ) : (
          <Link className="primary-button" href="/">Accéder à mon espace <ChevronRight size={17} /></Link>
        )}
      </>
    );
  }

  return (
    <>
      <p className="eyebrow">INVITATION</p>
      <h2>Rejoindre l’équipe.</h2>
      {!error && preview && (
        <p className="muted">
          Vous êtes invité(e) à rejoindre <strong>{preview.organization.name}</strong> en tant que{' '}
          <strong>{preview.role === 'INTERN' ? 'Stagiaire' : 'Employé'}</strong>.
          {preview.email ? ` Email attendu : ${preview.email}.` : ''}
        </p>
      )}
      {error ? (
        <div className="notice error">{error}</div>
      ) : preview ? (
        <form onSubmit={submit} className="auth-form">
          <div className="two-col">
            <label>Prénom<input name="firstName" required defaultValue={preview.firstName ?? ''} /></label>
            <label>Nom<input name="lastName" required defaultValue={preview.lastName ?? ''} /></label>
          </div>
          <label>Nom d’utilisateur<input name="username" required placeholder="prenom.nom" /></label>
          <label>Mot de passe<input name="password" required type="password" minLength={8} placeholder="8 caractères minimum" /></label>
          <button className="primary-button" type="submit">Rejoindre l’organisation <ChevronRight size={17} /></button>
        </form>
      ) : (
        <div className="loading-state"><span className="spinner" /> Vérification de l’invitation…</div>
      )}
    </>
  );
}

export default function JoinPage() {
  return (
    <main className="auth-page">
      <div className="auth-art">
        <div className="brand"><span className="brand-mark"><Zap size={18} fill="currentColor" /></span> MAR-CI FLOW</div>
        <div className="art-copy">
          <p className="eyebrow">INVITATION ÉQUIPE</p>
          <h1>Un seul lien<br /><em>et vous êtes dans la boucle.</em></h1>
          <p>Créez votre compte pour retrouver les tâches et activités de votre organisation.</p>
        </div>
        <div className="art-footer"><span>Suivi intelligent</span><span>•</span><span>Équipe en mouvement</span></div>
      </div>
      <section className="auth-panel">
        <div className="auth-mobile-brand"><span className="brand-mark"><Zap size={17} fill="currentColor" /></span> MAR-CI FLOW</div>
        <Suspense fallback={<div className="loading-state"><span className="spinner" /> Chargement…</div>}>
          <JoinForm />
        </Suspense>
        <p className="switch-copy"><Link className="text-button" href="/">Retour à l’accueil</Link></p>
      </section>
    </main>
  );
}
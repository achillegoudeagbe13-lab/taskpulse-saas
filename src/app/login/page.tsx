'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogIn, Zap } from '../ui-icons';

const Eye = (p: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={p.size || 20} height={p.size || 20} fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s8-7 11-7 11 7 11 7-8 7-11 7-11-7-11-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const EyeOff = (p: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={p.size || 20} height={p.size || 20} fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.9 12H6.1" />
    <line x1="11" y1="11" x2="4" y2="4" />
    <line x1="12" y1="12" x2="12" y2="12" />
  </svg>
);

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: data.identifier, password: data.password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Erreur de connexion.');
      } else {
        // La réponse est { user: publicUser(...) } — on lit donc sur json.user.
        const user = json?.user ?? json;
        const slug = user?.organization?.slug ?? json.organization?.slug;
        if (user?.platformRole === 'PLATFORM_SUPER_ADMIN') router.push('/platform');
        else if (slug) router.push('/o/' + slug);
        else router.push('/');
      }
    } catch {
      setError('Impossible de joindre le serveur.');
    }
    setLoading(false);
  };

  return (
    <main className="auth-page">
      <div className="auth-art">
        <div className="brand"><span className="brand-mark"><Zap size={16} fill="currentColor" /></span> TASKPULSE</div>
        <div className="art-copy">
          <p className="eyebrow">ESPACE MEMBRE</p>
          <h1>Le travail, <em>en mouvement.</em></h1>
          <p>Retrouvez vos tâches, votre pointage et votre équipe — où que vous soyez.</p>
        </div>
        <div className="art-footer"><span>Suivi intelligent</span><span>•</span><span>Équipe en mouvement</span></div>
      </div>

      <section className="auth-panel">
        <form onSubmit={handleSubmit}>
          <h2>Bon retour 👋</h2>
          <p className="muted" style={{ marginTop: -4, marginBottom: 0 }}>Connectez-vous à votre espace TaskPulse.</p>

          <label style={{ display: 'grid', gap: 6, marginTop: 24 }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', color: '#465065' }}>IDENTIFIANT</span>
            <input
              name="identifier"
              type="text"
              placeholder="Nom d'utilisateur ou email"
              required
              autoComplete="username"
            />
          </label>

          <label style={{ display: 'grid', gap: 6, marginTop: 16 }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', color: '#465065' }}>MOT DE PASSE</span>
            <span style={{ position: 'relative', display: 'block' }}>
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Votre mot de passe"
                required
                minLength={8}
                autoComplete="current-password"
                style={{ paddingRight: 46 }}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Cacher le mot de passe' : 'Afficher le mot de passe'}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#98a2b3' }}
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </span>
          </label>

          {error && <div className="notice error" style={{ marginTop: 16 }}>{error}</div>}

          <button type="submit" disabled={loading} className="primary-button" style={{ width: '100%', marginTop: 24 }}>
            {loading ? 'Connexion…' : <><LogIn size={17} /> Se connecter</>}
          </button>

          <p className="muted" style={{ textAlign: 'center', margin: '20px 0 0', fontSize: 13 }}>
            Pas encore d’organisation ?{' '}
            <Link href="/register-org" style={{ color: 'var(--blue)', fontWeight: 700 }}>Créer</Link>
            {' '}·{' '}
            Invité(e) ?{' '}
            <Link href="/rejoindre" style={{ color: 'var(--blue)', fontWeight: 700 }}>Rejoindre</Link>
          </p>
        </form>
      </section>
    </main>
  );
}


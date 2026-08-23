'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogIn } from '../ui-icons';

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
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: data.identifier, password: data.password }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || 'Erreur de connexion.');
    } else {
      const slug = json.organization?.slug;
      if (json.isPlatformSuperAdmin) router.push('/platform');
      else if (slug) router.push('/o/' + slug);
      else router.push('/');
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg">
        <h1 className="text-3xl font-bold text-center mb-2">TaskPulse</h1>
        <p className="text-center text-gray-600 mb-6">Connexion à votre espace</p>
        <div className="mb-4">
          <input
            name="identifier"
            type="text"
            placeholder="Nom d'utilisateur ou email"
            required
            autoComplete="username"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
          />
        </div>
        <div className="relative mb-6">
          <input
            name="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Mot de passe"
            required
            minLength={8}
            autoComplete="current-password"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 pr-12"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            aria-label={showPassword ? 'Cacher le mot de passe' : 'Afficher le mot de passe'}
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? 'Connexion...' : <><LogIn size={18} /> Se connecter</>}
        </button>
        <p className="mt-6 text-center text-sm text-gray-600">
          Pas d'organisation ?{' '}
          <Link href="/register-org" className="text-blue-600 hover:underline">
            Créer une organisation
          </Link>
        </p>
      </form>
    </main>
  );
}


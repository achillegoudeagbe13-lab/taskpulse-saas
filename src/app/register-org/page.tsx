'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RegisterOrgPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [orgData, setOrgData] = useState({
    name: '', sector: '', country: '', contactEmail: '', phone: '',
  });

  const handleOrgSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget)) as any;
    setOrgData({
      name: d.name, sector: d.sector, country: d.country,
      contactEmail: d.contactEmail, phone: d.phone || '',
    });
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const d = Object.fromEntries(new FormData(e.currentTarget)) as any;
    const res = await fetch('/api/org/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization: orgData,
        responsible: {
          firstName: d.firstName, lastName: d.lastName,
          username: d.username, email: d.email, password: d.password,
        },
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || 'Erreur lors de la création.');
    } else {
      router.push('/o/' + json.organization.slug);
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <form
        onSubmit={step === 1 ? handleOrgSubmit : handleSubmit}
        className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg"
      >
        <h1 className="text-3xl font-bold text-center mb-2">TaskPulse</h1>
        <p className="text-center text-gray-600 mb-6">
          {step === 1 ? "Créer votre organisation — Étape 1/2" : "Compte responsable — Étape 2/2"}
        </p>

        {step === 1 && (
          <>
            <input name="name" type="text" placeholder="Nom de l'organisation" required minLength={2} maxLength={120} className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4" />
            <input name="sector" type="text" placeholder="Secteur d'activité" maxLength={120} className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4" />
            <input name="country" type="text" placeholder="Pays" maxLength={80} className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4" />
            <input name="contactEmail" type="email" placeholder="Email professionnel" required className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4" />
            <input name="phone" type="text" placeholder="Téléphone (optionnel)" maxLength={30} className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4" />
          </>
        )}

        {step === 2 && (
          <>
            <input name="firstName" type="text" placeholder="Prénom" required className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4" />
            <input name="lastName" type="text" placeholder="Nom" required className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4" />
            <input name="username" type="text" placeholder="Nom d'utilisateur" required pattern="[a-z0-9._-]{3,30}" className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4" />
            <input name="email" type="email" placeholder="Email" required className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4" />
            <input name="password" type="password" placeholder="Mot de passe" required minLength={8} className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4" />
          </>
        )}

        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}

        {step === 1 ? (
          <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700">Suivant</button>
        ) : (
          <div className="flex gap-4">
            <button type="button" onClick={() => setStep(1)} className="flex-1 border border-gray-300 py-3 rounded-lg hover:bg-gray-100">Retour</button>
            <button type="submit" disabled={loading} className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50">{loading ? 'Création...' : 'Créer l\u2019organisation'}</button>
          </div>
        )}

        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="text-blue-600 hover:underline">Déjà un compte ? Se connecter</Link>
        </p>
      </form>
    </main>
  );
}

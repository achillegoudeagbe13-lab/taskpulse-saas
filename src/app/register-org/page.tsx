'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Zap } from '../ui-icons';

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
    <main className="auth-page">
      <div className="auth-art">
        <div className="brand"><span className="brand-mark"><Zap size={16} fill="currentColor" /></span> TASKPULSE</div>
        <div className="art-copy">
          <p className="eyebrow">CRÉER VOTRE ESPACE</p>
          <h1>Votre organisation, <em>prête en 2 minutes.</em></h1>
          <p>Créez votre espace, invitez votre équipe et commencez à suivre le travail dès aujourd’hui.</p>
        </div>
        <div className="art-footer"><span>Suivi intelligent</span><span>•</span><span>Équipe en mouvement</span></div>
      </div>

      <section className="auth-panel">
        <form
          onSubmit={step === 1 ? handleOrgSubmit : handleSubmit}
        >
          <h2>TaskPulse</h2>
          <p className="muted" style={{ marginTop: -4, marginBottom: 0 }}>
            {step === 1 ? 'Créer votre organisation — Étape 1/2' : 'Compte responsable — Étape 2/2'}
          </p>

          {step === 1 && (
            <div style={{ display: 'grid', gap: 12, marginTop: 22 }}>
              <input name="name" type="text" placeholder="Nom de l'organisation" required minLength={2} maxLength={120} />
              <input name="sector" type="text" placeholder="Secteur d'activité" maxLength={120} />
              <input name="country" type="text" placeholder="Pays" maxLength={80} />
              <input name="contactEmail" type="email" placeholder="Email professionnel" required />
              <input name="phone" type="text" placeholder="Téléphone (optionnel)" maxLength={30} />
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'grid', gap: 12, marginTop: 22 }}>
              <input name="firstName" type="text" placeholder="Prénom" required />
              <input name="lastName" type="text" placeholder="Nom" required />
              <input name="username" type="text" placeholder="Nom d'utilisateur" required pattern="[a-z0-9._-]{3,30}" />
              <input name="email" type="email" placeholder="Email" required />
              <input name="password" type="password" placeholder="Mot de passe (8 caractères min.)" required minLength={8} />
            </div>
          )}

          {error && <div className="notice error" style={{ marginTop: 16 }}>{error}</div>}

          {step === 1 ? (
            <button type="submit" className="primary-button" style={{ width: '100%', marginTop: 24 }}>Suivant</button>
          ) : (
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button type="button" onClick={() => setStep(1)} className="outline-button" style={{ flex: 1 }}>Retour</button>
              <button type="submit" disabled={loading} className="primary-button" style={{ flex: 1 }}>
                {loading ? 'Création…' : 'Créer l’organisation'}
              </button>
            </div>
          )}

          <p className="muted" style={{ textAlign: 'center', margin: '20px 0 0', fontSize: 13 }}>
            <Link href="/login" style={{ color: 'var(--blue)', fontWeight: 700 }}>Déjà un compte ? Se connecter</Link>
          </p>
        </form>
      </section>
    </main>
  );
}

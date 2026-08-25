'use client';

import Link from 'next/link';
import { LogIn, Zap, Clock3, MessageSquare, BarChart3 } from './ui-icons';

export default function Home() {
  return (
    <main className="hero">
      <span className="hero-badge"><Zap size={13} fill="currentColor" /> NOUVEAU · GESTION D’ÉQUIPE SIMPLIFIÉE</span>
      <h1>TaskPulse.<br />Le travail, <em>en mouvement.</em></h1>
      <p>
        Tâches, pointage, journal de travail, annonces et messagerie —
        tout ce dont votre équipe a besoin, réuni dans un espace clair et sécurisé.
      </p>

      <div className="hero-cta">
        <Link href="/login" className="primary-button">
          <LogIn size={18} /> Se connecter
        </Link>
        <Link href="/register-org" className="outline-button">
          Créer une organisation
        </Link>
      </div>

      <div className="hero-features">
        <div className="hero-feat">
          <span className="hero-feat-icon"><BarChart3 size={20} /></span>
          <div>
            <strong>Suivi intelligent</strong>
            <small>Kanban des tâches, priorités et progression en un coup d’œil.</small>
          </div>
        </div>
        <div className="hero-feat">
          <span className="hero-feat-icon"><Clock3 size={20} /></span>
          <div>
            <strong>Pointage & journal</strong>
            <small>Clock in/out précis et journal de travail validable par l’administrateur.</small>
          </div>
        </div>
        <div className="hero-feat">
          <span className="hero-feat-icon"><MessageSquare size={20} /></span>
          <div>
            <strong>Équipe connectée</strong>
            <small>Messagerie interne, annonces et notifications instantanées.</small>
          </div>
        </div>
      </div>
    </main>
  );
}
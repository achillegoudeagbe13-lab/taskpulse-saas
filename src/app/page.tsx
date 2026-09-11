import Link from 'next/link';
import { Zap, LogIn, Clock3, MessageSquare, KanbanSquare, Users, CheckCircle2, ShieldCheck } from './ui-icons';

const features = [
  {
    icon: <KanbanSquare size={22} />,
    title: 'Suivi intelligent',
    text: 'Kanban des tâches, priorités et progression en un coup d’œil.',
  },
  {
    icon: <Clock3 size={22} />,
    title: 'Pointage & journal',
    text: 'Clock in/out précis et journal de travail validable par l’administrateur.',
  },
  {
    icon: <MessageSquare size={22} />,
    title: 'Équipe connectée',
    text: 'Messagerie interne, annonces et notifications instantanées.',
  },
  {
    icon: <Users size={22} />,
    title: 'Organisation multi-équipes',
    text: 'Rôles, départements et invitations pour structurer vos effectifs.',
  },
  {
    icon: <CheckCircle2 size={22} />,
    title: 'Présences & congés',
    text: 'Pointage géolocalisé, congés et validations centralisés.',
  },
  {
    icon: <ShieldCheck size={22} />,
    title: 'Sécurité et supervision',
    text: 'Réinitialisation sécurisée et supervision sans accès au contenu privé.',
  },
];

export default function Home() {
  return (
    <main className="landing">
      <div className="landing-top">
        <Link href="/" className="landing-brand"><span className="brand-mark"><Zap size={15} fill="currentColor" /></span> MAR-CI FLOW</Link>
        <div className="landing-nav">
          <Link href="/login" className="ghost-link">Se connecter</Link>
          <Link href="/register-org" className="primary-button">Créer une organisation</Link>
        </div>
      </div>

      <header className="landing-hero">
        <span className="landing-badge"><Zap size={13} fill="currentColor" /> NOUVEAU · GESTION D’ÉQUIPE SIMPLIFIÉE</span>
        <h1>Le travail, <em>en mouvement.</em></h1>
        <p className="landing-sub">
          Tâches, pointage, journal, annonces et messagerie — tout ce dont votre
          équipe a besoin, réuni dans un espace clair et sécurisé.
        </p>
        <div className="landing-cta">
          <Link href="/login" className="primary-button"><LogIn size={17} /> Se connecter</Link>
          <Link href="/register-org" className="outline-button">Créer une organisation</Link>
        </div>
      </header>

      <section className="landing-grid" aria-label="Fonctionnalités">
        {features.map((f) => (
          <div className="landing-card" key={f.title}>
            <span className="landing-card-icon">{f.icon}</span>
            <h2>{f.title}</h2>
            <p>{f.text}</p>
          </div>
        ))}
      </section>

      <footer className="landing-footer">
        <span className="landing-brand"><span className="brand-mark"><Zap size={14} fill="currentColor" /></span> MAR-CI FLOW</span>
        <p>Le travail, en mouvement — simplifié, sécurisé, facturé par palier d’équipe.</p>
      </footer>
    </main>
  );
}
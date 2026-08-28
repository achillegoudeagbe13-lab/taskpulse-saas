'use client';

import { useState, type ReactNode } from 'react';
import { HelpCircle, Calendar, MapPin, Users, Clock, FileText, MessageSquare } from './ui-icons';

type Section = { id: string; label: string; icon: ReactNode; body: ReactNode };

const adminSections: Section[] = [
  {
    id: 'gps',
    label: 'Géolocalisation & pointage',
    icon: <MapPin size={18} />,
    body: (
      <>
        <h3>Activer le contrôle GPS</h3>
        <ul><li>Dans <strong>Paramètres de l’organisation</strong>, activez <em>« Contrôle GPS du pointage »</em>.</li><li>Définissez le <strong>rayon de tolérance</strong> autour des coordonnées du bureau.</li></ul>
        <h3>Comportement pour les employés</h3>
        <p>Si activé : le navigateur demande la géolocalisation. Hors zone = pointage bloqué.</p>
        <p>Si désactivé : la position est quand même enregistrée en arrière-plan (audit).</p>
      </>
    ),
  },
  {
    id: 'calendar',
    label: 'Calendrier & planning',
    icon: <Calendar size={18} />,
    body: (
      <>
        <h3>Vue unifiée</h3>
        <p>Le calendrier fusionne <strong>tâches deadlines</strong>, <strong>réunions</strong> et <strong>congés</strong>, chacune avec son code couleur.</p>
        <h3>Créer une réunion</h3>
        <p>Un admin peut planifier une réunion : titre, dates, lieu/link, participants → les invités sont notifiés.</p>
      </>
    ),
  },
  {
    id: 'attendance',
    label: 'Supervision des pointages',
    icon: <Clock size={18} />,
    body: (
      <>
        <h3>Suivi en temps réel</h3>
        <p>Depuis <strong>Administration → Pointages</strong>, visualisez les arrivées, départs, durées et alertes.</p>
        <h3>Audit</h3>
        <p>Chaque pointage enregistre l’IP et (si disponible) la position géographique.</p>
      </>
    ),
  },
  {
    id: 'security',
    label: 'Gestion des accès',
    icon: <Users size={18} />,
    body: (
      <>
        <h3>Rôles</h3>
        <p>Attribuez les rôles <em>Employé</em> / <em>Admin</em> / <em>Manager</em> via <strong>Administration → Utilisateurs</strong>. Seul un admin peut créer des tâches.</p>
        <h3>Sécurité des messages</h3>
        <p>L’admin ne peut en aucun cas lire le contenu des messages privés — fonction bloquée par le backend.</p>
      </>
    ),
  },
];

const employeeSections: Section[] = [
  {
    id: 'geo',
    label: 'Pointage avec géolocalisation',
    icon: <MapPin size={18} />,
    body: (
      <>
        <h3>Autoriser la localisation</h3>
        <p>Acceptez la demande du navigateur quand même (<strong>« Autoriser la géolocalisation »</strong>).</p>
        <h3>Pointer</h3>
        <p>Cliquez <strong>Arrivée</strong> ou <strong>Départ</strong>. Hors zone = bloqué avec message clair.</p>
      </>
    ),
  },
  {
    id: 'calendar',
    label: 'Utiliser le calendrier',
    icon: <Calendar size={18} />,
    body: (
      <>
        <h3>3 vues</h3>
        <p>Basculez entre <strong>Mois</strong>, <strong>Semaine</strong> et <strong>Jour</strong>.</p>
        <h3>Filtrer</h3>
        <p>Affichez/masquez les <em>Tâches</em>, <em>Réunions</em>, <em>Congés</em> et/ou un membre de l’équipe.</p>
      </>
    ),
  },
  {
    id: 'leave',
    label: 'Demander un congé',
    icon: <FileText size={18} />,
    body: (
      <>
        <h3>Déposer une demande</h3>
        <p>Dans le calendrier, cliquez <strong>« + Congé »</strong>, choisissez le type, les dates et un motif.</p>
        <h3>Suivi</h3>
        <p>Votre manager est notifié et approuve / rejette votre demande → un badge vous alerte.</p>
      </>
    ),
  },
  {
    id: 'message',
    label: 'Messagerie privée',
    icon: <MessageSquare size={18} />,
    body: (
      <>
        <h3>Lire & répondre</h3>
        <p>Les conversations sont privées et chiffrées côté serveur. L’administrateur ne peut pas les lire.</p>
      </>
    ),
  },
];

export default function HelpCenter({ isAdmin = false }: { isAdmin?: boolean }) {
  const [tab, setTab] = useState(isAdmin ? 'admin' : 'employee');
  const sections = tab === 'admin' ? adminSections : employeeSections;

  return (
    <div className="section-page">
      <div className="page-heading"><div><HelpCircle size={28} className="panel-icon" /><div><p className="eyebrow">CENTRE D’AIDE · GUIDE D’UTILISATION</p><h1>Mar-ci Flow — Guide d’utilisation</h1><p className="muted">{isAdmin ? 'Deux vues dédiées selon votre rôle.' : 'Votre guide d’utilisation en tant que membre de l’équipe.'}</p></div></div>
        <div className="help-tabs">
          {isAdmin && <button className={'tab-button' + (tab === 'admin' ? ' active' : '')} onClick={() => setTab('admin')}>👨‍💼 Guide Administrateur</button>}
          <button className={'tab-button' + (tab === 'employee' ? ' active' : '')} onClick={() => setTab('employee')}>👤 Guide Employé</button>
        </div>
      </div>

      <div className="help-grid">
        {sections.map((s) => (
          <section key={s.id} className="help-card">
            <header><span className="help-icon">{s.icon}</span><h2>{s.label}</h2></header>
            <div className="help-body">{s.body}</div>
          </section>
        ))}
      </div>
    </div>
  );
}


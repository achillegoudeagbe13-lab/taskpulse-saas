'use client';

import { useEffect, useState } from 'react';
import Dashboard from './Dashboard';
import WorkJournalPanel from '../../work-journal-panel';
import ActivitiesPanel from '../../activities-panel';
import AnnouncementsPanel from '../../announcements-panel';
import MessagesPanel from '../../messages-panel';
import HistoryPanel from '../../history-panel';
import AdminOverview from '../../admin-overview';
import InvitationsPanel from '../../invitations-panel';
import AttendancePanel from '../../attendance-panel';
import NotificationsPanel from '../../notifications-panel';
import TasksPanel from '../../tasks-panel';
import ProfilePanel from '../../profile-panel';
import ReportsPanel from '../../reports-panel';
import HelpCenter from '../../help-center';
import AdminAttendancePanel from '../../admin-attendance-panel';
import OrgSettingsPanel from '../../org-settings-panel';
import UsersPanel from './users/UsersPanel';
import NotificationBell from '../../notification-bell';
import CalendarPanel from '../../calendar-panel';
import MeetingRoomsPanel from '../../meeting-rooms-panel';
import TimeTrackingPanel from '../../time-tracking-panel';
import ActivityFeedPanel from '../../activity-feed-panel';
import MeetingNotesPanel from '../../meeting-notes-panel';
import DocumentsPanel from '../../documents-panel';
import AIAssistant from '../../ai-assistant';
import PlanLock, { type OrgPlan } from '../../plan-lock';
import PushNotifications from '../../push-notifications';
import { Moon, Sun, PlayCircle, FileText, Link2 } from '../../ui-icons';


import {
  LayoutDashboard, MessageSquare, Bell, Activity, BookOpen,
  Clock3, Settings, Users, ShieldCheck, ChevronRight, LogOut, Menu, X,
  KanbanSquare, UserRound, BarChart3, Building2, HelpCircle, Calendar, Sparkles, Video,
} from '../../ui-icons';

type User = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string | null;
  status: string;
  department: { id: string; name: string } | null;
  profile: { id: string; position?: string | null; bio?: string | null } | null;
  photoUrl?: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  platformRole: string;
  organization: { id: string; name: string; slug: string } | null;
  memberships: Array<{ organizationId: string; role: string; organization: { id: string; name: string; slug: string } }>;
  activeOrganizationId: string | null;
};

const MEMBER_TABS = [
  { id: 'Dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { id: 'Tâches', label: 'Tâches', icon: KanbanSquare },
  { id: 'Calendrier', label: 'Calendrier', icon: Calendar },
  { id: 'Visioconférence', label: 'Visioconférence', icon: Video },
  { id: 'Suivi du temps', label: 'Suivi du temps', icon: PlayCircle },
  { id: 'Fil activité', label: "Fil d'activité", icon: Activity },
  { id: 'Notes de réunion', label: 'Notes de réunion', icon: FileText },
  { id: 'Livrables', label: 'Livrables', icon: Link2 },
  { id: 'Pointage', label: 'Pointage', icon: Clock3 },
  { id: 'Messages', label: 'Messages', icon: MessageSquare },
  { id: 'Annonces', label: 'Annonces', icon: Bell },
  { id: 'Activités', label: 'Activités', icon: Activity },
  { id: 'Journal de travail', label: 'Journal de travail', icon: BookOpen },
  { id: 'Historique', label: 'Historique', icon: Clock3 },
      { id: 'Profil', label: 'Profil', icon: UserRound },
  { id: 'Aide', label: 'Aide / Guide', icon: HelpCircle },
];

const ADMIN_TABS = [
  ...MEMBER_TABS,
  { id: 'Rapports', label: 'Rapports', icon: BarChart3 },
  { id: 'Pointages', label: 'Pointages', icon: Clock3 },
  { id: 'Paramètres', label: 'Paramètres', icon: Building2 },
  { id: 'Administration', label: 'Administration', icon: Settings },
  { id: 'Invitations', label: 'Invitations', icon: Users },
  { id: 'Utilisateurs', label: 'Utilisateurs', icon: Users },
];

export default function AppLayout({
  user, organization, organizationId, orgRole, isPlatformSuperAdmin, initialPage, initialRoom,
}: {
  user: any;
  organization: { id: string; name: string; slug: string } | null;
  organizationId: string | null;
  orgRole: string | null;
  isPlatformSuperAdmin: boolean;
  /** Onglet ouvert au chargement (utilisé par les pages dédiées, ex. /o/<slug>/reunions). */
  initialPage?: string;
  /** Salle de visioconférence à rejoindre directement (paramètre `?room=`). */
  initialRoom?: string | null;
}) {
  const [activePage, setActivePage] = useState(initialPage ?? 'Dashboard');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => ((typeof window !== 'undefined' && (localStorage.getItem('mcf-theme') as any)) || 'light'));

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [branding, setBranding] = useState<{ name?: string | null; logoUrl?: string | null }>({});
  const [plan, setPlan] = useState<OrgPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(true);

  function loadPlan() {
    setPlanLoading(true);
    return fetch('/api/org/plan', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setPlan(d))
      .catch(() => setPlan(null))
      .finally(() => setPlanLoading(false));
  }

  useEffect(() => { loadPlan(); }, []);

  // Charger l'identité visuelle de l'organisation (nom + logo).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/org/branding', { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (!cancelled) setBranding({ name: json.name, logoUrl: json.logoUrl });
        }
      } catch { /* silencieux : fallback sur le nom fourni par le contexte */ }

    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('mcf-theme', theme);
  }, [theme]);

  // Fermer le drawer avec la touche Échap
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function goTo(page: string) {
    setActivePage(page);
    setDrawerOpen(false);
    // Les pages dédiées (ex. /o/<slug>/reunions) ne correspondent qu'à un onglet :
    // on revient à l'URL de l'espace de travail dès qu'on change d'onglet.
    if (typeof window !== 'undefined' && organization?.slug && page !== initialPage) {
      const root = `/o/${organization.slug}`;
      if (window.location.pathname !== root) {
        try { window.history.replaceState(null, '', root); } catch { /* no-op */ }
      }
    }
  }

    const ctx = { user, organization, organizationId, orgRole, isPlatformSuperAdmin, onNavigate: goTo, initialRoom: initialRoom ?? null };
  const tabs = orgRole === 'ORGANIZATION_ADMIN' ? ADMIN_TABS : MEMBER_TABS;

  // Abonnement verrouillé → on masque l'espace de travail au profit de l'écran d'activation.
  if (planLoading) {
    return <div className="loading-state" style={{ minHeight: '70vh', display: 'grid', placeItems: 'center' }}><span className="spinner" /> Vérification de l’abonnement…</div>;
  }
  if (plan?.locked) {
    return (
      <div className="app-shell" data-org-locked="true">
        <div style={{ padding: '4vh 20px 40px' }}>
          <PlanLock plan={plan} orgName={ctx.organization?.name ?? ''} canRequest={orgRole === 'ORGANIZATION_ADMIN'} onActivated={() => { setPlan(null); loadPlan(); }} />
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {drawerOpen && <div className="sidebar-overlay" onClick={() => setDrawerOpen(false)} aria-hidden="true" />}

      {/* Sidebar */}
      <nav className={'sidebar' + (drawerOpen ? ' open' : '')} aria-label="Navigation principale">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span className="sidebar-brand" style={{ padding: '0 4px' }}>
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logoUrl} alt="Logo de l’organisation" style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'contain', background: '#fff', border: '1px solid var(--line)', boxShadow: '0 1px 4px rgba(15,23,42,.08)' }} />
            ) : (
              <span className="brand-mark"><ShieldCheck size={16} /></span>
            )}
            {branding.name ?? organization?.name ?? 'MAR-CI FLOW'}
          </span>
          <button className="menu-button" style={{ display: 'inline-flex', width: 36, height: 36 }} onClick={() => setDrawerOpen(false)} aria-label="Fermer le menu">
            <X size={17} />
          </button>
        </div>

        {organization && <div className="sidebar-section">Espace · {organization.name}</div>}

        <div style={{ flex: 1, marginTop: 6 }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={'nav-link' + (activePage === tab.id ? ' active' : '')}
              onClick={() => goTo(tab.id)}
              aria-current={activePage === tab.id ? 'page' : undefined}
            >
              <tab.icon size={18} />
              <span>{tab.label}</span>
              <ChevronRight size={14} style={{ marginLeft: 'auto', opacity: .35 }} />
            </button>
          ))}
        </div>

        <div className="sidebar-bottom">
          <UserInfo user={user} />
          <LogoutButton />
        </div>
      </nav>

      {/* Contenu principal */}
      <div className="app-main">
        <header className="topbar">
          <button className="menu-button" onClick={() => setDrawerOpen(true)} aria-label="Ouvrir le menu">
            <Menu size={20} />
          </button>
          <button className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Basculer thème">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            <span>{theme === 'dark' ? 'Clair' : 'Sombre'}</span>
          </button>
          <div style={{ minWidth: 0 }}>
            <div className="topbar-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {branding.name ?? organization?.name ?? 'Mar-ci Flow'}
            </div>
            <div className="topbar-crumb">{activePage}</div>
          </div>
          <div className="topbar-spacer" />
          <NotificationBell onOpenAll={() => goTo('Notifications')} />
          {/* 🔔 Web Push navigateur (visible uniquement si supporté + configuré) */}
          <PushNotifications />
          {user.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.photoUrl} alt="" className="avatar top-avatar" title={user.email} />
          ) : (
            <span className="avatar top-avatar" title={user.email}>
              {(user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '')}
            </span>
          )}
        </header>

        <main className="app-content section-page" style={{ width: '100%' }}>
          {plan?.inTrial && orgRole === 'ORGANIZATION_ADMIN' && (
            <div className="trial-banner" role="status">
              <Sparkles size={15} />
              <span>
                <strong>Période d'essai</strong> — il vous reste <strong>{plan.daysLeft ?? 0} jour(s)</strong>.
                Activez un code de licence depuis les <strong>Paramètres</strong> pour continuer après l'essai.
              </span>
              <button type="button" className="trial-cta" onClick={() => goTo('Paramètres')}>Activer la licence</button>
            </div>
          )}
          {renderContent(activePage, ctx, goTo)}
        </main>
      </div>

      <AIAssistant userName={`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()} isAdmin={orgRole === 'ORGANIZATION_ADMIN'} />
    </div>
  );
}

function UserInfo({ user }: { user: User }) {
  const initials = (user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '') || '??';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 4px' }}>
      {user.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.photoUrl} alt="" className="avatar" />
      ) : (
        <span className="avatar">{initials}</span>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {user.firstName} {user.lastName}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {user.email}
        </div>
      </div>
    </div>
  );
}

function LogoutButton() {
  return (
    <button
      className="nav-link"
      style={{ color: 'var(--red)' }}
      onClick={async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login';
      }}
    >
      <LogOut size={16} />
      <span>Déconnexion</span>
    </button>
  );
}

function renderContent(
  page: string,
  ctx: { user: User; organization: { id: string; name: string; slug: string } | null; organizationId: string | null; orgRole: string | null; isPlatformSuperAdmin: boolean; initialRoom?: string | null },
  setPage: (p: string) => void,
) {
  const user = ctx.user;
  switch (page) {
    case 'Dashboard':
      return <Dashboard ctx={ctx} />;
    case 'Tâches':
      return <TasksPanel admin={ctx.orgRole === 'ORGANIZATION_ADMIN'} currentUserId={ctx.user.id} />;
    case 'Calendrier':
      return <CalendarPanel user={user as any} orgRole={ctx.orgRole} />;
    case 'Visioconférence':
      return (
        <MeetingRoomsPanel
          admin={ctx.orgRole === 'ORGANIZATION_ADMIN'}
          orgSlug={ctx.organization?.slug ?? ''}
          user={{ id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email }}
          defaultRoom={ctx.initialRoom ?? null}
        />
      );
    case 'Suivi du temps':
      return <TimeTrackingPanel isAdmin={ctx.orgRole === 'ORGANIZATION_ADMIN'} />;
    case 'Fil activité':
      return <ActivityFeedPanel />;
    case 'Notes de réunion':
      return <MeetingNotesPanel />;
    case 'Livrables':
      return <DocumentsPanel isAdmin={ctx.orgRole === 'ORGANIZATION_ADMIN'} />;
    case 'Pointage':
      return <AttendancePanel />;
    case 'Messages':
      return <MessagesPanel currentUserId={ctx.user.id} />;
    case 'Annonces':
      return <AnnouncementsPanel admin={ctx.orgRole === 'ORGANIZATION_ADMIN'} />;
    case 'Activités':
      return <ActivitiesPanel currentUserId={ctx.user.id} />;
    case 'Journal de travail':
      return <WorkJournalPanel user={user as any} onNavigate={setPage} orgRole={ctx.orgRole} />;
    case 'Historique':
      return <HistoryPanel />;
    case 'Notifications':
      return <NotificationsPanel />;
    case 'Profil':
      return <ProfilePanel />;
    case 'Aide':
      return <HelpCenter isAdmin={ctx.orgRole === 'ORGANIZATION_ADMIN'} />;
    case 'Rapports':
      return <ReportsPanel />;
    case 'Pointages':
      return <AdminAttendancePanel />;
    case 'Paramètres':
      return <OrgSettingsPanel organizationName={ctx.organization?.name ?? null} />;
    case 'Administration':
      return <AdminOverview onNavigate={setPage} />;
    case 'Invitations':
      return <InvitationsPanel />;
    case 'Utilisateurs':
      return <UsersPanel onNavigation={setPage} ctx={{ orgRole: ctx.orgRole, organization: ctx.organization }} />;
    default:
      return <div>Page inconnue</div>;
  }
}

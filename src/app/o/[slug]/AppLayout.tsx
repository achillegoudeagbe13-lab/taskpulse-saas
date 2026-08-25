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
import UsersPage from './users/page';
import NotificationBell from '../../notification-bell';

import {
  LayoutDashboard, MessageSquare, Bell, Activity, BookOpen,
  Clock3, Settings, Users, ShieldCheck, ChevronRight, LogOut, Menu, X
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
  { id: 'Pointage', label: 'Pointage', icon: Clock3 },
  { id: 'Messages', label: 'Messages', icon: MessageSquare },
  { id: 'Annonces', label: 'Annonces', icon: Bell },
  { id: 'Activités', label: 'Activités', icon: Activity },
  { id: 'Journal de travail', label: 'Journal de travail', icon: BookOpen },
  { id: 'Historique', label: 'Historique', icon: Clock3 },
];

const ADMIN_TABS = [
  ...MEMBER_TABS,
  { id: 'Administration', label: 'Administration', icon: Settings },
  { id: 'Invitations', label: 'Invitations', icon: Users },
  { id: 'Utilisateurs', label: 'Utilisateurs', icon: Users },
];

export default function AppLayout({
  user, organization, organizationId, orgRole, isPlatformSuperAdmin,
}: {
  user: any;
  organization: { id: string; name: string; slug: string } | null;
  organizationId: string | null;
  orgRole: string | null;
  isPlatformSuperAdmin: boolean;
}) {
  const [activePage, setActivePage] = useState('Dashboard');
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Fermer le drawer avec la touche Échap
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function goTo(page: string) {
    setActivePage(page);
    setDrawerOpen(false);
  }

  const ctx = { user, organization, organizationId, orgRole, isPlatformSuperAdmin };
  const tabs = orgRole === 'ORGANIZATION_ADMIN' ? ADMIN_TABS : MEMBER_TABS;

  return (
    <div className="app-shell">
      {drawerOpen && <div className="sidebar-overlay" onClick={() => setDrawerOpen(false)} aria-hidden="true" />}

      {/* Sidebar */}
      <nav className={'sidebar' + (drawerOpen ? ' open' : '')} aria-label="Navigation principale">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span className="sidebar-brand" style={{ padding: '0 4px' }}>
            <span className="brand-mark"><ShieldCheck size={16} /></span>
            TASKPULSE
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
          <div style={{ minWidth: 0 }}>
            <div className="topbar-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {organization?.name ?? 'TaskPulse'}
            </div>
            <div className="topbar-crumb">{activePage}</div>
          </div>
          <div className="topbar-spacer" />
          <NotificationBell onOpenAll={() => goTo('Notifications')} />
          <span className="avatar top-avatar" title={user.email}>
            {(user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '')}
          </span>
        </header>

        <main className="app-content section-page" style={{ width: '100%' }}>
          {renderContent(activePage, ctx, goTo)}
        </main>
      </div>
    </div>
  );
}

function UserInfo({ user }: { user: User }) {
  const initials = (user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '') || '??';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 4px' }}>
      <span className="avatar">{initials}</span>
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
  ctx: { user: User; organization: { id: string; name: string; slug: string } | null; organizationId: string | null; orgRole: string | null; isPlatformSuperAdmin: boolean },
  setPage: (p: string) => void,
) {
  const user = ctx.user;
  switch (page) {
    case 'Dashboard':
      return <Dashboard ctx={ctx} />;
    case 'Pointage':
      return <AttendancePanel />;
    case 'Messages':
      return <MessagesPanel currentUserId={ctx.user.id} />;
    case 'Annonces':
      return <AnnouncementsPanel admin={ctx.orgRole === 'ORGANIZATION_ADMIN'} />;
    case 'Activités':
      return <ActivitiesPanel currentUserId={ctx.user.id} />;
    case 'Journal de travail':
      return <WorkJournalPanel user={user as any} onNavigate={setPage} />;
    case 'Historique':
      return <HistoryPanel />;
    case 'Notifications':
      return <NotificationsPanel />;
    case 'Administration':
      return <AdminOverview onNavigate={setPage} />;
    case 'Invitations':
      return <InvitationsPanel />;
    case 'Utilisateurs':
      return <UsersPage onNavigation={setPage} ctx={{ orgRole: ctx.orgRole, organization: ctx.organization }} />;
    default:
      return <div>Page inconnue</div>;
  }
}

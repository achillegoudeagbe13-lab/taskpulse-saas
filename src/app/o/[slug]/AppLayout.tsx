'use client';

import { useState } from 'react';
import Dashboard from './Dashboard';
import WorkJournalPanel from '../../work-journal-panel';
import ActivitiesPanel from '../../activities-panel';
import AnnouncementsPanel from '../../announcements-panel';
import MessagesPanel from '../../messages-panel';
import HistoryPanel from '../../history-panel';
import AdminOverview from '../../admin-overview';
import InvitationsPanel from '../../invitations-panel';
import UsersPage from './users/page';

import {
  LayoutDashboard, MessagesSquare, Bell, Activity, BookOpen,
  Clock3, Settings, Users, ShieldCheck, ChevronRight, LogOut
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

const TABS = [
  { id: 'Dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { id: 'Messages', label: 'Messages', icon: MessageSquare },
  { id: 'Annonces', label: 'Annonces', icon: Bell },
  { id: 'Activités', label: 'Activités', icon: Activity },
  { id: 'Journal de travail', label: 'Journal de travail', icon: BookOpen },
  { id: 'Historique', label: 'Historique', icon: Clock3 },
];

const ADMIN_TABS = [
  ...TABS,
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

  const ctx = { user, organization, organizationId, orgRole, isPlatformSuperAdmin };
  const tabs = orgRole === 'ORGANIZATION_ADMIN' ? ADMIN_TABS : TABS;

  return (
    <div className="app-shell flex h-screen overflow-hidden">
      {/* Sidebar */}
      <nav className="sidebar w-64 bg-gray-900 text-white flex flex-col overflow-y-auto">
        <div className="sidebar-header p-4 border-b border-gray-700 flex items-center gap-2">
          <ShieldCheck size={20} />
          <span className="font-semibold">{organization?.name ?? 'Organisation'}</span>
        </div>
        <ul className="sidebar-nav flex-1">
          {tabs.map((tab) => (
            <li key={tab.id}>
              <button
                className={'nav-link flex items-center gap-3 px-4 py-3 hover:bg-gray-800 w-full text-left ' + (activePage === tab.id ? 'active bg-gray-800' : '')}
                onClick={() => setActivePage(tab.id)}
              >
                <tab.icon size={18} />
                <span>{tab.label}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="sidebar-footer p-4 border-t border-gray-700">
          <UserInfo user={user} />
          <LogoutButton />
        </div>
      </nav>

      {/* Main content */}
      <div className="main flex-1 flex flex-col overflow-hidden">
        <header className="topbar bg-white border-b p-4 flex items-center gap-2">
          <ChevronRight size={18} className="rotate-180" />
          <span className="breadcrumb text-gray-600">{activePage}</span>
        </header>

        <main className="main-content flex-1 overflow-auto p-6 bg-gray-50">
          {renderContent(activePage, ctx, setActivePage)}
        </main>
      </div>
    </div>
  );
}

function UserInfo({ user }: { user: User }) {
  const initials = (user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '') || '??';
  return (
    <div className="flex items-center gap-3 p-3 text-sm">
      <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
        {initials}
      </span>
      <div>
        <div>{user.firstName} {user.lastName}</div>
        <div className="text-gray-400">{user.email}</div>
      </div>
    </div>
  );
}

function LogoutButton() {
  return (
    <button
      className="flex items-center gap-3 p-3 text-red-400 hover:text-red-300 hover:bg-gray-800 w-full"
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

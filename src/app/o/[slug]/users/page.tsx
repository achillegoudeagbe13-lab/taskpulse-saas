'use client';

import { useState, useEffect } from 'react';
import { Search, MessageSquare, Settings, Trash2, Users, Send } from '@/app/ui-icons';

type MemberRow = {
  membershipId: string;
  role: string;
  joinedAt: string;
  user: {
    id: string; firstName: string; lastName: string;
    username: string; email: string; phone?: string | null;
    status?: string; department: string; photoUrl?: string | null;
  };
};

const roleLabels: Record<string, string> = {
  ORGANIZATION_ADMIN: 'Administrateur',
  EMPLOYEE: 'Employé',
  INTERN: 'Stagiaire',
};

export default function UsersPage({
  onNavigation,
  ctx,
}: {
  onNavigation: (page: string) => void;
  ctx: { orgRole: string | null; organization: { id: string; name: string; slug: string } | null };
}) {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [messageTarget, setMessageTarget] = useState<MemberRow | null>(null);
  const [messageError, setMessageError] = useState('');

  const filtered = members.filter((m) => {
    const q = query.toLowerCase();
    return (
      m.user.firstName.toLowerCase().includes(q) ||
      m.user.lastName.toLowerCase().includes(q) ||
      m.user.email.toLowerCase().includes(q) ||
      m.user.username.toLowerCase().includes(q)
    );
  });

  const load = async () => {
    setError('');
    try {
      const res = await fetch('/api/admin/users');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setMembers(json.members);
    } catch (e) {
      setError((e as Error).message || 'Impossible de charger les membres.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  async function changeRole(member: MemberRow, role: string) {
    setError(''); setNotice('');
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: member.user.id, role }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error); return; }
    setNotice(member.user.firstName + ' ' + member.user.lastName + ' est maintenant ' + (roleLabels[role] ?? role) + '.');
    load();
  }

  async function toggleStatus(member: MemberRow) {
    setError(''); setNotice('');
    const status = member.user.status === 'ACTIF' ? 'SUSPENDU' : 'ACTIF';
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: member.user.id, status }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error); return; }
    setNotice(status === 'ACTIF' ? 'Compte réactivé.' : 'Compte suspendu.');
    load();
  }

  async function removeFromOrg(member: MemberRow) {
    if (!window.confirm('Retirer ' + member.user.firstName + ' ' + member.user.lastName + ' ?')) return;
    setError(''); setNotice('');
    const res = await fetch('/api/admin/users?id=' + member.user.id, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) { setError(json.error); return; }
    setNotice('Membre retiré.');
    load();
  }

  async function sendDirectMessage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!messageTarget) return;
    setMessageError('');
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientId: messageTarget.user.id, content: data.content }),
    });
    const json = await res.json();
    if (!res.ok) { setMessageError(json.error); return; }
    setNotice('Message envoyé.');
    setMessageTarget(null);
    setMessageError('');
  }

  if (ctx.orgRole !== 'ORGANIZATION_ADMIN') {
    return <div className="p-6">Accès réservé aux administrateurs.</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gestion des membres</h1>
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un membre…"
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">{error}</div>}
      {notice && <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg">{notice}</div>}


      {loading ? (
        <p>Chargement…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Users size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold">Aucun membre</h3>
          <p className="text-gray-500">Invitez votre premier employé ou stagiaire.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr><th className="text-left p-3">Membre</th><th className="text-left p-3">Rôle</th><th className="text-left p-3">Département</th><th className="text-left p-3">Statut</th><th className="text-left p-3">Arrivée</th><th className="text-left p-3">Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map((member) => (
                <tr key={member.membershipId} className="border-t">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
                        {member.user.firstName[0]}{member.user.lastName[0]}
                      </span>
                      <div><strong>{member.user.firstName} {member.user.lastName}</strong><small className="text-gray-500 block">@{member.user.username} · {member.user.email}</small></div>
                    </div>
                  </td>
                  <td className="p-3">
                    <select value={member.role} onChange={(e) => changeRole(member, e.target.value)} className="px-2 py-1 border border-gray-300 rounded">
                      <option value="ORGANIZATION_ADMIN">Administrateur</option>
                      <option value="EMPLOYEE">Employé</option>
                      <option value="INTERN">Stagiaire</option>
                    </select>
                  </td>
                  <td className="p-3">{member.user.department || '—'}</td>
                  <td className="p-3">
                    <span className={'px-2 py-1 text-xs rounded ' + (member.user.status === 'ACTIF' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600')}>
                      {member.user.status === 'ACTIF' ? 'Actif' : member.user.status === 'SUSPENDU' ? 'Suspendu' : 'Inactif'}
                    </span>
                  </td>
                  <td className="p-3">{new Date(member.joinedAt).toLocaleDateString('fr-FR')}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button className="p-1 text-gray-600 hover:text-blue-600" title={'Message direct à ' + member.user.firstName} onClick={() => setMessageTarget(member)}><MessageSquare size={15} /></button>
                      <button className="p-1 text-gray-600 hover:text-green-600" title={member.user.status === 'ACTIF' ? 'Suspendre' : 'Réactiver'} onClick={() => toggleStatus(member)}><Settings size={15} /></button>
                      <button className="p-1 text-gray-600 hover:text-red-600" title="Retirer" onClick={() => removeFromOrg(member)}><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {messageTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <form className="bg-white p-6 rounded-xl shadow-xl w-96" onSubmit={sendDirectMessage} onClick={(e) => e.stopPropagation()}>
            <button className="float-right text-gray-500 hover:text-gray-700" type="button" onClick={() => setMessageTarget(null)}>×</button>
            <h2 className="text-lg font-bold">Message à {messageTarget.user.firstName} {messageTarget.user.lastName}</h2>
            <p className="text-sm text-gray-500 mb-4">@{messageTarget.user.username}</p>
            <textarea name="content" required maxLength={5000} placeholder="Votre message direct…" className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4" />
            {messageError && <div className="mb-3 text-sm text-red-600">{messageError}</div>}
            <div className="flex gap-3">
              <button type="button" className="flex-1 border border-gray-300 py-2 rounded-lg hover:bg-gray-100" onClick={() => setMessageTarget(null)}>Annuler</button>
              <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"><Send size={16} /> Envoyer</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { Clock3, Search, MessageSquare, Settings, Trash2, Users, Send, UserRound, Key } from '../../../ui-icons';
import { safeStr, safeFullName, safeDateLabel, safeTimeLabel, asArray } from '../../../../lib/render-safe';

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

export default function UsersPanel({
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
  const [supTarget, setSupTarget] = useState<MemberRow | null>(null);
  const [supData, setSupData] = useState<any>(null);
  const [supLoading, setSupLoading] = useState(false);
  const [resetTarget, setResetTarget] = useState<MemberRow | null>(null);
  const [resetSaving, setResetSaving] = useState(false);

  async function submitResetPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!resetTarget) return;
    setError(''); 
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    if ((data.newPassword ?? '').length < 8) { setError('Le mot de passe doit contenir au moins 8 caractères.'); return; }
    if (data.newPassword !== data.confirm) { setError('Les deux mots de passe ne correspondent pas.'); return; }
    setResetSaving(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: resetTarget.user.id, newPassword: data.newPassword }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Réinitialisation impossible.');
      setNotice(`Mot de passe de ${resetTarget.user.firstName} réinitialisé. Ses sessions ont été déconnectées.`);
      setResetTarget(null);
    } catch (e2) {
      setError((e2 as Error).message);
    } finally {
      setResetSaving(false);
    }
  }

  async function openSupervision(member: MemberRow) {
    setSupTarget(member); setSupData(null); setError(''); setNotice('');
    setSupLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${member.user.id}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Historique indisponible.');
      setSupData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement de l’historique.');
      setSupTarget(null);
    } finally { setSupLoading(false); }
  }

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
      setMembers(asArray<MemberRow>(json.members));
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
                        {safeStr(member.user.firstName).charAt(0)}{safeStr(member.user.lastName).charAt(0) || '?'}
                      </span>
                      <div><strong>{safeFullName(member.user)}</strong><small className="text-gray-500 block">@{safeStr(member.user.username)} · {safeStr(member.user.email)}</small></div>
                    </div>
                  </td>
                  <td className="p-3">
                    <select value={member.role} onChange={(e) => changeRole(member, e.target.value)} className="px-2 py-1 border border-gray-300 rounded">
                      <option value="ORGANIZATION_ADMIN">Administrateur</option>
                      <option value="EMPLOYEE">Employé</option>
                      <option value="INTERN">Stagiaire</option>
                    </select>
                  </td>
                  <td className="p-3">{safeStr(member.user.department) || '—'}</td>
                                    <td>
                    <span className={'status-pill ' + (member.user.status === 'ACTIF' ? 'active' : 'off')}>
                      {member.user.status === 'ACTIF' ? 'Actif' : member.user.status === 'SUSPENDU' ? 'Suspendu' : 'Inactif'}
                    </span>
                  </td>
                  <td>{safeDateLabel(member.joinedAt)}</td>
                  <td>
                    <div className="actions-row">
                      <button className="icon-button" title={'Historique de travail de ' + safeStr(member.user.firstName)} onClick={() => openSupervision(member)}><UserRound size={15} /></button>
                      <button className="icon-button" title={'Message direct à ' + safeStr(member.user.firstName)} onClick={() => setMessageTarget(member)}><MessageSquare size={15} /></button>
                      <button className="icon-button" title={'Réinitialiser le mot de passe de ' + safeStr(member.user.firstName)} onClick={() => { setError(''); setResetTarget(member); }}><Key size={15} /></button>
                      <button className="icon-button" title={member.user.status === 'ACTIF' ? 'Suspendre' : 'Réactiver'} onClick={() => toggleStatus(member)}><Settings size={15} /></button>
                      <button className="icon-button danger" title="Retirer" onClick={() => removeFromOrg(member)}><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {resetTarget && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setResetTarget(null)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h2>Réinitialiser le mot de passe</h2>
              <button className="icon-button" onClick={() => setResetTarget(null)} aria-label="Fermer">×</button>
            </div>
            <form onSubmit={submitResetPassword} className="modal-body">
              <p className="muted" style={{ marginTop: 0 }}>
                Définissez un nouveau mot de passe pour <strong>{safeFullName(resetTarget.user)}</strong> ({safeStr(resetTarget.user.email)}).
                Toutes ses sessions actives seront déconnectées.
              </p>
              <div className="form-row"><label>Nouveau mot de passe</label><input type="password" name="newPassword" required minLength={8} maxLength={128} autoComplete="new-password" placeholder="Au moins 8 caractères" /></div>
              <div className="form-row"><label>Confirmer</label><input type="password" name="confirm" required minLength={8} autoComplete="new-password" placeholder="Répétez le mot de passe" /></div>
              <div className="modal-footer">
                <button type="button" className="secondary-button" onClick={() => setResetTarget(null)}>Annuler</button>
                <button type="submit" className="primary-button" disabled={resetSaving}>{resetSaving ? 'Enregistrement…' : 'Réinitialiser'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

            {messageTarget && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setMessageTarget(null)}>
          <form className="modal" style={{ maxWidth: 460 }} onSubmit={sendDirectMessage}>
            <div className="modal-header">
              <h2>Message à {safeFullName(messageTarget.user)}</h2>
              <button className="icon-button" type="button" onClick={() => setMessageTarget(null)} aria-label="Fermer">×</button>
            </div>
            <div className="modal-body">
              <p className="muted" style={{ marginTop: 0 }}>@{safeStr(messageTarget.user.username)}</p>
              <div className="form-row"><label>Message</label><textarea name="content" required maxLength={5000} placeholder="Votre message direct…" rows={4} /></div>
              {messageError && <div className="notice error">{messageError}</div>}
              <div className="modal-footer">
                <button type="button" className="secondary-button" onClick={() => setMessageTarget(null)}>Annuler</button>
                <button type="submit" className="primary-button"><Send size={15} /> Envoyer</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {supTarget && (
        <div className="modal-overlay" onClick={() => setSupTarget(null)}>
          <div className="supervision" style={{ width: 'min(880px,100%)', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="supervision-head">
              <UserRound size={20} style={{ color: 'var(--blue)' }} />
              <div>
                <strong>Historique de travail — {safeFullName(supTarget.user)}</strong>
                <small>
                  @{safeStr(supTarget.user.username)} · {safeStr(roleLabels[supTarget.role] ?? supTarget.role)}
                  {supData?.member?.department ? ` · ${safeStr(supData.member.department)}` : ''}
                  {' · '}membre depuis {safeDateLabel(supTarget.joinedAt)}
                </small>
              </div>
              <button className="close-x" onClick={() => setSupTarget(null)} aria-label="Fermer"><span style={{ fontSize: 14, lineHeight: 1 }}>×</span></button>
            </div>

            {supLoading ? (
              <div className="loading-state" style={{ padding: '30px 0' }}><span className="spinner" /> Chargement de l’historique…</div>
            ) : supData ? (
              <>
                <div className="supervision-grid">
                  <div className="sup-cell"><small>Tâches assignées</small><strong>{safeStr(supData?.work?.tasks?.total)}</strong><em>{safeStr(supData?.work?.tasks?.termine)} terminée(s)</em></div>
                  <div className="sup-cell"><small>En cours</small><strong>{safeStr(supData?.work?.tasks?.enCours)}</strong><em>{safeStr(supData?.work?.tasks?.bloque)} bloquée(s)</em></div>
                  <div className="sup-cell"><small>Activités publiées</small><strong>{safeStr(supData?.work?.activities?.count)}</strong><em>rapports d’activité</em></div>
                  <div className="sup-cell"><small>Journal</small><strong>{safeStr(supData?.work?.journalEntries)}</strong><em>entrées cumulées</em></div>
                  <div className="sup-cell"><small>Pointages (60 j)</small><strong>{safeStr(supData?.work?.attendance?.last30days)}</strong><em>jours pointés</em></div>
                </div>

                <div style={{ padding: '0 22px 6px' }}>
                  <p className="eyebrow" style={{ marginBottom: 10 }}><Clock3 size={13} style={{ verticalAlign: '-2px' }} /> DERNIERS POINTAGES</p>

{asArray(supData?.work?.attendance?.records).length === 0 ? (
                    <p className="muted">Aucun pointage sur les 60 derniers jours.</p>
                  ) : (
                    <div className="plat-table-wrap">
                      <table>
                        <thead><tr><th>Date</th><th>Arrivée</th><th>Départ</th><th>Durée</th></tr></thead>
                        <tbody>
                          {asArray(supData?.work?.attendance?.records).map((r: any) => (
                            <tr key={safeStr(r.id)}>
                              <td>{safeDateLabel(r.clockIn)}</td>
                              <td>{safeTimeLabel(r.clockIn)}</td>
                              <td>{r.clockOut ? safeTimeLabel(r.clockOut) : '—'}</td>
                              <td>{duration(r.clockIn, r.clockOut)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div style={{ padding: '16px 22px 4px' }}>
                  <p className="eyebrow" style={{ marginBottom: 10 }}>DERNIÈRES TÂCHES ASSIGNÉES</p>
                  {asArray(supData?.work?.tasks?.recent).length === 0 ? (
                    <p className="muted">Aucune tâche assignée.</p>
                  ) : (
                    <ul className="dash-list">
                      {asArray(supData?.work?.tasks?.recent).map((t: any) => (
                        <li key={safeStr(t.id)}>
                          <span>{safeStr(t.title)}</span>
                          <span className={'status-badge ' + (t.status === 'TERMINE' ? 'termine' : t.status === 'EN_COURS' ? 'en_cours' : t.status === 'BLOQUE' ? 'bloque' : 'en_attente')}>
                            {safeStr(t.status === 'TERMINE' ? 'Terminée' : t.status === 'EN_COURS' ? 'En cours' : t.status === 'BLOQUE' ? 'Bloquée' : 'En attente')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div style={{ padding: '16px 22px 18px' }}>
                  <p className="eyebrow" style={{ marginBottom: 10 }}>DERNIÈRES ACTIVITÉS</p>
                  {asArray(supData?.work?.activities?.recent).length === 0 ? (
                    <p className="muted">Aucune activité publiée.</p>
                  ) : (
                    <ul className="dash-list">
                      {asArray(supData?.work?.activities?.recent).map((a: any) => (
                        <li key={safeStr(a.id)}>
                          <span>{safeStr(a.title)}</span>
                          <span className={'status-badge ' + (a.status === 'TERMINE' ? 'termine' : a.status === 'BLOQUE' ? 'bloque' : 'en_cours')}>
                            {safeDateLabel(a.createdAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <p className="sup-note">
                  🔒 Confidentialité : cet historique se limite aux pointages, tâches et activités.
                  La <strong>messagerie privée</strong> du membre n’est jamais accessible à l’administration.
                </p>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function duration(clockIn: string, clockOut: string | null) {
  if (!clockOut) return '—';
  const minutes = Math.max(0, Math.round((new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 60000));
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}
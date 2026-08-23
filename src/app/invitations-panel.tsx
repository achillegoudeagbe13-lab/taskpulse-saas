'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Check, Plus, Send, Trash2 } from './ui-icons';

type Invitation = { id: string; token: string; email: string | null; firstName: string | null; lastName: string | null; role: string; status: string; expiresAt: string; createdAt: string; invitedBy: { firstName: string; lastName: string } };

const roleLabel = (role: string) => (role === 'INTERN' ? 'Stagiaire' : 'Employé');

export default function InvitationsPanel() {
  const [items, setItems] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/invitations');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setItems(result.invitations);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de charger les invitations.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch('/api/invitations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok) { setError(result.error); return; }
    setOpen(false);
    event.currentTarget.reset();
    setNotice('Invitation créée : partagez le lien avec le futur membre.');
    load();
  }

  async function revoke(id: string) {
    if (!window.confirm('Révoquer cette invitation ?')) return;
    const response = await fetch(`/api/invitations?id=${id}`, { method: 'DELETE' });
    if (!response.ok) { const result = await response.json(); setError(result.error); return; }
    setNotice('Invitation révoquée.');
    load();
  }

  function inviteUrl(token: string) { return `${window.location.origin}/rejoindre?token=${token}`; }

  function copy(token: string) {
    navigator.clipboard?.writeText(inviteUrl(token)).then(() => {
      setCopied(token);
      window.setTimeout(() => setCopied(null), 2000);
    }).catch(() => { window.prompt('Copiez ce lien d’invitation :', inviteUrl(token)); });
  }

  return (
    <div className="section-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">CROISSANCE</p>
          <h1>Invitations</h1>
          <p className="muted">Invitez des employés ou stagiaires : ils rejoindront automatiquement votre organisation.</p>
        </div>
        <button className="primary-button" onClick={() => setOpen(true)}><Plus size={17} /> Nouvelle invitation</button>
      </div>

      {notice && <div className="notice success">{notice}</div>}
      {error && <div className="notice error">{error}<button className="link-button" onClick={load}>Réessayer</button></div>}

      {loading ? (
        <div className="loading-state"><span className="spinner" /> Chargement des invitations…</div>
      ) : (
        <section className="panel">
          {items.length === 0 ? (
            <div className="empty-state"><Send size={24} /><h3>Aucune invitation</h3><p className="muted">Créez un lien d’invitation pour faire grandir votre équipe.</p></div>
          ) : (
            <div className="responsive-table">
              <table>
                <thead><tr><th>Invité</th><th>Email</th><th>Rôle</th><th>Statut</th><th>Expire le</th><th>Lien</th><th></th></tr></thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{[item.firstName, item.lastName].filter(Boolean).join(' ') || '—'}</strong><small>par {item.invitedBy.firstName} {item.invitedBy.lastName}</small></td>
                      <td>{item.email || '—'}</td>
                      <td><span className="table-badge">{roleLabel(item.role)}</span></td>
                      <td><span className={`status-badge ${item.status === 'PENDING' && new Date(item.expiresAt) > new Date() ? 'active' : ''}`}>{item.status === 'ACCEPTED' ? 'Acceptée' : item.status === 'REVOKED' ? 'Révoquée' : new Date(item.expiresAt) > new Date() ? 'En attente' : 'Expirée'}</span></td>
                      <td>{new Date(item.expiresAt).toLocaleDateString('fr-FR')}</td>
                      <td>
                        {item.status === 'PENDING' && (
                          <button className={copied === item.token ? 'claim-button' : 'outline-button'} onClick={() => copy(item.token)}>
                            {copied === item.token ? <><Check size={14} /> Copié !</> : 'Copier le lien'}
                          </button>
                        )}
                      </td>
                      <td>{item.status === 'PENDING' && <button className="icon-button" title="Révoquer" onClick={() => revoke(item.id)}><Trash2 size={15} /></button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <form className="modal panel" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setOpen(false)}>×</button>
            <p className="eyebrow">CROISSANCE</p>
            <h2>Inviter un membre</h2>
            <p className="muted">Le lien d’invitation est valable 7 jours. Le membre rejoindra votre organisation avec le rôle choisi.</p>
            <label>Email (optionnel)<input name="email" type="email" placeholder="Pour pré-remplir son email" /></label>
            <div className="two-col">
              <label>Prénom (optionnel)<input name="firstName" /></label>
              <label>Nom (optionnel)<input name="lastName" /></label>
            </div>
            <label>Rôle attribué<select name="role" defaultValue="EMPLOYEE"><option value="EMPLOYEE">Employé</option><option value="INTERN">Stagiaire</option></select></label>
            <div className="modal-actions">
              <button className="outline-button" type="button" onClick={() => setOpen(false)}>Annuler</button>
              <button className="primary-button" type="submit"><Plus size={16} /> Créer l’invitation</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
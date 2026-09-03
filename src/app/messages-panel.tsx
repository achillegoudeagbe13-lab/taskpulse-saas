'use client';

import { FormEvent, useEffect, useState } from 'react';
import { MessageSquare, Plus, RefreshCw, Send } from './ui-icons';
import { safeStr, safeDateTime, safeFullName, asArray } from '../lib/render-safe';

type Contact = { id: string; firstName: string; lastName: string; username: string; role: string; department: string; photoUrl?: string | null };
type Message = { id: string; content: string; createdAt: string; senderId: string; recipientId: string; sender: { firstName: string; lastName: string; username: string }; recipient: { firstName: string; lastName: string; username: string } };

export default function MessagesPanel({ currentUserId }: { currentUserId: string }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [draft, setDraft] = useState('');

  useEffect(() => {
    fetch('/api/users').then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setContacts(asArray<Contact>(result.users).filter((user: Contact) => user.id !== currentUserId));
    }).catch((reason: Error) => setError(reason.message)).finally(() => setLoading(false));
  }, [currentUserId]);

  async function loadConversation(contact: Contact) {
    setSelected(contact);
    setDraft('');
    try {
      const response = await fetch(`/api/messages?with=${contact.id}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setMessages(result.messages);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de charger la conversation.');
    }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipientId: selected.id, content: data.content }) });
    const result = await response.json();
    if (!response.ok) { setFormError(result.error); return; }
    setDraft('');
    loadConversation(selected);
  }

  async function sendFromModal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipientId: data.recipientId, content: data.content }) });
    const result = await response.json();
    if (!response.ok) { setFormError(result.error); return; }
    setOpen(false);
    const contact = contacts.find((user) => user.id === data.recipientId) ?? null;
    if (contact) loadConversation(contact);
  }

  const others = messages.filter((message) => message.senderId !== currentUserId);

  return (
    <div className="section-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">COMMUNICATION</p>
          <h1>Messages</h1>
          <p className="muted">Échangez directement avec les membres de votre équipe.</p>
        </div>
        <button className="primary-button" onClick={() => setOpen(true)}><Plus size={17} /> Nouveau message</button>
      </div>

      {error && <div className="notice error">{error}<button onClick={() => window.location.reload()}><RefreshCw size={15} /> Réessayer</button></div>}

      {loading ? (
        <div className="loading-state"><span className="spinner" /> Chargement des messages…</div>
      ) : (
        <section className="panel messages-layout">
          <aside className="conversation-list">
            <div className="panel-heading"><h3>Conversations</h3><span className="table-badge">{contacts.length}</span></div>
            {contacts.length === 0 ? (
              <p className="muted empty-note">Aucun autre membre actif.</p>
            ) : contacts.map((contact) => (
              <button key={contact.id} className={selected?.id === contact.id ? 'conversation-row active' : 'conversation-row'} onClick={() => loadConversation(contact)}>
                <span className="avatar">{safeStr(contact.firstName).charAt(0)}{safeStr(contact.lastName).charAt(0) || '?'}</span>
                <span><strong>{safeFullName(contact)}</strong><small>{safeStr(contact.department) || safeStr(contact.role)}</small></span>
              </button>
            ))}
          </aside>
          <div className="conversation-pane">
            {!selected ? (
              <div className="empty-state"><MessageSquare size={24} /><h3>Sélectionnez une conversation</h3><p className="muted">Choisissez un membre à gauche ou créez un nouveau message.</p><button className="primary-button" onClick={() => setOpen(true)}><Plus size={17} /> Nouveau message</button></div>
            ) : (
              <>
                <div className="conversation-head">
                  <span className="avatar">{safeStr(selected.firstName).charAt(0)}{safeStr(selected.lastName).charAt(0) || '?'}</span>
                  <div><strong>{safeFullName(selected)}</strong><small>@{safeStr(selected.username)}</small></div>
                </div>
                <div className="message-thread">
                  {messages.length === 0 ? (
                    <p className="muted empty-note">Aucun message pour le moment. Lancez la conversation.</p>
                  ) : messages.map((message) => (
                    <div key={safeStr(message.id)} className={message.senderId === currentUserId ? 'message-bubble mine' : 'message-bubble'}><p>{safeStr(message.content)}</p><time>{safeDateTime(message.createdAt)}</time></div>
                  ))}
                  {others.length > 0 && <div className="message-divider"><span>{others.length} message{others.length > 1 ? 's' : ''} non lu{others.length > 1 ? 's' : ''}</span></div>}
                </div>
                <form className="composer" onSubmit={send}>
                  <input name="content" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Écrire un message…" required />
                  <button className="primary-button" type="submit"><Send size={16} /> Envoyer</button>
                </form>
              </>
            )}
          </div>
        </section>
      )}
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <form className="modal panel" onSubmit={sendFromModal} onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setOpen(false)}>×</button>
            <p className="eyebrow">COMMUNIQUE</p>
            <h2>Nouveau message</h2>
            <label>Destinataire<select name="recipientId" required defaultValue="">{!selected && <option value="" disabled>Choisir un membre…</option>}{contacts.map((contact) => <option key={contact.id} value={contact.id}>{safeFullName(contact)} · {safeStr(contact.department) || safeStr(contact.role)}</option>)}</select></label>
            <label>Message<textarea name="content" required maxLength={5000} placeholder="Votre message…" /></label>
            {formError && <div className="notice error">{formError}</div>}
            <div className="modal-actions">
              <button className="outline-button" type="button" onClick={() => setOpen(false)}>Annuler</button>
              <button className="primary-button" type="submit"><Send size={16} /> Envoyer</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Bell, MessageSquare, Plus, RefreshCw, Send } from './ui-icons';
import { safeStr, safeDateTime, safeFullName, asArray } from '../lib/render-safe';

type Announcement = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  author: { firstName: string; lastName: string; photoUrl?: string | null };
  _count: { reactions: number };
  comments: { id: string; content: string; author: { firstName: string; lastName: string } }[];
};

export default function AnnouncementsPanel({ admin }: { admin: boolean }) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/announcements');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setItems(asArray<Announcement>(result.announcements));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de charger les annonces.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch('/api/announcements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok) { setFormError(result.error ?? 'Publication impossible.'); return; }
    setOpen(false);
    event.currentTarget.reset();
    load();
  }

  return (
    <div className="section-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">COMMUNICATION D’ÉQUIPE</p>
          <h1>Annonces</h1>
          <p className="muted">Les informations importantes partagées avec toute l’équipe.</p>
        </div>
        <button className="primary-button" onClick={() => setOpen(true)}><Plus size={17} /> Créer une annonce</button>
      </div>

      {error && <div className="notice error">{error}<button onClick={load}><RefreshCw size={15} /> Réessayer</button></div>}

      {loading ? (
        <div className="loading-state"><span className="spinner" /> Chargement des annonces…</div>
      ) : (
        <div className="announcement-stream">
          {items.length === 0 ? (
            <div className="empty-state"><Bell size={24} /><h3>Aucune annonce</h3><p className="muted">Soyez le premier à partager une information.</p></div>
          ) : items.map((item) => (
            <article className="panel announcement-card" key={safeStr(item.id)}>
              <div className="activity-card-head">
                <span className="avatar">{safeStr(item.author?.firstName).charAt(0)}{safeStr(item.author?.lastName).charAt(0) || '?'}</span>
                <div><strong>{safeFullName(item.author)}</strong><small>{safeDateTime(item.createdAt)}</small></div>
                <span className="table-badge">Annonce</span>
              </div>
              <h3>{safeStr(item.title)}</h3>
              <p>{safeStr(item.content)}</p>
              <div className="activity-card-foot">
                <span><MessageSquare size={14} /> {asArray(item.comments).length} commentaire{asArray(item.comments).length > 1 ? 's' : ''}</span>
                <span>·</span>
                <span>{item._count?.reactions ?? 0} réaction{item._count?.reactions && item._count.reactions > 1 ? 's' : ''}</span>
              </div>
            </article>
          ))}
        </div>
      )}

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <form className="modal panel" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setOpen(false)}>×</button>
            <p className="eyebrow">COMMUNICATION D’ÉQUIPE</p>
            <h2>Créer une annonce</h2>
            <p className="muted">L’annonce sera visible par toute l’équipe.</p>
            <label>Titre<input name="title" required maxLength={160} placeholder="Ex. : Réunion générale vendredi" /></label>
            <label>Contenu<textarea name="content" required maxLength={5000} placeholder="Détaillez votre message…" /></label>
            {formError && <div className="notice error">{formError}</div>}
            <div className="modal-actions">
              <button className="outline-button" type="button" onClick={() => setOpen(false)}>Annuler</button>
              <button className="primary-button" type="submit"><Send size={16} /> Publier</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
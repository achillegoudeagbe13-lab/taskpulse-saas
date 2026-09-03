'use client';

import { FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, Pencil, Plus, RefreshCw } from './ui-icons';
import { safeStr, safeDateTime, safeFullName, asArray } from '../lib/render-safe';

type ActivityStatus = 'TERMINE' | 'EN_COURS' | 'BLOQUE';
type Activity = { id: string; title: string; content: string; status: ActivityStatus; createdAt: string; userId: string; user: { firstName: string; lastName: string; username: string; photoUrl?: string | null } };

const statusLabels: Record<ActivityStatus, string> = { TERMINE: 'Terminé', EN_COURS: 'En cours', BLOQUE: 'Bloqué' };

export default function ActivitiesPanel({ currentUserId }: { currentUserId: string }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [formError, setFormError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/activities');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setActivities(asArray<Activity>(result.activities));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de charger les activités.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch('/api/activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok) { setError(result.error); return; }
    setOpen(false);
    event.currentTarget.reset();
    setError('');
    setNotice('Activité publiée.');
    load();
  }

  /** Mise à jour par l'auteur : contenu + évolution du statut. */
  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setFormError('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch('/api/activities', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editing.id, ...data }) });
    const result = await response.json();
    if (!response.ok) { setFormError(result.error); return; }
    setEditing(null);
    setNotice(result.message ?? 'Activité mise à jour.');
    load();
  }

  /** Passage direct au statut final « Terminé ». */
  async function finish(activity: Activity) {
    const response = await fetch('/api/activities', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: activity.id, status: 'TERMINE' }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error); return; }
    setNotice(`« ${activity.title} » est maintenant terminé.`);
    load();
  }
  return (
    <div className="section-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">JOURNAL D’ÉQUIPE</p>
          <h1>Activités</h1>
          <p className="muted">Partagez ce qui avance, ce qui est terminé ou bloqué.</p>
        </div>
        <button className="primary-button" onClick={() => setOpen(true)}><Plus size={17} /> Publier une activité</button>
      </div>

      {notice && <div className="notice success">{notice}</div>}
      {error && <div className="notice error">{error}<button className="link-button" onClick={load}><RefreshCw size={15} /> Réessayer</button></div>}

      {loading ? (
        <div className="loading-state"><span className="spinner" /> Chargement des activités…</div>
      ) : (
        <div className="activity-stream">
          {activities.length === 0 ? (
            <div className="empty-state"><h3>Aucune activité publiée</h3><p className="muted">Soyez le premier à partager une mise à jour.</p></div>
          ) : activities.map((activity) => {
            const mine = activity.userId === currentUserId;
            return (
              <article className="panel activity-card" key={safeStr(activity.id)}>
                <div className="activity-card-head">
                  <span className="avatar">{safeStr(activity.user?.firstName).charAt(0)}{safeStr(activity.user?.lastName).charAt(0) || '?'}</span>
                  <div><strong>{safeFullName(activity.user)}</strong><small>{safeDateTime(activity.createdAt)}</small></div>
                  <span className={`status-badge ${safeStr(activity.status).toLowerCase()}`}>{safeStr(statusLabels[activity.status] ?? activity.status)}</span>
                </div>
                <h3>{safeStr(activity.title)}</h3>
                <p>{safeStr(activity.content)}</p>
                {mine && (
                  <div className="activity-card-foot">
                    <button className="link-button" onClick={() => { setEditing(activity); setFormError(''); }}><Pencil size={14} /> Modifier</button>
                    <span>·</span>
                    {activity.status !== 'TERMINE' && (
                      <button className="link-button" onClick={() => finish(activity)}><CheckCircle2 size={14} /> Marquer terminé</button>
                    )}
                    {activity.status === 'TERMINE' && <span>Activité finalisée</span>}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <form className="modal panel" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setOpen(false)}>×</button>
            <h2>Publier une activité</h2>
            <label>Titre<input name="title" required maxLength={160} /></label>
            <label>Description<textarea name="content" required maxLength={4000} /></label>
            <label>Statut<select name="status" defaultValue="EN_COURS"><option value="EN_COURS">En cours</option><option value="TERMINE">Terminé</option><option value="BLOQUE">Bloqué</option></select></label>
            <div className="modal-actions">
              <button className="outline-button" type="button" onClick={() => setOpen(false)}>Annuler</button>
              <button className="primary-button" type="submit">Publier</button>
            </div>
          </form>
        </div>
      )}

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <form className="modal panel" onSubmit={saveEdit} onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setEditing(null)}>×</button>
            <p className="eyebrow">MODIFIER MON ACTIVITÉ</p>
            <h2>{editing.title}</h2>
            <label>Titre<input name="title" required maxLength={160} defaultValue={editing.title} /></label>
            <label>Description<textarea name="content" required maxLength={4000} defaultValue={editing.content} /></label>
            <label>Statut<select name="status" defaultValue={editing.status}><option value="EN_COURS">En cours</option><option value="TERMINE">Terminé</option><option value="BLOQUE">Bloqué</option></select></label>
            {formError && <div className="notice error">{formError}</div>}
            <div className="modal-actions">
              <button className="outline-button" type="button" onClick={() => setEditing(null)}>Annuler</button>
              <button className="primary-button" type="submit">Enregistrer</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
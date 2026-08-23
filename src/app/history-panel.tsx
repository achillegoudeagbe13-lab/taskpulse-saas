'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Activity, BookOpen, CheckCircle2, Clock3, MessageSquare, Plus, RefreshCw, Send } from './ui-icons';

type HistoryItem = { id: string; kind: string; title: string; meta: string; date: string };

const kindLabels: Record<string, string> = {
  journal: 'Journal',
  activity: 'Activité',
  task: 'Tâche',
  attendance: 'Pointage',
  message: 'Message',
};

export default function HistoryPanel() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [journalRes, activityRes, taskRes, attendanceRes, messageRes, notificationsRes] = await Promise.all([
        fetch('/api/journal'), fetch('/api/activities'), fetch('/api/tasks'), fetch('/api/attendance'), fetch('/api/messages'), fetch('/api/notifications'),
      ]);
      const journal = await journalRes.json();
      const activities = await activityRes.json();
      const tasks = await taskRes.json();
      const attendance = await attendanceRes.json();
      const messages = await messageRes.json();
      const notifications = await notificationsRes.json();
      if (!journalRes.ok || !activityRes.ok || !taskRes.ok || !attendanceRes.ok || !messageRes.ok || !notificationsRes.ok) {
        throw new Error(journal.error || activities.error || tasks.error || 'Impossible de charger l’historique.');
      }
      const merged: HistoryItem[] = [
        ...(journal.entries || []).map((entry: { id: string; entryDate: string; title: string; status: string; category: { name: string } }) => ({ id: `j-${entry.id}`, date: entry.entryDate, kind: 'journal' as const, title: entry.title, meta: `${entry.category.name} · ${entry.status}` })),
        ...(activities.activities || []).map((activity: any) => ({ id: `a-${activity.id}`, date: activity.createdAt, kind: 'activity' as const, title: activity.title, meta: activity.status })),
        ...(tasks.tasks || []).map((task: any) => ({ id: `t-${task.id}`, date: task.createdAt, kind: 'task' as const, title: task.title, meta: `Avancement ${task.progress}%` })),
        ...(attendance.records || []).map((record: any) => ({ id: `p-${record.id}`, date: record.clockIn, kind: 'attendance' as const, title: 'Pointage', meta: record.clockOut ? 'Journée complète' : 'Arrivée pointée' })),
        ...(messages.messages || []).map((message: any) => ({ id: `m-${message.id}`, date: message.createdAt, kind: 'message' as const, title: message.content, meta: message.sender ? `De ${message.sender.firstName} ${message.sender.lastName}` : '' })),
      ];
      merged.sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
      setItems(merged.slice(0, 50));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de charger l’historique.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch('/api/activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok) { setFormError(result.error); return; }
    setOpen(false);
    event.currentTarget.reset();
    load();
  }

  return (
    <div className="section-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">SUIVI PERSONNEL</p>
          <h1>Historique</h1>
          <p className="muted">La trace de vos actions, entrées et échanges récents.</p>
        </div>
        <button className="primary-button" onClick={() => setOpen(true)}><Plus size={17} /> Créer une entrée</button>
      </div>

      {error && <div className="notice error">{error}<button onClick={load}><RefreshCw size={15} /> Réessayer</button></div>}
      {loading ? (
        <div className="loading-state"><span className="spinner" /> Chargement de l’historique…</div>
      ) : (
        <section className="panel history-timeline">
          {items.length === 0 ? (
            <div className="empty-state"><Clock3 size={24} /><h3>Aucune entrée pour le moment</h3><p className="muted">Votre activité récente apparaîtra ici automatiquement.</p></div>
          ) : items.map((item) => (
            <article className="history-row" key={item.id}>
              <span className="history-mark">{item.kind === 'journal' ? <BookOpen size={15} /> : item.kind === 'activity' ? <Activity size={15} /> : item.kind === 'task' ? <CheckCircle2 size={15} /> : item.kind === 'attendance' ? <Clock3 size={15} /> : <MessageSquare size={15} />}</span>
              <span className="table-badge">{kindLabels[item.kind]}</span>
              <div><strong>{item.title}</strong><small>{item.meta}</small></div>
              <time>{new Date(item.date).toLocaleString('fr-FR')}</time>
            </article>
          ))}
        </section>
      )}
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <form className="modal panel" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setOpen(false)}>×</button>
            <p className="eyebrow">SUIVI PERSONNEL</p>
            <h2>Créer une entrée</h2>
            <p className="muted">Partagez un point d’étape pour documenter votre historique.</p>
            <label>Titre<input name="title" required maxLength={160} placeholder="Ex. : Avancement du rapport" /></label>
            <label>Description<textarea name="content" required maxLength={4000} placeholder="Décrivez ce que vous avez réalisé…" /></label>
            <label>Statut<select name="status" defaultValue="EN_COURS"><option value="EN_COURS">En cours</option><option value="TERMINE">Terminé</option><option value="BLOQUE">Bloqué</option></select></label>
            {formError && <div className="notice error">{formError}</div>}
            <div className="modal-actions">
              <button className="outline-button" type="button" onClick={() => setOpen(false)}>Annuler</button>
              <button className="primary-button" type="submit"><Send size={16} /> Enregistrer</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
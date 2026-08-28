'use client';

import { FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, Download, KanbanSquare, List, Plus, RefreshCw, UserRound } from './ui-icons';

type TaskStatus = 'TERMINE' | 'EN_COURS' | 'BLOQUE' | 'EN_ATTENTE';
type Task = { id: string; title: string; description?: string | null; status: TaskStatus; priority: 'BASSE' | 'MOYENNE' | 'HAUTE'; progress: number; dueDate?: string | null; createdAt?: string; assignee?: { id: string; firstName: string; lastName: string } | null; creator?: { id: string; firstName: string; lastName: string } | null };
type Contact = { id: string; firstName: string; lastName: string; role: string; department: string };

const labels: Record<TaskStatus, string> = { EN_ATTENTE: 'À faire', EN_COURS: 'En cours', TERMINE: 'Terminée', BLOQUE: 'Bloquée' };
const priorities: Record<Task['priority'], string> = { BASSE: 'Basse', MOYENNE: 'Moyenne', HAUTE: 'Haute' };

/** Statut dynamique : tâche ouverte à tous, attribuée, ou « Tâche de X commencée par Y ». */
function origin(task: Task): { text: string; kind: 'open' | 'started' | 'assigned' } {
  if (!task.assignee) return { text: task.creator ? `Disponible pour tous · créée par ${task.creator.firstName} ${task.creator.lastName}` : 'Disponible pour tous', kind: 'open' };
  if (task.creator && task.creator.id !== task.assignee.id) {
    const by = `${task.creator.firstName} ${task.creator.lastName}`;
    const who = `${task.assignee.firstName} ${task.assignee.lastName}`;
    return task.status === 'EN_ATTENTE'
      ? { text: `Créée par ${by} · attribuée à ${who}`, kind: 'assigned' }
      : { text: `Tâche de ${by} commencée par ${who}`, kind: 'started' };
  }
  return { text: `${task.assignee.firstName} ${task.assignee.lastName}`, kind: 'assigned' };
}

export default function TasksPanel({ admin, currentUserId }: { admin: boolean; currentUserId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/tasks');

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setTasks(result.tasks);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de charger les tâches.');
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function exportTasksCsv() {
    const rows = [
      ['Titre', 'Statut', 'Priorité', 'Progression', 'Échéance', 'Assigné à'],
      ...tasks.map((t) => [
        t.title,
        labels[t.status],
        priorities[t.priority],
        `${t.progress}%`,
        t.dueDate ? new Date(t.dueDate).toLocaleDateString('fr-FR') : '',
        t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : 'Générale',
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mar-ci-flow-taches-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function openCreate() { setCreating(true); setError(''); loadContacts(); }

  async function loadContacts() {
    try {
      const response = await fetch('/api/users');
      const result = await response.json();
      if (response.ok) setContacts((result.users as Contact[]).filter((item) => item.role !== 'ORGANIZATION_ADMIN'));
    } catch { /* la liste des assignables reste simplement vide */ }
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok) { setError(result.error); return; }
    setCreating(false);
    setNotice(data.assigneeId ? 'Tâche créée et assignée.' : 'Tâche créée : disponible pour toute l’équipe.');
    load();
  }

  async function claim(task: Task) {
    setError('');
    const response = await fetch('/api/tasks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: task.id, action: 'CLAIM' }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error); return; }
    const me = result.task?.assignee;
    setNotice(`« ${task.title} » : tâche de ${task.creator ? `${task.creator.firstName} ${task.creator.lastName}` : "l'équipe"} commencée par ${me ? `${me.firstName} ${me.lastName}` : 'vous'}.`);
    load();
  }

  async function updateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/tasks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editing.id, status: form.get('status'), progress: form.get('progress'), comment: form.get('comment') }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error); return; }
    setEditing(null);
    setNotice('Tâche mise à jour.');
    load();
  }
useEffect(() => {
    if (creating || editing) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, [creating, editing]);
  return (
    <div className="section-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{admin ? 'ADMINISTRATION' : 'MON ESPACE'}</p>
          <h1>Tâches</h1>
          <p className="muted">Suivez les priorités et l’avancement du travail.</p>
        </div>
        <div className="page-actions">
          <button className="outline-button" onClick={exportTasksCsv} title="Exporter en CSV"><Download size={16} /> Export CSV</button>
          <button className={view === 'list' ? 'icon-button active' : 'icon-button'} onClick={() => setView('list')} aria-label="Vue liste"><List size={18} /></button>
          <button className={view === 'kanban' ? 'icon-button active' : 'icon-button'} onClick={() => setView('kanban')} aria-label="Vue kanban"><KanbanSquare size={18} /></button>
          {admin && <button className="primary-button" onClick={openCreate}><Plus size={17} /> Créer une tâche</button>}
        </div>
      </div>

      {notice && <div className="notice success">{notice}</div>}
      {error && <div className="notice error">{error}<button className="link-button" onClick={load}><RefreshCw size={15} /> Réessayer</button></div>}

      {loading ? (
        <div className="loading-state"><span className="spinner" /> Chargement des tâches…</div>
      ) : (
        <>
          {view === 'list' ? (
            <section className="panel task-table-panel">
              {tasks.length === 0 ? (
                <div className="empty-state"><CheckCircle2 size={24} /><h3>Aucune tâche</h3><p className="muted">{admin ? 'Créez la première tâche de votre équipe.' : 'Votre espace est à jour.'}</p></div>
              ) : (
                <div className="responsive-table">
                  <table>
                    <thead><tr><th>Tâche</th><th>Assigné à</th><th>Priorité</th><th>Statut</th><th>Avancement</th>{!admin && <th>Prise en charge</th>}</tr></thead>
                    <tbody>
                      {tasks.map((task) => {
                        const state = origin(task);
                        return (
                          <tr key={task.id} onClick={() => setEditing(task)}>
                            <td>
                              <strong>{task.title}</strong>
                              <small>{task.description || 'Sans description'}</small>
                              <span className={`task-origin ${state.kind}`}>{state.text}</span>
                            </td>
                            <td>{task.assignee ? `${task.assignee.firstName} ${task.assignee.lastName}` : <span className="muted">Ouverte à tous</span>}</td>
                            <td>{priorities[task.priority]}</td>
                            <td><span className={`status-badge ${task.status.toLowerCase()}`}>{labels[task.status]}</span></td>
                            <td><div className="table-progress"><span>{task.progress}%</span><i><b style={{ width: `${task.progress}%` }} /></i></div></td>
                            {!admin && (
                              <td>
                                {!task.assignee && task.status !== 'TERMINE' && (
                                  <button className="claim-button" onClick={(event) => { event.stopPropagation(); claim(task); }}><UserRound size={14} /> Prendre en charge</button>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}
          {view === 'kanban' ? (
            <div className="kanban-grid">
              {(['EN_ATTENTE', 'EN_COURS', 'BLOQUE', 'TERMINE'] as TaskStatus[]).map((status) => (
                <section className="kanban-column" key={status}>
                  <div className="panel-heading"><h3>{labels[status]}</h3><span>{tasks.filter((task) => task.status === status).length}</span></div>
                  {tasks.filter((task) => task.status === status).map((task) => (
                    <TaskCard key={task.id} task={task} canClaim={!admin} onEdit={setEditing} onClaim={claim} />
                  ))}
                </section>
              ))}
            </div>
          ) : null}

          {creating && (
            <div className="modal-backdrop" onClick={() => setCreating(false)}>
              <form className="modal panel" onSubmit={createTask} onClick={(event) => event.stopPropagation()}>
                <button className="modal-close" type="button" onClick={() => setCreating(false)}>×</button>
                <p className="eyebrow">ADMINISTRATION</p>
                <h2>Créer une tâche</h2>
                <label>Titre<input name="title" required maxLength={160} placeholder="Ex. : Préparer le rapport mensuel" /></label>
                <label>Description<textarea name="description" maxLength={4000} placeholder="Décrivez la tâche (optionnel)" /></label>
                <div className="two-col">
                  <label>Assigner à<select name="assigneeId" defaultValue=""><option value="">Disponible pour tous</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.firstName} {contact.lastName}{contact.department ? ` · ${contact.department}` : ''}</option>)}</select></label>
                  <label>Priorité<select name="priority" defaultValue="MOYENNE"><option value="BASSE">Basse</option><option value="MOYENNE">Moyenne</option><option value="HAUTE">Haute</option></select></label>
                </div>
                <div className="two-col">
                  <label>Échéance<input name="dueDate" type="date" /></label>
                  <label>Statut initial<select name="status" defaultValue="EN_ATTENTE"><option value="EN_ATTENTE">À faire</option><option value="EN_COURS">En cours</option><option value="BLOQUE">Bloquée</option></select></label>
                </div>
                <p className="muted">Sans assignation, la tâche reste ouverte : n’importe quel membre pourra la démarrer depuis son espace.</p>
                <div className="modal-actions">
                  <button className="outline-button" type="button" onClick={() => setCreating(false)}>Annuler</button>
                  <button className="primary-button" type="submit"><Plus size={16} /> Créer la tâche</button>
                </div>
              </form>
            </div>
          )}

          {editing && (
            <div className="modal-backdrop" onClick={() => setEditing(null)}>
              <form className="modal panel" onSubmit={updateTask} onClick={(event) => event.stopPropagation()}>
                <button type="button" className="modal-close" onClick={() => setEditing(null)}>×</button>
                <p className="eyebrow">{origin(editing).kind === 'started' ? 'TÂCHE COMMENCÉE' : 'MISE À JOUR'}</p>
                <h2>{editing.title}</h2>
                <p className="muted">{origin(editing).text}</p>
                <label>Statut<select name="status" defaultValue={editing.status}><option value="EN_ATTENTE">À faire</option><option value="EN_COURS">En cours</option><option value="BLOQUE">Bloquée</option><option value="TERMINE">Terminée</option></select></label>
                <label>Avancement<select name="progress" defaultValue={String(editing.progress)}><option value="0">0 %</option><option value="25">25 %</option><option value="50">50 %</option><option value="75">75 %</option><option value="100">100 %</option></select></label>
                <label>Commentaire<textarea name="comment" placeholder="Ajouter un commentaire (optionnel)" /></label>
                <div className="modal-actions">
                  <button className="outline-button" type="button" onClick={() => setEditing(null)}>Annuler</button>
                  <button className="primary-button" type="submit">Enregistrer</button>
                </div>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TaskCard({ task, canClaim, onEdit, onClaim }: { task: Task; canClaim: boolean; onEdit: (task: Task) => void; onClaim: (task: Task) => void }) {
  const state = origin(task);
  return (
    <div className="kanban-card" onClick={() => onEdit(task)} role="button" tabIndex={0}>
      <strong>{task.title}</strong>
      <small>{task.assignee ? `${task.assignee.firstName} ${task.assignee.lastName}` : 'Ouverte à tous'}</small>
      <span className={`task-origin ${state.kind}`}>{state.text}</span>
      {canClaim && !task.assignee && task.status !== 'TERMINE' && (
        <button className="claim-button" onClick={(event) => { event.stopPropagation(); onClaim(task); }}><UserRound size={14} /> Prendre en charge</button>
      )}
      <div className="table-progress"><span>{task.progress}%</span><i><b style={{ width: `${task.progress}%` }} /></i></div>
    </div>
  );
}
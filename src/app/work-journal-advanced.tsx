'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, CalendarDays, ChevronRight, FileSpreadsheet, FileText, FileUp, LayoutDashboard, Pencil, Plus, Printer, RefreshCw, Search, Trash2 } from './ui-icons';
import { safeStr, safeDateLabel, safeFullName, asArray } from '../lib/render-safe';

type Entry = {
  id: string;
  entryDate: string;
  title: string;
  summary: string;
  workItems: string;
  timeMinutes: number;
  status: string;
  category: { name: string };
  result?: string | null;
  comments?: { id: string; content: string; author: { firstName: string; lastName: string } }[];
};
type User = { firstName: string; lastName: string; role: string; department: string; profile?: { position?: string | null } | null };

const statuses: Record<string, string> = { BROUILLON: 'Brouillon', ENREGISTREE: 'Enregistrée', VALIDEE: 'Validée', MODIFICATION_DEMANDEE: 'Modification demandée', EN_ATTENTE_VALIDATION: 'En attente de validation' };
const categories = ['Administration', 'Comptabilité', 'Finance', 'Communication', 'Marketing', 'Informatique', 'Ressources humaines', 'Design', 'Réunion', 'Formation', 'Projet', 'Gestion', 'Autre'];

type FormProps = { entry: Entry; onClose: () => void; onSave: (event: FormEvent<HTMLFormElement>) => void };

export default function WorkJournalAdvanced({ user, onNavigate }: { user: User; onNavigate?: (page: string) => void }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [stats, setStats] = useState({ totalEntries: 0, documentedDays: 0, timeMinutes: 0, completedEntries: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<Entry | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [month, setMonth] = useState(new Date());
  const [report, setReport] = useState('');
  const admin = user.role === 'ORGANIZATION_ADMIN';

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (category) params.set('category', category);
      if (status) params.set('status', status);
      const response = await fetch(`/api/journal?${params}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setEntries(result.entries);
      setStats(result.stats);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de charger le journal.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [query, category, status]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (editing?.id) data.id = editing.id;
    const response = await fetch('/api/journal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok) { setError(result.error); return; }
    setEditing(null);
    setNotice(result.message);
    load();
  }

  async function remove(id: string) {
    if (!window.confirm('Supprimer cette entrée du journal ?')) return;
    const response = await fetch(`/api/journal?id=${id}`, { method: 'DELETE' });
    const result = await response.json();
    if (!response.ok) setError(result.error); else { setNotice('Entrée supprimée.'); load(); }
  }

  async function journalAction(action: 'COMMENT' | 'VALIDATE' | 'REQUEST_CHANGE' | 'SUBMIT', content?: string) {
    if (!selected) return;
    const response = await fetch('/api/journal/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, entryId: selected.id, content }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error); return; }
    setSelected(null);
    setNotice(action === 'COMMENT' ? 'Commentaire ajouté.' : action === 'VALIDATE' ? 'Entrée validée.' : action === 'REQUEST_CHANGE' ? 'Modification demandée.' : 'Entrée envoyée pour validation.');
    load();
  }

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !selected) return;
    const form = new FormData();
    form.append('entryId', selected.id);
    form.append('file', file);
    const response = await fetch('/api/journal/attachments', { method: 'POST', body: form });
    const result = await response.json();
    if (!response.ok) setError(result.error); else { setSelected(null); setNotice('Pièce jointe ajoutée.'); load(); }
    event.target.value = '';
  }

  async function prepareReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch('/api/journal/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) });
    const result = await response.json();
    if (!response.ok) setError(result.error); else { setReport(result.report.content); setNotice('Rapport préparé.'); }
  }

  function exportFile(format: 'pdf' | 'excel') {
    const params = new URLSearchParams({ format });
    if (category) params.set('category', category);
    if (status) params.set('status', status);
    window.open(`/api/journal/export?${params}`, '_blank', 'noopener,noreferrer');
    setNotice(format === 'pdf' ? 'Rapport PDF prêt à imprimer.' : 'Export Excel téléchargé.');
  }

  const days = useMemo(() => Array.from({ length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1)), [month]);
  const totalHours = Math.floor(stats.timeMinutes / 60);
  const totalMinutes = stats.timeMinutes % 60;
  const newEntry: Entry = { id: '', entryDate: new Date().toISOString(), title: '', summary: '', workItems: '', timeMinutes: 0, status: 'BROUILLON', category: { name: 'Projet' } };

  return <div className="section-page journal-page">
    <div className="back-bar">
      {onNavigate && <button className="back-button" onClick={() => onNavigate('Dashboard')}><ArrowLeft size={17} /> Retour au tableau de bord</button>}
      <div className="back-crumbs"><span>Mon espace</span><ChevronRight size={13} /><button onClick={() => onNavigate?.('Dashboard')}>Tableau de bord</button><ChevronRight size={13} /><strong>Journal de travail</strong></div>
    </div>
    <div className="page-heading"><div><p className="eyebrow">MÉMOIRE PROFESSIONNELLE</p><h1>Mon journal de travail</h1><p className="muted">{user.firstName} {user.lastName} · {user.profile?.position || (admin ? 'Administrateur' : user.role === 'INTERN' ? 'Stagiaire' : 'Employé')} · {user.department || 'Département non renseigné'}</p></div><div className="page-actions"><button className="outline-button" onClick={() => exportFile('pdf')}><Printer size={16} /> PDF</button><button className="outline-button" onClick={() => exportFile('excel')}><FileSpreadsheet size={16} /> Excel</button><button className="primary-button" onClick={() => setEditing(newEntry)}><Plus size={17} /> Nouvelle entrée</button></div></div>
    {notice && <div className="notice success">{notice}</div>}
    {error && <div className="notice error">{error}<button onClick={load}><RefreshCw size={15} /> Réessayer</button></div>}
    <div className="journal-stats"><div className="stat-card"><BookOpen size={18} /><strong>{stats.totalEntries}</strong><span className="stat-label">Entrées</span></div><div className="stat-card"><CalendarDays size={18} /><strong>{stats.documentedDays}</strong><span className="stat-label">Jours documentés</span></div><div className="stat-card"><FileText size={18} /><strong>{totalHours}h {totalMinutes}m</strong><span className="stat-label">Temps documenté</span></div><div className="stat-card"><strong>{stats.completedEntries}</strong><span className="stat-label">Enregistrées</span></div></div>
    <section className="panel journal-toolbar"><div className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher dans mon journal…" /></div><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Toutes les catégories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Tous les statuts</option>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></section>
    <section className="journal-tools-row"><div className="panel calendar-panel"><div className="panel-heading"><div><p className="eyebrow">CALENDRIER</p><h3>{month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</h3></div><div className="calendar-nav"><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button><CalendarDays size={18} /><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button></div></div><div className="calendar-grid">{days.map((day) => { const matches = entries.filter((entry) => safeStr(entry.entryDate).slice(0, 10) === day.toISOString().slice(0, 10)); return <button className={matches.length ? 'calendar-day has-entry' : 'calendar-day'} key={day.toISOString()} onClick={() => matches[0] && setSelected(matches[0])}><span>{day.getDate()}</span>{matches.length > 0 && <small>● {matches.length}</small>}</button>; })}</div></div><aside className="panel report-box"><p className="eyebrow">MES RAPPORTS</p><h3>Préparer mon rapport</h3><p className="muted">Basé uniquement sur vos entrées réellement enregistrées.</p><form onSubmit={prepareReport}><label>Du<input name="startDate" type="date" required /></label><label>Au<input name="endDate" type="date" required /></label><label>Type<select name="type" defaultValue={user.role === 'STAGIAIRE' ? 'rapport-stage' : admin ? 'rapport-activite' : 'bilan-activite'}><option value="bilan-activite">Bilan d’activité</option><option value="rapport-stage">Rapport de stage</option><option value="rapport-activite">Rapport d’activité</option></select></label><button className="primary-button" type="submit">Préparer</button></form>{report && <textarea className="report-preview" value={report} onChange={(event) => setReport(event.target.value)} />}</aside></section>
    <section className="journal-list">{loading ? <div className="loading-state"><span className="spinner" /> Chargement du journal…</div> : entries.length === 0 ? <div className="empty-state"><BookOpen size={25} /><h3>Aucune entrée trouvée</h3><p className="muted">Documentez votre première journée de travail.</p></div> : entries.map((entry) => <article className="panel journal-entry" key={safeStr(entry.id)}><div className="journal-entry-top"><time>{safeDateLabel(entry.entryDate)}</time><span className="table-badge">{safeStr(entry.category?.name)}</span><span className="status-badge">{safeStr(statuses[entry.status] ?? entry.status)}</span></div><h3>{safeStr(entry.title)}</h3><p>{safeStr(entry.summary)}</p><div className="journal-entry-meta"><span>{entry.timeMinutes ? `${Math.floor(entry.timeMinutes / 60)}h ${entry.timeMinutes % 60}m` : 'Temps non renseigné'}</span><button onClick={() => setSelected(entry)} aria-label="Détail"><Search size={15} /></button><button onClick={() => setEditing(entry)} aria-label="Modifier"><Pencil size={15} /></button><button onClick={() => remove(entry.id)} aria-label="Supprimer"><Trash2 size={15} /></button></div></article>)}</section>
    {editing && <EntryForm entry={editing} onClose={() => setEditing(null)} onSave={save} />}
    {selected && <EntryDetail entry={selected} admin={admin} onClose={() => setSelected(null)} onAction={journalAction} onUpload={upload} />}
  </div>;
}

function EntryForm({ entry, onClose, onSave }: FormProps) {
  return <div className="modal-backdrop" onClick={onClose}><form className="modal panel journal-form" onSubmit={onSave} onClick={(event) => event.stopPropagation()}><button className="modal-close" type="button" onClick={onClose}>×</button><p className="eyebrow">JOURNAL DE TRAVAIL</p><h2>{entry.id ? 'Modifier une entrée' : 'Nouvelle entrée'}</h2><div className="two-col"><label>Date<input name="entryDate" type="date" required defaultValue={safeStr(entry.entryDate).slice(0, 10)} /></label><label>Catégorie<select name="category" defaultValue={safeStr(entry.category?.name ?? 'Projet')}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label></div><label>Travail réalisé<input name="title" required defaultValue={safeStr(entry.title)} /></label><label>Résumé<textarea name="summary" required defaultValue={safeStr(entry.summary)} /></label><label>Travaux réalisés<textarea name="workItems" placeholder="Un élément par ligne" defaultValue={safeStr(entry.workItems)} /></label><div className="two-col"><label>Temps (minutes)<input name="timeMinutes" type="number" min="0" defaultValue={Number(entry.timeMinutes) || 0} /></label><label>Statut<select name="status" defaultValue={safeStr(entry.status)}>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div><label>Difficultés<textarea name="difficulties" defaultValue={safeStr((entry as any).difficulties)} /></label><label>Solutions<textarea name="solutions" defaultValue={safeStr((entry as any).solutions)} /></label><label>Compétences acquises<textarea name="skills" defaultValue={safeStr((entry as any).skills)} /></label><label>Résultat<textarea name="result" defaultValue={safeStr(entry.result)} /></label><button className="primary-button" type="submit">Enregistrer</button></form></div>;
}

function EntryDetail({ entry, admin, onClose, onAction, onUpload }: { entry: Entry; admin: boolean; onClose: () => void; onAction: (action: 'COMMENT' | 'VALIDATE' | 'REQUEST_CHANGE' | 'SUBMIT', content?: string) => void; onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void }) {
  const [comment, setComment] = useState('');
  return <div className="modal-backdrop" onClick={onClose}><section className="modal panel journal-detail" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><p className="eyebrow">DÉTAIL DU JOURNAL</p><h2>{safeStr(entry.title)}</h2><p className="muted">{safeDateLabel(entry.entryDate)} · {safeStr(entry.category?.name)}</p><p>{safeStr(entry.summary)}</p>{entry.result ? <p><strong>Résultat :</strong> {safeStr(entry.result)}</p> : null}<div className="journal-comments">{asArray(entry.comments).map((item) => <p key={safeStr((item as any).id)}><strong>{safeFullName((item as any).author)}</strong> {safeStr((item as any).content)}</p>)}</div><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Ajouter un commentaire…" /><div className="detail-actions"><button className="outline-button" disabled={!comment.trim()} onClick={() => onAction('COMMENT', comment)}>Commenter</button>{entry.status === 'BROUILLON' && <button className="outline-button" onClick={() => onAction('SUBMIT')}>Demander validation</button>}{admin && <><button className="outline-button" onClick={() => onAction('REQUEST_CHANGE')}>Demander modification</button><button className="primary-button" onClick={() => onAction('VALIDATE')}>Valider</button></>}<label className="outline-button file-button"><FileUp size={15} /> Ajouter un fichier<input type="file" accept="application/pdf,image/jpeg,image/png,text/plain,.docx" onChange={onUpload} hidden /></label></div></section></div>;
}

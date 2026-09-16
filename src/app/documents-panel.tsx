'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, FileText, Link2, Plus, Trash2 } from './ui-icons';

type Document = {
  id: string; name: string; url: string; kind: string; description: string | null;
  projectName: string | null; taskId: string | null; createdAt: string;
  task: { title: string } | null;
  uploadedBy: { id: string; firstName: string; lastName: string };
};
type Task = { id: string; title: string; project: string | null };

const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

/** Partage de documents et livrables : liens et fichiers attachés aux projets et tâches. */
export default function DocumentsPanel({ isAdmin }: { isAdmin: boolean }) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectFilter, setProjectFilter] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLInputElement>(null);
  const projectRef = useRef<HTMLInputElement>(null);
  const taskRef = useRef<HTMLSelectElement>(null);
  const kindRef = useRef<HTMLSelectElement>(null);

  const load = useCallback(async (project = '') => {
    try {
      const [docsRes, tasksRes] = await Promise.all([
        fetch(`/api/project-documents${project ? `?project=${encodeURIComponent(project)}` : ''}`),
        fetch('/api/tasks'),
      ]);
      const json = await docsRes.json();
      if (!docsRes.ok) throw new Error(json.error ?? 'Chargement impossible.');
      setDocuments(json.documents ?? []);
      if (tasksRes.ok) setTasks((await tasksRes.json()).tasks ?? []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const projects = [...new Set(documents.map((d) => d.projectName).filter(Boolean))] as string[];

  const add = async () => {
    const name = nameRef.current?.value.trim();
    const url = urlRef.current?.value.trim();
    if (!name || !url) { setError('Nom et lien/fichier sont requis.'); return; }
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/project-documents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, url,
          kind: kindRef.current?.value ?? 'LINK',
          description: descRef.current?.value.trim() || undefined,
          projectName: projectRef.current?.value.trim() || undefined,
          taskId: taskRef.current?.value || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Ajout impossible.');
      for (const r of [nameRef, urlRef, descRef]) if (r.current) r.current.value = '';
      await load(projectFilter);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inattendue.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setError('');
    const res = await fetch(`/api/project-documents/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? 'Suppression impossible.');
      return;
    }
    await load(projectFilter);
  };

  return (
    <div>
      <div className="page-heading">
        <div>
          <p className="eyebrow">LIVRABLES</p>
          <h1>Documents &amp; livrables</h1>
          <p className="muted">Partagez les liens et fichiers de vos projets, accessibles à toute l'équipe de l'organisation.</p>
        </div>
      </div>

      {error && <p className="notice" style={{ color: 'var(--red)' }}>{error}</p>}

      {/* Ajout */}
      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panel-heading"><div><p className="eyebrow">PARTAGER</p><h3>Ajouter un document ou livrable</h3></div></div>
        <form onSubmit={(e) => { e.preventDefault(); add(); }} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input ref={nameRef} type="text" placeholder="Nom du document" style={{ flex: '1 1 180px' }} required />
          <input ref={urlRef} type="url" placeholder="https://… (lien ou URL de fichier)" style={{ flex: '2 1 240px' }} required />
          <select ref={kindRef} defaultValue="LINK" style={{ width: 110 }}>
            <option value="LINK">Lien</option>
            <option value="FILE">Fichier</option>
          </select>
          <input ref={descRef} type="text" placeholder="Description (optionnel)" style={{ flex: '1 1 180px' }} />
          <input ref={projectRef} type="text" placeholder="Projet (optionnel)" style={{ flex: '1 1 150px' }} />
          <select ref={taskRef} defaultValue="" style={{ flex: '1 1 180px' }}>
            <option value="">— Sans tâche —</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>{t.title}{t.project ? ` · ${t.project}` : ''}</option>
            ))}
          </select>
          <button type="submit" className="btn" disabled={busy} style={{ padding: '0 16px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> Partager
          </button>
        </form>
      </section>

      {/* Filtres par projet */}
      <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
        <button
          className="btn"
          style={{ padding: '6px 12px', fontSize: 12, background: !projectFilter ? 'var(--blue-soft, #eef3ff)' : undefined }}
          onClick={() => { setProjectFilter(''); load(); }}
        >
          Tous
        </button>
        {projects.map((p) => (
          <button
            key={p}
            className="btn"
            style={{ padding: '6px 12px', fontSize: 12, background: projectFilter === p ? 'var(--blue-soft, #eef3ff)' : undefined }}
            onClick={() => { setProjectFilter(p); load(p); }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Liste */}
      <section className="panel" style={{ marginTop: 14 }}>
        <div className="panel-heading"><div><p className="eyebrow">BIBLIOTHÈQUE</p><h3>{projectFilter ? `Projet ${projectFilter}` : 'Tous les livrables'}</h3></div></div>
        {documents.length === 0 ? (
          <p className="muted">Aucun document partagé pour le moment.</p>
        ) : (
          documents.map((d) => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
              {d.kind === 'FILE'
                ? <FileText size={15} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                : <Link2 size={15} style={{ color: 'var(--muted)', flexShrink: 0 }} />}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {d.name}
                  {d.projectName ? <span className="muted"> · {d.projectName}</span> : null}
                  {d.task ? <span className="muted"> · {d.task.title}</span> : null}
                </div>
                <div className="muted" style={{ fontSize: 11.5 }}>
                  {d.kind === 'FILE' ? 'Fichier' : 'Lien'} · partagé par {d.uploadedBy.firstName} {d.uploadedBy.lastName} · {fmt(d.createdAt)}
                  {d.description ? ` — ${d.description}` : ''}
                </div>
              </div>
              <a href={d.url} target="_blank" rel="noreferrer" className="btn" style={{ padding: '0 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <ExternalLink size={12} /> Ouvrir
              </a>
              <button className="nav-link" style={{ color: 'var(--red)', padding: 6 }} title="Supprimer" onClick={() => remove(d.id)}>
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </section>
    </div>
  );
}



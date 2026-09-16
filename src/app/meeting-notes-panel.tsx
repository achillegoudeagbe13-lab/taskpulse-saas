'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Plus, Trash2 } from './ui-icons';

type Note = {
  id: string; title: string; projectName: string | null; roomName: string | null;
  createdAt: string; updatedAt: string;
  author: { id: string; firstName: string; lastName: string };
  lastEditedBy: { id: string; firstName: string; lastName: string } | null;
};
type Meeting = { id: string; description: string | null; room: { roomName: string } | null };

const fmt = (d: string) => new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Notes collaboratives de réunion : comptes-rendus partagés liés aux réunions Jitsi et aux projets. */
export default function MeetingNotesPanel() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openNote, setOpenNote] = useState<{ id: string; title: string; content: string; updatedAt: string; lastEditedBy: { firstName: string; lastName: string } | null } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const projectRef = useRef<HTMLInputElement>(null);
  const meetingRef = useRef<HTMLSelectElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const editTitleRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const [notesRes, meetRes] = await Promise.all([fetch('/api/meeting-notes'), fetch('/api/org/meetings')]);
      const json = await notesRes.json();
      if (!notesRes.ok) throw new Error(json.error ?? 'Chargement impossible.');
      setNotes(json.notes ?? []);
      if (meetRes.ok) {
        const m = await meetRes.json();
        setMeetings((m.meetings ?? []).map((x: { id: string; title: string; room: { roomName: string } | null }) => ({ id: x.id, description: x.title, room: x.room })));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Recharge périodiquement la note ouverte (édition collaborative partagée).
  useEffect(() => {
    if (!openId) return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/meeting-notes/${openId}`);
      if (!res.ok || !editorRef.current || !editTitleRef.current) return;
      const remote = (await res.json()).note;
      setOpenNote(remote);
      if (document.activeElement !== editorRef.current) {
        editorRef.current.value = remote.content;
        editorRef.current.defaultValue = remote.content;
      }
      if (document.activeElement !== editTitleRef.current) {
        editTitleRef.current.value = remote.title;
        editTitleRef.current.defaultValue = remote.title;
      }
    }, 10000);
    return () => clearInterval(t);
  }, [openId]);

  const open = async (id: string) => {
    setOpenId(id);
    setOpenNote(null);
    const res = await fetch(`/api/meeting-notes/${id}`);
    if (res.ok) setOpenNote((await res.json()).note);
  };

  const create = async () => {
    const title = titleRef.current?.value.trim();
    if (!title) { setError('Le titre est requis.'); return; }
    setError('');
    setBusy(true);
    try {
      const meetingId = meetingRef.current?.value || undefined;
      const meeting = meetings.find((m) => m.id === meetingId);
      const res = await fetch('/api/meeting-notes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          projectName: projectRef.current?.value.trim() || undefined,
          meetingId,
          roomName: meeting?.room?.roomName || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Création impossible.');
      if (titleRef.current) titleRef.current.value = '';
      if (projectRef.current) projectRef.current.value = '';
      await load();
      await open(json.note.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inattendue.');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!openId || !editorRef.current || !editTitleRef.current) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/meeting-notes/${openId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitleRef.current.value, content: editorRef.current.value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Enregistrement impossible.');
      setOpenNote(json.note);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inattendue.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setError('');
    const res = await fetch(`/api/meeting-notes/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? 'Suppression impossible.');
      return;
    }
    if (openId === id) { setOpenId(null); setOpenNote(null); }
    await load();
  };

  return (
    <div>
      <div className="page-heading">
        <div>
          <p className="eyebrow">COMPTES-RENDUS</p>
          <h1>Notes de réunion</h1>
          <p className="muted">Prenez des notes partagées pendant vos visioconférences Jitsi : chaque membre peut consulter et compléter le compte-rendu en temps quasi réel.</p>
        </div>
      </div>

      {error && <p className="notice" style={{ color: 'var(--red)' }}>{error}</p>}

      {/* Création */}
      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panel-heading"><div><p className="eyebrow">NOUVEAU</p><h3>Créer un compte-rendu</h3></div></div>
        <form onSubmit={(e) => { e.preventDefault(); create(); }} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input ref={titleRef} type="text" placeholder="Titre (ex : Réunion de lancement)" style={{ flex: '1 1 220px' }} required />
          <input ref={projectRef} type="text" placeholder="Projet (optionnel)" style={{ flex: '1 1 160px' }} />
          <select ref={meetingRef} defaultValue="" style={{ flex: '1 1 200px' }}>
            <option value="">— Sans réunion planifiée —</option>
            {meetings.map((m) => (
              <option key={m.id} value={m.id}>{m.description || 'Réunion'}{m.room ? ` · ${m.room.roomName}` : ''}</option>
            ))}
          </select>
          <button type="submit" className="btn" disabled={busy} style={{ padding: '0 16px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> Créer
          </button>
        </form>
      </section>

      {/* Éditeur partagé */}
      {openId && (
        <section className="panel" style={{ marginTop: 18 }}>
          <div className="panel-heading">
            <div><p className="eyebrow">ÉDITION PARTAGÉE</p><h3>{openNote?.title ?? 'Chargement…'}</h3></div>
            <button className="nav-link" onClick={() => { setOpenId(null); setOpenNote(null); }}>Fermer</button>
          </div>
          {openNote ? (
            <div style={{ display: 'grid', gap: 12 }}>
              <input ref={editTitleRef} defaultValue={openNote.title} style={{ fontWeight: 700 }} />
              <textarea
                ref={editorRef}
                defaultValue={openNote.content}
                style={{ minHeight: 260, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.55 }}
                placeholder="Décisions, actions, responsables…"
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button className="btn" onClick={save} disabled={busy} style={{ padding: '0 18px' }}>Enregistrer</button>
                <span className="muted" style={{ fontSize: 12 }}>
                  Dernière modification : {fmt(openNote.updatedAt)}
                  {openNote.lastEditedBy ? ` par ${openNote.lastEditedBy.firstName} ${openNote.lastEditedBy.lastName}` : ''}
                </span>
              </div>
            </div>
          ) : (
            <p className="muted">Chargement du contenu…</p>
          )}
        </section>
      )}

      {/* Liste */}
      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panel-heading"><div><p className="eyebrow">TOUS LES COMPTES-RENDUS</p><h3>Notes de l'organisation</h3></div></div>
        {notes.length === 0 ? (
          <p className="muted">Aucune note pour le moment.</p>
        ) : (
          notes.map((n) => (
            <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
              <FileText size={15} style={{ color: 'var(--muted)', flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{n.title}</div>
                <div className="muted" style={{ fontSize: 11.5 }}>
                  {n.projectName ? `Projet ${n.projectName} · ` : ''}
                  {n.roomName ? `Salle ${n.roomName} · ` : ''}
                  modifié {fmt(n.updatedAt)}
                  {n.lastEditedBy ? ` par ${n.lastEditedBy.firstName} ${n.lastEditedBy.lastName}` : ''}
                </div>
              </div>
              <button className="btn" onClick={() => open(n.id)} style={{ padding: '0 12px', fontSize: 12 }}>Ouvrir</button>
              <button className="nav-link" style={{ color: 'var(--red)', padding: 6 }} title="Supprimer" onClick={() => remove(n.id)}>
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </section>
    </div>
  );
}




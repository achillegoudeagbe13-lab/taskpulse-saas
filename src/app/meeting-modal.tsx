'use client';
import { useState, type FormEvent } from 'react';
import { X, Calendar as CalendarIcon, Users } from './ui-icons';
type Member = { id: string; name: string };

export default function MeetingModal({ open, onClose, members }: { open: boolean; onClose: () => void; members: Member[] }) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [location, setLocation] = useState('');
  const [link, setLink] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  if (!open) return null;

  function toggle(id: string) { setSelected(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]); }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!title || !start || !end) { setError('Titre, date de début et de fin sont obligatoires.'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await fetch('/api/org/meetings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, description: desc, startAt: start, endAt: end, location: location || undefined, meetingLink: link || undefined, members: selected }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Erreur inconnue.');
      setSuccess('Réunion programmée et participants notifiés.'); setTitle(''); setDesc(''); setStart(''); setEnd(''); setLocation(''); setLink(''); setSelected([]);
    } catch (e2) { setError((e2 as Error).message); } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay"><div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-header"><h2>Planifier une réunion d’équipe</h2><button className="icon-button" onClick={onClose}><X size={18} /></button></div>
      <form onSubmit={save} className="modal-body">
        {error && <div className="notice error">{error}</div>}
        {success && <div className="notice success">{success}</div>}
        <div className="form-row"><label>Titre *</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Réunion hebdo projet X" required /></div>
        <div className="form-row"><label>Description</label><textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} /></div>
        <div className="form-row"><label>Début *</label><input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required /></div>
        <div className="form-row"><label>Fin *</label><input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} required /></div>
        <div className="form-row"><label>Lieu / link</label><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Salle 3 ou lien visio…" /><input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/…" /></div>
        <div className="form-row"><label>Participants</label>
          <div className="members-checkboxes">{(members ?? []).slice(0, 20).map((m) => <label key={m.id}><input type="checkbox" checked={selected.includes(m.id)} onChange={() => toggle(m.id)} /> {m.name || m.id}</label>)}</div>
        </div>
        <div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>Annuler</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Planification…' : 'Planifier'}</button></div>
      </form>
    </div>
  </div>
  );
}

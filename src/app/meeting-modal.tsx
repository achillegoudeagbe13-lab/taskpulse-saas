'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { X } from './ui-icons';
import { jitsiRoomUrl } from '../lib/jitsi';
type Member = { id: string; name: string };
type MeetingRoom = { id: string; name: string; roomName: string; domain: string };

export default function MeetingModal({ open, onClose, onCreated, members, defaultDate = '' }: { open: boolean; onClose: () => void; onCreated?: () => void; members: Member[]; defaultDate?: string }) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [location, setLocation] = useState('');
  const [link, setLink] = useState('');
  const [rooms, setRooms] = useState<MeetingRoom[]>([]);
  const [roomId, setRoomId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // À l'ouverture : pré-remplit l'horaire avec la date cliquée dans le calendrier (ou vide).
  useEffect(() => {
    if (!open) return;
    const base = defaultDate?.slice(0, 10) ?? '';
    setStart(base ? `${base}T09:00` : '');
    setEnd(base ? `${base}T10:00` : '');
    setTitle(''); setDesc(''); setLocation(''); setLink(''); setSelected([]); setRoomId('');
    setError(''); setSuccess(''); setSaving(false);
  }, [open, defaultDate]);

  // Salles de visioconférence Jitsi de l'organisation (sélection optionnelle).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/org/meeting-rooms', { cache: 'no-store' });
        if (!response.ok) return;
        const result = await response.json();
        if (!cancelled) setRooms(Array.isArray(result.rooms) ? result.rooms : []);
      } catch { /* la salle Jitsi reste optionnelle : le lien libre demeure disponible */ }
    })();
    return () => { cancelled = true; };
  }, [open]);

  if (!open) return null;

  function toggle(id: string) { setSelected(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]); }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!title || !start || !end) { setError('Titre, date de début et de fin sont obligatoires.'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await fetch('/api/org/meetings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, description: desc, startAt: start, endAt: end, location: location || undefined, meetingLink: link || undefined, roomId: roomId || undefined, members: selected }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Erreur inconnue.');
      setSuccess('Réunion programmée et participants notifiés.'); setTitle(''); setDesc(''); setStart(''); setEnd(''); setLocation(''); setLink(''); setSelected([]);
      setTimeout(() => { onCreated?.(); onClose(); }, 700);
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
        <div className="form-row"><label>Lieu / lien</label><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Salle 3 ou visioconférence…" /></div>
        <div className="form-row">
          <label>Salle de visioconférence Jitsi</label>
          <select
            value={roomId}
            onChange={(e) => {
              const value = e.target.value;
              setRoomId(value);
              const room = rooms.find((item) => item.id === value);
              // Le lien Jitsi est prérempli ; il est de toute façon recalculé côté serveur.
              setLink(room ? jitsiRoomUrl(room.roomName, room.domain) : '');
            }}
          >
            <option value="">Aucune salle (lien libre ci-dessous)</option>
            {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
          </select>
          {rooms.length === 0 && <small className="muted">Créez une salle depuis l’onglet Visioconférence.</small>}
        </div>
        <div className="form-row"><label>Lien visio (optionnel)</label><input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.jit.si/…" /></div>
        <div className="form-row"><label>Participants</label>
          <div className="members-checkboxes">{(members ?? []).slice(0, 20).map((m) => <label key={m.id}><input type="checkbox" checked={selected.includes(m.id)} onChange={() => toggle(m.id)} /> {m.name || m.id}</label>)}</div>
        </div>
        <div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>Annuler</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Planification…' : 'Planifier'}</button></div>
      </form>
    </div>
  </div>
  );
}

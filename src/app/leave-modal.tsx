'use client';
import { useState, type FormEvent } from 'react';
import { X } from './ui-icons';

const TYPES = ['CONGE', 'RTT', 'MALADIE'];

export default function LeaveModal({ open, onClose, userId }: { open: boolean; onClose: () => void; userId: string }) {
  if (!open) return null;
  const [type, setType] = useState(TYPES[0]);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!start || !end) { setError('Veuillez choisir une période.'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await fetch('/api/org/leaves', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, startDate: start, endDate: end, reason, userId }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Erreur inconnue.');
      setSuccess(json.message ?? 'Demande envoyée.'); setType(TYPES[0]); setStart(''); setEnd(''); setReason('');
    } catch (e2) { setError((e2 as Error).message); } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay"><div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-header"><h2>Nouvelle demande de congé</h2><button className="icon-button" onClick={onClose}><X size={18} /></button></div>
      <form onSubmit={save} className="modal-body">
        {error && <div className="notice error">{error}</div>}
        {success && <div className="notice success">{success}</div>}
        <div className="form-row"><label>Type</label><select value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map((t) => <option key={t} value={t}>{t === 'CONGE' ? 'Congé' : t === 'RTT' ? 'RTT' : 'Maladie'}</option>)}</select></div>
        <div className="form-row"><label>Date de début</label><input type="date" value={start} onChange={(e) => setStart(e.target.value)} required /></div>
        <div className="form-row"><label>Date de fin</label><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} required /></div>
        <div className="form-row"><label>Motif (optionnel)</label><textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Ex. rendez-vous médical…" /></div>
        <div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>Annuler</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Envoi…' : 'Envoyer la demande'}</button></div>
      </form>
    </div>
  </div>
  );
}

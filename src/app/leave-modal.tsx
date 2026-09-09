'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { X } from './ui-icons';

const TYPES = ['ABSENCE', 'CONGE', 'PERMISSION', 'RTT', 'MALADIE'];
const TYPE_LABELS: Record<string, string> = { ABSENCE: 'Absence', CONGE: 'Congé', PERMISSION: 'Permission', RTT: 'RTT', MALADIE: 'Maladie' };
const MODAL_TITLES: Record<string, string> = { ABSENCE: 'Signaler une absence', CONGE: 'Demander un congé', PERMISSION: 'Demander une permission', RTT: 'Demander un RTT', MALADIE: 'Signaler un arrêt maladie' };

export default function LeaveModal({ open, onClose, onCreated, initialType = 'CONGE', defaultDate }: { open: boolean; onClose: () => void; onCreated?: () => void; initialType?: string; defaultDate?: string }) {
  const [type, setType] = useState(initialType);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // À l'ouverture : type et dates initialisés (avec la date cliquée dans le calendrier si fournie).
  useEffect(() => {
    if (!open) return;
    setType(initialType);
    setStart(defaultDate ?? '');
    setEnd(defaultDate ?? '');
    setReason(''); setError(''); setSuccess(''); setSaving(false);
  }, [open, initialType, defaultDate]);

  if (!open) return null;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!start || !end) { setError('Veuillez choisir une période.'); return; }
    if (end < start) { setError('La date de fin est antérieure à la date de début.'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await fetch('/api/org/leaves', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, startDate: start, endDate: end, reason }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Erreur inconnue.');
      setSuccess(json.message ?? 'Demande envoyée.');
      setTimeout(() => { onCreated?.(); onClose(); }, 700);
    } catch (e2) { setError((e2 as Error).message); } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay"><div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-header"><h2>{MODAL_TITLES[type] ?? 'Nouvelle demande'}</h2><button className="icon-button" onClick={onClose}><X size={18} /></button></div>
      <form onSubmit={save} className="modal-body">
        {error && <div className="notice error">{error}</div>}
        {success && <div className="notice success">{success}</div>}
        <div className="form-row"><label>Type</label><select value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}</select></div>
        <div className="form-row"><label>Date de début</label><input type="date" value={start} onChange={(e) => setStart(e.target.value)} required /></div>
        <div className="form-row"><label>Date de fin</label><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} required /></div>
        <div className="form-row"><label>Motif (optionnel)</label><textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Ex. rendez-vous médical…" /></div>
        <div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>Annuler</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Envoi…' : (type === 'ABSENCE' ? 'Signaler l’absence' : type === 'PERMISSION' ? 'Envoyer la demande de permission' : 'Envoyer la demande')}</button></div>
      </form>
    </div>
  </div>
  );
}

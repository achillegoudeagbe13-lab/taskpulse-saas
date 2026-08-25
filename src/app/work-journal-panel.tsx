'use client';

import { FormEvent, useEffect, useState } from 'react';
import { BookOpen, CalendarDays, Download, FileText, Pencil, Plus, RefreshCw, Search, Trash2 } from './ui-icons';
import JournalExtras from './journal-extras';
import WorkJournalAdvanced from './work-journal-advanced';

type Entry = { id: string; entryDate: string; title: string; summary: string; workItems: string; timeMinutes: number; difficulties?: string | null; solutions?: string | null; skills?: string | null; result?: string | null; personalComment?: string | null; status: string; category: { name: string } };
type JournalUser = { firstName: string; lastName: string; role: string; department: string; profile?: { position?: string | null } | null };
type Stats = { totalEntries: number; documentedDays: number; timeMinutes: number; completedEntries: number };

const statusLabels: Record<string, string> = { BROUILLON: 'Brouillon', ENREGISTREE: 'Enregistrée', VALIDEE: 'Validée', MODIFICATION_DEMANDEE: 'Modification demandée', EN_ATTENTE_VALIDATION: 'En attente de validation' };
const categories = ['Administration', 'Comptabilité', 'Finance', 'Communication', 'Marketing', 'Informatique', 'Ressources humaines', 'Design', 'Réunion', 'Formation', 'Projet', 'Gestion', 'Autre'];

export default function WorkJournalPanel({ user, onNavigate }: { user: JournalUser; onNavigate?: (page: string) => void }) {
  const [entries, setEntries] = useState<Entry[]>([]); const [stats, setStats] = useState<Stats>({ totalEntries: 0, documentedDays: 0, timeMinutes: 0, completedEntries: 0 }); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [editing, setEditing] = useState<Entry | null>(null); const [showForm, setShowForm] = useState(false); const [query, setQuery] = useState(''); const [category, setCategory] = useState(''); const [status, setStatus] = useState(''); const [report, setReport] = useState('');
    async function load() {
      setLoading(true); setError('');
      try {
        const params = new URLSearchParams(); if (query) params.set('q', query); if (category) params.set('category', category); if (status) params.set('status', status);
        const response = await fetch(`/api/journal?${params}`); const result = await response.json();
        if (!response.ok) throw new Error(result.error); setEntries(result.entries); setStats(result.stats);
      } catch (reason) { setError(reason instanceof Error ? reason.message : 'Impossible de charger le journal.'); } finally { setLoading(false); }
    }
  useEffect(() => { load(); }, [query, category, status]);
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); if (editing) data.id = editing.id; const response = await fetch('/api/journal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); const result = await response.json(); if (!response.ok) { setError(result.error); return; } setShowForm(false); setEditing(null); setNotice(result.message); load(); }
  async function remove(id: string) { if (!window.confirm('Supprimer cette entrée du journal ?')) return; const response = await fetch(`/api/journal?id=${id}`, { method: 'DELETE' }); const result = await response.json(); if (!response.ok) setError(result.error); else { setNotice('Entrée supprimée.'); load(); } }
  function exportCsv() { const header = ['Date', 'Titre', 'Catégorie', 'Résumé', 'Temps (minutes)', 'Statut']; const rows = entries.map((entry) => [entry.entryDate.slice(0, 10), entry.title, entry.category.name, entry.summary, String(entry.timeMinutes), statusLabels[entry.status]]); const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(';')).join('\n'); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })); link.download = 'mar-ci-flow-journal.csv'; link.click(); URL.revokeObjectURL(link.href); setNotice('Journal exporté.'); }
  async function prepareReport(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); const response = await fetch('/api/journal/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); const result = await response.json(); if (!response.ok) { setError(result.error); return; } setReport(result.report.content); setNotice(result.message); }
  const hours = Math.floor(stats.timeMinutes / 60); const minutes = stats.timeMinutes % 60;
  return <WorkJournalAdvanced user={user} onNavigate={onNavigate} />;
}
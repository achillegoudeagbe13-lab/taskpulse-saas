import { NextResponse } from 'next/server';
import { requireOrgMember } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';

function escapeHtml(value: unknown) { return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char)); }
function roleLabel(role: string) { return role === 'ORGANIZATION_ADMIN' ? 'Administrateur' : role === 'INTERN' ? 'Stagiaire' : 'Employé'; }

export async function GET(request: Request) {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;
  const params = new URL(request.url).searchParams;
  const format = params.get('format') === 'excel' ? 'excel' : params.get('format') === 'pdf' ? 'pdf' : 'csv';
  const category = params.get('category'); const status = params.get('status'); const from = params.get('from'); const to = params.get('to');
  const journal = await prisma.workJournal.findUnique({ where: { userId: auth.ctx.user.id }, include: { entries: { where: { organizationId: auth.ctx.organizationId, ...(category ? { category: { name: category } } : {}), ...(status ? { status: status as 'BROUILLON' | 'ENREGISTREE' | 'VALIDEE' | 'MODIFICATION_DEMANDEE' | 'EN_ATTENTE_VALIDATION' } : {}), ...(from || to ? { entryDate: { ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}) } } : {}) }, include: { category: true }, orderBy: { entryDate: 'asc' } } } });
  const entries = journal?.entries ?? [];
  const rows = entries.map((entry) => [entry.entryDate.toLocaleDateString('fr-FR'), entry.title, entry.category.name, entry.summary, `${entry.timeMinutes} min`, entry.status]);
  if (format === 'pdf') {
    const html = `<html lang="fr"><head><meta charset="utf-8"><title>TaskPulse - Journal</title><style>body{font-family:Arial;color:#172033;padding:32px}h1{color:#2251e5}table{border-collapse:collapse;width:100%}th,td{border:1px solid #dce2eb;padding:8px;text-align:left;vertical-align:top}th{background:#f1f4f9}</style></head><body><h1>TASKPULSE</h1><h2>Journal de travail - ${escapeHtml(auth.ctx.user.firstName)} ${escapeHtml(auth.ctx.user.lastName)}</h2><p>${escapeHtml(roleLabel(auth.ctx.orgRole ?? 'EMPLOYEE'))} · ${escapeHtml(auth.ctx.user.department?.name ?? '')} · ${escapeHtml(auth.ctx.organization.name)}</p><table><thead><tr><th>Date</th><th>Titre</th><th>Catégorie</th><th>Résumé</th><th>Temps</th><th>Statut</th></tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table><script>window.print()</script></body></html>`;
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': 'inline; filename="taskpulse-journal.html"' } });
  }
  const csv = [['Date', 'Titre', 'Catégorie', 'Résumé', 'Temps', 'Statut'], ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(';')).join('\r\n');
  return new NextResponse(`\ufeff${format === 'excel' ? `<table><tr>${['Date', 'Titre', 'Catégorie', 'Résumé', 'Temps', 'Statut'].map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</table>` : csv}`, { headers: { 'Content-Type': format === 'excel' ? 'application/vnd.ms-excel; charset=utf-8' : 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="taskpulse-journal.${format === 'excel' ? 'xls' : 'csv'}"` } });
}
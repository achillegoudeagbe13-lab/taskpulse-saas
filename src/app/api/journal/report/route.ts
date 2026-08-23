import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrgMember } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';

const inputSchema = z.object({ startDate: z.string(), endDate: z.string(), type: z.string().min(1) });

export async function POST(request: Request) {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;
  try {
    const input = inputSchema.parse(await request.json());
    const startDate = new Date(`${input.startDate}T00:00:00`); const endDate = new Date(`${input.endDate}T23:59:59`);
    const journal = await prisma.workJournal.findUnique({ where: { userId: auth.ctx.user.id }, include: { entries: { where: { organizationId: auth.ctx.organizationId, entryDate: { gte: startDate, lte: endDate }, status: { not: 'BROUILLON' } }, include: { category: true }, orderBy: { entryDate: 'asc' } } } });
    const entries = journal?.entries ?? [];
    const body = entries.length ? entries.map((entry) => `${entry.entryDate.toLocaleDateString('fr-FR')} - ${entry.title}\nCatégorie : ${entry.category.name}\n${entry.summary}${entry.result ? `\nRésultat : ${entry.result}` : ''}`).join('\n\n') : 'Aucune entrée enregistrée sur cette période.';
    const roleLabel = auth.ctx.orgRole === 'INTERN' ? 'Mon rapport de stage' : auth.ctx.orgRole === 'ORGANIZATION_ADMIN' ? 'Mon rapport d’activité' : 'Mon bilan d’activité';
    const title = `${roleLabel} - ${auth.ctx.organization.name}`;
    const content = `${title}\nPériode : ${input.startDate} au ${input.endDate}\n\n${body}`;
    const report = await prisma.journalReport.create({ data: { userId: auth.ctx.user.id, type: input.type, startDate, endDate, title, content } });
    return NextResponse.json({ report, message: 'Rapport préparé à partir de votre journal.' }, { status: 201 });
  } catch { return NextResponse.json({ error: 'Impossible de préparer ce rapport.' }, { status: 400 }); }
}
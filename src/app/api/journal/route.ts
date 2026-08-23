import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser, requireOrgMember } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const entrySchema = z.object({
  id: z.string().optional(),
  entryDate: z.string().min(1),
  title: z.string().trim().min(1).max(180),
  category: z.string().trim().min(1).max(80),
  summary: z.string().trim().min(1).max(6000),
  workItems: z.string().max(6000).default(''),
  timeMinutes: z.coerce.number().int().min(0).max(1440).default(0),
  difficulties: z.string().max(4000).optional(),
  solutions: z.string().max(4000).optional(),
  skills: z.string().max(4000).optional(),
  result: z.string().max(4000).optional(),
  personalComment: z.string().max(4000).optional(),
  status: z.enum(['BROUILLON', 'ENREGISTREE', 'VALIDEE', 'MODIFICATION_DEMANDEE', 'EN_ATTENTE_VALIDATION']).default('BROUILLON'),
  taskId: z.string().optional(),
  activityId: z.string().optional(),
});

function startOfDay(value: string) { const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? null : date; }

async function getJournal(userId: string) {
  return prisma.workJournal.upsert({ where: { userId }, update: {}, create: { userId } });
}

export async function GET(request: Request) {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;
  const params = new URL(request.url).searchParams;
  const query = params.get('q')?.trim();
  const category = params.get('category');
  const status = params.get('status') as 'BROUILLON' | 'ENREGISTREE' | 'VALIDEE' | 'MODIFICATION_DEMANDEE' | 'EN_ATTENTE_VALIDATION' | null;
  const from = params.get('from');
  const to = params.get('to');
  const requestedUserId = params.get('userId');

  // Un ORGANIZATION_ADMIN ne consulte que les journaux des membres de SON organisation.
  let targetUserId = auth.ctx.user.id;
  let viewOnly = false;
  if (requestedUserId && requestedUserId !== auth.ctx.user.id) {
    if (auth.ctx.orgRole !== 'ORGANIZATION_ADMIN') return NextResponse.json({ error: 'Accès réservé aux administrateurs.' }, { status: 403 });
    if (!(await prisma.membership.findFirst({ where: { userId: requestedUserId, organizationId: auth.ctx.organizationId } }))) {
      return NextResponse.json({ error: 'Ce membre n’appartient pas à votre organisation.' }, { status: 404 });
    }
    targetUserId = requestedUserId;
    viewOnly = true;
  }

  const journal = viewOnly
    ? await prisma.workJournal.findUnique({ where: { userId: targetUserId } })
    : await getJournal(targetUserId);
  if (!journal) return NextResponse.json({ error: 'Journal introuvable.' }, { status: 404 });

  // Isolation : entrées confinées à l'organisation active.
  const entries = await prisma.journalEntry.findMany({
    where: { journalId: journal.id, organizationId: auth.ctx.organizationId, ...(category ? { category: { name: category } } : {}), ...(status ? { status } : {}), ...(query ? { OR: [{ title: { contains: query } }, { summary: { contains: query } }, { workItems: { contains: query } }] } : {}), ...(from || to ? { entryDate: { ...(from ? { gte: startOfDay(from) ?? undefined } : {}), ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}) } } : {}) },
    include: { category: true, attachments: true, comments: { include: { author: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: 'asc' } } },
    orderBy: { entryDate: 'desc' },
  });
  const [categories, totalTime, days, totalWorks] = await Promise.all([
    prisma.journalCategory.findMany({ where: { organizationId: auth.ctx.organizationId }, orderBy: { name: 'asc' } }),
    prisma.journalEntry.aggregate({ where: { journalId: journal.id, organizationId: auth.ctx.organizationId }, _sum: { timeMinutes: true } }),
    prisma.journalEntry.findMany({ where: { journalId: journal.id, organizationId: auth.ctx.organizationId }, select: { entryDate: true }, distinct: ['entryDate'] }),
    prisma.journalEntry.count({ where: { journalId: journal.id, organizationId: auth.ctx.organizationId, status: { not: 'BROUILLON' } } }),
  ]);
  return NextResponse.json({ entries, categories, stats: { totalEntries: await prisma.journalEntry.count({ where: { journalId: journal.id, organizationId: auth.ctx.organizationId } }), documentedDays: days.length, timeMinutes: totalTime._sum.timeMinutes ?? 0, completedEntries: totalWorks } });
}

export async function POST(request: Request) {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;
  try {
    const input = entrySchema.parse(await request.json());
    const entryDate = startOfDay(input.entryDate);
    if (!entryDate) return NextResponse.json({ error: 'Date invalide.' }, { status: 400 });
    const journal = await getJournal(auth.ctx.user.id);
    if (['VALIDEE', 'MODIFICATION_DEMANDEE', 'EN_ATTENTE_VALIDATION'].includes(input.status) && auth.ctx.orgRole !== 'ORGANIZATION_ADMIN') {
      return NextResponse.json({ error: 'Ce statut doit être attribué par un responsable.' }, { status: 403 });
    }
    // Catégorie propre à l'organisation active.
    let categoryRecord = await prisma.journalCategory.findFirst({ where: { organizationId: auth.ctx.organizationId, name: input.category } });
    if (!categoryRecord) categoryRecord = await prisma.journalCategory.create({ data: { name: input.category, organizationId: auth.ctx.organizationId } });
    const data = { entryDate, title: input.title, categoryId: categoryRecord.id, summary: input.summary, workItems: input.workItems, timeMinutes: input.timeMinutes, difficulties: input.difficulties || null, solutions: input.solutions || null, skills: input.skills || null, result: input.result || null, personalComment: input.personalComment || null, status: input.status, taskId: input.taskId || null, activityId: input.activityId || null };
    const updated = input.id ? await prisma.journalEntry.updateMany({ where: { id: input.id, journalId: journal.id, organizationId: auth.ctx.organizationId }, data }) : null;
    if (input.id && !updated?.count) return NextResponse.json({ error: 'Entrée introuvable.' }, { status: 404 });
    const created = input.id ? await prisma.journalEntry.findUnique({ where: { id: input.id }, include: { category: true } }) : await prisma.journalEntry.create({ data: { ...data, journalId: journal.id, organizationId: auth.ctx.organizationId }, include: { category: true } });
    return NextResponse.json({ entry: created, message: input.id ? 'Entrée mise à jour.' : 'Entrée enregistrée.' }, { status: input.id ? 200 : 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof z.ZodError ? error.issues[0]?.message : 'Impossible d’enregistrer cette entrée.' }, { status: 400 }); }
}

export async function DELETE(request: Request) {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Entrée manquante.' }, { status: 400 });
  const journal = await getJournal(auth.ctx.user.id);
  const deleted = await prisma.journalEntry.deleteMany({ where: { id, journalId: journal.id, organizationId: auth.ctx.organizationId } });
  return deleted.count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Entrée introuvable.' }, { status: 404 });
}
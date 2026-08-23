import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrgMember } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const actionSchema = z.object({ action: z.enum(['COMMENT', 'VALIDATE', 'REQUEST_CHANGE', 'SUBMIT']), entryId: z.string().min(1), content: z.string().trim().max(3000).optional() });

export async function POST(request: Request) {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;
  try {
    const input = actionSchema.parse(await request.json());
    const entry = await prisma.journalEntry.findUnique({ where: { id: input.entryId }, include: { journal: true } });
    // Anti-énumération : entrée d'une autre organisation = introuvable.
    if (!entry || entry.organizationId !== auth.ctx.organizationId) return NextResponse.json({ error: 'Entrée introuvable.' }, { status: 404 });
    const isOwner = entry.journal.userId === auth.ctx.user.id;
    if (!isOwner && auth.ctx.orgRole !== 'ORGANIZATION_ADMIN') return NextResponse.json({ error: 'Entrée privée.' }, { status: 403 });
    if (input.action === 'COMMENT') {
      if (!input.content) return NextResponse.json({ error: 'Le commentaire est vide.' }, { status: 400 });
      const comment = await prisma.journalComment.create({ data: { entryId: entry.id, authorId: auth.ctx.user.id, content: input.content } });
      return NextResponse.json({ comment }, { status: 201 });
    }
    if (input.action === 'SUBMIT') {
      if (!isOwner) return NextResponse.json({ error: 'Seul l’auteur peut demander une validation.' }, { status: 403 });
      const updated = await prisma.journalEntry.update({ where: { id: entry.id }, data: { status: 'EN_ATTENTE_VALIDATION' } });
      return NextResponse.json({ entry: updated });
    }
    if (auth.ctx.orgRole !== 'ORGANIZATION_ADMIN') return NextResponse.json({ error: 'Seul un administrateur peut valider une entrée.' }, { status: 403 });
    const updated = await prisma.journalEntry.update({ where: { id: entry.id }, data: { status: input.action === 'VALIDATE' ? 'VALIDEE' : 'MODIFICATION_DEMANDEE' } });
    return NextResponse.json({ entry: updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? error.issues[0]?.message : 'Action impossible.' }, { status: 400 });
  }
}
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrgMember } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { recordActivity } from '../../../../lib/activity';

const patchSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  content: z.string().max(50000).optional(),
});

/** GET — contenu complet d'une note (édition partagée). */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;

  const note = await prisma.meetingNote.findUnique({
    where: { id: params.id },
    select: {
      id: true, title: true, content: true, projectName: true, roomName: true,
      meetingId: true, updatedAt: true, organizationId: true,
      lastEditedBy: { select: { firstName: true, lastName: true } },
      author: { select: { firstName: true, lastName: true } },
    },
  });
  if (!note || note.organizationId !== auth.ctx.organizationId) {
    return NextResponse.json({ error: 'Note introuvable.' }, { status: 404 });
  }
  const { organizationId: _orgId, ...data } = note;
  return NextResponse.json({ note: data });
}

/** PATCH — édition collaborative (titre et/ou contenu). */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;

  const note = await prisma.meetingNote.findUnique({ where: { id: params.id }, select: { id: true, organizationId: true, title: true, projectName: true } });
  if (!note || note.organizationId !== auth.ctx.organizationId) {
    return NextResponse.json({ error: 'Note introuvable.' }, { status: 404 });
  }
  try {
    const input = patchSchema.parse(await request.json());
    const updated = await prisma.meetingNote.update({
      where: { id: note.id },
      data: { ...input, lastEditedById: auth.ctx.user.id },
      select: { id: true, title: true, content: true, updatedAt: true },
    });
    const actor = `${auth.ctx.user.firstName} ${auth.ctx.user.lastName}`.trim();
    recordActivity({
      organizationId: auth.ctx.organizationId, actorId: auth.ctx.user.id,
      action: 'NOTE_UPDATED', entityType: 'MeetingNote', entityId: note.id,
      summary: `a mis à jour le compte-rendu « ${updated.title} »`, projectName: note.projectName,
      metadata: { editor: actor },
    });
    return NextResponse.json({ note: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof z.ZodError ? error.issues[0]?.message : 'Données invalides.' },
      { status: 400 },
    );
  }
}

/** DELETE — suppression d'une note (auteur ou admin). */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;

  const note = await prisma.meetingNote.findUnique({ where: { id: params.id }, select: { id: true, authorId: true, organizationId: true, title: true } });
  if (!note || note.organizationId !== auth.ctx.organizationId) {
    return NextResponse.json({ error: 'Note introuvable.' }, { status: 404 });
  }
  if (note.authorId !== auth.ctx.user.id && auth.ctx.orgRole !== 'ORGANIZATION_ADMIN') {
    return NextResponse.json({ error: 'Suppression non autorisée.' }, { status: 403 });
  }
  await prisma.meetingNote.delete({ where: { id: note.id } });
  return NextResponse.json({ ok: true });
}

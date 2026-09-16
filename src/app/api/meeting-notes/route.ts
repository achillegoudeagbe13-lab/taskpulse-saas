import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrgMember } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { recordActivity } from '../../../lib/activity';

const noteSchema = z.object({
  title: z.string().trim().min(1).max(160),
  content: z.string().max(50000).default(''),
  meetingId: z.string().optional(),
  roomName: z.string().max(200).optional(),
  projectName: z.string().max(120).optional(),
});

/** GET — notes de l'organisation (métadonnées ; le contenu est récupéré par note). */
export async function GET() {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;

  const notes = await prisma.meetingNote.findMany({
    where: { organizationId: auth.ctx.organizationId },
    select: {
      id: true, title: true, projectName: true, roomName: true,
      createdAt: true, updatedAt: true,
      author: { select: { id: true, firstName: true, lastName: true } },
      lastEditedBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });
  return NextResponse.json({ notes });
}

/** POST — création d'une note de réunion (compte-rendu partagé). */
export async function POST(request: Request) {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;
  try {
    const input = noteSchema.parse(await request.json());

    let meetingId: string | undefined;
    if (input.meetingId) {
      const meeting = await prisma.meeting.findUnique({ where: { id: input.meetingId }, select: { id: true, organizationId: true } });
      if (!meeting || meeting.organizationId !== auth.ctx.organizationId) {
        return NextResponse.json({ error: 'Réunion introuvable.' }, { status: 404 });
      }
      meetingId = meeting.id;
    }

    const note = await prisma.meetingNote.create({
      data: {
        title: input.title, content: input.content,
        meetingId, roomName: input.roomName, projectName: input.projectName,
        authorId: auth.ctx.user.id, lastEditedById: auth.ctx.user.id,
        organizationId: auth.ctx.organizationId,
      },
      select: { id: true, title: true },
    });
    recordActivity({
      organizationId: auth.ctx.organizationId, actorId: auth.ctx.user.id,
      action: 'NOTE_CREATED', entityType: 'MeetingNote', entityId: note.id,
      summary: `a créé le compte-rendu « ${note.title} »`, projectName: input.projectName,
    });
    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof z.ZodError ? error.issues[0]?.message : 'Données invalides.' },
      { status: 400 },
    );
  }
}

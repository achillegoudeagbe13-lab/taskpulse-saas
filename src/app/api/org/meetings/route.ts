import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrgAdmin } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { jitsiRoomUrl } from '../../../../lib/jitsi';

const meetingSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().max(2000).optional(),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  location: z.string().max(160).optional(),
  meetingLink: z.string().url().optional(),
  /** Salle de visioconférence de l'organisation : le lien Jitsi en est dérivé côté serveur. */
  roomId: z.string().trim().min(1).max(64).optional(),
  members: z.array(z.string()).optional(),
});

/** GET — réunions récentes de l'organisation (admin). */
export async function GET() {
  const auth = await requireOrgAdmin();
  if (auth.error) return auth.error;
  const meetings = await prisma.meeting.findMany({
    where: { organizationId: auth.ctx.organizationId },
    select: {
      id: true, title: true, description: true, startAt: true, endAt: true, location: true, meetingLink: true, roomId: true,
      room: { select: { id: true, name: true, roomName: true, domain: true } },
      attendees: { select: { user: { select: { firstName: true, lastName: true, email: true } }, status: true } },
    },
    orderBy: { startAt: 'desc' },
    take: 60,
  });
  return NextResponse.json({ meetings });
}

/** POST — crée une réunion et notifie les participants. */
export async function POST(request: Request) {
  const auth = await requireOrgAdmin();
  if (auth.error) return auth.error;
  try {
    const input = meetingSchema.parse(await request.json());
    const start = new Date(input.startAt); const end = new Date(input.endAt);
    if (end <= start) return NextResponse.json({ error: 'La fin doit être postérieure au début.' }, { status: 400 });

    // Salle de visioconférence (optionnelle) : le lien Jitsi est dérivé de la salle
    // persistée, ce qui garantit un identifiant unique et non devinable.
    let roomId: string | undefined;
    let meetingLink = input.meetingLink;
    if (input.roomId) {
      const room = await prisma.meetingRoom.findFirst({
        where: { id: input.roomId, organizationId: auth.ctx.organizationId },
        select: { id: true, roomName: true, domain: true },
      });
      if (!room) return NextResponse.json({ error: 'Salle de visioconférence introuvable.' }, { status: 404 });
      roomId = room.id;
      meetingLink = jitsiRoomUrl(room.roomName, room.domain);
    }

    const memberIds = new Set<string>();
    // On résout chaque membre dans l'organisation.
    const memberships = input.members?.length
      ? await prisma.membership.findMany({ where: { organizationId: auth.ctx.organizationId, userId: { in: input.members } }, select: { userId: true } })
      : [];
    for (const m of memberships) memberIds.add(m.userId);
    memberIds.add(auth.ctx.user.id); // créateur inclut.

    const meeting = await prisma.meeting.create({
      data: {
        organizationId: auth.ctx.organizationId, createdById: auth.ctx.user.id,
        title: input.title, description: input.description, startAt: start, endAt: end,
        location: input.location, meetingLink, roomId,
        attendees: { create: Array.from(memberIds).map((uid) => ({ userId: uid })) },
      },
      select: { id: true, title: true, startAt: true, endAt: true, roomId: true, meetingLink: true },
    });

    // Notifications (fire-and-forget).
    for (const uid of memberIds) {
      prisma.notification.create({
        data: {
          user: { connect: { id: uid } }, organization: { connect: { id: auth.ctx.organizationId } },
          title: 'Réunion programmée', content: `${input.title} (${start.toLocaleString('fr-FR')} – ${end.toLocaleString('fr-FR')}).`,
        },
      }).catch(() => {});
    }
    return NextResponse.json({ meeting, ok: true }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Réunion invalide.' }, { status: 400 });
  }
}
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrgAdmin } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/prisma';
import { writeAudit } from '../../../../../lib/audit';

const patchSchema = z
  .object({
    name: z.string().trim().min(2, 'Le nom de la salle est trop court.').max(80).optional(),
    isDefault: z.boolean().optional(),
    /** `null` détache la salle de son projet/équipe ; une chaîne la rattache (ou crée) le projet. */
    departmentName: z.string().trim().min(1).max(60).nullable().optional(),
  })
  .refine((value) => value.name !== undefined || value.isDefault !== undefined || value.departmentName !== undefined, {
    message: 'Aucune modification demandée.',
  });

/** PATCH — renomme une salle, la définit par défaut ou la rattache à un projet/équipe. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireOrgAdmin();
  if (auth.error) return auth.error;
  const organizationId = auth.ctx.organizationId;

  try {
    const input = patchSchema.parse(await request.json());

    const room = await prisma.meetingRoom.findFirst({
      where: { id: params.id, organizationId },
      select: { id: true, name: true, roomName: true, departmentId: true },
    });
    if (!room) return NextResponse.json({ error: 'Salle introuvable.' }, { status: 404 });

    // Projet/équipe : libellé résolu (ou créé) dans l'organisation, ou détachement si `null`.
    let departmentId: string | null | undefined;
    if (input.departmentName) {
      const department = await prisma.department.upsert({
        where: { organizationId_name: { organizationId, name: input.departmentName } },
        update: {},
        create: { name: input.departmentName, organizationId },
        select: { id: true },
      });
      departmentId = department.id;
    } else if (input.departmentName === null) {
      departmentId = null;
    }

    if (input.name && input.name !== room.name) {
      const duplicate = await prisma.meetingRoom.findFirst({
        where: { organizationId, name: input.name, NOT: { id: room.id } },
        select: { id: true },
      });
      if (duplicate) return NextResponse.json({ error: 'Une salle porte déjà ce nom.' }, { status: 409 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.meetingRoom.updateMany({ where: { organizationId, NOT: { id: room.id } }, data: { isDefault: false } });
      }
      return tx.meetingRoom.update({
        where: { id: room.id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
          ...(input.departmentName !== undefined ? { departmentId } : {}),
        },
        select: { id: true, name: true, roomName: true, isDefault: true, departmentId: true },
      });
    });

    await writeAudit(auth.ctx.user.id, 'MODIFICATION_SALLE_VISIO', 'MeetingRoom', room.id, {
      before: room.name, after: updated.name, isDefault: updated.isDefault,
    });

    return NextResponse.json({ room: updated, ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Modification invalide.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Modification impossible.' }, { status: 400 });
  }
}

/** DELETE — supprime une salle de l'organisation (les réunions la référençant sont détachées). */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireOrgAdmin();
  if (auth.error) return auth.error;

  const room = await prisma.meetingRoom.findFirst({
    where: { id: params.id, organizationId: auth.ctx.organizationId },
    select: { id: true, name: true, roomName: true },
  });
  if (!room) return NextResponse.json({ error: 'Salle introuvable.' }, { status: 404 });

  await prisma.meetingRoom.delete({ where: { id: room.id } });
  await writeAudit(auth.ctx.user.id, 'SUPPRESSION_SALLE_VISIO', 'MeetingRoom', room.id, { roomName: room.roomName });

  return NextResponse.json({ ok: true, message: 'Salle supprimée.' });
}
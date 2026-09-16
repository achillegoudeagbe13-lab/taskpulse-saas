import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { requireOrgMember, requireOrgAdmin } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { writeAudit } from '../../../../lib/audit';
import { jitsiDomain, sanitizeRoomSegment } from '../../../../lib/jitsi';

const roomSchema = z.object({
  name: z.string().trim().min(2, 'Le nom de la salle est trop court.').max(80),
  /** Projet / équipe (Department) : créé à la volée si le libellé est nouveau. */
  departmentName: z.string().trim().min(1).max(60).optional(),
  isDefault: z.boolean().optional(),
});

/**
 * Identifiant de salle Jitsi unique et URL-safe :
 * `taskpulse-<organisation>-<libellé>-<aléa>` (ex. `taskpulse-mar-ci-flow-standup-3f9a2c`).
 * Le suffixe aléatoire évite toute collision avec d'autres organisations (voire
 * d'autres applications) sur un domaine Jitsi public partagé.
 */
function buildRoomName(orgSlug: string, label: string): string {
  const org = sanitizeRoomSegment(orgSlug) || 'org';
  const slug = sanitizeRoomSegment(label) || 'reunion';
  return `taskpulse-${org}-${slug}-${randomBytes(3).toString('hex')}`.slice(0, 76);
}

const roomSelect = {
  id: true, name: true, roomName: true, domain: true, isDefault: true, createdAt: true,
  department: { select: { id: true, name: true } },
  createdBy: { select: { firstName: true, lastName: true } },
  _count: { select: { meetings: true } },
} as const;

/** GET — salles de visioconférence de l'organisation active (tous les membres). */
export async function GET() {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;

  const rooms = await prisma.meetingRoom.findMany({
    where: { organizationId: auth.ctx.organizationId },
    select: roomSelect,
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });

  return NextResponse.json({
    rooms,
    domain: rooms[0]?.domain ?? jitsiDomain(),
    isAdmin: auth.ctx.orgRole === 'ORGANIZATION_ADMIN',
  });
}

/** POST — création d'une salle réutilisable (administrateur de l'organisation). */
export async function POST(request: Request) {
  const auth = await requireOrgAdmin();
  if (auth.error) return auth.error;
  const organizationId = auth.ctx.organizationId;

  try {
    const input = roomSchema.parse(await request.json());

    // Un projet/équipe optionnel : le libellé est résolu (ou créé) dans l'organisation,
    // comme pour le rattachement d'un membre dans /api/admin/users.
    let departmentId: string | undefined;
    if (input.departmentName) {
      const department = await prisma.department.upsert({
        where: { organizationId_name: { organizationId, name: input.departmentName } },
        update: {},
        create: { name: input.departmentName, organizationId },
        select: { id: true },
      });
      departmentId = department.id;
    }

    const duplicate = await prisma.meetingRoom.findFirst({
      where: { organizationId, name: input.name },
      select: { id: true },
    });
    if (duplicate) return NextResponse.json({ error: 'Une salle porte déjà ce nom.' }, { status: 409 });

    // Génération de l'identifiant Jitsi avec quelques tentatives en cas de collision.
    let created: {
      id: string; name: string; roomName: string; domain: string; isDefault: boolean; createdAt: Date;
    } | null = null;
    for (let attempt = 0; attempt < 5 && !created; attempt += 1) {
      const roomName = buildRoomName(auth.ctx.organization.slug, input.name);
      try {
        created = await prisma.$transaction(async (tx) => {
          if (input.isDefault) {
            await tx.meetingRoom.updateMany({ where: { organizationId }, data: { isDefault: false } });
          }
          return tx.meetingRoom.create({
            data: {
              name: input.name,
              roomName,
              domain: jitsiDomain(),
              isDefault: Boolean(input.isDefault),
              organizationId,
              departmentId,
              createdById: auth.ctx.user.id,
            },
            select: { id: true, name: true, roomName: true, domain: true, isDefault: true, createdAt: true },
          });
        });
      } catch (error) {
        // P2002 = violation d'unicité (identifiant de salle déjà pris) → on réessaie.
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      }
    }
    if (!created) return NextResponse.json({ error: 'Impossible de générer un identifiant de salle unique.' }, { status: 500 });

    await writeAudit(auth.ctx.user.id, 'CREATION_SALLE_VISIO', 'MeetingRoom', created.id, {
      roomName: created.roomName, name: created.name,
    });

    return NextResponse.json({ room: created, message: 'Salle de visioconférence créée.' }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Données de salle invalides.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Création de la salle impossible.' }, { status: 400 });
  }
}
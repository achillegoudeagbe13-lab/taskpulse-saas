import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { createSession, publicUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';

const usernameRegex = /^[a-z0-9._-]{3,30}$/;

/** Aperçu d'une invitation : organisation, rôle et informations pré-remplies. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Jeton manquant.' }, { status: 400 });
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { organization: { select: { id: true, name: true, slug: true } } },
  });
  if (!invitation || invitation.status !== 'PENDING' || invitation.expiresAt <= new Date()) {
    return NextResponse.json({ error: 'Cette invitation est invalide ou expirée.' }, { status: 404 });
  }
  return NextResponse.json({
    organization: invitation.organization,
    role: invitation.role,
    email: invitation.email,
    firstName: invitation.firstName,
    lastName: invitation.lastName,
    expiresAt: invitation.expiresAt.toISOString(),
  });
}

/** Acceptation d'une invitation : création du compte rattaché à l'organisation de l'admin. */
export async function POST(request: Request) {
  try {
    const input = z.object({
      token: z.string().min(10),
      firstName: z.string().trim().min(1).max(80),
      lastName: z.string().trim().min(1).max(80),
      username: z.string().trim().toLowerCase().regex(usernameRegex),
      password: z.string().min(8).max(72),
    }).parse(await request.json());

    const invitation = await prisma.invitation.findUnique({ where: { token: input.token }, include: { organization: true } });
    if (!invitation || invitation.status !== 'PENDING' || invitation.expiresAt <= new Date() || invitation.organization.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Cette invitation est invalide ou expirée.' }, { status: 404 });
    }

    // Email imposé par l'invitation si défini ; unicité vérifiée côté serveur.
    const email = (invitation.email ?? `${input.username}@invites.taskpulse.local`).toLowerCase();
    const duplicate = await prisma.user.findFirst({ where: { OR: [{ username: input.username }, { email }] } });
    if (duplicate) return NextResponse.json({ error: "Ce nom d'utilisateur ou cet email est déjà utilisé." }, { status: 409 });

    const passwordHash = await bcrypt.hash(input.password, 12);
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          username: input.username,
          email,
          passwordHash,
          platformRole: 'USER',
        },
      });
      // L'organizationId de l'admin est reçu automatiquement via l'invitation.
      const membership = await tx.membership.create({
        data: { userId: user.id, organizationId: invitation.organizationId, role: invitation.role },
      });
      await tx.user.update({ where: { id: user.id }, data: { activeOrganizationId: membership.organizationId } });
      await tx.invitation.update({ where: { id: invitation.id }, data: { status: 'ACCEPTED', acceptedAt: new Date() } });
      return user;
    });

    await writeAudit(result.id, 'REJOINT_ORGANISATION', 'Organization', invitation.organizationId, { role: invitation.role });
    await createSession(result.id);

    const full = await prisma.user.findUnique({
      where: { id: result.id },
      include: { department: true, profile: true, memberships: { include: { organization: true }, orderBy: { createdAt: 'asc' } } },
    });
    return NextResponse.json({ organization: { id: invitation.organization.id, name: invitation.organization.name, slug: invitation.organization.slug }, user: publicUser(full!) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? 'Données invalides.' }, { status: 400 });
    return NextResponse.json({ error: 'Impossible de rejoindre cette organisation.' }, { status: 400 });
  }
}
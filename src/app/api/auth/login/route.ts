import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { createSession, publicUser, syncPlatformRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';

const loginSchema = z.object({ identifier: z.string().trim().min(1), password: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await request.json());
    const identifier = input.identifier.toLowerCase();
    const user = await prisma.user.findFirst({
      where: { OR: [{ username: identifier }, { email: identifier }] },
      include: {
        department: true,
        profile: true,
        memberships: { include: { organization: true }, orderBy: { createdAt: 'asc' } },
      },
    });

    if (!user || user.status !== 'ACTIF' || !(await bcrypt.compare(input.password, user.passwordHash))) return NextResponse.json({ error: 'Identifiants incorrects.' }, { status: 401 });

    // Rôle plateforme attribué côté serveur via TASKPULSE_ADMIN_EMAIL.
    const platformRole = await syncPlatformRole(user);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        // Organisation active par défaut = première membership si non définie.
        ...(user.activeOrganizationId ? {} : { activeOrganizationId: user.memberships[0]?.organizationId ?? null }),
      },
    });
    await createSession(user.id);
    await writeAudit(user.id, 'CONNEXION', 'Session', user.id);
    return NextResponse.json({ user: publicUser({ ...user, platformRole }) });
  } catch {
    return NextResponse.json({ error: 'Requête de connexion invalide.' }, { status: 400 });
  }
}
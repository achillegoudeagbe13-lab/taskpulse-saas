import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser, publicUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';

const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(30).optional(),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,30}$/),
  position: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(2000).optional(),
});

export async function PATCH(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: 'Session inexistante.' }, { status: 401 });
  try {
    const input = profileSchema.parse(await request.json());
    const duplicate = await prisma.user.findFirst({
      where: { id: { not: currentUser.id }, OR: [{ username: input.username }, { email: input.email }] },
    });
    if (duplicate) return NextResponse.json({ error: "Ce nom d'utilisateur ou cet email est déjà utilisé." }, { status: 409 });

    await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        username: input.username,
        email: input.email,
        phone: input.phone || null,
        profile: { upsert: { update: { position: input.position || null, bio: input.bio || null }, create: { position: input.position || null, bio: input.bio || null } } },
      },
    });
    await writeAudit(currentUser.id, 'MODIFICATION_PROFIL', 'User', currentUser.id);

    // Rechargement avec memberships pour reconstruire le contexte org côté client.
    const updated = await prisma.user.findUnique({
      where: { id: currentUser.id },
      include: { department: true, profile: true, memberships: { include: { organization: true }, orderBy: { createdAt: 'asc' } } },
    });
    return NextResponse.json({ user: publicUser(updated!), message: 'Profil mis à jour.' });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? 'Données invalides.' }, { status: 400 });
    return NextResponse.json({ error: 'Impossible de mettre à jour le profil.' }, { status: 400 });
  }
}
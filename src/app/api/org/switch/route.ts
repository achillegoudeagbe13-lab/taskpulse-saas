import { NextResponse } from 'next/server';
import { z } from 'zod';
import { publicUser, requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';

/** Change l'organisation active de l'utilisateur (parmi ses memberships uniquement). */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  try {
    const input = z.object({ organizationId: z.string().min(1) }).parse(await request.json());
    const membership = auth.ctx.user.memberships.find((item) => item.organizationId === input.organizationId);
    if (!membership) return NextResponse.json({ error: 'Vous n’êtes pas membre de cette organisation.' }, { status: 403 });

    await prisma.user.update({ where: { id: auth.ctx.user.id }, data: { activeOrganizationId: membership.organizationId } });
    await writeAudit(auth.ctx.user.id, 'CHANGEMENT_ORGANISATION', 'Organization', membership.organizationId);

    const full = await prisma.user.findUnique({
      where: { id: auth.ctx.user.id },
      include: { department: true, profile: true, memberships: { include: { organization: true }, orderBy: { createdAt: 'asc' } } },
    });
    return NextResponse.json({ user: publicUser(full!) });
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }
}
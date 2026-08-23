import { NextResponse } from 'next/server';
import { requireOrgMember } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/** Liste des membres ACTIFS de l'organisation active uniquement (isolation inter-organisations). */
export async function GET() {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;

  const memberships = await prisma.membership.findMany({
    where: { organizationId: auth.ctx.organizationId, user: { status: 'ACTIF' } },
    include: { user: { select: { id: true, firstName: true, lastName: true, username: true, email: true, status: true, photoUrl: true, department: { select: { name: true } } } }, organization: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({
    users: memberships.map((membership) => ({
      id: membership.user.id,
      firstName: membership.user.firstName,
      lastName: membership.user.lastName,
      username: membership.user.username,
      email: membership.user.email,
      role: membership.role,
      department: membership.user.department?.name ?? '',
      photoUrl: membership.user.photoUrl,
      organizationName: membership.organization.name,
    })),
  });
}
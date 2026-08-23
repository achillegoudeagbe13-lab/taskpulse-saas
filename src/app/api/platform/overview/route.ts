import { NextResponse } from 'next/server';
import { requirePlatformSuperAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Tableau de bord plateforme : métriques agrégées et métadonnées d'organisations
 * uniquement — aucune donnée privée (membres nommés, contenus) n'est exposée.
 */
export async function GET() {
  const auth = await requirePlatformSuperAdmin();
  if (auth.error) return auth.error;

  const [organizations, totalUsers, totalTasks, totalActivities, activeOrgs] = await Promise.all([
    prisma.organization.findMany({
      select: {
        id: true, name: true, slug: true, sector: true, country: true, status: true, createdAt: true,
        _count: { select: { memberships: true, tasks: true, announcements: true, activities: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count(),
    prisma.task.count(),
    prisma.activity.count(),
    prisma.organization.count({ where: { status: 'ACTIVE' } }),
  ]);

  return NextResponse.json({
    totals: { organizations: organizations.length, activeOrganizations: activeOrgs, users: totalUsers, tasks: totalTasks, activities: totalActivities },
    organizations,
    viewerEmail: auth.ctx.user.email,
  });
}
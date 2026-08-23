import { NextResponse } from 'next/server';
import { requireOrgAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const auth = await requireOrgAdmin();
  if (auth.error) return auth.error;
  const params = new URL(request.url).searchParams;
  const search = params.get('search') || undefined;
  // Journal d'audit limité à l'organisation active.
  const logs = await prisma.auditLog.findMany({
    where: { organizationId: auth.ctx.organizationId, ...(search ? { OR: [{ action: { contains: search } }, { entity: { contains: search } }] } : {}) },
    include: { user: { select: { firstName: true, lastName: true, username: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return NextResponse.json({ logs });
}
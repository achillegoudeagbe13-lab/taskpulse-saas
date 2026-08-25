import { NextResponse } from 'next/server';
import { requireOrgAdmin } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';

/** Pointages récents de TOUS les membres de l'organisation active (vue admin). */
export async function GET(request: Request) {
  const auth = await requireOrgAdmin();
  if (auth.error) return auth.error;

  const limit = Math.min(Number(new URL(request.url).searchParams.get('limit') ?? 120) || 120, 300);
  const records = await prisma.attendance.findMany({
    where: { organizationId: auth.ctx.organizationId },
    orderBy: { clockIn: 'desc' },
    take: limit,
    include: { user: { select: { firstName: true, lastName: true, username: true } } },
  });

  return NextResponse.json({
    records: records.map((record) => ({
      id: record.id,
      clockIn: record.clockIn.toISOString(),
      clockOut: record.clockOut?.toISOString() ?? null,
      user: { name: `${record.user.firstName} ${record.user.lastName}`, username: record.user.username },
    })),
  });
}
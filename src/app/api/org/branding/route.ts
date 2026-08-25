import { NextResponse } from 'next/server';
import { requireOrgMember } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';

/** Identité visuelle de l'organisation active (accessible à tous les membres). */
export async function GET() {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;

  const settings = await prisma.systemSetting.findMany({
    where: { organizationId: auth.ctx.organizationId, key: { in: ['organizationName', 'logoUrl'] } },
  });
  const map = Object.fromEntries(settings.map((item) => [item.key, item.value]));

  return NextResponse.json({
    name: map.organizationName || auth.ctx.organization?.name || null,
    logoUrl: map.logoUrl || null,
  });
}
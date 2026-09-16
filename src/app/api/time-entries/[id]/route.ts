import { NextResponse } from 'next/server';
import { requireOrgMember } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';

/** DELETE — suppression d'une entrée de temps (auteur ou admin). */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;

  const entry = await prisma.timeEntry.findUnique({ where: { id: params.id }, select: { id: true, userId: true, organizationId: true } });
  if (!entry || entry.organizationId !== auth.ctx.organizationId) {
    return NextResponse.json({ error: 'Entrée introuvable.' }, { status: 404 });
  }
  const isAdmin = auth.ctx.orgRole === 'ORGANIZATION_ADMIN';
  if (!isAdmin && entry.userId !== auth.ctx.user.id) {
    return NextResponse.json({ error: 'Suppression non autorisée.' }, { status: 403 });
  }
  await prisma.timeEntry.delete({ where: { id: entry.id } });
  return NextResponse.json({ ok: true });
}

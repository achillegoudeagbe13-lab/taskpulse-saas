import { NextResponse } from 'next/server';
import { requireOrgMember } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';

/** DELETE — retrait d'un livrable (auteur ou admin). */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;

  const document = await prisma.projectDocument.findUnique({
    where: { id: params.id },
    select: { id: true, uploadedById: true, organizationId: true, name: true },
  });
  if (!document || document.organizationId !== auth.ctx.organizationId) {
    return NextResponse.json({ error: 'Livrable introuvable.' }, { status: 404 });
  }
  if (document.uploadedById !== auth.ctx.user.id && auth.ctx.orgRole !== 'ORGANIZATION_ADMIN') {
    return NextResponse.json({ error: 'Suppression non autorisée.' }, { status: 403 });
  }
  await prisma.projectDocument.delete({ where: { id: document.id } });
  return NextResponse.json({ ok: true });
}

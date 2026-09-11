import { NextResponse } from 'next/server';
import { requirePlatformSuperAdmin } from '../../../../../../lib/auth';
import { prisma } from '../../../../../../lib/prisma';
import { writeAudit } from '../../../../../../lib/audit';

type Params = { params: { id: string } };

/** POST /api/platform/licenses/[id]/revoke — révoque un code (super admin). */
export async function POST(request: Request, { params }: Params) {
  const auth = await requirePlatformSuperAdmin();
  if (auth.error) return auth.error;

  const existing = await prisma.licenseCode.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'Code introuvable.' }, { status: 404 });
  if (existing.status === 'USED') {
    return NextResponse.json({ error: 'Ce code est déjà utilisé et lié à une organisation.' }, { status: 409 });
  }

  const updated = await prisma.licenseCode.update({ where: { id: params.id }, data: { status: 'REVOKED' } });
  await writeAudit(auth.ctx.user.id, 'REVOCATION_LICENCE', 'LicenseCode', params.id, { code: existing.code });

  return NextResponse.json({ ok: true, license: updated });
}
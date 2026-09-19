import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePlatformSuperAdmin } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { writeAudit } from '../../../../lib/audit';
import { TIERS, tierInfo } from '../../../../lib/billing';
import { generateLicenseKey } from '../../../../lib/license-keys';

/** GET /api/platform/licenses — liste (super admin). */
export async function GET() {
  const auth = await requirePlatformSuperAdmin();
  if (auth.error) return auth.error;

  const codes = await prisma.licenseCode.findMany({
    include: { organization: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return NextResponse.json({
    codes: codes.map((c) => ({
      id: c.id,
      code: c.code,
      tier: c.tier,
      maxSeats: c.maxSeats,
      status: c.status,
      note: c.note,
      activatedAt: c.activatedAt?.toISOString() ?? null,
      expiresAt: c.expiresAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      organization: c.organization,
    })),
    tiers: TIERS,
  });
}

/** POST /api/platform/licenses — génère une clé signée par palier (super admin). */
const genSchema = z.object({
  tier: z.enum(['T1', 'T2', 'T3', 'T4']),
  note: z.string().trim().max(200).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
});

export async function POST(request: Request) {
  const auth = await requirePlatformSuperAdmin();
  if (auth.error) return auth.error;

  try {
    const input = genSchema.parse(await request.json());
    const tierInfoLocal = tierInfo(input.tier);
    // Clé unique dont le préfixe identifie le palier (ex : MCF-10K-AB12-CD34).
    let code = generateLicenseKey(input.tier);
    while (await prisma.licenseCode.findUnique({ where: { code } })) {
      code = generateLicenseKey(input.tier);
    }

    const license = await prisma.licenseCode.create({
      data: {
        code,
        tier: input.tier,
        maxSeats: tierInfoLocal.maxSeats ?? 9999,
        note: input.note ?? null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
    });

    await writeAudit(auth.ctx.user.id, 'GENERATION_LICENCE', 'LicenseCode', license.id, { tier: input.tier, code });

    return NextResponse.json({ ok: true, license }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Données invalides.' }, { status: 400 });
    return NextResponse.json({ error: 'Génération impossible.' }, { status: 400 });
  }
}

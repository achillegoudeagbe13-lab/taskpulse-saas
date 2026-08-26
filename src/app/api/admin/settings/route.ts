import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrgAdmin } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';

const schema = z.object({
  organizationName: z.string().trim().min(1).max(120).optional(),
  logoUrl: z.string().max(1_600_000).optional(),
  // Contrôle GPS du pointage (activé/désactivé + zone géographique).
  geoEnabled: z.boolean().optional(),
  geoLat: z.number().min(-90).max(90).optional(),
  geoLng: z.number().min(-180).max(180).optional(),
  geoRadiusMeters: z.number().int().min(5).max(50000).optional(),
});

/** Paramètres de l'organisation active uniquement. */
export async function GET() {
  const auth = await requireOrgAdmin();
  if (auth.error) return auth.error;
  const settings = await prisma.systemSetting.findMany({ where: { organizationId: auth.ctx.organizationId } });
  return NextResponse.json({ settings: Object.fromEntries(settings.map((item) => [item.key, item.value])) });
}

export async function PATCH(request: Request) {
  const auth = await requireOrgAdmin();
  if (auth.error) return auth.error;
  try {
    const input = schema.parse(await request.json());
    if (input.logoUrl && !/^(data:image\/(png|jpe?g|webp|svg\+xml);base64,|https?:\/\/)/i.test(input.logoUrl)) {
      return NextResponse.json({ error: 'Format de logo invalide.' }, { status: 400 });
    }
    // Chaque organisation possède ses propres réglages (clé unique par org).
    for (const [key, value] of Object.entries(input)) {
      const existing = await prisma.systemSetting.findFirst({ where: { organizationId: auth.ctx.organizationId, key } });
      if (existing) await prisma.systemSetting.update({ where: { id: existing.id }, data: { value: String(value ?? '') } });
      else await prisma.systemSetting.create({ data: { key, value: String(value ?? ''), organizationId: auth.ctx.organizationId } });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Paramètres invalides.' }, { status: 400 });
  }
}
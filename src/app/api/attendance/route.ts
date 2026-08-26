import { NextResponse } from 'next/server';
import { requireAuth, requireOrgMember } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';

function dayStart() { const date = new Date(); date.setHours(0, 0, 0, 0); return date; }
export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  // Pointages personnels uniquement (aucune donnée d'autrui).
  const records = await prisma.attendance.findMany({ where: { userId: auth.ctx.user.id }, orderBy: { clockIn: 'desc' }, take: 30 });
  return NextResponse.json({ records });
}
export async function POST(request: Request) {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;
  const { action, latitude, longitude, userAgent } = await request.json();
  const open = await prisma.attendance.findFirst({ where: { userId: auth.ctx.user.id, clockIn: { gte: dayStart() }, clockOut: null }, orderBy: { clockIn: 'desc' } });

  // ---- Contrôle GPS optionnel (admin-configurable) ----
  const orgSettings = await prisma.systemSetting.findMany({ where: { organizationId: auth.ctx.organizationId, key: { in: ['geoEnabled', 'geoLat', 'geoLng', 'geoRadiusMeters'] } } });
  const settings = Object.fromEntries(orgSettings.map((s) => [s.key, s.value]));
  const geoEnabled = settings.geoEnabled === 'true';

  const recordData: { userId: string; organizationId: string; latitude?: number | null; longitude?: number | null; userAgent?: string | null } = {
    userId: auth.ctx.user.id, organizationId: auth.ctx.organizationId, latitude, longitude, userAgent: userAgent ?? null,
  };

  if (geoEnabled) {
    const lat = Number(latitude); const lng = Number(longitude);
    const centerLat = Number(settings.geoLat); const centerLng = Number(settings.geoLng); const radius = Number(settings.geoRadiusMeters) || 0;
    if (!latitude || !longitude || Number.isNaN(lat) || Number.isNaN(lng)) {
      return NextResponse.json({ error: 'Le contrôle GPS est activé : la position est requise pour pointer.' }, { status: 403 });
    }
    const distance = haversine(lat, lng, centerLat, centerLng);
    if (radius && distance > radius) {
      const km = (distance / 1000).toFixed(1);
      return NextResponse.json({ error: `Vous êtes à ${km} km du bureau autorisé. Rendez-vous sur site pour pointer (rayon autorisé : ${(radius / 1000).toFixed(1)} km).` }, { status: 409 });
    }
  }

  if (action === 'ARRIVEE') {
    if (open) return NextResponse.json({ error: 'Vous avez déjà pointé votre arrivée.' }, { status: 409 });
    const record = await prisma.attendance.create({ data: { ...recordData, clockIn: new Date() } as any });
    return NextResponse.json({ record }, { status: 201 });
  }
  if (action === 'DEPART') {
    if (!open) return NextResponse.json({ error: 'Pointez votre arrivée avant votre départ.' }, { status: 409 });
    const record = await prisma.attendance.update({ where: { id: open.id }, data: { clockOut: new Date(), latitude: latitude ?? undefined, longitude: longitude ?? undefined } as any });
    return NextResponse.json({ record });
  }
  return NextResponse.json({ error: 'Action de pointage inconnue.' }, { status: 400 });
}

/* Distance orthodromienne (mètres) entre deux points — GPS audit. */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (v: number) => v * Math.PI / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1); const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * R);
}
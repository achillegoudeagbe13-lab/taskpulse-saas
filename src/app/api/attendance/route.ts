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
  const action = (await request.json()).action;
  const open = await prisma.attendance.findFirst({ where: { userId: auth.ctx.user.id, clockIn: { gte: dayStart() }, clockOut: null }, orderBy: { clockIn: 'desc' } });
  if (action === 'ARRIVEE') { if (open) return NextResponse.json({ error: 'Vous avez déjà pointé votre arrivée.' }, { status: 409 }); const record = await prisma.attendance.create({ data: { userId: auth.ctx.user.id, organizationId: auth.ctx.organizationId, clockIn: new Date() } }); return NextResponse.json({ record }, { status: 201 }); }
  if (action === 'DEPART') { if (!open) return NextResponse.json({ error: 'Pointez votre arrivée avant votre départ.' }, { status: 409 }); const record = await prisma.attendance.update({ where: { id: open.id }, data: { clockOut: new Date() } }); return NextResponse.json({ record }); }
  return NextResponse.json({ error: 'Action de pointage inconnue.' }, { status: 400 });
}
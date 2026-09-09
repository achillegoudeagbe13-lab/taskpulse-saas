import { NextResponse } from 'next/server';

/** GET /api/health — health-check public pour Render (aucune authentification requise). */
export async function GET() {
  return NextResponse.json({ ok: true, service: 'taskpulse-saas', time: new Date().toISOString() });
}
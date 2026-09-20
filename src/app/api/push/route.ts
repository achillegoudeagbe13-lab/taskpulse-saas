import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { vapidPublicKey } from '../../../lib/push';

/**
 * Web Push :
 *  GET    — clé publique VAPID pour l'inscription du navigateur (null si non configuré)
 *  POST   — enregistre / met à jour l'abonnement push de l'appareil courant
 *  DELETE — supprime l'abonnement (désinscription)
 */

const subscribeSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(200) }),
  userAgent: z.string().max(300).optional(),
});

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  return NextResponse.json({ publicKey: vapidPublicKey() });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  if (!vapidPublicKey()) return NextResponse.json({ error: 'Push non configuré sur le serveur.' }, { status: 503 });
  try {
    const input = subscribeSchema.parse(await request.json());
    await prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        userId: auth.ctx.user.id,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent ?? request.headers.get('user-agent')?.slice(0, 300) ?? null,
      },
      update: { userId: auth.ctx.user.id, p256dh: input.keys.p256dh, auth: input.keys.auth },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Abonnement push invalide.' }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  try {
    const { endpoint } = z.object({ endpoint: z.string().url().max(1000) }).parse(await request.json());
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: auth.ctx.user.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }
}

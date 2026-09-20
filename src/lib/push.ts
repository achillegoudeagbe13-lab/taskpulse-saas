import webpush from 'web-push';
import { prisma } from './prisma';

/**
 * Web Push — envoi de notifications hors application (navigateur fermé).
 *
 * Configuration requise (variables d'environnement) :
 *   WEB_PUSH_PUBLIC_KEY / WEB_PUSH_PRIVATE_KEY — paire générée via
 *   `npx web-push generate-vapid-keys` (noms historiques VAPID_PUBLIC_KEY /
 *   VAPID_PRIVATE_KEY acceptés en repli). Sans ces clés, les envois sont
 *   silencieusement ignorés (dégradation douce).
 *   WEB_PUSH_SUBJECT (optionnel) — expéditeur VAPID, défaut
 *   `mailto:contact@mar-ci-flow.app`.
 */

let configured = false;
function pickEnv(...names: string[]): string | null {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return null;
}
function ensureConfigured() {
  if (configured) return true;
  const publicKey = pickEnv('WEB_PUSH_PUBLIC_KEY', 'VAPID_PUBLIC_KEY');
  const privateKey = pickEnv('WEB_PUSH_PRIVATE_KEY', 'VAPID_PRIVATE_KEY');
  if (!publicKey || !privateKey) return false;
  const subject = pickEnv('WEB_PUSH_SUBJECT', 'VAPID_SUBJECT') ?? 'mailto:contact@mar-ci-flow.app';
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export function vapidPublicKey(): string | null {
  return pickEnv('WEB_PUSH_PUBLIC_KEY', 'VAPID_PUBLIC_KEY');
}

export type PushPayload = { title: string; body: string; url?: string };

/** Envoie une notification push à TOUS les appareils d'un utilisateur (fire-and-forget). */
export async function sendPushToUser(userId: string, title: string, body: string, url?: string): Promise<void> {
  if (!ensureConfigured()) return;
  type PSub = { id: string; userId: string; endpoint: string; p256dh: string; auth: string };
  const subs: PSub[] = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return;
  const payload = JSON.stringify({ title, body, url: url ?? undefined });
  await Promise.allSettled(
    subs.map(async (sub: PSub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
      } catch (error) {
        // Abonnement expiré/révoqué (404/410) : on nettoie.
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
        }
      }
    }),
  );
}


/**
 * Rappels de réunion — lancé par la maintenance quotidienne (GitHub Actions).
 *
 * Pour chaque réunion dont le début est dans moins de REMIND_WINDOW_MINUTES
 * (défaut 60 min), crée une notification in-app pour chaque participant, avec
 * déduplication via SystemSetting « meetingReminder:<meetingId> » (une seule
 * notification par réunion, même si le cron tourne plusieurs fois).
 *
 * Configuration :
 *   - REMIND_WINDOW_MINUTES (défaut 60) : fenêtre d'anticipation en minutes
 *   - DATABASE_URL : chaîne de connexion Prisma
 *
 * Dégradation douce : sans base joignable, le script échoue avec un message
 * clair et le workflow GitHub continue (voir maintenance.yml).
 */
import { PrismaClient } from '@prisma/client';
import webpush from 'web-push';

const prisma = new PrismaClient();
const WINDOW_MIN = Number(process.env.REMIND_WINDOW_MINUTES || 60);
const MARKER_PREFIX = 'meetingReminder:';

/** Web Push optionnel : envoi silencieusement ignoré sans clés (WEB_PUSH_* ou VAPID_*). */
function pickEnv(...names: string[]): string | null {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return null;
}
function pushConfigured(): boolean {
  const publicKey = pickEnv('WEB_PUSH_PUBLIC_KEY', 'VAPID_PUBLIC_KEY');
  const privateKey = pickEnv('WEB_PUSH_PRIVATE_KEY', 'VAPID_PRIVATE_KEY');
  if (!publicKey || !privateKey) return false;
  const subject = pickEnv('WEB_PUSH_SUBJECT', 'VAPID_SUBJECT') ?? 'mailto:contact@mar-ci-flow.app';
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

async function sendPush(userIds: string[], title: string, body: string): Promise<void> {
  if (!pushConfigured()) return;
  const subs = await prisma.pushSubscription.findMany({ where: { userId: { in: userIds } } });
  const payload = JSON.stringify({ title, body, url: '/' });
  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
        }
      }
    }),
  );
}

async function main(): Promise<void> {
  const now = new Date();
  const until = new Date(now.getTime() + WINDOW_MIN * 60 * 1000);

  const meetings = await prisma.meeting.findMany({
    where: { startAt: { gte: now, lte: until } },
    select: {
      id: true,
      title: true,
      startAt: true,
      organizationId: true,
      attendees: { select: { userId: true } },
    },
  });

  if (meetings.length === 0) {
    console.log(`[meeting-reminders] aucune réunion dans les ${WINDOW_MIN} prochaines minutes. RAS.`);
    return;
  }

  let notified = 0;
  for (const meeting of meetings) {
    // Les réunions sans organisation (données historiques) ne portent pas de rappel.
    if (!meeting.organizationId) continue;
    const markerKey = `${MARKER_PREFIX}${meeting.id}`;
    // Déduplication : un seul rappel par réunion.
    const marker = await prisma.systemSetting.findUnique({
      where: { organizationId_key: { organizationId: meeting.organizationId, key: markerKey } },
    });
    if (marker) continue;

    const userIds = [...new Set(meeting.attendees.map((a) => a.userId).filter((id): id is string => id !== null))];
    if (userIds.length > 0) {
      await prisma.notification.createMany({
        data: userIds.map((userId) => ({
          userId,
          organizationId: meeting.organizationId,
          title: '⏰ Réunion imminente',
          content: `${meeting.title} — ${meeting.startAt.toLocaleString('fr-FR', { timeZone: 'UTC' })} (UTC).`,
        })),
      });
      notified += userIds.length;
      const when = meeting.startAt.toLocaleString('fr-FR', { timeZone: 'UTC' });
      await sendPush(userIds, '⏰ Réunion imminente', `${meeting.title} — ${when} (UTC).`);
    }

    await prisma.systemSetting.create({
      data: { organizationId: meeting.organizationId, key: markerKey, value: new Date().toISOString() },
    });
    console.log(`[meeting-reminders] rappel créé pour « ${meeting.title} » (${userIds.length} participant(s)).`);
  }

  console.log(`[meeting-reminders] terminé : ${notified} notification(s) créée(s) pour ${meetings.length} réunion(s).`);
}

main()
  .catch((e) => {
    console.error('[meeting-reminders] erreur :', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

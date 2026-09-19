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

const prisma = new PrismaClient();
const WINDOW_MIN = Number(process.env.REMIND_WINDOW_MINUTES || 60);
const MARKER_PREFIX = 'meetingReminder:';

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
    const markerKey = `${MARKER_PREFIX}${meeting.id}`;
    // Déduplication : un seul rappel par réunion.
    const marker = await prisma.systemSetting.findUnique({
      where: { organizationId_key: { organizationId: meeting.organizationId, key: markerKey } },
    });
    if (marker) continue;

    const userIds = [...new Set(meeting.attendees.map((a) => a.userId))];
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

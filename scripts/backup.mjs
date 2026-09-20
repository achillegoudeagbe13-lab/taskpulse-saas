/**
 * Sauvegarde JSON de la base (tables métier) — sortie vers backups/<date>.json.
 * Utilisable en local ou dans un workflow GitHub Actions quotidien.
 */
import { PrismaClient } from '@prisma/client';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

const [users, organizations, memberships, tasks, activities, announcements, attendances, journalEntries, messages, invitations, licenseCodes, passwordResets, meetingRooms, timeEntries, activityEvents, meetingNotes, projectDocuments, planRequests, supportMessages, pushSubscriptions] = await Promise.all([
  prisma.user.findMany(),
  prisma.organization.findMany(),
  prisma.membership.findMany(),
  prisma.task.findMany(),
  prisma.activity.findMany(),
  prisma.announcement.findMany(),
  prisma.attendance.findMany(),
  prisma.journalEntry.findMany(),
  prisma.message.findMany(),
  prisma.invitation.findMany(),
  prisma.licenseCode.findMany(),
  prisma.passwordReset.findMany(),
  prisma.meetingRoom.findMany(),
  prisma.timeEntry.findMany(),
  prisma.activityEvent.findMany(),
  prisma.meetingNote.findMany(),
  prisma.projectDocument.findMany(),
  prisma.planRequest.findMany(),
  prisma.supportMessage.findMany(),
  prisma.pushSubscription.findMany(),
]);

const backup = {
  exportedAt: new Date().toISOString(),
  counts: {
    users: users.length, organizations: organizations.length, memberships: memberships.length,
    tasks: tasks.length, activities: activities.length, timeEntries: timeEntries.length,
    activityEvents: activityEvents.length, meetingNotes: meetingNotes.length,
    projectDocuments: projectDocuments.length, planRequests: planRequests.length,
    supportMessages: supportMessages.length, pushSubscriptions: pushSubscriptions.length,
  },
  users,
  organizations,
  memberships,
  tasks,
  activities,
  announcements,
  attendances,
  journalEntries,
  messages,
  invitations,
  licenseCodes,
  passwordResets, // hashes uniquement (jamais de mot de passe en clair)
  meetingRooms, // salles de visioconférence (Jitsi) de chaque organisation
  timeEntries, // suivi du temps v7.3 (chronos + saisies manuelles)
  activityEvents, // fil d'activité d'équipe v7.3
  meetingNotes, // comptes-rendus collaboratifs v7.3
  projectDocuments, // livrables & documents v7.3
  planRequests, // demandes d'abonnement v7.4
  supportMessages, // conversation support / remise de clés v7.4
  pushSubscriptions, // abonnements Web Push des navigateurs (notifications réunions)
};

const dir = join(process.cwd(), process.env.BACKUP_DIR ?? 'backups');
mkdirSync(dir, { recursive: true });
const file = join(dir, `backup-${new Date().toISOString().slice(0, 10)}.json`);
writeFileSync(file, JSON.stringify(backup, null, 2));
console.log(`Sauvegarde écrite : ${file}`);

await prisma.$disconnect();

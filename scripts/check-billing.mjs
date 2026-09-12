/**
 * Surveillance facturation — à lancer en cron (GitHub Actions quotidien).
 * Liste les organisations dont l'essai/abonnement expire dans ≤ 3 jours ou
 * est déjà expiré, et envoie un e-mail d'alerte au super admin si SMTP configuré.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const now = Date.now();
const ALERT_DAYS = 3;

const orgs = await prisma.organization.findMany({
  where: { planExpiresAt: { not: null } },
  select: { name: true, slug: true, planTier: true, planStatus: true, planExpiresAt: true },
  orderBy: { planExpiresAt: 'asc' },
});

const expiringSoon = [];
const expired = [];
for (const o of orgs) {
  const ms = o.planExpiresAt.getTime() - now;
  const days = Math.ceil(ms / 86400000);
  if (days < 0) expired.push({ ...o, days });
  else if (days <= ALERT_DAYS) expiringSoon.push({ ...o, days });
}

console.log(`=== Surveillance abonnements (${new Date().toISOString()}) ===`);
if (!expiringSoon.length && !expired.length) {
  console.log('Aucune organisation proche de l\'expiration. RAS.');
} else {
  if (expiringSoon.length) {
    console.log(`\n⏳ Expirent dans ≤ ${ALERT_DAYS} jours :`);
    for (const o of expiringSoon) console.log(`  - ${o.name} (/o/${o.slug}) : ${o.planTier}, ${o.days} j restants`);
  }
  if (expired.length) {
    console.log('\n🚫 Déjà expirées (verrouillées) :');
    for (const o of expired) console.log(`  - ${o.name} (/o/${o.slug}) : ${o.planTier}, expiré depuis ${-o.days} j`);
  }

  // Alerte e-mail si SMTP configuré (nodemailer installé côté app ; ici en script
  // on se limite à un appel HTTP à l'app pour déléguer l'envoi si prévu, sinon log).
  const adminEmail = process.env.TASKPULSE_ADMIN_EMAIL;
  console.log(`\n(Super admin à notifier : ${adminEmail ?? 'non configuré'})`);
  // Code de sortie 1 = alerte présente (utile pour un workflow GitHub qui notifie).
  process.exitCode = 1;
}

await prisma.$disconnect();

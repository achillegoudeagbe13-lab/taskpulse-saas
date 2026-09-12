/**
 * Relance d'expiration d'abonnement — lancé par la maintenance quotidienne
 * (GitHub Actions). Envoie aux administrateurs de chaque organisation un
 * e-mail de relance lorsque leur abonnement approche de l'échéance ou vient
 * d'expirer, puis enregistre l'échéance notifiée pour éviter d'écrire chaque
 * jour (déduplication via SystemSetting « expiryReminderEsperance »).
 *
 * Configuration :
 *   - SMTP_HOST / SMTP_USER / SMTP_PASS / SMTP_PORT / MAIL_FROM  → mailer
 *   - EXPIRY_WARNING_DAYS (défaut 5) : seuil de relance anticipée en jours
 *   - APP_URL : base du site pour le lien « Ouvrir l’espace »
 *
 * Sans SMTP configuré, le script se termine sans effet (dégradation douce).
 */
import { PrismaClient } from '@prisma/client';
import { sendMail, mailTemplate, isMailConfigured } from '../src/lib/mailer';
import { tierInfo, formatPrice } from '../src/lib/plans';

const prisma = new PrismaClient();

const WARNING_DAYS = Number(process.env.EXPIRY_WARNING_DAYS || 5);
const REMINDER_KEY = 'expiryReminderEsperance';

async function main(): Promise<void> {
  if (!isMailConfigured()) {
    console.log('[notify-expiry] SMTP non configuré — aucun e-mail envoyé.');
    return;
  }

  const now = new Date();

  const orgs = await prisma.organization.findMany({
    where: { planExpiresAt: { not: null } },
    include: {
      memberships: {
        where: { role: 'ORGANIZATION_ADMIN' },
        include: { user: { select: { email: true, firstName: true, lastName: true } } },
      },
    },
  });

  let notified = 0;

  for (const org of orgs) {
    if (!org.planExpiresAt) continue;

    const daysLeft = Math.ceil((org.planExpiresAt.getTime() - now.getTime()) / 86400000);
    const expired = daysLeft < 0;
    // Ignore les échéances encore lointaines.
    if (!expired && daysLeft > WARNING_DAYS) continue;

    // Déduplication : une seule relance par échéance (et non par jour).
    const marker = await prisma.systemSetting.findUnique({
      where: { organizationId_key: { organizationId: org.id, key: REMINDER_KEY } },
    });
    const expiresKey = org.planExpiresAt.toISOString();
    if (marker?.value === expiresKey) continue;

    const admins = org.memberships
      .map((m) => m.user)
      .filter((u): u is typeof u & { email: string } => Boolean(u.email));
    if (admins.length === 0) {
      console.warn(`[notify-expiry] ${org.name} : aucun admin avec e-mail, relance ignorée.`);
      continue;
    }

    const tier = tierInfo(org.planTier);
    const subject = expired
      ? `🔒 ${org.name} — votre espace est verrouillé`
      : `⏳ ${org.name} — abonnement expire dans ${daysLeft} jour(s)`;

    const detail = expired
      ? 'Votre période d’abonnement est arrivée à expiration. L’espace de travail de votre organisation est désormais <strong>verrouillé</strong> : les membres ne peuvent plus y accéder.'
      : `Il reste <strong>${daysLeft} jour(s)</strong> avant l’expiration de votre abonnement. Passé ce délai, l’espace de travail sera verrouillé.`;

    const body = `
      <p style="margin:0 0 10px"><strong>Palier :</strong> ${tier.label} · ${formatPrice(tier.price)}</p>
      <p>${detail}</p>
      <p>Pour continuer sans interruption, activez un <strong>code de licence</strong> reçu après paiement depuis <strong>Paramètres → Plan &amp; licence</strong> de votre espace d’administration.</p>`;

    const appUrl = (process.env.APP_URL || '').replace(/\/+$/, '');
    const sent = await sendMail(
      admins[0].email,
      subject,
      mailTemplate(
        `Abonnement · ${org.name}`,
        body,
        appUrl ? { label: 'Ouvrir mon espace', url: `${appUrl}/login` } : undefined,
      ),
    );

    if (!sent.sent) {
      console.warn(`[notify-expiry] échec d’envoi pour ${org.name} : ${sent.error ?? 'inconnu'}`);
      continue;
    }

    // Mémorise l'échéance notifiée pour ne pas renvoyer chaque jour.
    await prisma.systemSetting.upsert({
      where: { organizationId_key: { organizationId: org.id, key: REMINDER_KEY } },
      update: { value: expiresKey },
      create: { organizationId: org.id, key: REMINDER_KEY, value: expiresKey },
    });

    notified += 1;
    console.log(`[notify-expiry] relance envoyée → ${admins[0].email} (${org.name}, ${expired ? 'expiré' : `${daysLeft} j restants`})`);
  }

  console.log(`[notify-expiry] terminé : ${notified} organisation(s) notifiée(s).`);
}

main()
  .catch((e) => {
    console.error('[notify-expiry] erreur :', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
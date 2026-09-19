import { prisma } from './prisma';
import { NextResponse } from 'next/server';

/**
 * Garde-fou serveur d'abonnement : verrouillage AUTOMATIQUE des organisations
 * dont la période payée (planExpiresAt) est dépassée.
 *
 * `subscriptionExpired` ne fait qu'un constat passif (lecture) : si le cron
 * `check-billing.mjs` n'a pas tourné, le statut en base reste « ACTIVE » et
 * l'organisation continue d'agir normalement. `enforcePlanActive` fait le
 * travail actif : il PERSISTE le passage à EXPIRED puis refuse la requête (402).
 *
 * À appeler dans les handlers API sensibles (invitations, activation de code…)
 * après `requireOrgMember`/`requireOrgAdmin`, avec `auth.ctx`.
 */
export async function enforcePlanActive(
  ctx: {
    organization: { id: string; planStatus: string; planExpiresAt: Date | null; licenseCodeId: string | null };
  },
): Promise<NextResponse | null> {
  const org = ctx.organization;
  // Déjà verrouillée en base, ou période d'essai sans échéance : rien à faire.
  if (org.planStatus !== 'ACTIVE') return null;
  // Non expirée : accès normal.
  if (!org.planExpiresAt || org.planExpiresAt.getTime() > Date.now()) return null;

  // Période payée dépassée : on persiste le verrouillage (source de vérité
  // pour le tableau de bord plateforme et les e-mails de rappel).
  await prisma.organization.update({
    where: { id: org.id },
    data: { planStatus: 'EXPIRED' },
  });
  return NextResponse.json(
    {
      error: 'Votre abonnement a expiré. L’espace de travail est verrouillé — activez un code de licence pour continuer.',
      locked: true,
      lockReason: 'EXPIRATION',
    },
    { status: 402 },
  );
}

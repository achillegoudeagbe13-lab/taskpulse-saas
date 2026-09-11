export * from './plans';
import type { PlanTier } from '@prisma/client';
import { tierInfo, tierForSeats, formatPrice } from './plans';
import { prisma } from './prisma';

/**
 * Helpers côté serveur du système de monétisation.
 * Les constantes de paliers purs vivent dans `./plans` (sûr client).
 */

/**
 * Nombre de « sièges » occupés par une organisation : membres actuellement
 * rattachés + invitations en attente (le futur membre est décompté).
 */
export async function getOrgSeatUsage(orgId: string) {
  const [members, pending] = await Promise.all([
    prisma.membership.count({ where: { organizationId: orgId } }),
    prisma.invitation.count({ where: { organizationId: orgId, status: 'PENDING' } }),
  ]);
  return { members, pending, total: members + pending };
}

/**
 * Vérifie qu'une invitation n'entraîne pas un dépassement du palier courant.
 * Retourne null si OK, sinon un objet d'erreur avec le palier requis.
 */
export async function checkInviteSeatCapacity(orgId: string, planTier: PlanTier | null) {
  const { members, pending } = await getOrgSeatUsage(orgId);
  const resulting = members + pending + 1;
  const cap = tierInfo(planTier).maxSeats;
  if (cap === null) return null;
  if (resulting > cap) {
    const required = tierForSeats(resulting);
    return {
      error: `Limite de votre palier atteinte : votre plan actuel autorise ${cap} membre(s) (${members} membre(s) + ${pending} invitation(s) en attente). Passez au palier « ${required.label} » (${formatPrice(required.price)}) pour ajouter ce membre.`,
      requiredTier: required.tier,
      requiredPrice: required.price,
      seatLimit: cap,
      resulting,
    };
  }
  return null;
}
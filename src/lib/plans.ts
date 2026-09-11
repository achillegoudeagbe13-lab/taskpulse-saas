import type { PlanTier } from '@prisma/client';

/**
 * Grille tarifaire par paliers (volume de membres) — monétisation Mar-ci Flow.
 * Fichier « sûr » côté client : aucune dépendance Prisma / serveur.
 * Les montants sont exprimés en F (francs) par abonnement.
 */
export type Tier = { tier: PlanTier; label: string; minSeats: number; maxSeats: number | null; price: number };

export const TIERS: Tier[] = [
  { tier: 'T1', label: '1 à 3 utilisateurs', minSeats: 1, maxSeats: 3, price: 5000 },
  { tier: 'T2', label: '4 à 10 utilisateurs', minSeats: 4, maxSeats: 10, price: 10000 },
  { tier: 'T3', label: '11 à 20 utilisateurs', minSeats: 11, maxSeats: 20, price: 15000 },
  { tier: 'T4', label: 'Plus de 20 utilisateurs', minSeats: 21, maxSeats: null, price: 20000 },
];

export function tierForSeats(seats: number): Tier {
  return TIERS.find((t) => seats >= t.minSeats && (t.maxSeats === null || seats <= t.maxSeats)) ?? TIERS[TIERS.length - 1];
}

/** Retrouve une fiche de palier depuis sa valeur d'énumération. */
export function tierInfo(tier: PlanTier | null | undefined): Tier {
  return TIERS.find((t) => t.tier === tier) ?? TIERS[0];
}

export function seatLimitOf(tier: PlanTier | null | undefined): number | null {
  return tierInfo(tier).maxSeats;
}

export function priceOf(tier: PlanTier | null | undefined): number {
  return tierInfo(tier).price;
}

export function formatPrice(price: number): string {
  return `${price.toLocaleString('fr-FR')} F`;
}

export function tierLabel(tier: PlanTier | null | undefined): string {
  return tierInfo(tier).label;
}

/** Formate une date d'expiration lisible. */
export function formatExpiry(date: Date | null | string | undefined): string {
  if (!date) return 'Illimité';
  return new Date(date).toLocaleDateString('fr-FR');
}
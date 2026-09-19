import { randomBytes } from 'crypto';
import type { PlanTier } from '@prisma/client';
import { TIER_PREFIX, KEY_PATTERN } from './plans';

/**
 * Génération de clés d'activation « signées » par palier (côté serveur uniquement).
 * Format : MCF-<PREFIX>-XXXX-XXXX où PREFIX identifie le montant cible
 * (5K = 5 000 F, 10K = 10 000 F, 15K = 15 000 F, 20K = 20 000 F).
 */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans I, O, 0, 1 (lisibilité)

function block(length: number) {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** Génère une clé unique au format MCF-<PREFIX>-XXXX-XXXX pour le palier donné. */
export function generateLicenseKey(tier: PlanTier): string {
  const prefix = TIER_PREFIX[tier];
  return `MCF-${prefix}-${block(4)}-${block(4)}`;
}

/** Vérifie la forme d'une clé (préfixe palier inclus). */
export function isValidKeyShape(code: string): boolean {
  return KEY_PATTERN.test(code.trim().toUpperCase());
}

/** Extrait le préfixe de palier d'une clé ('5K', '10K'…), ou null si forme invalide. */
export function keyPrefix(code: string): string | null {
  const m = KEY_PATTERN.exec(code.trim().toUpperCase());
  return m?.[1] ?? null;
}

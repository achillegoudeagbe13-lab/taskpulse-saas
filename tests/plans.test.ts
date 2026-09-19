import { describe, expect, it } from 'vitest';
import { TIERS, formatExpiry, formatPrice, seatLimitOf, tierForSeats, tierInfo, tierLabel } from '../src/lib/plans';
import type { PlanTier } from '@prisma/client';

describe('grille tarifaire', () => {
  it('couvre tous les paliers sans trou de sièges', () => {
    expect(TIERS[0].minSeats).toBe(1);
    for (let i = 1; i < TIERS.length; i++) {
      expect(TIERS[i].minSeats).toBe((TIERS[i - 1].maxSeats ?? 0) + 1);
    }
    expect(TIERS[TIERS.length - 1].maxSeats).toBeNull(); // illimité
  });

  it('calcule le palier requis pour un nombre de sièges', () => {
    expect(tierForSeats(1).tier).toBe('T1');
    expect(tierForSeats(3).tier).toBe('T1');
    expect(tierForSeats(4).tier).toBe('T2');
    expect(tierForSeats(10).tier).toBe('T2');
    expect(tierForSeats(11).tier).toBe('T3');
    expect(tierForSeats(20).tier).toBe('T3');
    expect(tierForSeats(21).tier).toBe('T4');
    expect(tierForSeats(1000).tier).toBe('T4');
  });

  it('retourne T1 par défaut pour un palier inconnu', () => {
    expect(tierInfo(null).tier).toBe('T1');
    expect(tierInfo(undefined).tier).toBe('T1');
    expect(tierInfo('INCONNU' as PlanTier).tier).toBe('T1');
  });

  it('expose la limite de sièges (null = illimité)', () => {
    expect(seatLimitOf('T1')).toBe(3);
    expect(seatLimitOf('T4')).toBeNull();
    expect(seatLimitOf(null)).toBe(3);
  });
});

describe('formatage', () => {
  it('formate les prix en francs (espace insécable tolérée)', () => {
    // Node formate avec une espace insécable étroite (U+202F) : on accepte toute variante.
    expect(formatPrice(5000)).toMatch(/^5\s+000\sF$/u);
    expect(formatPrice(20000)).toMatch(/^20\s+000\sF$/u);
  });

  it('formate les libellés et les dates', () => {
    expect(tierLabel('T2')).toBe('4 à 10 utilisateurs');
    expect(formatExpiry(null)).toBe('Illimité');
    expect(formatExpiry('2030-01-15T00:00:00.000Z')).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
});

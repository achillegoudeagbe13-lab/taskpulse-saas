import { describe, expect, it } from 'vitest';
import type { PlanTier } from '@prisma/client';
import { generateLicenseKey, isValidKeyShape, keyPrefix } from '../src/lib/license-keys';
import { KEY_PATTERN, TIER_PREFIX, tierByPrefix } from '../src/lib/plans';

describe('génération de clés', () => {
  const tiers: PlanTier[] = ['T1', 'T2', 'T3', 'T4'];

  it('génère une clé au format attendu pour chaque palier', () => {
    for (const tier of tiers) {
      const key = generateLicenseKey(tier);
      expect(key.startsWith(`MCF-${TIER_PREFIX[tier]}-`)).toBe(true);
      expect(KEY_PATTERN.test(key)).toBe(true);
    }
  });

  it('génère des clés uniques', () => {
    const keys = new Set(Array.from({ length: 200 }, () => generateLicenseKey('T2')));
    expect(keys.size).toBe(200);
  });

  it('n’utilise pas de caractères ambigus (I, O, 0, 1) dans les blocs aléatoires', () => {
    for (let i = 0; i < 50; i++) {
      const key = generateLicenseKey('T3');
      // On ne teste que les deux blocs aléatoires (le préfixe contient « 1 »).
      const blocks = key.split('-').slice(2).join('-');
      expect(blocks).not.toMatch(/[IO01]/);
    }
  });
});

describe('validation de forme', () => {
  it('accepte les clés valides (casse et espaces tolérés)', () => {
    expect(isValidKeyShape('MCF-5K-ABCD-EFGH')).toBe(true);
    expect(isValidKeyShape('  mcf-10k-ab2c-def3 '.trim())).toBe(true);
    expect(isValidKeyShape('MCF-20K-XYZ2-3456')).toBe(true);
  });

  it('rejette les clés invalides', () => {
    expect(isValidKeyShape('MCF-3K-ABCD-EFGH')).toBe(false); // préfixe inconnu
    expect(isValidKeyShape('MCF-5K-ABCD-EFG')).toBe(false); // bloc trop court
    expect(isValidKeyShape('MCF-5K-ABCD-EFGH1')).toBe(false);
    expect(isValidKeyShape('ABC-5K-ABCD-EFGH')).toBe(false);
    expect(isValidKeyShape('')).toBe(false);
    expect(isValidKeyShape('MCF-5K-I0O1-EFGH')).toBe(false); // caractères ambigus
  });
});

describe('préfixe ↔ palier', () => {
  it('fait la correspondance dans les deux sens', () => {
    expect(tierByPrefix('5K')).toBe('T1');
    expect(tierByPrefix('10K')).toBe('T2');
    expect(tierByPrefix('15K')).toBe('T3');
    expect(tierByPrefix('20K')).toBe('T4');
    expect(tierByPrefix('99K')).toBeNull();
    expect(keyPrefix('MCF-15K-ABCD-EFGH')).toBe('15K');
    expect(keyPrefix('nimporte')).toBeNull();
  });
});

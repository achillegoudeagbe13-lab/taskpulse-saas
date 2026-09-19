import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RATE_LIMITS, checkRateLimit, clientIp } from '../src/lib/rate-limit';

function req(ip: string): Request {
  return new Request('https://app.test/api/x', { headers: { 'x-forwarded-for': `${ip}, 10.0.0.1` } });
}

describe('clientIp', () => {
  it('extrait la première IP de x-forwarded-for', () => {
    expect(clientIp(req('1.2.3.4'))).toBe('1.2.3.4');
  });

  it('retourne unknown sans en-tête', () => {
    expect(clientIp(new Request('https://app.test'))).toBe('unknown');
  });
});

describe('checkRateLimit', () => {
  beforeEach(() => {
    // Chaque test part d'une fenêtre propre (clé unique par test).
  });
  afterEach(() => {
    // Rien : les clés uniques isolent les tests.
  });

  it('autorise sous la limite et bloque au-delà avec Retry-After', () => {
    const rule: (typeof RATE_LIMITS)['login'] = { ...RATE_LIMITS.login, limit: 3, windowMs: 60_000 };
    const ip = '10.1.1.' + Math.floor(Math.random() * 1000);
    expect(checkRateLimit(rule, ip, req(ip))).toBeNull();
    expect(checkRateLimit(rule, ip, req(ip))).toBeNull();
    expect(checkRateLimit(rule, ip, req(ip))).toBeNull();
    const blocked = checkRateLimit(rule, ip, req(ip));
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
    expect(Number(blocked!.headers.get('Retry-After'))).toBeGreaterThanOrEqual(1);
  });

  it('isole les clients par IP', () => {
    const rule: (typeof RATE_LIMITS)['ai'] = { ...RATE_LIMITS.ai, limit: 1, windowMs: 60_000 };
    const a = '10.2.0.a' + Math.random();
    const b = '10.2.0.b' + Math.random();
    expect(checkRateLimit(rule, a, req(a))).toBeNull();
    expect(checkRateLimit(rule, a, req(a))?.status).toBe(429);
    // L'autre client n'est pas affecté.
    expect(checkRateLimit(rule, b, req(b))).toBeNull();
  });

  it('laisse repasser après expiration de la fenêtre', () => {
    const rule: (typeof RATE_LIMITS)['forgot'] = { ...RATE_LIMITS.forgot, limit: 1, windowMs: 20 };
    const ip = '10.3.0.' + Math.random();
    expect(checkRateLimit(rule, ip, req(ip))).toBeNull();
    expect(checkRateLimit(rule, ip, req(ip))?.status).toBe(429);
    // Attente de l'expiration de la fenêtre (20 ms).
    return new Promise((resolve) => setTimeout(resolve, 40)).then(() => {
      expect(checkRateLimit(rule, ip, req(ip))).toBeNull();
    });
  });
});

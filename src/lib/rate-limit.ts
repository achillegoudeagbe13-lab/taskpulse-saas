import { NextResponse } from 'next/server';

/**
 * Rate limiting applicatif (fenêtre fixe, en mémoire par instance).
 *
 * Objectif : freiner l'abus des endpoints sensibles (brute-force de connexion,
 * spam de demandes de réinitialisation / invitations, coût de l'IA, création
 * d'organisations en masse). C'est une protection applicative volontairement
 * sans dépendance : sur un déploiement multi-instances, remplacer le stockage
 * `hits` par Redis/Upstash serait nécessaire pour un quota global.
 */

type Bucket = { count: number; resetAt: number };

/** Stockage module : survit entre les requêtes, reset à chaque redémarrage du process. */
const buckets = new Map<string, Bucket>();

/** Nombre maximal de clés gardées (anti-fuite mémoire : purge FIFO au-delà). */
const MAX_BUCKETS = 10_000;

export type RateLimitRule = {
  /** Nom logique du point d'application (ex. 'login'). */
  scope: string;
  /** Nombre de requêtes autorisées dans la fenêtre. */
  limit: number;
  /** Durée de la fenêtre en millisecondes. */
  windowMs: number;
};

/** Règles par défaut des endpoints sensibles. */
export const RATE_LIMITS = {
  /** Connexion : 10 tentatives / 5 min par IP. */
  login: { scope: 'login', limit: 10, windowMs: 5 * 60 * 1000 } as RateLimitRule,
  /** Mot de passe oublié : 5 demandes / 15 min par IP. */
  forgot: { scope: 'forgot', limit: 5, windowMs: 15 * 60 * 1000 } as RateLimitRule,
  /** Réinitialisation : 10 tentatives / 15 min par IP. */
  reset: { scope: 'reset', limit: 10, windowMs: 15 * 60 * 1000 } as RateLimitRule,
  /** Inscription (création d'organisation) : 5 / heure par IP. */
  register: { scope: 'register', limit: 5, windowMs: 60 * 60 * 1000 } as RateLimitRule,
  /** Acceptation d'invitation : 10 / heure par IP. */
  join: { scope: 'join', limit: 10, windowMs: 60 * 60 * 1000 } as RateLimitRule,
  /** Assistant IA : 20 messages / min par utilisateur (coût API). */
  ai: { scope: 'ai', limit: 20, windowMs: 60 * 1000 } as RateLimitRule,
} satisfies Record<string, RateLimitRule>;

/** Meilleure IP disponible derrière un proxy (Render, Vercel, Nginx…). */
export function clientIp(request: Request): string {
  const headers = request.headers;
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip')?.trim() || 'unknown';
}

/**
 * Consomme 1 crédit pour la clé (scope + identifiant). Retourne `null` si la
 * requête est autorisée, sinon une réponse 429 prête à renvoyer.
 */
export function checkRateLimit(
  rule: RateLimitRule,
  identifier: string,
  request: Request,
): NextResponse | null {
  const now = Date.now();
  const key = `${rule.scope}:${identifier}`;
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + rule.windowMs };
    buckets.set(key, bucket);
    // Purge légère : évite une croissance sans borne du stockage.
    if (buckets.size > MAX_BUCKETS) {
      const oldest = buckets.keys().next().value;
      if (oldest !== undefined) buckets.delete(oldest);
    }
  }
  bucket.count += 1;
  if (bucket.count > rule.limit) {
    const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return NextResponse.json(
      {
        error:
          rule.scope === 'login'
            ? 'Trop de tentatives de connexion. Réessayez dans quelques minutes.'
            : 'Trop de requêtes. Réessayez plus tard.',
      },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
    );
  }
  void request;
  return null;
}

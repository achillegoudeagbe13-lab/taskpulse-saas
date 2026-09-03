/**
 * Utilitaires de rendu sûr pour React.
 *
 * Évite l'erreur React #130 (« Objects are not valid as a React child ») et les
 * crashs de type « Cannot read properties of undefined » en garantissant que
 * toutes les valeurs affichées dans le JSX sont des chaînes de caractères ou
 * des dates valides, avec vérification systématique de null/undefined.
 */

/** Convertit n'importe quelle valeur en chaîne de caractères sûre. */
export function safeStr(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return isNaN(value.getTime()) ? fallback : value.toISOString();
  if (Array.isArray(value)) return value.map((v) => safeStr(v)).filter(Boolean).join(', ');
  try { return String(value); } catch { return fallback; }
}

/** Construit une Date valide depuis n'importe quelle entrée, ou null si invalide. */
export function safeDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  try {
    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    const parsed = new Date(String(value));
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch { return null; }
}

/** Date + heure locale sûres : renvoie '' si non renseigné / invalide. */
export function safeDateTime(value: unknown): string {
  const date = safeDate(value);
  if (!date) return '';
  try { return date.toLocaleString('fr-FR'); } catch { return ''; }
}

/** Date locale sûre : renvoie le fallback si absente / invalide. */
export function safeDateLabel(value: unknown, fallback = ''): string {
  const date = safeDate(value);
  if (!date) return fallback;
  try { return date.toLocaleDateString('fr-FR'); } catch { return fallback; }
}

/** Heure locale 'HH:MM' sûre : renvoie '' si absente / invalide. */
export function safeTimeLabel(value: unknown, fallback = ''): string {
  const date = safeDate(value);
  if (!date) return fallback;
  try { return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch { return fallback; }
}

/** Extrait un nom complet sûr à partir d'un objet utilisateur partiel. */
export function safeFullName(user: { firstName?: unknown; lastName?: unknown } | null | undefined, fallback = '—'): string {
  if (!user || typeof user !== 'object') return fallback;
  const first = safeStr(user.firstName);
  const last = safeStr(user.lastName);
  return [first, last].filter(Boolean).join(' ') || fallback;
}

/** Renvoie le premier élément d'un tableau garanti, ou [] (évite les crashs sur .map). */
export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}
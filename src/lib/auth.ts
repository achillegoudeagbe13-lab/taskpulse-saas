import { createHash, randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { OrgRole, PlatformRole } from '@prisma/client';
import { prisma } from './prisma';

export const SESSION_COOKIE = 'taskpulse-session';
const SESSION_DAYS = 30;

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({ data: { tokenHash: hashSessionToken(token), userId, expiresAt } });
  cookies().set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', expires: expiresAt, path: '/' });
}

/** Utilisateur courant avec ses memberships et organisations. */
export async function getCurrentUser() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: {
      user: {
        include: {
          department: true,
          profile: true,
          memberships: { include: { organization: true }, orderBy: { createdAt: 'asc' as const } },
        },
      },
    },
  });

  if (!session || session.expiresAt <= new Date() || session.user.status !== 'ACTIF') return null;
  return session.user;
}

type SessionUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export type AuthContext = {
  user: SessionUser;
  organization: SessionUser['memberships'][number]['organization'] | null;
  organizationId: string | null;
  orgRole: OrgRole | null;
  isPlatformSuperAdmin: boolean;
};

function resolveActiveMembership(user: SessionUser) {
  return user.memberships.find((membership) => membership.organizationId === user.activeOrganizationId) ?? user.memberships[0] ?? null;
}

/** Contexte complet : utilisateur + organisation active + rôle dans cette organisation. */
export async function getAuthContext(): Promise<AuthContext | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const active = resolveActiveMembership(user);
  return {
    user,
    organization: active?.organization ?? null,
    organizationId: active?.organizationId ?? null,
    orgRole: active?.role ?? null,
    isPlatformSuperAdmin: user.platformRole === 'PLATFORM_SUPER_ADMIN',
  };
}
type Guard<T> = Promise<{ ctx: T; error: null } | { ctx: null; error: NextResponse }>;

/** Garde : session valide obligatoire. */
export async function requireAuth(): Guard<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) return { ctx: null, error: NextResponse.json({ error: 'Session inexistante.' }, { status: 401 }) };
  return { ctx, error: null };
}

type OrgContext = AuthContext & { organizationId: string; orgRole: OrgRole; organization: NonNullable<AuthContext['organization']> };

/** Garde : membre actif d'une organisation (contexte organisation obligatoire). */
export async function requireOrgMember(): Guard<OrgContext> {
  const result = await requireAuth();
  if (result.error) return result;
  const { organization, organizationId, orgRole } = result.ctx;
  if (!organization || !organizationId || !orgRole) {
    return { ctx: null, error: NextResponse.json({ error: 'Aucune organisation active pour ce compte.' }, { status: 403 }) };
  }
  return { ctx: { ...result.ctx, organization, organizationId, orgRole }, error: null };
}

/** Garde : administrateur de l'organisation active (ORGANIZATION_ADMIN). */
export async function requireOrgAdmin(): Promise<{ ctx: OrgContext; error: null } | { ctx: null; error: NextResponse }> {
  const result = await requireOrgMember();
  if (result.error) return result;
  if (result.ctx.orgRole !== 'ORGANIZATION_ADMIN') {
    return { ctx: null, error: NextResponse.json({ error: 'Accès réservé aux administrateurs de l’organisation.' }, { status: 403 }) };
  }
  return { ctx: result.ctx, error: null };
}

/** Garde : super-admin plateforme (TASKPULSE_ADMIN_EMAIL), sans accès aux données privées des organisations. */
export async function requirePlatformSuperAdmin(): Guard<AuthContext> {
  const result = await requireAuth();
  if (result.error) return result;
  if (!result.ctx.isPlatformSuperAdmin) {
    return { ctx: null, error: NextResponse.json({ error: 'Accès réservé à l’administration de la plateforme.' }, { status: 403 }) };
  }
  return { ctx: result.ctx, error: null };
}

/**
 * Rôle plateforme piloté côté serveur uniquement : l'email défini dans
 * TASKPULSE_ADMIN_EMAIL reçoit PLATFORM_SUPER_ADMIN (jamais depuis le client).
 */
export async function syncPlatformRole(user: { id: string; email: string; platformRole: PlatformRole }): Promise<PlatformRole> {
  const platformEmail = (process.env.TASKPULSE_ADMIN_EMAIL ?? '').trim().toLowerCase();
  const shouldBeSuperAdmin = platformEmail.length > 0 && user.email.toLowerCase() === platformEmail;
  if (shouldBeSuperAdmin && user.platformRole !== 'PLATFORM_SUPER_ADMIN') {
    await prisma.user.update({ where: { id: user.id }, data: { platformRole: 'PLATFORM_SUPER_ADMIN' } });
    return 'PLATFORM_SUPER_ADMIN';
  }
  return user.platformRole;
}

/** Vérifie qu'un utilisateur est membre actif d'une organisation donnée. */
export async function isMemberOf(userId: string, organizationId: string) {
  const membership = await prisma.membership.findFirst({ where: { userId, organizationId, organization: { status: 'ACTIVE' } } });
  return Boolean(membership);
}

export function publicUser(user: SessionUser) {
  const active = resolveActiveMembership(user);
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    email: user.email,
    phone: user.phone,
    // Rôle dans l'organisation active (remplace l'ancien rôle global).
    role: active?.role ?? null,
    status: user.status,
    department: user.department?.name ?? '',
    photoUrl: user.photoUrl,
    profile: user.profile,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    platformRole: user.platformRole,
    organization: active ? { id: active.organization.id, name: active.organization.name, slug: active.organization.slug } : null,
    memberships: user.memberships.map((membership) => ({
      organizationId: membership.organizationId,
      role: membership.role as OrgRole,
      organization: { id: membership.organization.id, name: membership.organization.name, slug: membership.organization.slug },
    })),
  };
}
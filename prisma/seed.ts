import { PrismaClient, OrgRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_ORG_NAME = 'Organisation Initiale';
const DEFAULT_ORG_SLUG = 'organisation-initiale';

/** Mappe l'ancien rôle global vers le nouveau rôle d'organisation. */
function legacyToOrgRole(role?: string | null): OrgRole {
  if (role === 'ADMIN') return 'ORGANIZATION_ADMIN';
  if (role === 'STAGIAIRE') return 'INTERN';
  return 'EMPLOYEE';
}

async function ensureDefaultOrganization() {
  const existing = await prisma.organization.findUnique({ where: { slug: DEFAULT_ORG_SLUG } });
  if (existing) return existing;
  const organization = await prisma.organization.create({ data: { name: DEFAULT_ORG_NAME, slug: DEFAULT_ORG_SLUG, sector: null, country: null, contactEmail: null } });
  await prisma.systemSetting.create({ data: { key: 'organizationName', value: organization.name, organizationId: organization.id } });
  console.log(`✓ Organisation par défaut créée : ${organization.name}`);
  return organization;
}

/** Rattache à l'org par défaut tout compte sans membership (aucune suppression). */
async function attachOrphanUsers(organizationId: string) {
  const users = await prisma.user.findMany({ include: { memberships: true } });
  let attached = 0;
  for (const user of users) {
    if (user.memberships.length > 0) continue;
    const role = legacyToOrgRole(user.role);
    await prisma.membership.create({ data: { userId: user.id, organizationId, role } });
    await prisma.user.update({ where: { id: user.id }, data: { activeOrganizationId: user.activeOrganizationId ?? organizationId } });
    attached += 1;
  }
  console.log(`✓ Comptes rattachés à « ${DEFAULT_ORG_NAME} » : ${attached}`);
}

/** Rétro-propage l'organisation par défaut sur les lignes créées avant la migration. */
async function backfillOrganizationIds(organizationId: string) {
  const tables: Array<[keyof typeof prisma, string]> = [
    [prisma.department, 'department'], [prisma.task, 'task'], [prisma.activity, 'activity'],
    [prisma.announcement, 'announcement'], [prisma.message, 'message'], [prisma.notification, 'notification'],
    [prisma.attendance, 'attendance'], [prisma.journalEntry, 'journalEntry'], [prisma.journalCategory, 'journalCategory'],
  ];
  for (const [delegate, label] of tables) {
    const store = delegate as unknown as { updateMany(args: { where: { organizationId: null }; data: { organizationId: string } }): Promise<{ count: number }> };
    const result = await store.updateMany({ where: { organizationId: null }, data: { organizationId } });
    if (result.count > 0) console.log(`✓ ${label} : ${result.count} ligne(s) rattachée(s)`);
  }
}

/** TASKPULSE_ADMIN_EMAIL → PLATFORM_SUPER_ADMIN (attribution uniquement). */
async function syncPlatformSuperAdmin() {
  const email = (process.env.TASKPULSE_ADMIN_EMAIL ?? '').trim().toLowerCase();
  if (!email) return;
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && user.platformRole !== 'PLATFORM_SUPER_ADMIN') {
    await prisma.user.update({ where: { id: user.id }, data: { platformRole: 'PLATFORM_SUPER_ADMIN' } });
    console.log(`✓ PLATFORM_SUPER_ADMIN accordé à ${email}`);
  }
}

async function main() {
  const organization = await ensureDefaultOrganization();

  // Compte administrateur de démonstration (idempotent).
  const roles = [
    { name: 'ADMIN' as const, description: 'Rôle historique (voir Membership.role)' },
    { name: 'EMPLOYE' as const, description: 'Rôle historique (voir Membership.role)' },
    { name: 'STAGIAIRE' as const, description: 'Rôle historique (voir Membership.role)' },
  ];
  for (const role of roles) {
    await prisma.roleDefinition.upsert({ where: { name: role.name }, update: {}, create: role }).catch(async () => {
      const found = await prisma.roleDefinition.findUnique({ where: { name: role.name } });
      if (!found) await prisma.roleDefinition.create({ data: role });
    });
  }

  const passwordHash = await bcrypt.hash(process.env.ADMIN_INITIAL_PASSWORD ?? 'Admin123!', 12);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { passwordHash },
    create: { firstName: 'Amélie', lastName: 'Martin', username: 'admin', email: 'admin@taskpulse.fr', passwordHash },
  });
  const adminMembership = await prisma.membership.findFirst({ where: { userId: admin.id, organizationId: organization.id } });
  if (!adminMembership) {
    await prisma.membership.create({ data: { userId: admin.id, organizationId: organization.id, role: 'ORGANIZATION_ADMIN' } });
  }
  await prisma.user.update({ where: { id: admin.id }, data: { activeOrganizationId: admin.activeOrganizationId ?? organization.id } });
  await prisma.profile.upsert({ where: { userId: admin.id }, update: { position: 'Administratrice' }, create: { userId: admin.id, position: 'Administratrice' } });

  await attachOrphanUsers(organization.id);
  await backfillOrganizationIds(organization.id);
  await syncPlatformSuperAdmin();
  console.log('✓ Migration multi-organisations terminée.');
}

main().finally(() => prisma.$disconnect());
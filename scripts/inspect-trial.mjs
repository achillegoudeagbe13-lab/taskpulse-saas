import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const orgs = await prisma.organization.findMany({
  select: {
    id: true, name: true, slug: true, status: true,
    planTier: true, planStatus: true, planExpiresAt: true, licenseCodeId: true,
    memberships: { select: { role: true, user: { select: { email: true, role: true, status: true } } } },
    invitations: { where: { status: 'PENDING' }, select: { email: true, status: true } },
    license: { select: { code: true, tier: true, status: true } },
  },
  orderBy: { createdAt: 'asc' },
});

console.log(`\n=== ${orgs.length} organisation(s) ===\n`);
for (const o of orgs) {
  const admins = o.memberships.filter((m) => m.role === 'ORGANIZATION_ADMIN').map((m) => m.user.email);
  const members = o.memberships.length;
  const pending = o.invitations.length;
  const exp = o.planExpiresAt ? o.planExpiresAt.toISOString() : '— (null)';
  const daysLeft = o.planExpiresAt
    ? Math.max(0, Math.ceil((o.planExpiresAt.getTime() - Date.now()) / 86400000))
    : null;
  const expired = o.planExpiresAt ? o.planExpiresAt <= new Date() : false;
  const inTrial = o.planStatus === 'ACTIVE' && !expired && !!o.planExpiresAt && !o.licenseCodeId;
  console.log(`▸ ${o.name} (slug=${o.slug}, statut org=${o.status})`);
  console.log(`   planTier=${o.planTier} | planStatus=${o.planStatus} | licenseCodeId=${o.licenseCodeId ?? 'null'} | code=${o.license?.code ?? '—'}`);
  console.log(`   planExpiresAt=${exp} | jours restants=${daysLeft ?? 'n/a'} | expired=${expired}`);
  console.log(`   membres=${members} | invitations en attente=${pending} | sièges projetés=${members + pending}`);
  console.log(`   admins org: ${admins.length ? admins.join(', ') : 'AUCUN'}`);
  console.log(`   → inTrial (logique API) = ${inTrial}\n`);
}

const licenses = await prisma.licenseCode.findMany({
  select: { id: true, code: true, tier: true, seats: true, status: true, usedBy: { select: { name: true } } },
});
console.log(`=== ${licenses.length} code(s) de licence ===`);
for (const l of licenses) {
  console.log(`   ${l.code} | tier=${l.tier} | sièges=${l.seats} | statut=${l.status} | utilisée par=${l.usedBy?.name ?? '—'}`);
}

await prisma.$disconnect();

import { requireOrgAdmin } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';

/**
 * GET /api/admin/export?type=attendance|leaves|billing[&from=YYYY-MM-DD&to=YYYY-MM-DD]
 * Exports CSV (séparateur « ; », BOM UTF-8 pour Excel) réservés à l'administrateur
 * de l'organisation active : pointages, congés et facturation.
 */

const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const csvOf = (rows: unknown[][]) => `\ufeff${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}`;
const csvResponse = (body: string, filename: string) =>
  new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });

const dateFr = (date: Date | null | undefined) => (date ? date.toLocaleString('fr-FR', { timeZone: 'UTC' }) : '');

export async function GET(request: Request) {
  const auth = await requireOrgAdmin();
  if (auth.error) return auth.error;
  const orgId = auth.ctx.organizationId;
  const params = new URL(request.url).searchParams;
  const type = params.get('type') ?? 'attendance';
  const from = params.get('from');
  const to = params.get('to');
  const range = from || to
    ? { ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}) }
    : undefined;

  if (type === 'leaves') {
    const leaves = await prisma.leaveRequest.findMany({
      where: { organizationId: orgId, ...(range ? { startDate: range } : {}) },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { startDate: 'asc' },
    });
    return csvResponse(
      csvOf([
        ['Employé', 'Email', 'Type', 'Début', 'Fin', 'Statut', 'Motif'],
        ...leaves.map((leave) => [
          `${leave.user.firstName} ${leave.user.lastName}`,
          leave.user.email,
          leave.type,
          dateFr(leave.startDate),
          dateFr(leave.endDate),
          leave.status,
          leave.reason ?? '',
        ]),
      ]),
      'mar-ci-flow-conges.csv',
    );
  }

  if (type === 'billing') {
    const [org, activations] = await Promise.all([
      prisma.organization.findUnique({ where: { id: orgId }, include: { license: true } }),
      prisma.auditLog.findMany({
        where: { entity: 'LicenseCode', organizationId: orgId },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: { action: true, createdAt: true },
      }),
    ]);
    return csvResponse(
      csvOf([
        ['Champ', 'Valeur'],
        ['Organisation', org?.name ?? ''],
        ['Palier', org?.planTier ?? ''],
        ['Statut', org?.planStatus ?? ''],
        ['Expiration', dateFr(org?.planExpiresAt)],
        ['Licence', org?.license?.code ?? 'Aucune'],
        [],
        ['Historique des opérations de licence', 'Date'],
        ...activations.map((entry) => [entry.action, dateFr(entry.createdAt)]),
      ]),
      'mar-ci-flow-facturation.csv',
    );
  }

  // Défaut : pointages sur la période demandée.
  const records = await prisma.attendance.findMany({
    where: { organizationId: orgId, ...(range ? { clockIn: range } : {}) },
    include: { user: { select: { firstName: true, lastName: true } } },
    orderBy: { clockIn: 'asc' },
    take: 5000,
  });
  return csvResponse(
    csvOf([
      ['Employé', 'Arrivée', 'Départ', 'Durée (h)'],
      ...records.map((record) => {
        const duration = record.clockOut ? ((record.clockOut.getTime() - record.clockIn.getTime()) / 3600000).toFixed(2) : '';
        return [`${record.user.firstName} ${record.user.lastName}`, dateFr(record.clockIn), dateFr(record.clockOut), duration];
      }),
    ]),
    'mar-ci-flow-pointages.csv',
  );
}

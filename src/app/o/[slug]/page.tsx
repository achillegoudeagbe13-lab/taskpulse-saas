/**
 * PAGE DASHBOARD ORGANISATION — wrapper serveur.
 * Résout le contexte d'auth + organisation via getAuthContext().
 * Vérifie que le slug correspond à l'organisation active.
 * Puis rend le layout client <AppLayout />.
 */
import { requireOrgMember } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AppLayout from './AppLayout';

export const dynamic = 'force-dynamic';

export default async function OrgDashboardPage({ params }: { params: { slug: string } }) {
  const auth = await requireOrgMember();
  if (auth.error) redirect('/login');

  const ctx = auth.ctx;
  const orgSlug = ctx.organization?.slug ?? '';

  // Vérifier que l'utilisateur est membre de l'organisation demandée
  if (params.slug !== orgSlug) {
    redirect('/o/' + (orgSlug || ''));
  }

  return (
    <AppLayout
      user={ctx.user}
      organization={ctx.organization}
      organizationId={ctx.organizationId}
      orgRole={ctx.orgRole}
      isPlatformSuperAdmin={ctx.isPlatformSuperAdmin}
    />
  );
}

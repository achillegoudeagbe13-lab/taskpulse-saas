/**
 * PAGE FIL D'ACTIVITÉ — /o/<slug>/activite
 */
import { requireOrgMember } from '../../../../lib/auth';
import { redirect } from 'next/navigation';
import AppLayout from '../AppLayout';

export const dynamic = 'force-dynamic';

export default async function OrgActivityFeedPage({ params }: { params: { slug: string } }) {
  const auth = await requireOrgMember();
  if (auth.error) redirect('/login');
  const ctx = auth.ctx;
  if (params.slug !== (ctx.organization?.slug ?? '')) redirect('/o/' + (ctx.organization?.slug ?? ''));
  return (
    <AppLayout
      user={ctx.user}
      organization={ctx.organization}
      organizationId={ctx.organizationId}
      orgRole={ctx.orgRole}
      isPlatformSuperAdmin={ctx.isPlatformSuperAdmin}
      initialPage="Fil activité"
    />
  );
}

/**
 * PAGE RÉUNION DÉDIÉE — /o/<slug>/reunions
 *
 * Permet de partager un lien direct vers l'onglet Visioconférence, et —
 * avec le paramètre `?room=<identifiant>` — de rejoindre une salle précise.
 * Même contrat d'authentification que le tableau de bord de l'organisation.
 */
import { requireOrgMember } from '../../../../lib/auth';
import { redirect } from 'next/navigation';
import AppLayout from '../AppLayout';

export const dynamic = 'force-dynamic';

export default async function OrgMeetingPage({
  params, searchParams,
}: {
  params: { slug: string };
  searchParams?: { room?: string | string[] };
}) {
  const auth = await requireOrgMember();
  if (auth.error) redirect('/login');

  const ctx = auth.ctx;
  const orgSlug = ctx.organization?.slug ?? '';

  // Vérifier que l'utilisateur est membre de l'organisation demandée
  if (params.slug !== orgSlug) {
    redirect('/o/' + (orgSlug || ''));
  }

  const roomParam = searchParams?.room;
  const room = Array.isArray(roomParam) ? roomParam[0] : roomParam;

  return (
    <AppLayout
      user={ctx.user}
      organization={ctx.organization}
      organizationId={ctx.organizationId}
      orgRole={ctx.orgRole}
      isPlatformSuperAdmin={ctx.isPlatformSuperAdmin}
      initialPage="Visioconférence"
      initialRoom={room ?? null}
    />
  );
}
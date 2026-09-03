/**
 * ROUTE /o/[slug]/users — wrapper serveur de redirection.
 * La gestion des utilisateurs est un onglet de l'application organisation :
 * le composant réel (UsersPanel) vit dans users/UsersPanel.tsx et est rendu
 * par <AppLayout /> avec le contexte d'authentification. Une visite directe
 * de cette URL renvoie donc vers le tableau de bord de l'organisation.
 */
import { redirect } from 'next/navigation';

export default function OrgUsersRoute({ params }: { params: { slug: string } }) {
  redirect('/o/' + (params?.slug ?? ''));
}

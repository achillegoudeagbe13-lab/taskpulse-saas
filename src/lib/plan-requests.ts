import type { PlanRequestStatus, PlanTier } from '@prisma/client';
import { tierInfo, priceOf } from './plans';

/**
 * Parcours client d'abonnement — constantes et sérialisation partagées.
 *
 * Fichier sûr côté client : aucune dépendance Prisma *runtime* (uniquement des
 * imports de types, effacés à la compilation). Les paliers tarifaires restent
 * définis dans `./plans`.
 */

export const PAYMENT_METHODS = [
  { value: 'MOBILE_MONEY', label: 'Mobile Money (Wave, Orange, MTN…)' },
  { value: 'VIREMENT', label: 'Virement bancaire' },
  { value: 'ESPECES', label: 'Espèces (remise en main propre)' },
  { value: 'AUTRE', label: 'Autre (à préciser dans le message)' },
] as const;

export const PAYMENT_METHOD_VALUES = ['MOBILE_MONEY', 'VIREMENT', 'ESPECES', 'AUTRE'] as const;

export function paymentMethodLabel(value: string | null | undefined): string {
  return PAYMENT_METHODS.find((method) => method.value === value)?.label ?? 'Moyen de paiement non précisé';
}

const STATUS_LABELS: Record<PlanRequestStatus, string> = {
  PENDING: 'En attente',
  PROCESSING: 'En traitement',
  APPROVED: 'Approuvée',
  REJECTED: 'Refusée',
};

export function planRequestStatusLabel(status: string | null | undefined): string {
  return STATUS_LABELS[(status ?? '') as PlanRequestStatus] ?? 'En attente';
}

/** Classe de badge cohérente avec `.status-badge` (active / bloque). */
export function planRequestStatusBadge(status: string | null | undefined): string {
  if (status === 'APPROVED') return 'active';
  if (status === 'REJECTED') return 'bloque';
  return '';
}

/** Une demande reste « ouverte » tant qu'aucune décision n'a été prise. */
export function isOpenPlanRequest(status: string | null | undefined): boolean {
  return status === 'PENDING' || status === 'PROCESSING';
}

/* ------------------------------------------------------------------ */
/* Sérialisation API → client (dates ISO, libellés calculés).          */
/* ------------------------------------------------------------------ */

type MessageLike = {
  id: string;
  body: string;
  licenseKey: string | null;
  isSuperAdmin: boolean;
  createdAt: Date | string;
  author: { firstName: string; lastName: string };
};

type RequestLike = {
  id: string;
  requestedTier: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  paymentMethod: string;
  needs: string | null;
  status: string;
  decidedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  organization?: { id: string; name: string; slug: string } | null;
  messages?: MessageLike[];
};

export type PlanRequestMessageView = {
  id: string;
  body: string;
  licenseKey: string | null;
  isSuperAdmin: boolean;
  authorName: string;
  createdAt: string;
};

export type PlanRequestView = {
  id: string;
  organizationId?: string;
  organization?: { id: string; name: string; slug: string } | null;
  requestedTier: string;
  requestedTierLabel: string;
  requestedPrice: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  paymentMethod: string;
  paymentMethodLabel: string;
  needs: string | null;
  status: string;
  statusLabel: string;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  messages: PlanRequestMessageView[];
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

export function serializePlanRequest(request: RequestLike, options?: { withOrganization?: boolean }): PlanRequestView {
  const tier = tierInfo(request.requestedTier as PlanTier);
  return {
    id: request.id,
    ...(options?.withOrganization ? { organization: request.organization ?? null } : {}),
    requestedTier: request.requestedTier,
    requestedTierLabel: tier.label,
    requestedPrice: priceOf(request.requestedTier as PlanTier),
    contactName: request.contactName,
    contactEmail: request.contactEmail,
    contactPhone: request.contactPhone ?? null,
    paymentMethod: request.paymentMethod,
    paymentMethodLabel: paymentMethodLabel(request.paymentMethod),
    needs: request.needs ?? null,
    status: request.status,
    statusLabel: planRequestStatusLabel(request.status),
    decidedAt: toIso(request.decidedAt),
    createdAt: toIso(request.createdAt) as string,
    updatedAt: toIso(request.updatedAt) as string,
    messages: (request.messages ?? []).map((message) => ({
      id: message.id,
      body: message.body,
      licenseKey: message.licenseKey ?? null,
      isSuperAdmin: message.isSuperAdmin,
      authorName: `${message.author.firstName} ${message.author.lastName}`.trim(),
      createdAt: toIso(message.createdAt) as string,
    })),
  };
}
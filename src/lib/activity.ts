import { prisma } from './prisma';

/**
 * Enregistre un événement dans le fil d'activité d'équipe.
 * Fire-and-forget : ne doit jamais faire échouer la requête appelante.
 */
export function recordActivity(input: {
  organizationId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string;
  summary: string;
  projectName?: string | null;
  metadata?: unknown;
}) {
  prisma.activityEvent
    .create({
      data: {
        organizationId: input.organizationId,
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        summary: input.summary,
        projectName: input.projectName ?? null,
        metadata: input.metadata != null ? JSON.stringify(input.metadata) : null,
      },
    })
    .catch(() => {});
}

/** Nom complet d'un utilisateur (fallback sur l'email implicite : prénom). */
export function displayName(user: { firstName: string; lastName: string }) {
  return `${user.firstName} ${user.lastName}`.trim() || 'Un membre';
}

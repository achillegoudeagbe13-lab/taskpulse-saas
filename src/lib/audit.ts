import { prisma } from '@/lib/prisma';

export async function writeAudit(userId: string | null, action: string, entity: string, entityId?: string, metadata?: unknown) {
  await prisma.auditLog.create({ data: { userId, action, entity, entityId, metadata: metadata ? JSON.stringify(metadata) : null } });
}
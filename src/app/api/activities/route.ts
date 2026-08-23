import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrgMember } from '@/lib/auth';
import { writeAudit } from '@/lib/audit';
import { prisma } from '@/lib/prisma';

const activitySchema = z.object({ title: z.string().trim().min(1).max(160), content: z.string().trim().min(1).max(4000), status: z.enum(['TERMINE', 'EN_COURS', 'BLOQUE']), attachmentUrl: z.string().url().optional().or(z.literal('')) });
const activityPatch = z.object({ id: z.string().min(1), title: z.string().trim().min(1).max(160).optional(), content: z.string().trim().min(1).max(4000).optional(), status: z.enum(['TERMINE', 'EN_COURS', 'BLOQUE']).optional() });

export async function GET() {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;
  // Admin d'organisation : toutes les activités de SON organisation ; membre : les siennes.
  const scope = auth.ctx.orgRole === 'ORGANIZATION_ADMIN' ? {} : { userId: auth.ctx.user.id };
  const activities = await prisma.activity.findMany({ where: { organizationId: auth.ctx.organizationId, ...scope }, include: { user: { select: { firstName: true, lastName: true, username: true, photoUrl: true } } }, orderBy: { createdAt: 'desc' }, take: 50 });
  return NextResponse.json({ activities });
}

export async function POST(request: Request) {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;
  try { const input = activitySchema.parse(await request.json()); const activity = await prisma.activity.create({ data: { ...input, attachmentUrl: input.attachmentUrl || null, userId: auth.ctx.user.id, organizationId: auth.ctx.organizationId } }); return NextResponse.json({ activity }, { status: 201 }); } catch (error) { return NextResponse.json({ error: error instanceof z.ZodError ? error.issues[0]?.message : 'Publication impossible.' }, { status: 400 }); }
}

/** Mise à jour par l'auteur : contenu et évolution du statut (ex. « En cours » → « Terminé »). */
export async function PATCH(request: Request) {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;
  try {
    const input = activityPatch.parse(await request.json());
    if (!input.title && !input.content && !input.status) return NextResponse.json({ error: 'Aucune modification fournie.' }, { status: 400 });
    const activity = await prisma.activity.findUnique({ where: { id: input.id } });
    // Anti-énumération : une activité d'une autre organisation est invisible.
    if (!activity || activity.organizationId !== auth.ctx.organizationId) return NextResponse.json({ error: 'Activité introuvable.' }, { status: 404 });
    if (activity.userId !== auth.ctx.user.id) return NextResponse.json({ error: 'Seul l’auteur de l’activité peut la modifier.' }, { status: 403 });
    const updated = await prisma.activity.update({
      where: { id: input.id },
      data: { ...(input.title !== undefined ? { title: input.title } : {}), ...(input.content !== undefined ? { content: input.content } : {}), ...(input.status !== undefined ? { status: input.status } : {}) },
    });
    await writeAudit(auth.ctx.user.id, 'MODIFICATION_ACTIVITE', 'Activity', updated.id);
    return NextResponse.json({ activity: updated, message: input.status === 'TERMINE' && activity.status !== 'TERMINE' ? 'Activité terminée.' : 'Activité mise à jour.' });
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? error.issues[0]?.message : 'Modification impossible.' }, { status: 400 });
  }
}
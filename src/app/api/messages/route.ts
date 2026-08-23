import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isMemberOf, requireOrgMember } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';

export async function GET(request: Request) {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;
  const recipientId = new URL(request.url).searchParams.get('with');
  // Toute la conversation est filtrée par l'organisation active.
  const messages = await prisma.message.findMany({
    where: { organizationId: auth.ctx.organizationId, ...(recipientId ? { OR: [{ senderId: auth.ctx.user.id, recipientId }, { senderId: recipientId, recipientId: auth.ctx.user.id }] } : { OR: [{ senderId: auth.ctx.user.id }, { recipientId: auth.ctx.user.id }] }) },
    include: { sender: { select: { firstName: true, lastName: true, username: true } }, recipient: { select: { firstName: true, lastName: true, username: true } } },
    orderBy: { createdAt: 'asc' },
  });
  if (recipientId) await prisma.message.updateMany({ where: { organizationId: auth.ctx.organizationId, senderId: recipientId, recipientId: auth.ctx.user.id, readAt: null }, data: { readAt: new Date() } });
  return NextResponse.json({ messages });
}

export async function POST(request: Request) {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;
  try {
    const input = z.object({ recipientId: z.string(), content: z.string().trim().min(1).max(5000) }).parse(await request.json());
    // Le destinataire doit être un membre actif de LA MÊME organisation.
    if (!(await isMemberOf(input.recipientId, auth.ctx.organizationId))) return NextResponse.json({ error: 'Destinataire introuvable.' }, { status: 404 });
    const message = await prisma.message.create({ data: { senderId: auth.ctx.user.id, recipientId: input.recipientId, content: input.content, organizationId: auth.ctx.organizationId } });
    await prisma.notification.create({ data: { userId: input.recipientId, organizationId: auth.ctx.organizationId, title: 'Nouveau message', content: `Message de ${auth.ctx.user.firstName} ${auth.ctx.user.lastName}.` } });
    return NextResponse.json({ message }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Message invalide.' }, { status: 400 });
  }
}
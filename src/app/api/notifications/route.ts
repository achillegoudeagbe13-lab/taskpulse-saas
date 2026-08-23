import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() { const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: 'Session inexistante.' }, { status: 401 }); const notifications = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 50 }); return NextResponse.json({ notifications, unread: notifications.filter((item) => !item.readAt).length }); }
export async function PATCH(request: Request) { const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: 'Session inexistante.' }, { status: 401 }); const input = z.object({ id: z.string().optional(), all: z.boolean().optional() }).parse(await request.json()); if (input.all) await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } }); else if (input.id) await prisma.notification.updateMany({ where: { id: input.id, userId: user.id }, data: { readAt: new Date() } }); return NextResponse.json({ ok: true }); }
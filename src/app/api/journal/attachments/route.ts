import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { requireOrgMember } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';

const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
const maxBytes = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;
  const form = await request.formData();
  const entryId = String(form.get('entryId') ?? '');
  const file = form.get('file');
  if (!(file instanceof File) || !entryId) return NextResponse.json({ error: 'Fichier ou entrée manquant.' }, { status: 400 });
  if (!allowedTypes.has(file.type) || file.size > maxBytes) return NextResponse.json({ error: 'Format non autorisé ou fichier trop volumineux (5 Mo maximum).' }, { status: 400 });
  const entry = await prisma.journalEntry.findUnique({ where: { id: entryId }, include: { journal: true } });
  // Pièces jointes réservées au propriétaire, dans la même organisation.
  if (!entry || entry.journal.userId !== auth.ctx.user.id || entry.organizationId !== auth.ctx.organizationId) return NextResponse.json({ error: 'Entrée privée.' }, { status: 403 });
  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const relativePath = `/uploads/journal/${safeName}`;
  const absoluteDir = path.join(process.cwd(), 'public', 'uploads', 'journal');
  await mkdir(absoluteDir, { recursive: true });
  await writeFile(path.join(absoluteDir, safeName), Buffer.from(await file.arrayBuffer()));
  const attachment = await prisma.journalAttachment.create({ data: { entryId, name: file.name, url: relativePath, mimeType: file.type } });
  return NextResponse.json({ attachment }, { status: 201 });
}
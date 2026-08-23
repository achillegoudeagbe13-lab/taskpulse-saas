import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { hashSessionToken, SESSION_COOKIE } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { getCurrentUser } from '../../../../lib/auth';
import { writeAudit } from '../../../../lib/audit';

export async function POST() {
  const user = await getCurrentUser();
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  cookies().delete(SESSION_COOKIE);
  if (user) await writeAudit(user.id, 'DECONNEXION', 'Session', user.id);
  return NextResponse.json({ ok: true });
}
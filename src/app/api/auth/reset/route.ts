import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../../../lib/prisma';
import { writeAudit } from '../../../../lib/audit';
import { RATE_LIMITS, checkRateLimit, clientIp } from '../../../../lib/rate-limit';

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

type Guard = { ok: true; userId: string } | { ok: false; error: NextResponse };

/** Vérifie le jeton : non consommé, non expiré. */
async function consumeCheck(request: Request): Promise<Guard> {
  const token = new URL(request.url).searchParams.get('token');
  // Le POST envoie le jeton dans le corps.
  if (!token) return { ok: false, error: NextResponse.json({ error: 'Jeton manquant.' }, { status: 400 }) };
  const record = await prisma.passwordReset.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.usedAt) return { ok: false, error: NextResponse.json({ error: 'Ce lien est invalide ou a déjà été utilisé.' }, { status: 400 }) };
  if (record.expiresAt <= new Date()) return { ok: false, error: NextResponse.json({ error: 'Ce lien de réinitialisation est expiré.' }, { status: 410 }) };
  return { ok: true, userId: record.userId };
}

/** GET /api/auth/reset?token= — valide un lien de réinitialisation. */
export async function GET(request: Request) {
  const check = await consumeCheck(request);
  if (!check.ok) return check.error;
  const user = await prisma.user.findUnique({ where: { id: check.userId }, select: { id: true, firstName: true } });
  return NextResponse.json({ ok: true, user: { id: user?.id, firstName: user?.firstName } });
}

/** POST /api/auth/reset — définit un nouveau mot de passe (zéro-connaissance). */
const schema = z.object({ token: z.string().min(10), password: z.string().min(8).max(72) });

export async function POST(request: Request) {
  // Anti brute-force de jetons : 10 tentatives / 15 min par IP.
  const limited = checkRateLimit(RATE_LIMITS.reset, clientIp(request), request);
  if (limited) return limited;
  let input: { token: string; password: string };
  try {
    input = schema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Mot de passe trop court (8 caractères minimum).' }, { status: 400 });
    return NextResponse.json({ error: 'Données invalides.' }, { status: 400 });
  }

  const record = await prisma.passwordReset.findUnique({ where: { tokenHash: hashToken(input.token) } });
  if (!record || record.usedAt) return NextResponse.json({ error: 'Ce lien est invalide ou a déjà été utilisé.' }, { status: 400 });
  if (record.expiresAt <= new Date()) return NextResponse.json({ error: 'Ce lien de réinitialisation est expiré.' }, { status: 410 });

  const passwordHash = await bcrypt.hash(input.password, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    // Consommation du jeton (usage unique).
    prisma.passwordReset.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // Invalidation de toutes les sessions ouvertes.
    prisma.session.deleteMany({ where: { userId: record.userId } }),
  ]);

  await writeAudit(record.userId, 'MOT_DE_PASSE_REINITIALISE', 'User', record.userId);
  return NextResponse.json({ ok: true, message: 'Mot de passe réinitialisé. Vous pouvez vous connecter.' });
}
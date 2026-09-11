import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';
import { prisma } from '../../../../lib/prisma';
import { writeAudit } from '../../../../lib/audit';

const RESET_TTL_MS = 24 * 60 * 60 * 1000; // 24 h

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * POST /api/auth/forgot — demande une réinitialisation de mot de passe.
 *
 * Zéro-connaissance : seul le HASH du jeton est stocké ; le jeton brut n'est
 * conservé nulle part. En l'absence de prestataire e-mail dans cette itération,
 * le lien unique est renvoyé dans la réponse pour être transmis au membre.
 */
const schema = z.object({ email: z.string().trim().toLowerCase().email() });

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    // Réponse identique que le compte existe ou non (pas de fuite d'existence).
    if (!user) {
      return NextResponse.json({ ok: true, message: 'Si cet email existe, un lien de réinitialisation a été envoyé.' });
    }

    // Révocation des éventuels jetons précédents non consommés.
    await prisma.passwordReset.deleteMany({ where: { userId: user.id, usedAt: null } });

    const token = randomBytes(32).toString('hex');
    await prisma.passwordReset.create({
      data: {
        tokenHash: hashToken(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
      },
    });

    await writeAudit(user.id, 'DEMANDE_RESET_MOT_DE_PASSE', 'User', user.id);
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/reset?token=${token}`;

    return NextResponse.json({ ok: true, message: 'Lien de réinitialisation créé (usage unique, 24 h).', resetUrl });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Email invalide.' }, { status: 400 });
    return NextResponse.json({ error: 'Impossible de traiter la demande.' }, { status: 400 });
  }
}
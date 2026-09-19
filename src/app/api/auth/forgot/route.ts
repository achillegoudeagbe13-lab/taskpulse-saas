import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';
import { prisma } from '../../../../lib/prisma';
import { writeAudit } from '../../../../lib/audit';
import { RATE_LIMITS, checkRateLimit, clientIp } from '../../../../lib/rate-limit';

const RESET_TTL_MS = 24 * 60 * 60 * 1000; // 24 h

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

/** Échappe les caractères HTML pour éviter toute injection dans les e-mails. */
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
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
  // Anti spam d'e-mails : 5 demandes / 15 min par IP.
  const limited = checkRateLimit(RATE_LIMITS.forgot, clientIp(request), request);
  if (limited) return limited;
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
    // URL absolue : on part de l'origine de la requête (fonctionne en prod comme
    // en local) si NEXT_PUBLIC_APP_URL n'est pas défini.
    const base = process.env.NEXT_PUBLIC_APP_URL?.trim() || new URL(request.url).origin;
    const resetUrl = `${base.replace(/\/+$/, '')}/reset?token=${token}`;

    // Envoi réel de l'e-mail si le SMTP est configuré ; sinon le lien est
    // renvoyé dans la réponse pour transmission manuelle par le super admin.
    const { sendMail, mailTemplate, isMailConfigured } = await import('../../../../lib/mailer');
    let emailed = false;
    if (isMailConfigured()) {
      const result = await sendMail(
        user.email,
        'Réinitialisation de votre mot de passe — MAR-CI FLOW',
        mailTemplate(
          'Réinitialisation de votre mot de passe',
          `<p>Bonjour <strong>${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}</strong>,</p>
           <p>Vous avez demandé la réinitialisation de votre mot de passe. Ce lien unique est valable <strong>24 heures</strong> et ne peut être utilisé qu'une seule fois.</p>
           <p>Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet e-mail — votre mot de passe actuel reste valable.</p>`,
          { label: 'Choisir un nouveau mot de passe', url: resetUrl },
        ),
      );
      emailed = result.sent;
    }

    return NextResponse.json({
      ok: true,
      message: emailed
        ? 'Lien de réinitialisation envoyé par e-mail (usage unique, 24 h).'
        : 'Lien de réinitialisation créé (usage unique, 24 h). Transmettez-le au membre.',
      resetUrl: emailed ? undefined : resetUrl,
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Email invalide.' }, { status: 400 });
    return NextResponse.json({ error: 'Impossible de traiter la demande.' }, { status: 400 });
  }
}
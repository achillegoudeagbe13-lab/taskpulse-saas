import { createTransport, type Transporter } from 'nodemailer';

/**
 * Envoi d'e-mails transactionnels via SMTP (variables d'environnement :
 * SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM).
 *
 * Dégradation gracieuse : si le SMTP n'est pas configuré, `sendMail`
 * renvoie { sent: false } et les routes conservent leur comportement de
 * secours (lien renvoyé dans la réponse API, affiché à l'admin).
 */

let cached: Transporter | null = null;

export function isMailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter(): Transporter | null {
  if (!isMailConfigured()) return null;
  if (cached) return cached;
  cached = createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return cached;
}

const FROM = process.env.MAIL_FROM || 'MAR-CI FLOW <no-reply@marciflow.app>';

export async function sendMail(to: string, subject: string, html: string): Promise<{ sent: boolean; error?: string }> {
  const transporter = getTransporter();
  if (!transporter) return { sent: false, error: 'SMTP_NON_CONFIGURE' };
  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject,
      html,
      text: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    });
    return { sent: true };
  } catch (error) {
    console.error('[mailer] envoi impossible:', error instanceof Error ? error.message : error);
    return { sent: false, error: error instanceof Error ? error.message : 'ERREUR_SMTP' };
  }
}

/** Mise en page commune des e-mails. */
export function mailTemplate(title: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  return `<!doctype html><html><body style="font-family:Segoe UI,Arial,sans-serif;background:#f1f5f9;padding:24px">
  <div style="max-width:560px;margin:auto;background:#fff;border-radius:14px;padding:28px;border:1px solid #e2e8f0">
    <h1 style="margin:0 0 12px;font-size:19px;color:#0f172a">${title}</h1>
    <div style="font-size:14px;color:#334155;line-height:1.6">${bodyHtml}</div>
    ${cta ? `<p style="margin:22px 0 4px"><a href="${cta.url}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:11px 20px;border-radius:9px;font-weight:600;font-size:14px">${cta.label}</a></p>
    <p style="font-size:12px;color:#64748b;word-break:break-all">Ou copiez ce lien : ${cta.url}</p>` : ''}
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0" />
    <p style="font-size:11px;color:#94a3b8;margin:0">MAR-CI FLOW — plateforme de suivi d'activité et de gestion d'équipe.<br/>Si vous n'êtes pas à l'origine de cette action, ignorez cet e-mail.</p>
  </div></body></html>`;
}

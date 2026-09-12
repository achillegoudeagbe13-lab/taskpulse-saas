/** Déclaration minimale pour nodemailer (pas de @types officiel installé). */
declare module 'nodemailer' {
  export interface MailOptions {
    from?: string;
    to?: string | string[];
    subject: string;
    text?: string;
    html?: string;
    replyTo?: string;
  }
  export interface SentMessageInfo {
    messageId?: string;
    accepted?: string[];
    rejected?: string[];
    response?: string;
  }
  export interface Transporter {
    sendMail(options: MailOptions): Promise<SentMessageInfo>;
    verify(): Promise<true>;
  }
  export function createTransport(options: unknown): Transporter;
  const _default: { createTransport: typeof createTransport };
  export default _default;
}

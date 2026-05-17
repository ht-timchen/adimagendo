import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { acceptInviteUrl } from "@/lib/admin-people";

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  auth: { user: string; pass: string };
  from: string;
};

export function isSmtpConfigured(): boolean {
  return getSmtpConfig() !== null;
}

function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.EMAIL_SERVER_HOST?.trim();
  const user = process.env.EMAIL_SERVER_USER?.trim();
  const pass = process.env.EMAIL_SERVER_PASSWORD?.trim();
  if (!host || !user || !pass) return null;

  const port = Number(process.env.EMAIL_SERVER_PORT || "587");
  const from = process.env.EMAIL_FROM?.trim() || user;

  return {
    host,
    port: Number.isFinite(port) ? port : 587,
    secure: port === 465,
    auth: { user, pass },
    from,
  };
}

function createTransporter(config: SmtpConfig) {
  const transport: SMTPTransport.Options = {
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  };
  if (config.port === 587) {
    transport.secure = false;
    transport.requireTLS = true;
  }
  return nodemailer.createTransport(transport);
}

export const SMTP_NOT_CONFIGURED_MSG =
  "Email was not sent. Add EMAIL_SERVER_HOST, EMAIL_SERVER_USER, and EMAIL_SERVER_PASSWORD to .env, then restart the dev server.";

export type SendMailResult =
  | { sent: true }
  | { sent: false; reason: "smtp_not_configured"; previewLogged: boolean };

/** Send transactional email via SMTP (invite, password reset). */
export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<SendMailResult> {
  const smtp = getSmtpConfig();

  if (!smtp) {
    const msg = SMTP_NOT_CONFIGURED_MSG;
    if (process.env.NODE_ENV === "development") {
      console.warn("[mail]", msg);
      console.info("[mail:preview]", opts.to, opts.subject, "\n", opts.text);
      return { sent: false, reason: "smtp_not_configured", previewLogged: true };
    }
    throw new Error(msg);
  }

  const transporter = createTransporter(smtp);

  try {
    await transporter.sendMail({
      from: smtp.from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html ?? opts.text.replace(/\n/g, "<br>"),
    });
    if (process.env.NODE_ENV === "development") {
      console.info("[mail:sent]", opts.to, opts.subject);
    }
    return { sent: true };
  } catch (err) {
    console.error("[mail:error]", err);
    throw err;
  }
}

export async function sendInviteEmail(opts: {
  to: string;
  name: string;
  token: string;
  subject?: string;
}): Promise<SendMailResult> {
  const link = acceptInviteUrl(opts.token);
  const subject = opts.subject ?? "ADIMAGENDO — set your password";
  const text = `Hello ${opts.name},\n\nOpen this link to set your password (expires soon):\n${link}\n\nIf you did not expect this email, you can ignore it.`;
  const html = `
    <p>Hello ${escapeHtml(opts.name)},</p>
    <p><a href="${link}">Set your password</a></p>
    <p>Or copy this link into your browser:</p>
    <p style="word-break:break-all;"><a href="${link}">${link}</a></p>
    <p>This link expires soon.</p>
  `.trim();
  return sendMail({ to: opts.to, subject, text, html });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

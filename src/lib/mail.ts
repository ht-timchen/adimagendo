import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { acceptInviteUrl } from "@/lib/admin-people";

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  requireTls: boolean;
  auth: { user: string; pass: string };
  from: string;
};

export type EmailDeliveryMode = "manual" | "smtp";
export type EffectiveEmailDelivery = "manual" | "smtp" | "smtp_unconfigured";
export type StaffCredentialDelivery = "email" | "manual" | "unavailable";

export type MailConfigSummary = {
  deliveryMode: EmailDeliveryMode | "unset";
  effective: EffectiveEmailDelivery;
};

/** Parse EMAIL_SERVER_PORT safely; defaults to 587. */
export function parseSmtpPort(raw: string | undefined): number {
  const trimmed = raw?.trim();
  if (!trimmed) return 587;
  const port = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return 587;
  return port;
}

/** Port 465 → implicit TLS; port 587 → STARTTLS. */
export function resolveSmtpTls(port: number): {
  secure: boolean;
  requireTls: boolean;
} {
  if (port === 465) return { secure: true, requireTls: false };
  if (port === 587) return { secure: false, requireTls: true };
  return { secure: false, requireTls: false };
}

export function parseEmailDeliveryModeEnv(
  raw: string | undefined
): EmailDeliveryMode | null {
  const value = raw?.trim().toLowerCase();
  if (!value) return null;
  if (value === "manual" || value === "smtp") return value;
  return null;
}

export function resolveEffectiveEmailDelivery(opts: {
  modeEnv?: string;
  smtpConfigured: boolean;
}): EffectiveEmailDelivery {
  const explicit = parseEmailDeliveryModeEnv(opts.modeEnv);
  if (explicit === "manual") return "manual";
  if (explicit === "smtp") {
    return opts.smtpConfigured ? "smtp" : "smtp_unconfigured";
  }
  return opts.smtpConfigured ? "smtp" : "manual";
}

function getEffectiveEmailDelivery(): EffectiveEmailDelivery {
  return resolveEffectiveEmailDelivery({
    modeEnv: process.env.EMAIL_DELIVERY_MODE,
    smtpConfigured: isSmtpConfigured(),
  });
}

/** SMTP env vars are present (host, user, password). */
export function isSmtpConfigured(): boolean {
  return getSmtpConfig() !== null;
}

/** Staff invite/reset should use SMTP email delivery. */
export function usesSmtpEmailDelivery(): boolean {
  logMailConfigOnce();
  return getEffectiveEmailDelivery() === "smtp";
}

export function resolveStaffInviteDelivery(
  requestDelivery?: "email" | "manual"
): StaffCredentialDelivery {
  const effective = getEffectiveEmailDelivery();
  if (effective === "manual") return "manual";
  if (effective === "smtp") return "email";
  if (requestDelivery === "email") return "unavailable";
  return "manual";
}

export function resolveStaffResetDelivery(): StaffCredentialDelivery {
  const effective = getEffectiveEmailDelivery();
  if (effective === "manual") return "manual";
  if (effective === "smtp") return "email";
  return "unavailable";
}

/** Server-side operator docs only — not for API responses. */
export const EMAIL_DELIVERY_UNAVAILABLE_MSG =
  "Email delivery is not available. Configure SMTP or set EMAIL_DELIVERY_MODE=manual.";

/** Safe user-facing message when email delivery is unavailable. */
export const STAFF_EMAIL_UNAVAILABLE_USER_MSG =
  "Email delivery is not available. Use temporary password delivery or contact support.";

export function buildStaffManualCredentialsResponse(
  email: string,
  temporaryPassword: string
) {
  return {
    delivery: "manual" as const,
    email,
    temporaryPassword,
  };
}

export function buildStaffEmailDeliveryResponse() {
  return { delivery: "email" as const };
}

function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.EMAIL_SERVER_HOST?.trim();
  const user = process.env.EMAIL_SERVER_USER?.trim();
  const pass = process.env.EMAIL_SERVER_PASSWORD?.trim();
  if (!host || !user || !pass) return null;

  const port = parseSmtpPort(process.env.EMAIL_SERVER_PORT);
  const { secure, requireTls } = resolveSmtpTls(port);
  const from = process.env.EMAIL_FROM?.trim() || user;

  return { host, port, secure, requireTls, auth: { user, pass }, from };
}

export function getMailConfigSummary(): MailConfigSummary {
  return {
    deliveryMode:
      parseEmailDeliveryModeEnv(process.env.EMAIL_DELIVERY_MODE) ?? "unset",
    effective: getEffectiveEmailDelivery(),
  };
}

let mailConfigLogged = false;

export function logMailConfigOnce(): void {
  if (mailConfigLogged) return;
  mailConfigLogged = true;

  const summary = getMailConfigSummary();
  const smtp = getSmtpConfig();
  console.info("[mail:config]", {
    deliveryMode: summary.deliveryMode,
    effective: summary.effective,
    ...(smtp
      ? {
          host: smtp.host,
          port: smtp.port,
          secure: smtp.secure,
          requireTls: smtp.requireTls,
          from: smtp.from,
          user: smtp.auth.user,
        }
      : {}),
  });
}

function createTransporter(config: SmtpConfig) {
  const transport: SMTPTransport.Options = {
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 30_000,
  };
  if (config.requireTls) transport.requireTLS = true;
  return nodemailer.createTransport(transport);
}

export const SMTP_NOT_CONFIGURED_MSG =
  "Email was not sent. Add EMAIL_SERVER_HOST, EMAIL_SERVER_USER, and EMAIL_SERVER_PASSWORD to .env, then restart the dev server.";

export type SendMailResult =
  | { sent: true }
  | { sent: false; reason: "smtp_not_configured"; previewLogged: boolean };

/** Detailed mail error text for server logs only (no secrets). */
export function formatMailDeliveryError(err: unknown): string {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code: unknown }).code)
      : "";
  const message = err instanceof Error ? err.message : String(err);

  if (
    code === "ETIMEDOUT" ||
    /connection timeout/i.test(message) ||
    message.includes("ETIMEDOUT")
  ) {
    return "Email server connection timed out. Check EMAIL_SERVER_HOST, EMAIL_SERVER_PORT, and that outbound SMTP is allowed from your hosting environment.";
  }
  if (code === "ECONNREFUSED") {
    return "Email server connection refused. Check EMAIL_SERVER_HOST and EMAIL_SERVER_PORT.";
  }
  if (code === "EAUTH" || /invalid login|authentication/i.test(message)) {
    return "Email server authentication failed. Check EMAIL_SERVER_USER and EMAIL_SERVER_PASSWORD.";
  }
  return "Failed to send email. Check email server configuration.";
}

function isEmailDeliveryFailure(err: unknown): boolean {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code: unknown }).code)
      : "";
  const message = err instanceof Error ? err.message : String(err);
  return (
    code === "ETIMEDOUT" ||
    code === "ECONNREFUSED" ||
    code === "EAUTH" ||
    /connection timeout|etimedout|invalid login|authentication|email server|smtp|mail server/i.test(
      message
    )
  );
}

/** Sanitized message for staff invite/reset API responses. */
export function formatStaffActionUserError(
  err: unknown,
  action: "invite" | "reset_password"
): string {
  if (isEmailDeliveryFailure(err)) {
    return "Email delivery failed. Please check email configuration.";
  }
  if (action === "invite") {
    return "Unable to add person. Please try again or contact support.";
  }
  return "Unable to reset password. Please try again or contact support.";
}

/** Send transactional email via SMTP (Nodemailer). Dormant when EMAIL_DELIVERY_MODE=manual. */
export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<SendMailResult> {
  logMailConfigOnce();

  if (getEffectiveEmailDelivery() === "manual") {
    throw new Error("Email delivery is disabled (EMAIL_DELIVERY_MODE=manual).");
  }

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
    const summary = getMailConfigSummary();
    const smtpSummary = getSmtpConfig();
    console.error("[mail:error]", {
      deliveryMode: summary.deliveryMode,
      effective: summary.effective,
      ...(smtpSummary
        ? {
            host: smtpSummary.host,
            port: smtpSummary.port,
            secure: smtpSummary.secure,
            requireTls: smtpSummary.requireTls,
          }
        : {}),
      code:
        err && typeof err === "object" && "code" in err
          ? (err as { code: unknown }).code
          : undefined,
      command:
        err && typeof err === "object" && "command" in err
          ? (err as { command: unknown }).command
          : undefined,
      message: err instanceof Error ? err.message : String(err),
    });
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

/** Placeholder for transactional email (invite, alerts). Wire SMTP or provider when ready. */
export async function sendMail(opts: { to: string; subject: string; text: string; html?: string }) {
  if (process.env.NODE_ENV === "development") {
    console.info("[mail:stub]", opts.to, opts.subject);
  }
}

import { Webhook } from "svix";
import { ENV } from "./_core/env";

export function emailProviderConfigured() {
  return Boolean(ENV.resendApiKey && ENV.resendFromEmail);
}

export async function sendTransactionalEmail(input: { to: string; subject: string; html: string; text: string; replyTo?: string; idempotencyKey: string; attachment?: { filename: string; content: string } }) {
  if (!emailProviderConfigured()) throw new Error("Email delivery is not configured. Add a transactional email API key and verified sender address first.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.resendApiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      from: ENV.resendFromEmail,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      reply_to: input.replyTo || undefined,
      attachments: input.attachment ? [{ filename: input.attachment.filename, content: input.attachment.content }] : undefined,
      tags: [{ name: "source", value: "pulseforge" }],
    }),
  });
  const payload = await response.json().catch(() => ({})) as { id?: string; message?: string };
  if (!response.ok || !payload.id) throw new Error(payload.message || "The email provider rejected the request.");
  return payload.id;
}

export async function retrieveInboundEmail(emailId: string) {
  if (!ENV.resendApiKey) throw new Error("Inbound email processing is not configured.");
  const response = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, { headers: { Authorization: `Bearer ${ENV.resendApiKey}` } });
  if (!response.ok) throw new Error("Could not retrieve the received email.");
  return response.json() as Promise<{ id: string; to: string[]; from: string; subject: string; html?: string | null; text?: string | null; message_id?: string | null; created_at: string; headers?: Record<string, string> }>;
}

export function verifyResendWebhook(payload: string, headers: { id?: string; timestamp?: string; signature?: string }) {
  if (!ENV.resendWebhookSecret) throw new Error("Inbound email webhook verification is not configured.");
  const webhook = new Webhook(ENV.resendWebhookSecret);
  return webhook.verify(payload, {
    "svix-id": headers.id || "",
    "svix-timestamp": headers.timestamp || "",
    "svix-signature": headers.signature || "",
  }) as { type?: string; created_at?: string; data?: Record<string, unknown> };
}

export function plainTextToEmailHtml(value: string) {
  const escaped = value.replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" }[character] || character));
  return `<div style="font-family:Arial,sans-serif;white-space:pre-wrap;line-height:1.6;color:#201c28">${escaped}</div>`;
}

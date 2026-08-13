export type CommunicationLifecycleStatus = "sent" | "delivered" | "bounced" | "complained" | "suppressed" | "failed";

export function mapResendLifecycleEvent(eventType: string): CommunicationLifecycleStatus | null {
  const events: Record<string, CommunicationLifecycleStatus> = {
    "email.sent": "sent",
    "email.delivered": "delivered",
    "email.bounced": "bounced",
    "email.complained": "complained",
    "email.suppressed": "suppressed",
    "email.failed": "failed",
  };
  return events[eventType] || null;
}

export function suppressionReasonForLifecycle(status: CommunicationLifecycleStatus) {
  if (status === "bounced") return "bounce" as const;
  if (status === "complained") return "complaint" as const;
  if (status === "suppressed") return "manual" as const;
  return null;
}

export function getHeaderValue(headers: Record<string, string> | undefined, name: string) {
  if (!headers) return "";
  const key = Object.keys(headers).find(header => header.toLowerCase() === name.toLowerCase());
  return key && typeof headers[key] === "string" ? headers[key] : "";
}

export function replyCandidates(inReplyTo?: string, referencesHeader?: string) {
  return [inReplyTo, ...(referencesHeader || "").split(/\s+/).reverse()].filter((value): value is string => Boolean(value));
}

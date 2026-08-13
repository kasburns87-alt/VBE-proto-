# Resend Integration Notes

Verified on 13 August 2026 from official documentation.

- Outbound email uses the Resend `POST /emails` API with a sender, recipient list, subject, and HTML/text content. It supports attachments, reply-to addresses, tags, and an `Idempotency-Key` header. Source: https://resend.com/docs/api-reference/emails/send-email
- Inbound email can be routed through the `email.received` webhook. The event carries sender, recipients, subject, message ID, and attachment metadata; the body and attachments are fetched separately through the receiving APIs. Source: https://resend.com/docs/dashboard/receiving/introduction
- Webhook requests must be verified from the raw request body using the Svix request headers and a webhook secret. Webhook delivery is at least once, so applications must store delivery IDs and ignore duplicates. Source: https://resend.com/docs/webhooks/introduction and https://resend.com/docs/webhooks/verify-webhooks-requests
- Resend’s documentation includes a received-email retrieval endpoint and receiving API. Source: https://resend.com/docs/api-reference/emails/retrieve-received-email

The received-email retrieval endpoint is `GET /emails/receiving/{id}`. It returns the received message’s sender, recipients, subject, text/HTML, message ID, and attachment metadata. The inbound webhook must preserve the raw request body and verify the `svix-id`, `svix-timestamp`, and `svix-signature` headers with the configured signing secret before any message is stored. Sources: https://resend.com/docs/api-reference/emails/retrieve-received-email and https://resend.com/docs/webhooks/verify-webhooks-requests.

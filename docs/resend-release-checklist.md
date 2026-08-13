# Native Resend Release Checklist

## Delivery state

PulseForge intentionally keeps outbound sends and schedule activation disabled until all DNS verification and end-to-end tests pass. The application requires both configured provider credentials and the explicit `RESEND_DELIVERY_APPROVED=true` gate before it will send any client email or activate a schedule.

## Dedicated domain model

Use a dedicated subdomain such as `reply.yourdomain.com` for both the Resend sending identity and Receiving. Do **not** point root-domain MX records at Resend if `yourdomain.com` already receives normal business mail. Resend advises a subdomain for this situation because the lowest-priority MX route receives mail and an MX change on the root domain can disrupt an existing mailbox. [1]

| DNS purpose | Hostname | Value | Required action |
|---|---|---|---|
| Domain verification / DKIM | Resend-provided hostname under `reply.yourdomain.com` | Resend-provided value | Copy every TXT/CNAME verification record displayed in the Resend domain setup screen exactly. These values are generated for the domain and must not be guessed. |
| Sending SPF / return path | Resend-provided hostname under `reply.yourdomain.com` | Resend-provided value | Copy the specific record from Resend’s domain setup screen. |
| Receiving MX | `reply.yourdomain.com` | The exact Resend Receiving MX target shown after enabling Receiving | Add only to the dedicated subdomain; then click **I’ve added the record** in Resend. [1] |
| Optional DMARC | `_dmarc.reply.yourdomain.com` | Your organization’s DMARC policy | Add after basic sending and Receiving tests pass. |

The exact DNS values vary by Resend account, domain, and region. The domain setup page is the authoritative source for these values; PulseForge does not invent or hard-code them.

## Secure project secrets

Enter all values through the project **Settings → Secrets** interface, never in chat or source files.

| Environment variable | Required value | Notes |
|---|---|---|
| `RESEND_API_KEY` | Resend API key | Needed for outbound email and retrieved Receiving content. |
| `RESEND_FROM_EMAIL` | A verified sender such as `PulseForge <reports@reply.yourdomain.com>` | Must belong to the verified dedicated subdomain. |
| `RESEND_WEBHOOK_SECRET` | Secret shown for the Resend webhook | Used to verify raw Svix webhook signatures. |
| `PUBLIC_APP_URL` | `https://pulseforge-sbbnxqa8.manus.space` or the assigned custom production domain | Used to create signed unsubscribe links. |
| `RESEND_DELIVERY_APPROVED` | `false` initially | Change to `true` only after all DNS and lifecycle tests pass and the owner explicitly approves activation. |

## Webhook registration

Register a single HTTPS Resend webhook at:

```
https://pulseforge-sbbnxqa8.manus.space/api/webhooks/resend
```

Select these events: `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.failed`, `email.suppressed`, `email.received`, `suppression.added`, and `suppression.removed`. Resend documents that webhooks have at-least-once delivery and can arrive out of order; PulseForge stores the `svix-id` as a unique provider event ID and ignores duplicate deliveries. [2] [3]

The unsubscribe endpoint is generated per recipient as a signed URL under:

```
https://pulseforge-sbbnxqa8.manus.space/api/unsubscribe
```

It records a user-scoped suppression and is advertised through `List-Unsubscribe` headers when `PUBLIC_APP_URL` is configured.

## End-to-end acceptance checklist

1. Verify the `reply.yourdomain.com` domain and Receiving MX record in Resend.
2. Enter the four Resend/PulseForge environment values above, keeping `RESEND_DELIVERY_APPROVED=false`.
3. Send no production email yet. Generate a PDF draft from a weekly report schedule and confirm the PDF is persisted in report history.
4. Use Resend’s webhook test/replay tools to confirm valid signed lifecycle events are recorded once; replay the same event and confirm it is ignored as a duplicate.
5. Send a controlled test message after temporary approval, then reply to it at the receiving subdomain. Confirm the inbound record retains `Message-ID`, `In-Reply-To`, `References`, and the original thread key.
6. Test a bounce, complaint, or provider suppression event. Confirm the address appears in suppression state and that a second outbound attempt is rejected before provider submission.
7. Use the unsubscribe URL and confirm that a subsequent send is blocked for that user and address.
8. Only after all checks pass and the owner explicitly approves, set `RESEND_DELIVERY_APPROVED=true`, restart the service, and activate the intended schedules from Client Operations.

## References

[1]: https://resend.com/docs/dashboard/receiving/custom-domains "Resend Custom Receiving Domains"
[2]: https://resend.com/docs/webhooks/introduction "Resend Managing Webhooks"
[3]: https://resend.com/docs/webhooks/event-types "Resend Webhook Event Types"

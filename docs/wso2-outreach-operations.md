# WSO2 outreach operations

This is a bounded, human-operated campaign for the public WSO2 Context Compiler pilot. It is not a bulk-mail system.

## Frozen first cohort

The migration `20260819000100_wso2_outbound_provider_delivery.sql` prepares four unapproved drafts using public business contacts and official source pages:

- X-Venture — `info@x-venture.io`
- Chakray APAC — `apac-info@chakray.com`
- Claria — `info@claria.com`
- Tellestia — `info@tellestia.com`

Applying the migration sends nothing. Every row stops at `draft_ready`, and every draft stops at `draft`.

## Operator sequence

1. Open `/admin/outbound` with the market-mapping bearer token.
2. Review the source, relevance claim, recipient, subject and complete body.
3. Edit the draft if needed. A revision creates a new version and supersedes the prior unapproved version.
4. Approve that draft. Approval does not send it.
5. Obtain separate human authorization for that recipient and exact draft.
6. Select **Send approved email** and type `SEND <draft-id>` exactly.

The provider path claims the draft once in Postgres before calling Resend and also uses the draft ID as the provider idempotency key. A claimed, failed or ambiguously finalized delivery is never retried automatically.

## Configuration

Provider delivery is available only when both are present in the server environment:

- `RESEND_API_KEY`
- `MAHA_OUTBOUND_EMAIL_ENABLED=true`

Optional overrides are `MAHA_OUTBOUND_FROM` and `MAHA_OUTBOUND_REPLY_TO`. They are server-only values. Do not prefix them with `NEXT_PUBLIC_`.

## Explicit limits

- No email is sent by a migration, deployment, scheduled job or draft approval.
- There is no automatic follow-up.
- There is no retry button for a failed or ambiguous provider claim.
- The initial campaign contains four reviewed organizational addresses only.
- The application sends plain text without attachments or application-level tracking pixels.
- Replies, bounces and opt-outs require operator review; any opt-out ends outreach.

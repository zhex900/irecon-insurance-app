# Email

Outbound email strategy for Irecon Insurance.

## Policy documents — Resend

- Server-only: `app/lib/services/email/resend.server.ts`
- Send orchestration: `send-policy-documents.server.ts`
- HTTP: `POST /api/policies/:policyId/email-documents` (auth required)
- UI: Email documents dialog posts to that API; never calls Resend from the browser
- Body: rich HTML from **React Email editor** (`@react-email/editor`); plain text fallback included
- Templates: Settings → Email templates (super-admin); defaults converted from `_archive/email-templates/*.ascx`
- Attachments: generated / cached PDFs (and library PDFs from R2) as Resend attachments
- Audit: `policy.documents_email` written **after** a successful Resend response (includes `resendId`)

Env (local `.env` / Worker secrets):

| Variable         | Required      | Notes                                                      |
| ---------------- | ------------- | ---------------------------------------------------------- |
| `RESEND_API_KEY` | Yes (to send) | Resend API key                                             |
| `EMAIL_FROM`     | Yes (to send) | Verified sender, e.g. `Irecon Insurance <policies@domain>` |
| `EMAIL_REPLY_TO` | No            | Optional reply-to                                          |
| `APP_URL`        | Recommended   | Public origin for footer logo URL in outbound HTML emails  |

## Auth emails — Supabase Auth

Password **reset** and confirmation links use **Supabase Auth email templates** (`resetPasswordForEmail`, Auth dashboard templates). Admin user create sets a password and confirms email via the Admin API — no invite email via Resend.

Do not duplicate auth mail through Resend unless product explicitly switches later.

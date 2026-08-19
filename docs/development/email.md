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
| `APP_URL`        | Recommended   | Public origin for footer logo URL in outbound HTML emails  |

Policy document emails set **Reply-To** to the client's assigned account manager (`account_manager.email`). `EMAIL_REPLY_TO` is not used for policy sends.

## Auth emails — Resend

Password **reset** uses a custom Irecon template sent via **Resend** (`send-password-reset.server.ts`). Supabase Auth mints the recovery link only (`auth.admin.generateLink`); Supabase SMTP templates are not used for forgot-password.

| Variable              | Required | Notes                                                            |
| --------------------- | -------- | ---------------------------------------------------------------- |
| `RESEND_API_KEY`      | Yes      | Same as policy document email                                    |
| `EMAIL_FROM`          | Yes      | Verified Resend sender, e.g. `Irecon Insurance <noreply@domain>` |
| `APP_URL`             | Yes      | Reset links redirect via `/auth/confirm?next=/reset-password`    |
| `SUPABASE_SECRET_KEY` | Yes      | Admin API to generate recovery links (never expose to client)    |

Disable Supabase Auth “Reset password” SMTP in the Supabase dashboard if you no longer want duplicate mail from Supabase.

### Preview password reset email (local)

```bash
npm run db:start    # optional — loads footer logo from DB
npm run preview:password-reset-email
open .preview/password-reset-email.html
```

Uses a fake reset link (`code=preview-only`). To test delivery, use `/forgot-password` with your email (requires `RESEND_API_KEY` + `EMAIL_FROM` in `.env`).

Admin user create sets a password and confirms email via the Admin API — no invite email via Resend.

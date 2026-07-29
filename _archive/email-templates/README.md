# Legacy ASCX email templates

Source Word/Outlook HTML email controls from the previous CAR portal.

| File | Maps to |
| --- | --- |
| `CARPolicyAnnual.ascx` | Settings → **Broker** template (default) |
| `CARSendToInsurer.ascx` | Settings → **Insurer** template (default) |
| `CARPolicySingle.ascx` | Cover-type variant (not a separate in-app slot yet) |
| `CARPolicyOwnerBuilder.ascx` | Cover-type variant (not a separate in-app slot yet) |
| `CARPolicyAnnualRenewal.ascx` | Cover-type variant (not a separate in-app slot yet) |

Converted HTML lives in `app/lib/email/default-bodies.ts` (TipTap-safe markup)
and is edited in-app with `@react-email/editor` (not MJML — React Email has no MJML mode).

Footer logo: `public/email-footer.png` (replaces legacy `cid:image02`).

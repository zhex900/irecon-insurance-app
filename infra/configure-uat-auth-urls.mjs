#!/usr/bin/env node
/**
 * Point UAT Supabase Auth Site URL + redirect allow list at the Worker.
 *
 * Requires SUPABASE_ACCESS_TOKEN (https://supabase.com/dashboard/account/tokens)
 *
 *   SUPABASE_ACCESS_TOKEN=... node --env-file=.env.uat infra/configure-uat-auth-urls.mjs
 */
const PROJECT_REF =
  process.env.UAT_SUPABASE_REF?.trim() || "tjnsygunohylofihoksl";
const APP_URL = (process.env.APP_URL ?? "https://uat.irecon.net").replace(
  /\/$/,
  "",
);

const allowList = [
  APP_URL,
  `${APP_URL}/**`,
  `${APP_URL}/auth/confirm`,
  `${APP_URL}/auth/confirm/**`,
  `${APP_URL}/reset-password`,
  "http://127.0.0.1:5173/**",
  "http://localhost:5173/**",
].join(",");

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "SUPABASE_ACCESS_TOKEN is required. Create one at https://supabase.com/dashboard/account/tokens",
    );
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const getRes = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`,
    { headers: { Authorization: headers.Authorization } },
  );
  if (!getRes.ok) {
    throw new Error(
      `GET auth config failed: ${getRes.status} ${await getRes.text()}`,
    );
  }
  const before = await getRes.json();
  console.log("Before:");
  console.log("  site_url =", before.site_url);
  console.log("  uri_allow_list =", before.uri_allow_list);

  const patchRes = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        site_url: APP_URL,
        uri_allow_list: allowList,
        mailer_subjects_recovery: "Reset your password",
        mailer_templates_recovery_content:
          '<h2>Reset your password</h2><p>We received a request to reset your password. Follow the link below to choose a new one.</p><p><a href="{{ .ConfirmationURL }}">Reset password</a></p><p>If you didn\'t request this, you can safely ignore this email.</p>',
      }),
    },
  );
  if (!patchRes.ok) {
    throw new Error(
      `PATCH auth config failed: ${patchRes.status} ${await patchRes.text()}`,
    );
  }
  const after = await patchRes.json();
  console.log("After:");
  console.log("  site_url =", after.site_url);
  console.log("  uri_allow_list =", after.uri_allow_list);
  console.log("✓ UAT Auth URLs configured for", APP_URL);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Point UAT Supabase Auth Site URL + redirect allow list at the Worker.
 *
 * Requires SUPABASE_ACCESS_TOKEN (https://supabase.com/dashboard/account/tokens)
 *
 *   SUPABASE_ACCESS_TOKEN=... node --env-file=.env.uat deployment/configure-uat-auth-urls.mjs
 */
import {
  LOCAL_DEV_AUTH_ORIGINS,
  PASSWORD_RESET_EMAIL_SUBJECT,
  PASSWORD_RESET_EMAIL_TEMPLATE,
  SUPABASE_API,
  UAT_APP_URL,
  UAT_PROJECT_REF,
} from "./lib/constants.mjs";

const PROJECT_REF = process.env.UAT_SUPABASE_REF?.trim() || UAT_PROJECT_REF;
const APP_URL = (process.env.APP_URL ?? UAT_APP_URL).replace(/\/$/, "");

const allowList = [
  APP_URL,
  `${APP_URL}/**`,
  `${APP_URL}/auth/confirm`,
  `${APP_URL}/auth/confirm/**`,
  `${APP_URL}/reset-password`,
  ...LOCAL_DEV_AUTH_ORIGINS,
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
    `${SUPABASE_API}/projects/${PROJECT_REF}/config/auth`,
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
    `${SUPABASE_API}/projects/${PROJECT_REF}/config/auth`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        site_url: APP_URL,
        uri_allow_list: allowList,
        mailer_subjects_recovery: PASSWORD_RESET_EMAIL_SUBJECT,
        mailer_templates_recovery_content: PASSWORD_RESET_EMAIL_TEMPLATE,
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

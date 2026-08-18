/**
 * Provision a Supabase database branch off the UAT project for PR previews.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  captureJson,
  DEFAULT_REGION,
  previewRoot,
  randomSecret,
  run,
  sleep,
  UAT_PROJECT_REF,
  supabaseUrls,
  webRoot,
} from "./preview-env.mjs";

const SUPABASE_API = "https://api.supabase.com/v1";

function accessToken() {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "SUPABASE_ACCESS_TOKEN is required. Create one at https://supabase.com/dashboard/account/tokens",
    );
  }
  return token;
}

function uatProjectRef() {
  return process.env.UAT_SUPABASE_REF?.trim() || UAT_PROJECT_REF;
}

function previewRegion() {
  return process.env.PREVIEW_REGION?.trim() || DEFAULT_REGION;
}

function branchWithData() {
  return process.env.PREVIEW_BRANCH_WITH_DATA?.trim() !== "false";
}

function extractDbPassword(dbUrl) {
  if (!dbUrl?.trim()) return null;
  try {
    return decodeURIComponent(new URL(dbUrl).password || "");
  } catch {
    return null;
  }
}

async function supabaseApi(path, { method = "GET", body } = {}) {
  const res = await fetch(`${SUPABASE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }
  if (!res.ok) {
    throw new Error(
      `Supabase API ${method} ${path} failed (${res.status}): ${typeof json === "string" ? json : JSON.stringify(json)}`,
    );
  }
  return json;
}

export async function resolveOrgId() {
  const explicit =
    process.env.SUPABASE_ORG_ID?.trim() ||
    process.env.SUPABASE_ORG_SLUG?.trim();
  if (explicit) return explicit;
  const orgs = await captureJson("npx", [
    "supabase",
    "orgs",
    "list",
    "--output",
    "json",
  ]);
  const list = Array.isArray(orgs) ? orgs : (orgs?.organizations ?? []);
  if (list.length === 1) {
    return list[0].slug ?? list[0].id;
  }
  const names = list
    .map((org) => `${org.name ?? "?"} (${org.id ?? org.slug})`)
    .join(", ");
  throw new Error(
    `Multiple Supabase orgs found. Set SUPABASE_ORG_ID in .env.uat. Orgs: ${names || "(none)"}`,
  );
}

export async function listBranches(parentRef = uatProjectRef()) {
  const branches = await supabaseApi(`/projects/${parentRef}/branches`);
  return Array.isArray(branches) ? branches : [];
}

export async function findBranchByName(
  branchName,
  parentRef = uatProjectRef(),
) {
  const branches = await listBranches(parentRef);
  return branches.find((branch) => branch.name === branchName) ?? null;
}

async function waitUntilBranchHealthy(
  branchName,
  parentRef = uatProjectRef(),
  { timeoutMs = 10 * 60 * 1000 } = {},
) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const branch = await findBranchByName(branchName, parentRef);
    if (!branch) {
      throw new Error(`Branch "${branchName}" disappeared while provisioning.`);
    }
    const status = branch.status ?? "";
    if (status === "ACTIVE_HEALTHY" && branch.project_ref) {
      return branch;
    }
    console.log(
      `  … branch ${branchName} status ${status || "unknown"} (ref ${branch.project_ref ?? "pending"})`,
    );
    await sleep(10_000);
  }
  throw new Error(
    `Timed out waiting for Supabase branch ${branchName} to become ACTIVE_HEALTHY`,
  );
}

export async function getProjectApiKeys(projectRef) {
  const keys = await captureJson("npx", [
    "supabase",
    "projects",
    "api-keys",
    "--project-ref",
    projectRef,
    "--reveal",
    "--output",
    "json",
  ]);
  const list = Array.isArray(keys) ? keys : [];
  const pick = (...names) =>
    list.find((key) => names.includes(key.name) || names.includes(key.type))
      ?.api_key ??
    list.find((key) => names.includes(key.name) || names.includes(key.type))
      ?.apiKey ??
    null;

  const publishableKey = pick("publishable");
  const secretKey = pick("secret");
  if (!publishableKey) {
    throw new Error(
      `Could not read publishable key for ${projectRef}. Got: ${JSON.stringify(list.map((k) => k.name ?? k.type))}`,
    );
  }
  if (!secretKey) {
    throw new Error(`Could not read secret key for ${projectRef}.`);
  }
  return { publishableKey, secretKey };
}

export async function copyPgsodiumKey(sourceRef, destRef) {
  try {
    const key = await supabaseApi(`/projects/${sourceRef}/pgsodium`);
    await supabaseApi(`/projects/${destRef}/pgsodium`, {
      method: "PUT",
      body: key,
    });
    console.log("✓ Copied pgsodium/Vault root key from UAT");
  } catch (error) {
    console.warn(
      "Warning: could not copy pgsodium key (ok if Vault is unused).",
      error instanceof Error ? error.message : error,
    );
  }
}

export async function configureAuthUrls({
  projectRef,
  appUrl,
  extraOrigins = [],
}) {
  const origins = [
    ...new Set([
      appUrl.replace(/\/$/, ""),
      ...extraOrigins.map((origin) => origin.replace(/\/$/, "")),
    ]),
  ];
  const allowList = [
    ...origins.flatMap((origin) => [
      origin,
      `${origin}/**`,
      `${origin}/auth/confirm`,
      `${origin}/auth/confirm/**`,
      `${origin}/reset-password`,
    ]),
    "http://127.0.0.1:5173/**",
    "http://localhost:5173/**",
  ].join(",");
  await supabaseApi(`/projects/${projectRef}/config/auth`, {
    method: "PATCH",
    body: {
      site_url: origins[0],
      uri_allow_list: allowList,
    },
  });
  console.log("✓ Auth Site URL + redirect allow list →", origins.join(", "));
}

async function loadSavedPassword(label) {
  const fromEnv = process.env.PREVIEW_DB_PASSWORD?.trim();
  if (fromEnv) return fromEnv;
  try {
    const saved = (
      await readFile(join(previewRoot, label, ".db-password"), "utf8")
    ).trim();
    return saved || null;
  } catch {
    return null;
  }
}

async function savePassword(label, password) {
  await mkdir(join(previewRoot, label), { recursive: true });
  await writeFile(
    join(previewRoot, label, ".db-password"),
    `${password}\n`,
    "utf8",
  );
}

async function createBranch({ branchName, parentRef }) {
  console.log(
    `→ Creating Supabase branch ${branchName} from UAT project ${parentRef}${branchWithData() ? " (with data)" : ""}…`,
  );
  const created = await supabaseApi(`/projects/${parentRef}/branches`, {
    method: "POST",
    body: {
      branch_name: branchName,
      with_data: branchWithData(),
    },
  });
  console.log(`✓ Branch create requested (${created.id ?? branchName})`);
  return created;
}

export async function provisionSupabase({ names }) {
  const parentRef = uatProjectRef();
  const branchName = names.supabaseBranchName;
  const region = previewRegion();
  let branch = await findBranchByName(branchName, parentRef);
  let created = false;

  if (branch) {
    console.log(
      `→ Reusing Supabase branch ${branchName} (${branch.project_ref})`,
    );
  } else {
    branch = await createBranch({ branchName, parentRef });
    created = true;
  }

  branch = await waitUntilBranchHealthy(branchName, parentRef);
  const projectRef = branch.project_ref;
  if (!projectRef) {
    throw new Error(
      `Branch ${branchName} has no project_ref after provisioning.`,
    );
  }

  let password =
    (await loadSavedPassword(names.label)) ||
    extractDbPassword(process.env.DATABASE_URL) ||
    process.env.PREVIEW_DB_PASSWORD?.trim();
  if (!password) {
    throw new Error(
      "Could not determine UAT database password. Set DATABASE_URL in .env.uat or PREVIEW_DB_PASSWORD.",
    );
  }
  await savePassword(names.label, password);

  const urls = supabaseUrls({ projectRef, password, region });
  const keys = await getProjectApiKeys(projectRef);
  await configureAuthUrls({ projectRef, appUrl: names.appUrl });

  if (created) {
    console.log("✓ Supabase branch ready (schema cloned from UAT parent)");
  }

  return {
    branchId: branch.id,
    branchName,
    parentProjectRef: parentRef,
    projectRef,
    password,
    region,
    created,
    ...urls,
    publishableKey: keys.publishableKey,
    secretKey: keys.secretKey,
  };
}

export async function loadExistingSupabase(names) {
  const parentRef = uatProjectRef();
  const branchName = names.supabaseBranchName;
  const branch = await findBranchByName(branchName, parentRef);
  if (!branch?.project_ref) {
    throw new Error(
      `No Supabase branch named "${branchName}" on UAT project ${parentRef}. Run a full deploy first (omit --skip-db).`,
    );
  }
  const region = previewRegion();
  const password = await loadSavedPassword(names.label);
  if (!password) {
    throw new Error(
      `Missing DB password for branch ${branchName}. Set PREVIEW_DB_PASSWORD or re-run a full deploy.`,
    );
  }
  const urls = supabaseUrls({
    projectRef: branch.project_ref,
    password,
    region,
  });
  const keys = await getProjectApiKeys(branch.project_ref);
  return {
    branchId: branch.id,
    branchName,
    parentProjectRef: parentRef,
    projectRef: branch.project_ref,
    password,
    region,
    created: false,
    ...urls,
    publishableKey: keys.publishableKey,
    secretKey: keys.secretKey,
  };
}

export async function destroySupabase({ branchId, projectRef } = {}) {
  const parentRef = uatProjectRef();
  if (projectRef && projectRef === parentRef) {
    throw new Error("Refusing to delete the UAT Supabase project.");
  }
  const target = branchId || projectRef;
  if (!target) return;
  console.log(`→ Deleting Supabase branch ${target}…`);
  await supabaseApi(`/branches/${target}`, { method: "DELETE" });
  console.log("✓ Supabase branch deleted");
}

/** @deprecated PR previews use branches, not standalone projects. */
export async function findProjectByName() {
  return null;
}

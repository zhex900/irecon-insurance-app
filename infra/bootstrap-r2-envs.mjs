#!/usr/bin/env node
/**
 * One-time migration: copy objects into per-environment R2 buckets.
 *
 *   npm run infra:bootstrap:r2
 *   npm run infra:bootstrap:r2 -- --only uat
 *   npm run infra:bootstrap:r2 -- --only local
 *   npm run infra:bootstrap:r2 -- --from uat --only local
 *   npm run infra:bootstrap:r2 -- --dry-run
 *
 * Default source is the legacy shared buckets. Use `--from uat` to copy UAT → local
 * after UAT buckets are populated.
 *
 * Requires R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_S3_ENDPOINT and Cloudflare auth
 * (`CLOUDFLARE_API_TOKEN` in .env.uat or `npx wrangler login`).
 */
import {
  ensureR2Buckets,
  listR2BucketNames,
  r2BucketExists,
} from "./lib/preview-cloudflare.mjs";
import {
  LEGACY_AVATARS_BUCKET,
  LEGACY_LIBRARY_BUCKET,
  LOCAL_AVATARS_BUCKET,
  LOCAL_LIBRARY_BUCKET,
  UAT_AVATARS_BUCKET,
  UAT_LIBRARY_BUCKET,
} from "./lib/preview-env.mjs";
import { syncR2Bucket } from "./lib/r2-s3-sync.mjs";
import { loadUatDeployEnv } from "./lib/uat-env.mjs";

const TARGETS = {
  uat: {
    avatarsBucket: UAT_AVATARS_BUCKET,
    libraryBucket: UAT_LIBRARY_BUCKET,
  },
  local: {
    avatarsBucket: LOCAL_AVATARS_BUCKET,
    libraryBucket: LOCAL_LIBRARY_BUCKET,
  },
};

const SOURCE_PRESETS = {
  legacy: {
    avatarsBucket: LEGACY_AVATARS_BUCKET,
    libraryBucket: LEGACY_LIBRARY_BUCKET,
  },
  uat: {
    avatarsBucket: UAT_AVATARS_BUCKET,
    libraryBucket: UAT_LIBRARY_BUCKET,
  },
};

function parseOnlyTargets(argv) {
  const onlyIdx = argv.indexOf("--only");
  if (onlyIdx < 0) return Object.keys(TARGETS);
  const raw = argv[onlyIdx + 1]?.trim().toLowerCase();
  if (!raw || !TARGETS[raw]) {
    throw new Error(`Invalid --only value "${raw ?? ""}". Use: uat, local`);
  }
  return [raw];
}

function parseFromPreset(argv) {
  const eq = argv.find((arg) => arg.startsWith("--from="));
  const idx = argv.indexOf("--from");
  const raw =
    eq?.slice("--from=".length) ?? (idx >= 0 ? argv[idx + 1] : "legacy");
  const preset = raw?.trim().toLowerCase() || "legacy";
  if (!SOURCE_PRESETS[preset]) {
    throw new Error(`Invalid --from value "${preset}". Use: legacy, uat`);
  }
  return preset;
}

async function resolveSourceBuckets(preset) {
  const source = { ...SOURCE_PRESETS[preset] };

  if (!(await r2BucketExists(source.libraryBucket))) {
    let available = "";
    try {
      const names = await listR2BucketNames();
      available = names.sort().join(", ");
    } catch {
      available = "(could not list — check R2 S3 credentials)";
    }
    throw new Error(
      `Source library bucket "${source.libraryBucket}" not found.\n` +
        `  Available buckets: ${available || "(none)"}\n` +
        `  Use --from=legacy (default) or --from=uat after UAT buckets exist.`,
    );
  }

  if (!(await r2BucketExists(source.avatarsBucket))) {
    console.warn(
      `Warning: source avatars bucket "${source.avatarsBucket}" not found — skipping avatars sync.`,
    );
    source.avatarsBucket = null;
  }

  return source;
}

async function assertCloudflareAuth() {
  try {
    if (process.env.R2_ACCESS_KEY_ID?.trim()) {
      await listR2BucketNames();
      return;
    }
    await r2BucketExists(LEGACY_LIBRARY_BUCKET);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not reach Cloudflare R2.\n` +
        `  Set CLOUDFLARE_API_TOKEN in .env.uat (or run npx wrangler login) for bucket create.\n` +
        `  Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_S3_ENDPOINT for object sync.\n` +
        `  ${message}`,
    );
  }
}

async function copySourceToTarget(source, targetKey) {
  const names = TARGETS[targetKey];
  console.log(`\n=== Bootstrapping R2 for ${targetKey} ===`);

  await ensureR2Buckets({
    avatarsBucket: names.avatarsBucket,
    libraryBucket: names.libraryBucket,
  });

  if (source.avatarsBucket) {
    console.log(`  ${source.avatarsBucket} → ${names.avatarsBucket}`);
    await syncR2Bucket(source.avatarsBucket, names.avatarsBucket);
  }

  console.log(`  ${source.libraryBucket} → ${names.libraryBucket}`);
  await syncR2Bucket(source.libraryBucket, names.libraryBucket);
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const fromPreset = parseFromPreset(argv);
  let targets = parseOnlyTargets(argv);

  if (fromPreset === "uat") {
    targets = targets.filter((target) => target === "local");
    if (targets.length === 0) {
      throw new Error(
        "--from uat only applies when copying to local (--only local).",
      );
    }
  }

  await loadUatDeployEnv();

  const sourcePreset = SOURCE_PRESETS[fromPreset];
  console.log("R2 environment bootstrap");
  console.log(
    `  Source (${fromPreset}): ${sourcePreset.avatarsBucket}, ${sourcePreset.libraryBucket}`,
  );
  for (const target of targets) {
    const names = TARGETS[target];
    console.log(
      `  Target (${target}): ${names.avatarsBucket}, ${names.libraryBucket}`,
    );
  }

  if (dryRun) {
    console.log("\nDry run — no buckets created or objects copied.");
    return;
  }

  await assertCloudflareAuth();
  const source = await resolveSourceBuckets(fromPreset);

  for (const target of targets) {
    if (
      target === "uat" &&
      fromPreset === "legacy" &&
      (await r2BucketExists(TARGETS.uat.libraryBucket))
    ) {
      console.warn(
        `\nWarning: ${TARGETS.uat.libraryBucket} already exists — sync will merge/overwrite objects.`,
      );
    }
    await copySourceToTarget(source, target);
  }

  console.log("\n✓ R2 bootstrap complete.");
  if (targets.includes("uat")) {
    console.log(
      "  Deploy UAT so Workers use the new buckets: npm run deploy:uat",
    );
  }
  if (targets.includes("local")) {
    console.log(
      "  Local dev reads insurance-app-*-local via wrangler.jsonc remote bindings.",
    );
  }
  if (
    fromPreset === "legacy" &&
    targets.includes("uat") &&
    !targets.includes("local")
  ) {
    console.log(
      "  Copy UAT → local later: npm run infra:bootstrap:r2 -- --from uat --only local",
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

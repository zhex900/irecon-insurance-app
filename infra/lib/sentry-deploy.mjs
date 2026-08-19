/**
 * Upload client source maps to Sentry and strip *.map before Worker deploy.
 */
import { spawn } from "node:child_process";
import { readdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { webRoot } from "./preview-env.mjs";

function run(command, args, { env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: webRoot,
      stdio: "inherit",
      env: env ?? process.env,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited ${code}`));
    });
  });
}

async function deleteSourceMaps(rootDir) {
  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return 0;
    }
    let removed = 0;
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        removed += await walk(path);
      } else if (entry.name.endsWith(".map")) {
        await unlink(path);
        removed += 1;
      }
    }
    return removed;
  }
  return walk(rootDir);
}

async function writeSentrySourcemapIgnoreFile(clientDir) {
  const assetsDir = join(clientDir, "assets");
  let entries = [];
  try {
    entries = await readdir(assetsDir);
  } catch {
    return null;
  }
  const maps = new Set(entries.filter((name) => name.endsWith(".map")));
  const withoutMap = entries.filter(
    (name) => name.endsWith(".js") && !maps.has(`${name}.map`),
  );
  if (withoutMap.length === 0) return null;
  const ignorePath = join(clientDir, ".sentry-sourcemaps-ignore");
  await writeFile(
    ignorePath,
    `${withoutMap.map((name) => `**/${name}`).join("\n")}\n`,
  );
  return ignorePath;
}

export async function uploadSentrySourceMaps(release) {
  const authToken = process.env.SENTRY_AUTH_TOKEN?.trim();
  const org = process.env.SENTRY_ORG?.trim();
  const project = process.env.SENTRY_PROJECT?.trim();
  const clientDir = join(webRoot, "build/client");

  try {
    if (!authToken || !org || !project) {
      console.warn(
        "Warning: SENTRY_AUTH_TOKEN / SENTRY_ORG / SENTRY_PROJECT missing — skipping source map upload.",
      );
      return;
    }

    const ignoreFile = await writeSentrySourcemapIgnoreFile(clientDir);
    const ignoreArgs = ignoreFile ? ["--ignore-file", ignoreFile] : [];

    console.log(`→ Uploading Sentry source maps for release ${release}…`);
    const sentryEnv = {
      ...process.env,
      SENTRY_LOAD_DOTENV: "0",
      SENTRY_AUTH_TOKEN: authToken,
      SENTRY_ORG: org,
      SENTRY_PROJECT: project,
    };
    await run(
      "npx",
      ["sentry-cli", "sourcemaps", "inject", ...ignoreArgs, clientDir],
      { env: sentryEnv },
    );
    await run(
      "npx",
      [
        "sentry-cli",
        "sourcemaps",
        "upload",
        "--release",
        release,
        ...ignoreArgs,
        clientDir,
      ],
      { env: sentryEnv },
    );
    console.log("✓ Sentry source maps uploaded");
  } finally {
    const removed = await deleteSourceMaps(join(webRoot, "build"));
    if (removed > 0) {
      console.log(`✓ Removed ${removed} source map(s) before deploy`);
    }
  }
}

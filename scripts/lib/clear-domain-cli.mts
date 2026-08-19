import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { assertProductionDatabaseUrl } from "../../infra/lib/production-env.mjs";
import { repairSupabaseDatabaseUrl } from "../../infra/lib/preview-env.mjs";
import { applyEnvFile, readEnvFile } from "../../infra/lib/pr-env.mjs";
import { loadUatDeployEnv } from "../../infra/lib/uat-env.mjs";

import {
  type ClearRunOptions,
  isLocalDatabaseUrl,
  maskDatabaseUrl,
} from "./clear-domain-data.mts";

export type ClearTargetEnv = "local" | "uat" | "prod";

export type ClearScriptAction =
  "policies" | "clients" | "account-managers" | "ar";

const ENV_FILES: Record<ClearTargetEnv, string> = {
  local: ".env",
  uat: ".env.uat",
  prod: ".env.production",
};

export function readFlag(name: string): boolean {
  return process.argv.includes(name);
}

export function readOption(name: string): string | undefined {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length).trim() || undefined;
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1]?.trim() || undefined;
  return undefined;
}

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function parseTargetEnv(): ClearTargetEnv | undefined {
  const value = readOption("--env")?.toLowerCase();
  if (value === "local" || value === "uat" || value === "prod") return value;
  return undefined;
}

export async function loadClearTargetEnv(
  target: ClearTargetEnv,
): Promise<string> {
  if (target === "uat") {
    await loadUatDeployEnv();
  } else {
    const env = await readEnvFile(ENV_FILES[target]);
    applyEnvFile(env);

    const databaseUrl = env.DATABASE_URL?.trim();
    if (!databaseUrl) {
      throw new Error(`DATABASE_URL is required in ${ENV_FILES[target]}.`);
    }

    process.env.DATABASE_URL =
      target === "prod" && env.SUPABASE_URL?.trim()
        ? repairSupabaseDatabaseUrl(databaseUrl, env.SUPABASE_URL)
        : databaseUrl;

    if (target === "local") {
      if (!isLocalDatabaseUrl(process.env.DATABASE_URL)) {
        throw new Error(
          `--env=local requires DATABASE_URL in ${ENV_FILES.local} to point at localhost.`,
        );
      }
    } else {
      assertProductionDatabaseUrl(process.env.DATABASE_URL);
    }
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error(
      `DATABASE_URL is missing after loading ${ENV_FILES[target]}.`,
    );
  }

  if (target === "local" && !isLocalDatabaseUrl(databaseUrl)) {
    throw new Error(`--env=local requires DATABASE_URL to point at localhost.`);
  }
  if (target !== "local" && isLocalDatabaseUrl(databaseUrl)) {
    throw new Error(`--env=${target} must not use a localhost DATABASE_URL.`);
  }

  return databaseUrl;
}

async function askConfirm(prompt: string): Promise<boolean> {
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(prompt);
    return answer.trim().toLowerCase() === "yes";
  } finally {
    rl.close();
  }
}

function readClearRunOptions(): ClearRunOptions {
  const clientId = readOption("--client-id");
  const id = parsePositiveInteger(readOption("--id"));
  return { clientId, id };
}

function formatClearSummary(
  action: ClearScriptAction,
  summary: unknown,
  options: ClearRunOptions,
): string {
  if (action === "policies") {
    const typed = summary as { policiesRemoved: number };
    return options.clientId
      ? `${typed.policiesRemoved} polic(y/ies) for client ${options.clientId}`
      : `${typed.policiesRemoved} polic(y/ies) (all clients)`;
  }

  if (action === "clients") {
    const typed = summary as {
      policiesRemoved: number;
      clientsRemoved: number;
    };
    return options.clientId
      ? `client ${options.clientId} and ${typed.policiesRemoved} polic(y/ies)`
      : `${typed.clientsRemoved} client(s) and ${typed.policiesRemoved} polic(y/ies)`;
  }

  if (action === "account-managers") {
    const typed = summary as {
      accountManagersRemoved: number;
      clientsRemoved: number;
      policiesRemoved: number;
    };
    const scope = options.id
      ? `account manager ${options.id}`
      : `${typed.accountManagersRemoved} account manager(s)`;
    if (options.id) return scope;
    return `${scope}, ${typed.clientsRemoved} client(s), and ${typed.policiesRemoved} polic(y/ies)`;
  }

  const typed = summary as {
    authorisedRepresentativesRemoved: number;
    appUsersUnlinked: number;
    clientsWithOrphanedAr: number;
  };
  const scope = options.id
    ? `authorised representative ${options.id}`
    : `${typed.authorisedRepresentativesRemoved} authorised representative(s)`;
  const extras = [
    `${typed.appUsersUnlinked} app user link(s) cleared`,
    `${typed.clientsWithOrphanedAr} client(s) left with stale AR references`,
  ];
  return options.id
    ? `${scope} (${extras.join("; ")})`
    : `${scope} (${extras.join("; ")})`;
}

function missingEnvHelp(action: ClearScriptAction): string {
  const examples: Record<ClearScriptAction, string> = {
    policies: "npm run db:clear:policies -- --env=local",
    clients: "npm run db:clear:clients -- --env=uat --dry-run",
    "account-managers":
      "npm run db:clear:account-managers -- --env=local --dry-run",
    ar: "npm run db:clear:ar -- --env=local",
  };
  return "Missing required --env=local|uat|prod.\n" + `  ${examples[action]}`;
}

export async function runClearDomainScript<TSummary>(options: {
  action: ClearScriptAction;
  clearFn: (opts: ClearRunOptions) => Promise<TSummary>;
}) {
  const targetEnv = parseTargetEnv();
  if (!targetEnv) {
    console.error(missingEnvHelp(options.action));
    process.exit(1);
  }

  const dryRun = readFlag("--dry-run");
  const confirmFlag = readFlag("--confirm");
  const runOptions = readClearRunOptions();

  const databaseUrl = await loadClearTargetEnv(targetEnv);
  const preview = await options.clearFn({ ...runOptions, dryRun: true });

  console.log(`Environment: ${targetEnv}`);
  console.log(`Database: ${maskDatabaseUrl(databaseUrl)}`);

  const previewText = formatClearSummary(options.action, preview, runOptions);
  const verb = options.action === "ar" ? "clear" : "delete";

  if (dryRun) {
    console.log(`Would ${verb} ${previewText}.`);
    return;
  }

  console.log(`About to ${verb} ${previewText}.`);

  if (targetEnv === "prod") {
    console.warn("⚠️  Production database — this cannot be undone.");
  }

  if (options.action === "account-managers" && !runOptions.id) {
    console.warn(
      "⚠️  Full account-manager wipe cascades to all clients and policies.",
    );
  }

  if (options.action === "ar" && !runOptions.id) {
    console.warn(
      "⚠️  Clients keep stale authorised_representative_id values until re-seeded.",
    );
  }

  if (!confirmFlag) {
    const confirmed = await askConfirm('Type "yes" to continue: ');
    if (!confirmed) {
      console.log("Aborted.");
      process.exit(1);
    }
  }

  const summary = await options.clearFn({ ...runOptions, dryRun: false });
  console.log(
    `${options.action === "ar" ? "Cleared" : "Deleted"} ${formatClearSummary(options.action, summary, runOptions)}.`,
  );
}

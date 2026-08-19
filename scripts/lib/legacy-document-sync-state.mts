/**
 * Checkpoint file for resumable legacy policy document migration.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

export const DEFAULT_SYNC_STATE_PATH = join(
  repoRoot,
  "_archive/data/legacy-documents-sync-state.json",
);

export type LegacyDocumentSyncState = {
  version: 1;
  env: string;
  exportPath: string;
  exportExportedAt: string | null;
  completedDocumentIds: number[];
  missingDocumentIds: number[];
  stats: {
    uploaded: number;
    missing: number;
    postgresUpdated: number;
  };
  updatedAt: string;
};

export function emptySyncState(options: {
  env: string;
  exportPath: string;
  exportExportedAt?: string | null;
}): LegacyDocumentSyncState {
  return {
    version: 1,
    env: options.env,
    exportPath: options.exportPath,
    exportExportedAt: options.exportExportedAt ?? null,
    completedDocumentIds: [],
    missingDocumentIds: [],
    stats: {
      uploaded: 0,
      missing: 0,
      postgresUpdated: 0,
    },
    updatedAt: new Date().toISOString(),
  };
}

export function loadSyncState(
  path: string = DEFAULT_SYNC_STATE_PATH,
): LegacyDocumentSyncState | null {
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw) as LegacyDocumentSyncState;
  if (parsed.version !== 1) {
    throw new Error(
      `Unsupported document sync state version: ${parsed.version}`,
    );
  }
  return parsed;
}

export function saveSyncState(
  state: LegacyDocumentSyncState,
  path: string = DEFAULT_SYNC_STATE_PATH,
): void {
  mkdirSync(dirname(path), { recursive: true });
  state.updatedAt = new Date().toISOString();
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function clearSyncStateFile(
  path: string = DEFAULT_SYNC_STATE_PATH,
): boolean {
  if (!existsSync(path)) return false;
  unlinkSync(path);
  return true;
}

export function syncStateSets(state: LegacyDocumentSyncState | null): {
  completed: Set<number>;
  missing: Set<number>;
} {
  return {
    completed: new Set(state?.completedDocumentIds ?? []),
    missing: new Set(state?.missingDocumentIds ?? []),
  };
}

export function assertSyncStateCompatible(
  state: LegacyDocumentSyncState,
  options: {
    env: string;
    exportPath: string;
    exportExportedAt?: string | null;
  },
): void {
  if (state.env !== options.env) {
    throw new Error(
      `Document sync checkpoint is for env=${state.env}, but current run is env=${options.env}. ` +
        "Pass --no-resume to ignore the checkpoint, or --clear-documents to reset.",
    );
  }
  if (state.exportPath !== options.exportPath) {
    console.warn(
      `Checkpoint export path differs (${state.exportPath} vs ${options.exportPath}). ` +
        "Continuing with current export; already-completed IDs are still skipped.",
    );
  }
  if (
    options.exportExportedAt &&
    state.exportExportedAt &&
    state.exportExportedAt !== options.exportExportedAt
  ) {
    console.warn(
      `Checkpoint export timestamp differs (${state.exportExportedAt} vs ${options.exportExportedAt}). ` +
        "If the export changed materially, pass --clear-documents before re-running.",
    );
  }
}

export function markDocumentCompleted(
  state: LegacyDocumentSyncState,
  policyDocumentId: number,
): void {
  if (!state.completedDocumentIds.includes(policyDocumentId)) {
    state.completedDocumentIds.push(policyDocumentId);
  }
  state.missingDocumentIds = state.missingDocumentIds.filter(
    (id) => id !== policyDocumentId,
  );
  state.stats.uploaded = state.completedDocumentIds.length;
}

export function markDocumentMissing(
  state: LegacyDocumentSyncState,
  policyDocumentId: number,
): void {
  if (!state.missingDocumentIds.includes(policyDocumentId)) {
    state.missingDocumentIds.push(policyDocumentId);
  }
  state.stats.missing = state.missingDocumentIds.length;
}

import { getDb } from "~/lib/db/client";
import { appFeatureFlag } from "~/lib/db/schema";

export const FEATURE_KEYS = [
  "audit_log",
  "prices",
  "email_templates",
  "library_documents",
  "document_templates",
  "additional_wording",
  "account_managers",
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type FeatureFlag = {
  key: FeatureKey;
  label: string;
  description: string;
  enabled: boolean;
};

const FEATURE_CATALOGUE: Record<
  FeatureKey,
  { label: string; description: string; defaultEnabled: boolean }
> = {
  audit_log: {
    label: "Audit Log",
    description:
      "When disabled, the Audit Log is hidden from everyone except super-admins.",
    defaultEnabled: true,
  },
  prices: {
    label: "Prices",
    description:
      "When disabled, the Prices catalogue is hidden from everyone except super-admins.",
    defaultEnabled: true,
  },
  email_templates: {
    label: "Email Templates",
    description:
      "When disabled, Email Templates is hidden from everyone except super-admins.",
    defaultEnabled: true,
  },
  library_documents: {
    label: "Library Documents",
    description:
      "When disabled, Library Documents is hidden from everyone except super-admins.",
    defaultEnabled: true,
  },
  document_templates: {
    label: "Document Templates",
    description:
      "When disabled, Document Templates (PDF editor) is hidden from everyone except super-admins.",
    defaultEnabled: true,
  },
  additional_wording: {
    label: "Additional Wording",
    description:
      "When disabled, Additional Wording settings is hidden from everyone except super-admins.",
    defaultEnabled: true,
  },
  account_managers: {
    label: "Account Managers",
    description:
      "When disabled, Account Managers settings is hidden from everyone except super-admins.",
    defaultEnabled: true,
  },
};

const FEATURE_FLAG_CACHE_TTL_MS = 60_000;

type FeatureFlagCache = {
  expiresAt: number;
  byKey: Map<FeatureKey, boolean>;
};

let featureFlagCache: FeatureFlagCache | null = null;

function invalidateFeatureFlagCache() {
  featureFlagCache = null;
}

async function loadFeatureFlagByKey(): Promise<Map<FeatureKey, boolean>> {
  const now = Date.now();
  if (featureFlagCache && now < featureFlagCache.expiresAt) {
    return featureFlagCache.byKey;
  }

  const db = getDb();
  const rows = await db.select().from(appFeatureFlag);
  const fromDb = new Map(
    rows.map((row) => [row.featureKey as FeatureKey, Boolean(row.enabled)]),
  );

  const byKey = new Map<FeatureKey, boolean>();
  for (const key of FEATURE_KEYS) {
    byKey.set(key, fromDb.get(key) ?? FEATURE_CATALOGUE[key].defaultEnabled);
  }

  featureFlagCache = {
    expiresAt: now + FEATURE_FLAG_CACHE_TTL_MS,
    byKey,
  };
  return byKey;
}

/** All feature on/off states in one cached read (one DB query per TTL window). */
export async function getFeatureFlagStates(): Promise<
  Record<FeatureKey, boolean>
> {
  const byKey = await loadFeatureFlagByKey();
  return Object.fromEntries(
    FEATURE_KEYS.map((key) => [key, byKey.get(key)!]),
  ) as Record<FeatureKey, boolean>;
}

export async function listFeatureFlags(): Promise<FeatureFlag[]> {
  const byKey = await loadFeatureFlagByKey();
  return FEATURE_KEYS.map((key) => {
    const meta = FEATURE_CATALOGUE[key];
    return {
      key,
      label: meta.label,
      description: meta.description,
      enabled: byKey.get(key) ?? meta.defaultEnabled,
    };
  });
}

export async function isFeatureEnabled(key: FeatureKey): Promise<boolean> {
  const byKey = await loadFeatureFlagByKey();
  return byKey.get(key) ?? FEATURE_CATALOGUE[key].defaultEnabled;
}

export async function setFeatureEnabled(
  key: FeatureKey,
  enabled: boolean,
  updatedBy = "",
): Promise<FeatureFlag> {
  const db = getDb();
  const meta = FEATURE_CATALOGUE[key];
  await db
    .insert(appFeatureFlag)
    .values({
      featureKey: key,
      enabled,
      updatedWhen: new Date(),
      updatedBy,
    })
    .onConflictDoUpdate({
      target: appFeatureFlag.featureKey,
      set: {
        enabled,
        updatedWhen: new Date(),
        updatedBy,
      },
    });

  invalidateFeatureFlagCache();

  return {
    key,
    label: meta.label,
    description: meta.description,
    enabled,
  };
}

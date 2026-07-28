import { eq } from "drizzle-orm";
import { getDb } from "~/lib/db/client";
import { appFeatureFlag } from "~/lib/db/schema";

export const FEATURE_KEYS = [
  "audit_log",
  "prices",
  "email_templates",
  "library_documents",
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
    label: "Audit log",
    description:
      "When disabled, the Audit log is hidden from everyone except super-admins.",
    defaultEnabled: true,
  },
  prices: {
    label: "Prices",
    description:
      "When disabled, the Prices catalogue is hidden from everyone except super-admins.",
    defaultEnabled: true,
  },
  email_templates: {
    label: "Email templates",
    description:
      "When disabled, Email templates is hidden from everyone except super-admins.",
    defaultEnabled: true,
  },
  library_documents: {
    label: "Library documents",
    description:
      "When disabled, Library documents is hidden from everyone except super-admins.",
    defaultEnabled: true,
  },
};

export async function listFeatureFlags(): Promise<FeatureFlag[]> {
  const db = getDb();
  const rows = await db.select().from(appFeatureFlag);
  const byKey = new Map(rows.map((row) => [row.featureKey, row]));

  return FEATURE_KEYS.map((key) => {
    const meta = FEATURE_CATALOGUE[key];
    const row = byKey.get(key);
    return {
      key,
      label: meta.label,
      description: meta.description,
      enabled: row ? Boolean(row.enabled) : meta.defaultEnabled,
    };
  });
}

export async function isFeatureEnabled(key: FeatureKey): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(appFeatureFlag)
    .where(eq(appFeatureFlag.featureKey, key))
    .limit(1);
  if (!row) return FEATURE_CATALOGUE[key].defaultEnabled;
  return Boolean(row.enabled);
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

  return {
    key,
    label: meta.label,
    description: meta.description,
    enabled,
  };
}

import { useEffect, useRef } from "react";
import { redirect, useFetcher } from "react-router";
import { SlidersHorizontalIcon } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "~/components/layout/app-layout";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { requireAuth } from "~/lib/auth/session.server";
import { isSuperAdmin } from "~/lib/auth/roles";
import { writeAuditLog } from "~/lib/services/audit/service";
import {
  FEATURE_KEYS,
  listFeatureFlags,
  setFeatureEnabled,
  type FeatureFlag,
} from "~/lib/services/feature-flags";
import type { Route } from "./+types/features";
import { pageTitle } from "~/lib/brand";

export function meta() {
  return [{ title: pageTitle("Features") }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const viewer = await requireAuth(request);
  if (!isSuperAdmin(viewer)) {
    throw redirect("/settings");
  }
  return { features: await listFeatureFlags() };
}

export async function action({ request }: Route.ActionArgs) {
  const viewer = await requireAuth(request);
  if (!isSuperAdmin(viewer)) {
    throw redirect("/settings");
  }

  const formData = await request.formData();
  const parsed = z
    .object({
      featureKey: z.enum(FEATURE_KEYS),
      enabled: z.enum(["0", "1"]),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false as const, error: "Unknown feature" };
  }
  const key = parsed.data.featureKey;
  const enabled = parsed.data.enabled === "1";
  const updated = await setFeatureEnabled(key, enabled, viewer.email);
  await writeAuditLog({
    actor: viewer,
    action: "settings.feature_toggle",
    entityType: "feature",
    entityId: key,
    summary: `${enabled ? "Enabled" : "Disabled"} feature ${updated.label}`,
    metadata: { featureKey: key, enabled },
    request,
  });

  return {
    ok: true as const,
    key,
    enabled,
    message: `${updated.label} ${enabled ? "enabled" : "disabled"}`,
  };
}

function FeatureToggleRow({ feature }: { feature: FeatureFlag }) {
  const fetcher = useFetcher<typeof action>();
  const lastToastRef = useRef<unknown>(null);
  const enabled = fetcher.formData
    ? String(fetcher.formData.get("enabled")) === "1"
    : feature.enabled;
  const busy = fetcher.state !== "idle";

  useEffect(() => {
    if (
      fetcher.state !== "idle" ||
      !fetcher.data?.ok ||
      !fetcher.data.message
    ) {
      return;
    }
    if (lastToastRef.current === fetcher.data) return;
    lastToastRef.current = fetcher.data;
    toast.success(fetcher.data.message);
  }, [fetcher.state, fetcher.data]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <SlidersHorizontalIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <CardTitle className="text-base">{feature.label}</CardTitle>
          <CardDescription>{feature.description}</CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Label
            htmlFor={`feature-${feature.key}`}
            className="hidden font-normal sm:inline"
          >
            {enabled ? "Enabled" : "Disabled"}
            {busy ? "…" : ""}
          </Label>
          <Checkbox
            id={`feature-${feature.key}`}
            checked={enabled}
            disabled={busy}
            aria-label={`${feature.label}: ${enabled ? "enabled" : "disabled"}`}
            onCheckedChange={(checked) => {
              fetcher.submit(
                {
                  featureKey: feature.key,
                  enabled: checked === true ? "1" : "0",
                },
                { method: "post" },
              );
            }}
          />
        </div>
      </CardHeader>
    </Card>
  );
}

export default function SettingsFeaturesRoute({
  loaderData,
}: Route.ComponentProps) {
  return (
    <div>
      <PageHeader
        title="Features"
        description="Enable or disable product features."
        breadcrumbs={[
          { label: "Settings", to: "/settings" },
          { label: "Features" },
        ]}
      />

      <div className="flex max-w-2xl flex-col gap-4">
        {loaderData.features.map((feature) => (
          <FeatureToggleRow key={feature.key} feature={feature} />
        ))}
      </div>
    </div>
  );
}

import { redirect, useActionData } from "react-router";
import { PriceEditorDialog } from "~/components/prices/price-editor-dialog";
import { requireSuperAdminPage } from "~/lib/auth/authorize.server";
import { isSuperAdmin } from "~/lib/auth/roles";
import { requireAuth } from "~/lib/auth/session.server";
import { publicErrorMessage } from "~/lib/http/public-error.server";
import {
  createTemplate,
  emptyCatalogue,
  isPriceCatalogueSlug,
  pricesListHref,
  slugLabel,
  slugToKind,
} from "~/lib/pricing/settings-shared";
import { withSuccessToast } from "~/hooks/use-success-toast";
import { writeAuditLog } from "~/lib/services/audit/service";
import {
  createCarSchedule,
  createEslSchedule,
  createFeeSchedule,
  createPlantRate,
  createStampSchedule,
  createTerrorSchedule,
  getPriceCatalogueSnapshot,
  type CarScheduleInput,
  type EslScheduleInput,
  type FeeScheduleInput,
  type PlantRateInput,
  type StampScheduleInput,
  type TerrorScheduleInput,
} from "~/lib/services/price/catalogue.server";
import type { Route } from "./+types/$catalogue.new";
import { pageTitle } from "~/lib/brand";

export function meta({ params }: Route.MetaArgs) {
  const slug = params.catalogue ?? "car-rates";
  const label = isPriceCatalogueSlug(slug) ? slugLabel(slug) : "Prices";
  return [{ title: pageTitle(`New ${label}`) }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const viewer = await requireAuth(request);
  requireSuperAdminPage(viewer);
  const slug = params.catalogue ?? "";
  if (!isPriceCatalogueSlug(slug)) {
    throw redirect("/settings/prices/car-rates");
  }

  let catalogue;
  try {
    catalogue = await getPriceCatalogueSnapshot();
  } catch {
    catalogue = emptyCatalogue();
  }

  const kind = slugToKind(slug);
  return {
    slug,
    kind,
    json: createTemplate(kind, catalogue),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const viewer = await requireAuth(request);
  if (!isSuperAdmin(viewer)) {
    return {
      ok: false as const,
      error: "Only super-admins can change prices.",
    };
  }
  const slug = params.catalogue ?? "";
  if (!isPriceCatalogueSlug(slug)) {
    return { ok: false as const, error: "Unknown catalogue" };
  }
  const kind = slugToKind(slug);
  const createdBy = viewer.email || viewer.fullName || "unknown";
  const formData = await request.formData();
  const raw = String(formData.get("payload") ?? "");
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return { ok: false as const, error: "Invalid payload" };
  }

  try {
    let entityId = 0;
    switch (kind) {
      case "car":
        entityId = await createCarSchedule(
          payload as CarScheduleInput,
          createdBy,
        );
        break;
      case "stamp":
        entityId = await createStampSchedule(
          payload as StampScheduleInput,
          createdBy,
        );
        break;
      case "esl":
        entityId = await createEslSchedule(
          payload as EslScheduleInput,
          createdBy,
        );
        break;
      case "plant":
        entityId = await createPlantRate(payload as PlantRateInput, createdBy);
        break;
      case "terror":
        entityId = await createTerrorSchedule(
          payload as TerrorScheduleInput,
          createdBy,
        );
        break;
      case "fees":
        entityId = await createFeeSchedule(
          payload as FeeScheduleInput,
          createdBy,
        );
        break;
    }
    await writeAuditLog({
      actor: viewer,
      action: "price.create",
      entityType: `price_${kind}`,
      entityId,
      summary: `Created ${slugLabel(slug)} #${entityId}`,
      metadata: { catalogue: kind, id: entityId, payload },
      request,
    });
    throw redirect(
      withSuccessToast(
        pricesListHref(slug),
        `${slugLabel(slug)} #${entityId} added`,
      ),
    );
  } catch (error) {
    if (error instanceof Response) throw error;
    return {
      ok: false as const,
      error: publicErrorMessage(error, {
        fallback: "Create failed",
        operation: "price_catalogue_entry_create",
      }),
    };
  }
}

export default function SettingsPricesNewRoute({
  loaderData,
}: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();
  const { slug, kind, json } = loaderData;

  return (
    <PriceEditorDialog
      title={`New ${slugLabel(slug)}`}
      description="Edit the JSON payload, then save. Prefills from the latest schedule when one exists."
      closeHref={pricesListHref(slug)}
      intent="create"
      catalogue={kind}
      json={json}
      error={actionData && !actionData.ok ? actionData.error : null}
    />
  );
}

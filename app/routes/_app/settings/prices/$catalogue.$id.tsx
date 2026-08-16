import { redirect, useActionData } from "react-router";
import {
  parseScheduleFormData,
  Schedule,
  DeleteDialog,
} from "~/components/prices";
import { requireAuth } from "~/lib/auth/session/server.server";
import { publicErrorMessage } from "~/lib/http/public-error.server";
import {
  booleanFlagSchema,
  parseFormIntent,
  parsePositiveInteger,
} from "~/lib/http/route-input";
import { isSuperAdmin } from "~/lib/auth/roles";
import {
  isPriceCatalogueSlug,
  pricesEditHref,
  pricesItemHref,
  pricesListHref,
  scheduleViewFromSnapshot,
  slugLabel,
  slugToKind,
} from "~/lib/pricing/settings-shared";
import { withSuccessToast } from "~/hooks/utilities";
import { writeAuditLog } from "~/lib/services/audit/service";
import {
  deleteCarSchedule,
  deleteEslSchedule,
  deleteFeeSchedule,
  deletePlantRate,
  deleteStampSchedule,
  deleteTerrorSchedule,
  getPriceCatalogueSnapshot,
  updateCarSchedule,
  updateEslSchedule,
  updateFeeSchedule,
  updatePlantRate,
  updateStampSchedule,
  updateTerrorSchedule,
  type CarScheduleInput,
  type EslScheduleInput,
  type FeeScheduleInput,
  type PlantRateInput,
  type StampScheduleInput,
  type TerrorScheduleInput,
} from "~/lib/services/price/catalogue.server";
import type { Route } from "./+types/$catalogue.$id";
import { pageTitle } from "~/lib/brand";

export function meta({ params }: Route.MetaArgs) {
  const slug = params.catalogue ?? "car-rates";
  const label = isPriceCatalogueSlug(slug) ? slugLabel(slug) : "Prices";
  return [{ title: pageTitle(`${label} #${params.id}`) }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const viewer = await requireAuth(request);
  const slug = params.catalogue ?? "";
  if (!isPriceCatalogueSlug(slug)) {
    throw redirect("/settings/prices/car-rates");
  }
  const id = parsePositiveInteger(params.id);
  if (!id) throw redirect(pricesListHref(slug));

  const catalogue = await getPriceCatalogueSnapshot();
  const kind = slugToKind(slug);
  const schedule = scheduleViewFromSnapshot(kind, catalogue, id);
  if (!schedule) {
    throw new Response(`Price schedule #${id} not found`, { status: 404 });
  }

  const url = new URL(request.url);
  const deleting =
    booleanFlagSchema.parse(url.searchParams.get("delete") ?? "0") === "1";
  const editing =
    booleanFlagSchema.parse(url.searchParams.get("edit") ?? "0") === "1";
  const canEdit = isSuperAdmin(viewer);

  if ((editing || deleting) && !canEdit) {
    throw redirect(pricesItemHref(slug, id));
  }

  return {
    slug,
    kind,
    id,
    schedule,
    deleting,
    editing: editing && canEdit,
    canEdit,
    label: `${slugLabel(slug)} #${id}`,
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
  const id = parsePositiveInteger(params.id);
  if (!id) return { ok: false as const, error: "Missing id" };

  const formData = await request.formData();
  const intent = parseFormIntent(formData, ["update", "delete"]);

  if (intent === "delete") {
    try {
      switch (kind) {
        case "car":
          await deleteCarSchedule(id);
          break;
        case "stamp":
          await deleteStampSchedule(id);
          break;
        case "esl":
          await deleteEslSchedule(id);
          break;
        case "plant":
          await deletePlantRate(id);
          break;
        case "terror":
          await deleteTerrorSchedule(id);
          break;
        case "fees":
          await deleteFeeSchedule(id);
          break;
      }
      await writeAuditLog({
        actor: viewer,
        action: "price.delete",
        entityType: `price_${kind}`,
        entityId: id,
        summary: `Deleted ${slugLabel(slug)} #${id}`,
        metadata: { catalogue: kind, id },
        request,
      });
      throw redirect(
        withSuccessToast(
          pricesListHref(slug),
          `${slugLabel(slug)} #${id} deleted`,
        ),
      );
    } catch (error) {
      if (error instanceof Response) throw error;
      return {
        ok: false as const,
        error: publicErrorMessage(error, {
          fallback: "Delete failed",
          operation: "price_catalogue_entry_delete",
        }),
      };
    }
  }

  if (intent !== "update") {
    return { ok: false as const, error: "Unknown action" };
  }

  try {
    const payload = parseScheduleFormData(kind, formData);
    switch (kind) {
      case "car":
        await updateCarSchedule(id, payload as CarScheduleInput);
        break;
      case "stamp":
        await updateStampSchedule(id, payload as StampScheduleInput);
        break;
      case "esl":
        await updateEslSchedule(id, payload as EslScheduleInput);
        break;
      case "plant":
        await updatePlantRate(id, payload as PlantRateInput);
        break;
      case "terror":
        await updateTerrorSchedule(id, payload as TerrorScheduleInput);
        break;
      case "fees":
        await updateFeeSchedule(id, payload as FeeScheduleInput);
        break;
    }
    await writeAuditLog({
      actor: viewer,
      action: "price.update",
      entityType: `price_${kind}`,
      entityId: id,
      summary: `Updated ${slugLabel(slug)} #${id}`,
      metadata: { catalogue: kind, id, payload },
      request,
    });
    throw redirect(
      withSuccessToast(
        `/settings/prices/${slug}/${id}`,
        `${slugLabel(slug)} #${id} updated`,
      ),
    );
  } catch (error) {
    if (error instanceof Response) throw error;
    return {
      ok: false as const,
      error: publicErrorMessage(error, {
        fallback: "Save failed",
        operation: "price_catalogue_entry_save",
      }),
    };
  }
}

export default function SettingsPricesItemRoute({
  loaderData,
}: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();
  const { slug, kind, id, schedule, deleting, editing, canEdit, label } =
    loaderData;
  const error = actionData && !actionData.ok ? actionData.error : null;

  if (deleting) {
    return (
      <DeleteDialog
        label={label}
        closeHref={pricesItemHref(slug, id)}
        catalogue={kind}
        id={id}
        error={error}
      />
    );
  }

  return (
    <Schedule
      title={label}
      closeHref={editing ? pricesItemHref(slug, id) : pricesListHref(slug)}
      editHref={pricesEditHref(slug, id)}
      schedule={schedule}
      editing={editing}
      canEdit={canEdit}
      catalogue={kind}
      id={id}
      error={error}
    />
  );
}

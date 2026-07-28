import { redirect, useActionData } from "react-router";
import { parseScheduleFormData } from "~/components/prices/parse-schedule-form-data";
import {
  PriceDeleteDialog,
  PriceScheduleDialog,
} from "~/components/prices/price-schedule-dialog";
import { requireAuth } from "~/lib/auth/session.server";
import { isSuperAdmin } from "~/lib/auth/roles";
import {
  isPriceCatalogueSlug,
  pricesEditHref,
  pricesItemHref,
  pricesListHref,
  scheduleViewFromSnapshot,
  slugLabel,
  slugToKind,
} from "~/lib/prices/settings-shared";
import { withSuccessToast } from "~/hooks/use-success-toast";
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

export function meta({ params }: Route.MetaArgs) {
  const slug = params.catalogue ?? "car-rates";
  const label = isPriceCatalogueSlug(slug) ? slugLabel(slug) : "Prices";
  return [{ title: `${label} #${params.id} | BrokerSure` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const viewer = await requireAuth(request);
  const slug = params.catalogue ?? "";
  if (!isPriceCatalogueSlug(slug)) {
    throw redirect("/settings/prices/car-rates");
  }
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) throw redirect(pricesListHref(slug));

  const catalogue = await getPriceCatalogueSnapshot();
  const kind = slugToKind(slug);
  const schedule = scheduleViewFromSnapshot(kind, catalogue, id);
  if (!schedule) {
    throw new Response(`Price schedule #${id} not found`, { status: 404 });
  }

  const url = new URL(request.url);
  const deleting = url.searchParams.get("delete") === "1";
  const editing = url.searchParams.get("edit") === "1";
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
  const id = Number(params.id);
  if (!id) return { ok: false as const, error: "Missing id" };

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

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
        error: error instanceof Error ? error.message : "Delete failed",
      };
    }
  }

  if (intent !== "update") {
    return { ok: false as const, error: "Unknown action" };
  }

  const payload = parseScheduleFormData(kind, formData);

  try {
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
      error: error instanceof Error ? error.message : "Save failed",
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
      <PriceDeleteDialog
        label={label}
        closeHref={pricesItemHref(slug, id)}
        catalogue={kind}
        id={id}
        error={error}
      />
    );
  }

  return (
    <PriceScheduleDialog
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

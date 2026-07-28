import type { ReactNode } from "react";
import { Outlet, redirect } from "react-router";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { PageHeader } from "~/components/layout/app-layout";
import { SettingsBackLink } from "~/components/layout/settings-back-link";
import { Badge } from "~/components/reui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { requireAuth } from "~/lib/auth/session.server";
import { isSuperAdmin } from "~/lib/auth/roles";
import {
  emptyCatalogue,
  isPriceCatalogueSlug,
  kindToSlug,
  pricesItemHref,
  pricesListHref,
  pricesNewHref,
  slugLabel,
  slugToKind,
  type PriceCatalogueSlug,
  PRICE_CATALOGUE_SLUGS,
} from "~/lib/prices/settings-shared";
import {
  getPriceCatalogueSnapshot,
  type PriceCatalogueSnapshot,
} from "~/lib/services/price";
import { cn, formatCurrency, formatDate, formatNumber } from "~/lib/utils";
import type { Route } from "./+types/$catalogue";

export function meta({ params }: Route.MetaArgs) {
  const slug = params.catalogue ?? "car-rates";
  const label = isPriceCatalogueSlug(slug) ? slugLabel(slug) : "Prices";
  return [{ title: `${label} | BrokerSure` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const viewer = await requireAuth(request);
  const slug = params.catalogue ?? "";
  if (!isPriceCatalogueSlug(slug)) {
    throw redirect("/settings/prices/car-rates");
  }

  let catalogue: PriceCatalogueSnapshot;
  let loadError: string | null = null;
  try {
    catalogue = await getPriceCatalogueSnapshot();
  } catch (error) {
    console.error("settings/prices/$catalogue loader failed", error);
    catalogue = emptyCatalogue();
    loadError =
      error instanceof Error
        ? error.message
        : "Failed to load price catalogues";
  }

  return {
    slug,
    kind: slugToKind(slug),
    catalogue,
    loadError,
    canEdit: isSuperAdmin(viewer),
  };
}

function PublishedBadge({ published }: { published: boolean }) {
  return published ? (
    <Badge variant="success-light" radius="full">
      Published
    </Badge>
  ) : (
    <Badge variant="outline" radius="full">
      Draft
    </Badge>
  );
}

export default function SettingsPricesCatalogueRoute({
  loaderData,
}: Route.ComponentProps) {
  const { slug, catalogue, loadError, canEdit } = loaderData;

  return (
    <div>
      <SettingsBackLink />
      <PageHeader
        title="Prices"
        description={
          canEdit
            ? "Click a row to view rates. Use Edit in the dialog to change values."
            : "Click a row to view rates."
        }
      />

      {loadError ? (
        <p className="mb-4 text-sm text-destructive">{loadError}</p>
      ) : null}

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div
          role="tablist"
          aria-label="Price catalogues"
          className="flex flex-wrap gap-1 border-b border-border pb-px"
        >
          {PRICE_CATALOGUE_SLUGS.map((item) => {
            const href = pricesListHref(item);
            return (
              <a
                key={item}
                href={href}
                role="tab"
                aria-selected={slug === item}
                className={cn(
                  "relative inline-flex items-center px-3 py-1.5 text-sm font-medium transition-colors",
                  slug === item
                    ? "text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {slugLabel(item)}
              </a>
            );
          })}
        </div>
        {canEdit ? (
          <a
            href={pricesNewHref(slug)}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80"
          >
            <PlusIcon className="size-4" />
            Add schedule
          </a>
        ) : null}
      </div>

      <CataloguePanel slug={slug} catalogue={catalogue} canEdit={canEdit} />

      <Outlet />
    </div>
  );
}

function CataloguePanel({
  slug,
  catalogue,
  canEdit,
}: {
  slug: PriceCatalogueSlug;
  catalogue: PriceCatalogueSnapshot;
  canEdit: boolean;
}) {
  switch (slug) {
    case "car-rates":
      return <CarPanel catalogue={catalogue} canEdit={canEdit} />;
    case "stamp-duty":
      return <StampPanel catalogue={catalogue} canEdit={canEdit} />;
    case "esl":
      return <EslPanel catalogue={catalogue} canEdit={canEdit} />;
    case "plant":
      return <PlantPanel catalogue={catalogue} canEdit={canEdit} />;
    case "terrorism":
      return <TerrorPanel catalogue={catalogue} canEdit={canEdit} />;
    case "broker-fees":
      return <FeesPanel catalogue={catalogue} canEdit={canEdit} />;
  }
}

function ClickableScheduleRow({
  href,
  deleteHref,
  canEdit,
  deleteLabel,
  id,
  children,
}: {
  href: string;
  deleteHref: string;
  canEdit: boolean;
  deleteLabel: string;
  id: number;
  children: ReactNode;
}) {
  return (
    <TableRow className="relative hover:bg-muted/50">
      <TableCell className="text-foreground tabular-nums">
        <a
          href={href}
          className="text-foreground before:absolute before:inset-0 before:z-10"
          aria-label={`View schedule ${id}`}
        >
          {id}
        </a>
      </TableCell>
      {children}
      {canEdit ? (
        <TableCell className="relative z-20 w-12 text-right">
          <a
            href={deleteHref}
            aria-label={deleteLabel}
            className="relative z-20 inline-flex size-7 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10"
          >
            <Trash2Icon className="size-4" />
          </a>
        </TableCell>
      ) : null}
    </TableRow>
  );
}

function ListCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">{children}</CardContent>
    </Card>
  );
}

function EmptyCatalogue({ label }: { label: string }) {
  return (
    <p className="py-8 text-center text-sm text-muted-foreground">
      No {label} loaded yet.
    </p>
  );
}

function CarPanel({
  catalogue,
  canEdit,
}: {
  catalogue: PriceCatalogueSnapshot;
  canEdit: boolean;
}) {
  const slug = kindToSlug("car");
  return (
    <ListCard
      title="CAR price schedules"
      description="Click a row to view turnover bands and rates."
    >
      {catalogue.car.length === 0 ? (
        <EmptyCatalogue label="CAR price schedules" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Effective</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Bands</TableHead>
              <TableHead>Created by</TableHead>
              {canEdit ? <TableHead className="w-12" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...catalogue.car]
              .sort((a, b) => b.dateStart.localeCompare(a.dateStart))
              .map((schedule) => (
                <ClickableScheduleRow
                  key={schedule.priceId}
                  id={schedule.priceId}
                  href={pricesItemHref(slug, schedule.priceId)}
                  deleteHref={`${pricesItemHref(slug, schedule.priceId)}?delete=1`}
                  canEdit={canEdit}
                  deleteLabel={`Delete CAR rates #${schedule.priceId}`}
                >
                  <TableCell className="pointer-events-none">
                    {formatDate(schedule.dateStart)}
                  </TableCell>
                  <TableCell className="pointer-events-none">
                    <PublishedBadge published={schedule.published} />
                  </TableCell>
                  <TableCell className="pointer-events-none text-right tabular-nums">
                    {schedule.bands.length}
                  </TableCell>
                  <TableCell className="pointer-events-none text-muted-foreground">
                    {schedule.createdBy || "—"}
                  </TableCell>
                </ClickableScheduleRow>
              ))}
          </TableBody>
        </Table>
      )}
    </ListCard>
  );
}

function StampPanel({
  catalogue,
  canEdit,
}: {
  catalogue: PriceCatalogueSnapshot;
  canEdit: boolean;
}) {
  const slug = kindToSlug("stamp");
  return (
    <ListCard
      title="Stamp duty schedules"
      description="Click a row to view state rates."
    >
      {catalogue.stampDuty.length === 0 ? (
        <EmptyCatalogue label="stamp duty schedules" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Effective</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">States</TableHead>
              {canEdit ? <TableHead className="w-12" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...catalogue.stampDuty]
              .sort((a, b) => b.dateStart.localeCompare(a.dateStart))
              .map((schedule) => (
                <ClickableScheduleRow
                  key={schedule.priceStampDutyId}
                  id={schedule.priceStampDutyId}
                  href={pricesItemHref(slug, schedule.priceStampDutyId)}
                  deleteHref={`${pricesItemHref(slug, schedule.priceStampDutyId)}?delete=1`}
                  canEdit={canEdit}
                  deleteLabel={`Delete stamp duty #${schedule.priceStampDutyId}`}
                >
                  <TableCell className="pointer-events-none">
                    {formatDate(schedule.dateStart)}
                  </TableCell>
                  <TableCell className="pointer-events-none">
                    <PublishedBadge published={schedule.published} />
                  </TableCell>
                  <TableCell className="pointer-events-none text-right tabular-nums">
                    {schedule.rates.length}
                  </TableCell>
                </ClickableScheduleRow>
              ))}
          </TableBody>
        </Table>
      )}
    </ListCard>
  );
}

function EslPanel({
  catalogue,
  canEdit,
}: {
  catalogue: PriceCatalogueSnapshot;
  canEdit: boolean;
}) {
  const slug = kindToSlug("esl");
  return (
    <ListCard
      title="ESL schedules"
      description="Click a row to view ESL rates."
    >
      {catalogue.esl.length === 0 ? (
        <EmptyCatalogue label="ESL schedules" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Effective</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">States</TableHead>
              {canEdit ? <TableHead className="w-12" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...catalogue.esl]
              .sort((a, b) => b.dateStart.localeCompare(a.dateStart))
              .map((schedule) => (
                <ClickableScheduleRow
                  key={schedule.priceEslId}
                  id={schedule.priceEslId}
                  href={pricesItemHref(slug, schedule.priceEslId)}
                  deleteHref={`${pricesItemHref(slug, schedule.priceEslId)}?delete=1`}
                  canEdit={canEdit}
                  deleteLabel={`Delete ESL #${schedule.priceEslId}`}
                >
                  <TableCell className="pointer-events-none">
                    {formatDate(schedule.dateStart)}
                  </TableCell>
                  <TableCell className="pointer-events-none">
                    <PublishedBadge published={schedule.published} />
                  </TableCell>
                  <TableCell className="pointer-events-none text-right tabular-nums">
                    {schedule.rates.length}
                  </TableCell>
                </ClickableScheduleRow>
              ))}
          </TableBody>
        </Table>
      )}
    </ListCard>
  );
}

function PlantPanel({
  catalogue,
  canEdit,
}: {
  catalogue: PriceCatalogueSnapshot;
  canEdit: boolean;
}) {
  const slug = kindToSlug("plant");
  return (
    <ListCard
      title="Plant rates"
      description="Click a row to view plant rates."
    >
      {catalogue.plant.length === 0 ? (
        <EmptyCatalogue label="plant rates" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Effective</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Min</TableHead>
              <TableHead className="text-right">Max</TableHead>
              {canEdit ? <TableHead className="w-12" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...catalogue.plant]
              .sort((a, b) => b.dateStart.localeCompare(a.dateStart))
              .map((row) => (
                <ClickableScheduleRow
                  key={row.pricePlantId}
                  id={row.pricePlantId}
                  href={pricesItemHref(slug, row.pricePlantId)}
                  deleteHref={`${pricesItemHref(slug, row.pricePlantId)}?delete=1`}
                  canEdit={canEdit}
                  deleteLabel={`Delete plant #${row.pricePlantId}`}
                >
                  <TableCell className="pointer-events-none">
                    {formatDate(row.dateStart)}
                  </TableCell>
                  <TableCell className="pointer-events-none">
                    <PublishedBadge published={row.published} />
                  </TableCell>
                  <TableCell className="pointer-events-none text-right tabular-nums">
                    {formatNumber(row.rate)}
                  </TableCell>
                  <TableCell className="pointer-events-none text-right tabular-nums">
                    {formatCurrency(row.plantMinValue)}
                  </TableCell>
                  <TableCell className="pointer-events-none text-right tabular-nums">
                    {formatCurrency(row.plantMaxValue)}
                  </TableCell>
                </ClickableScheduleRow>
              ))}
          </TableBody>
        </Table>
      )}
    </ListCard>
  );
}

function TerrorPanel({
  catalogue,
  canEdit,
}: {
  catalogue: PriceCatalogueSnapshot;
  canEdit: boolean;
}) {
  const slug = kindToSlug("terror");
  return (
    <ListCard
      title="Terrorism schedules"
      description="Click a row to view terrorism tiers."
    >
      {catalogue.terrorism.length === 0 ? (
        <EmptyCatalogue label="terrorism schedules" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Effective</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Tiers</TableHead>
              {canEdit ? <TableHead className="w-12" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...catalogue.terrorism]
              .sort((a, b) => b.dateStart.localeCompare(a.dateStart))
              .map((schedule) => (
                <ClickableScheduleRow
                  key={schedule.priceTerrorismId}
                  id={schedule.priceTerrorismId}
                  href={pricesItemHref(slug, schedule.priceTerrorismId)}
                  deleteHref={`${pricesItemHref(slug, schedule.priceTerrorismId)}?delete=1`}
                  canEdit={canEdit}
                  deleteLabel={`Delete terrorism #${schedule.priceTerrorismId}`}
                >
                  <TableCell className="pointer-events-none">
                    {formatDate(schedule.dateStart)}
                  </TableCell>
                  <TableCell className="pointer-events-none">
                    <PublishedBadge published={schedule.published} />
                  </TableCell>
                  <TableCell className="pointer-events-none text-right tabular-nums">
                    {schedule.tiers.length}
                  </TableCell>
                </ClickableScheduleRow>
              ))}
          </TableBody>
        </Table>
      )}
    </ListCard>
  );
}

function FeesPanel({
  catalogue,
  canEdit,
}: {
  catalogue: PriceCatalogueSnapshot;
  canEdit: boolean;
}) {
  const slug = kindToSlug("fees");
  return (
    <ListCard
      title="Broker fee schedules"
      description="Click a row to view fee lines."
    >
      {catalogue.brokerFees.length === 0 ? (
        <EmptyCatalogue label="broker fee schedules" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Effective</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Lines</TableHead>
              {canEdit ? <TableHead className="w-12" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...catalogue.brokerFees]
              .sort((a, b) => b.dateStart.localeCompare(a.dateStart))
              .map((schedule) => (
                <ClickableScheduleRow
                  key={schedule.brokerFeeScheduleId}
                  id={schedule.brokerFeeScheduleId}
                  href={pricesItemHref(slug, schedule.brokerFeeScheduleId)}
                  deleteHref={`${pricesItemHref(slug, schedule.brokerFeeScheduleId)}?delete=1`}
                  canEdit={canEdit}
                  deleteLabel={`Delete fee schedule #${schedule.brokerFeeScheduleId}`}
                >
                  <TableCell className="pointer-events-none">
                    {formatDate(schedule.dateStart)}
                  </TableCell>
                  <TableCell className="pointer-events-none">
                    <PublishedBadge published={schedule.published} />
                  </TableCell>
                  <TableCell className="pointer-events-none text-right tabular-nums">
                    {schedule.lines.length}
                  </TableCell>
                </ClickableScheduleRow>
              ))}
          </TableBody>
        </Table>
      )}
    </ListCard>
  );
}

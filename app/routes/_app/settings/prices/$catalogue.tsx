import type { ReactNode } from "react";
import { Link, Outlet, redirect, useNavigate } from "react-router";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { PageHeader } from "~/components/layout/app-layout";
import { Badge } from "~/components/reui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  InteractiveTableActionsCell,
  InteractiveTableRow,
} from "~/components/ui/interactive-table-row";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { requireAuth } from "~/lib/auth/session.server";
import { publicErrorMessage } from "~/lib/http/public-error.server";
import { isSuperAdmin } from "~/lib/auth/roles";
import {
  emptyCatalogue,
  isPriceCatalogueSlug,
  kindToSlug,
  pricesDeleteHref,
  pricesItemHref,
  pricesListHref,
  pricesNewHref,
  slugLabel,
  slugToKind,
  type PriceCatalogueSlug,
  PRICE_CATALOGUE_SLUGS,
} from "~/lib/pricing/settings-shared";
import {
  getPriceCatalogueSnapshot,
  type PriceCatalogueSnapshot,
} from "~/lib/services/price/catalogue.server";
import {
  cn,
  formatCurrency,
  formatDate,
  formatNumber,
  formatRate,
} from "~/lib/utils";
import type { Route } from "./+types/$catalogue";
import { pageTitle } from "~/lib/brand";

export function meta({ params }: Route.MetaArgs) {
  const slug = params.catalogue ?? "car-rates";
  const label = isPriceCatalogueSlug(slug) ? slugLabel(slug) : "Prices";
  return [{ title: pageTitle(`${label}`) }];
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
    catalogue = emptyCatalogue();
    loadError = publicErrorMessage(error, {
      fallback: "Failed to load price catalogues",
      operation: "price_catalogue_load",
    });
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
      <PageHeader
        title="Prices"
        description={
          canEdit
            ? "Schedules are stored in Postgres. Click a row to view rates; use Edit to change values."
            : "Schedules are stored in Postgres. Click a row to view rates."
        }
        breadcrumbs={[
          { label: "Settings", to: "/settings" },
          { label: "Prices" },
        ]}
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
              <Link
                key={item}
                to={href}
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
              </Link>
            );
          })}
        </div>
        {canEdit ? (
          <Link
            to={pricesNewHref(slug)}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80"
          >
            <PlusIcon className="size-4" />
            Add schedule
          </Link>
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
  const navigate = useNavigate();

  return (
    <InteractiveTableRow
      className="hover:bg-muted/50"
      aria-label={`View schedule ${id}`}
      onActivate={() => void navigate(href)}
    >
      <TableCell className="text-foreground tabular-nums">
        <Link
          to={href}
          className="font-medium text-foreground hover:underline"
          aria-label={`View schedule ${id}`}
        >
          {id}
        </Link>
      </TableCell>
      {children}
      {canEdit ? (
        <InteractiveTableActionsCell className="w-12 text-right">
          <Link
            to={deleteHref}
            aria-label={deleteLabel}
            className="inline-flex size-7 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10"
          >
            <Trash2Icon className="size-4" />
          </Link>
        </InteractiveTableActionsCell>
      ) : null}
    </InteractiveTableRow>
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
    <div className="flex flex-col gap-1 py-8 text-center text-sm text-muted-foreground">
      <p>No {label} loaded yet.</p>
      <p>
        Import from legacy MSSQL with{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">
          npm run db:migrate:prices
        </code>
        .
      </p>
    </div>
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
      title="CAR Price Schedules"
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
                  deleteHref={pricesDeleteHref(slug, schedule.priceId)}
                  canEdit={canEdit}
                  deleteLabel={`Delete CAR rates #${schedule.priceId}`}
                >
                  <TableCell>{formatDate(schedule.dateStart)}</TableCell>
                  <TableCell>
                    <PublishedBadge published={schedule.published} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {schedule.bands.length}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
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
      title="Stamp Duty Schedules"
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
                  deleteHref={pricesDeleteHref(slug, schedule.priceStampDutyId)}
                  canEdit={canEdit}
                  deleteLabel={`Delete stamp duty #${schedule.priceStampDutyId}`}
                >
                  <TableCell>{formatDate(schedule.dateStart)}</TableCell>
                  <TableCell>
                    <PublishedBadge published={schedule.published} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
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
      title="ESL Schedules"
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
                  deleteHref={pricesDeleteHref(slug, schedule.priceEslId)}
                  canEdit={canEdit}
                  deleteLabel={`Delete ESL #${schedule.priceEslId}`}
                >
                  <TableCell>{formatDate(schedule.dateStart)}</TableCell>
                  <TableCell>
                    <PublishedBadge published={schedule.published} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
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
      title="Plant Rates"
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
              <TableHead className="text-right">Rate %</TableHead>
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
                  deleteHref={pricesDeleteHref(slug, row.pricePlantId)}
                  canEdit={canEdit}
                  deleteLabel={`Delete plant #${row.pricePlantId}`}
                >
                  <TableCell>{formatDate(row.dateStart)}</TableCell>
                  <TableCell>
                    <PublishedBadge published={row.published} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatRate(row.rate)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(row.plantMinValue)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
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
      title="Terrorism Schedules"
      description="price_terrorism → rates → postcodes with state (legacy CAR_Terrorism*)."
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
              <TableHead>States</TableHead>
              <TableHead className="text-right">Postcodes</TableHead>
              {canEdit ? <TableHead className="w-12" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...catalogue.terrorism]
              .sort((a, b) => b.dateStart.localeCompare(a.dateStart))
              .map((schedule) => {
                const postcodeCount = schedule.tiers.reduce(
                  (sum, tier) => sum + tier.postcodes.length,
                  0,
                );
                const states = [
                  ...new Set(
                    schedule.tiers.flatMap((tier) =>
                      tier.postcodes.map((p) => p.stateCode),
                    ),
                  ),
                ].sort();
                return (
                  <ClickableScheduleRow
                    key={schedule.priceTerrorismId}
                    id={schedule.priceTerrorismId}
                    href={pricesItemHref(slug, schedule.priceTerrorismId)}
                    deleteHref={pricesDeleteHref(
                      slug,
                      schedule.priceTerrorismId,
                    )}
                    canEdit={canEdit}
                    deleteLabel={`Delete terrorism #${schedule.priceTerrorismId}`}
                  >
                    <TableCell>{formatDate(schedule.dateStart)}</TableCell>
                    <TableCell>
                      <PublishedBadge published={schedule.published} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {schedule.tiers.length}
                    </TableCell>
                    <TableCell className="max-w-[12rem] truncate text-muted-foreground">
                      {states.length ? states.join(", ") : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(postcodeCount)}
                    </TableCell>
                  </ClickableScheduleRow>
                );
              })}
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
      title="Broker Fee Schedules"
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
                  deleteHref={pricesDeleteHref(
                    slug,
                    schedule.brokerFeeScheduleId,
                  )}
                  canEdit={canEdit}
                  deleteLabel={`Delete fee schedule #${schedule.brokerFeeScheduleId}`}
                >
                  <TableCell>{formatDate(schedule.dateStart)}</TableCell>
                  <TableCell>
                    <PublishedBadge published={schedule.published} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
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

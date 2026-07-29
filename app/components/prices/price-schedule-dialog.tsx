import { type ReactNode, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Form, useNavigation } from "react-router";
import { XIcon } from "lucide-react";
import { Badge } from "~/components/reui/badge";
import { Field, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { LoadingButton } from "~/components/ui/loading-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import type { PriceCatalogueKind } from "~/lib/services/price";
import {
  cn,
  formatCurrency,
  formatDate,
  formatNumber,
  formatRate,
  rateToPercent,
} from "~/lib/utils";

/** Percent step in the UI (storage remains a decimal fraction). */
const RATE_STEP = "0.0001";
const RATE_FRACTION_DIGITS = 4;

export type CarScheduleView = {
  kind: "car";
  dateStart: string;
  published: boolean;
  createdBy?: string;
  bands: Array<{
    coverTypeId: number;
    coverTypeName: string;
    turnoverMin: number;
    turnoverMax: number | null;
    contractWorksRate: number;
    contractWorksMinPremium: number;
    liability10mRate: number;
    liability10mMinPremium: number;
    liability20mRate: number;
    liability20mMinPremium: number;
  }>;
};

export type StampScheduleView = {
  kind: "stamp";
  dateStart: string;
  published: boolean;
  rates: Array<{ stateCode: string; stateName: string; rate: number }>;
};

export type EslScheduleView = {
  kind: "esl";
  dateStart: string;
  published: boolean;
  rates: Array<{
    stateCode: string;
    stateName: string;
    constructionRate: number;
    plantRate: number;
  }>;
};

export type PlantScheduleView = {
  kind: "plant";
  dateStart: string;
  published: boolean;
  rate: number;
  plantMinValue: number;
  plantMaxValue: number;
};

export type TerrorScheduleView = {
  kind: "terror";
  dateStart: string;
  published: boolean;
  tiers: Array<{
    priceTerrorismRateId: number;
    tier: string;
    rate: number;
    postcodes: Array<{
      postcode: string;
      stateId: number;
      stateCode: string;
      stateName: string;
    }>;
  }>;
};

export type FeesScheduleView = {
  kind: "fees";
  dateStart: string;
  published: boolean;
  lines: Array<{
    sortOrder: number;
    name: string;
    fee: number;
    feeGst: number;
  }>;
};

export type ScheduleView =
  | CarScheduleView
  | StampScheduleView
  | EslScheduleView
  | PlantScheduleView
  | TerrorScheduleView
  | FeesScheduleView;

function CloseControl({
  closeHref,
  onClose,
}: {
  closeHref?: string;
  onClose?: () => void;
}) {
  const className =
    "inline-flex size-7 items-center justify-center rounded-lg hover:bg-muted";
  if (onClose) {
    return (
      <button
        type="button"
        aria-label="Close"
        className={className}
        onClick={onClose}
      >
        <XIcon className="size-4" />
      </button>
    );
  }
  return (
    <a href={closeHref ?? ".."} aria-label="Close" className={className}>
      <XIcon className="size-4" />
    </a>
  );
}

function DialogShell({
  title,
  description,
  closeHref,
  onClose,
  error,
  children,
  footer,
}: {
  title: string;
  description?: string;
  closeHref?: string;
  onClose?: () => void;
  error?: string | null;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const overlay = (
    <div
      className="fixed inset-x-0 top-14 bottom-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="price-schedule-title"
    >
      <div className="my-auto flex max-h-[min(90vh,56rem)] w-full max-w-5xl flex-col gap-4 overflow-y-auto rounded-xl bg-popover p-4 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <h2
              id="price-schedule-title"
              className="font-heading text-base leading-none font-medium"
            >
              {title}
            </h2>
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <CloseControl closeHref={closeHref} onClose={onClose} />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {children}
        {footer ? (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );

  if (typeof document === "undefined") return overlay;
  return createPortal(overlay, document.body);
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

function MetaRow({
  dateStart,
  published,
  createdBy,
  editing,
}: {
  dateStart: string;
  published: boolean;
  createdBy?: string;
  editing: boolean;
}) {
  if (editing) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="dateStart">Effective date</FieldLabel>
          <Input
            id="dateStart"
            name="dateStart"
            type="date"
            defaultValue={dateStart}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="published">Status</FieldLabel>
          <label className="flex h-8 items-center gap-2 text-sm">
            <input
              id="published"
              name="published"
              type="checkbox"
              defaultChecked={published}
              className="size-4 rounded border"
              value="true"
            />
            Published
          </label>
        </Field>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <span>Effective {formatDate(dateStart)}</span>
      <PublishedBadge published={published} />
      {createdBy ? <span>· created by {createdBy}</span> : null}
    </div>
  );
}

function NumInput({
  name,
  defaultValue,
  step = "any",
  fractionDigits,
  suffix,
}: {
  name: string;
  defaultValue: number | "";
  step?: string;
  /** When set, formats the default for display/edit (e.g. rates → 4 d.p.). */
  fractionDigits?: number;
  /** Optional trailing unit (e.g. "%") — display only, not submitted. */
  suffix?: string;
}) {
  const display =
    defaultValue === ""
      ? ""
      : fractionDigits != null
        ? Number(defaultValue).toFixed(fractionDigits)
        : String(defaultValue);

  const input = (
    <Input
      name={name}
      type="number"
      step={step}
      defaultValue={display}
      className={cn("h-7 min-w-20 text-right tabular-nums", suffix && "pr-6")}
      required
    />
  );

  if (!suffix) return input;

  return (
    <div className="relative">
      {input}
      <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-muted-foreground">
        {suffix}
      </span>
    </div>
  );
}

/** Rate editor: value is percent (storage remains a decimal fraction). */
function RatePercentInput({ name, rate }: { name: string; rate: number }) {
  return (
    <NumInput
      name={name}
      defaultValue={rateToPercent(rate)}
      step={RATE_STEP}
      fractionDigits={RATE_FRACTION_DIGITS}
      suffix="%"
    />
  );
}

function FooterButton({
  href,
  onClick,
  className,
  children,
}: {
  href?: string;
  onClick?: () => void;
  className: string;
  children: ReactNode;
}) {
  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {children}
      </button>
    );
  }
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

export function PriceScheduleDialog({
  title,
  closeHref,
  editHref,
  onClose,
  onEdit,
  schedule,
  editing,
  canEdit,
  catalogue,
  id,
  error,
  formAction,
}: {
  title: string;
  closeHref?: string;
  editHref?: string;
  onClose?: () => void;
  onEdit?: () => void;
  schedule: ScheduleView;
  editing: boolean;
  canEdit: boolean;
  catalogue: PriceCatalogueKind;
  id: number;
  error?: string | null;
  /** Where update posts (defaults to current route). */
  formAction?: string;
}) {
  const navigation = useNavigation();
  const saving =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "update";

  const secondaryClass =
    "inline-flex h-8 items-center justify-center rounded-lg border border-foreground/25 bg-background px-2.5 text-sm font-medium hover:bg-muted";
  const primaryClass =
    "inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80";

  const footer = editing ? (
    <>
      <FooterButton
        href={closeHref}
        onClick={onClose}
        className={secondaryClass}
      >
        Cancel
      </FooterButton>
      <LoadingButton
        type="submit"
        form="price-schedule-form"
        loading={saving}
        loadingLabel="Saving…"
      >
        Save
      </LoadingButton>
    </>
  ) : (
    <>
      <FooterButton
        href={closeHref}
        onClick={onClose}
        className={secondaryClass}
      >
        Close
      </FooterButton>
      {canEdit ? (
        <FooterButton href={editHref} onClick={onEdit} className={primaryClass}>
          Edit
        </FooterButton>
      ) : null}
    </>
  );

  return (
    <DialogShell
      title={title}
      closeHref={closeHref}
      onClose={onClose}
      error={error}
      footer={footer}
    >
      {editing ? (
        <Form
          id="price-schedule-form"
          method="post"
          action={formAction}
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="intent" value="update" />
          <input type="hidden" name="catalogue" value={catalogue} />
          <input type="hidden" name="id" value={id} />
          <MetaRow
            dateStart={schedule.dateStart}
            published={schedule.published}
            createdBy={"createdBy" in schedule ? schedule.createdBy : undefined}
            editing
          />
          <ScheduleBody schedule={schedule} editing />
        </Form>
      ) : (
        <div className="flex flex-col gap-4">
          <MetaRow
            dateStart={schedule.dateStart}
            published={schedule.published}
            createdBy={"createdBy" in schedule ? schedule.createdBy : undefined}
            editing={false}
          />
          <ScheduleBody schedule={schedule} editing={false} />
        </div>
      )}
    </DialogShell>
  );
}

function ScheduleBody({
  schedule,
  editing,
}: {
  schedule: ScheduleView;
  editing: boolean;
}) {
  switch (schedule.kind) {
    case "car":
      return <CarBody schedule={schedule} editing={editing} />;
    case "stamp":
      return <StampBody schedule={schedule} editing={editing} />;
    case "esl":
      return <EslBody schedule={schedule} editing={editing} />;
    case "plant":
      return <PlantBody schedule={schedule} editing={editing} />;
    case "terror":
      return <TerrorBody schedule={schedule} editing={editing} />;
    case "fees":
      return <FeesBody schedule={schedule} editing={editing} />;
  }
}

function CarBody({
  schedule,
  editing,
}: {
  schedule: CarScheduleView;
  editing: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <input type="hidden" name="bandCount" value={schedule.bands.length} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cover</TableHead>
            <TableHead>Turnover min</TableHead>
            <TableHead>Turnover max</TableHead>
            <TableHead className="text-right">CW rate %</TableHead>
            <TableHead className="text-right">CW min</TableHead>
            <TableHead className="text-right">$10m rate %</TableHead>
            <TableHead className="text-right">$10m min</TableHead>
            <TableHead className="text-right">$20m rate %</TableHead>
            <TableHead className="text-right">$20m min</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schedule.bands.map((band, index) => (
            <TableRow key={`${band.coverTypeId}-${band.turnoverMin}-${index}`}>
              <TableCell>
                {band.coverTypeName}
                {editing ? (
                  <input
                    type="hidden"
                    name={`band_${index}_coverTypeId`}
                    value={band.coverTypeId}
                  />
                ) : null}
              </TableCell>
              {editing ? (
                <>
                  <TableCell>
                    <NumInput
                      name={`band_${index}_turnoverMin`}
                      defaultValue={band.turnoverMin}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      name={`band_${index}_turnoverMax`}
                      type="number"
                      step="any"
                      defaultValue={
                        band.turnoverMax == null ? "" : String(band.turnoverMax)
                      }
                      placeholder="∞"
                      className="h-7 min-w-20 text-right tabular-nums"
                    />
                  </TableCell>
                  <TableCell>
                    <RatePercentInput
                      name={`band_${index}_contractWorksRatePercent`}
                      rate={band.contractWorksRate}
                    />
                  </TableCell>
                  <TableCell>
                    <NumInput
                      name={`band_${index}_contractWorksMinPremium`}
                      defaultValue={band.contractWorksMinPremium}
                    />
                  </TableCell>
                  <TableCell>
                    <RatePercentInput
                      name={`band_${index}_liability10mRatePercent`}
                      rate={band.liability10mRate}
                    />
                  </TableCell>
                  <TableCell>
                    <NumInput
                      name={`band_${index}_liability10mMinPremium`}
                      defaultValue={band.liability10mMinPremium}
                    />
                  </TableCell>
                  <TableCell>
                    <RatePercentInput
                      name={`band_${index}_liability20mRatePercent`}
                      rate={band.liability20mRate}
                    />
                  </TableCell>
                  <TableCell>
                    <NumInput
                      name={`band_${index}_liability20mMinPremium`}
                      defaultValue={band.liability20mMinPremium}
                    />
                  </TableCell>
                </>
              ) : (
                <>
                  <TableCell className="tabular-nums">
                    {formatCurrency(band.turnoverMin)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {band.turnoverMax == null
                      ? "—"
                      : formatCurrency(band.turnoverMax)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatRate(band.contractWorksRate)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(band.contractWorksMinPremium)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatRate(band.liability10mRate)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(band.liability10mMinPremium)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatRate(band.liability20mRate)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(band.liability20mMinPremium)}
                  </TableCell>
                </>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function StampBody({
  schedule,
  editing,
}: {
  schedule: StampScheduleView;
  editing: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <input type="hidden" name="rateCount" value={schedule.rates.length} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>State</TableHead>
            <TableHead className="text-right">Rate %</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schedule.rates.map((rate, index) => (
            <TableRow key={rate.stateCode}>
              <TableCell>
                {rate.stateCode}
                {rate.stateName ? (
                  <span className="text-muted-foreground">
                    {" "}
                    · {rate.stateName}
                  </span>
                ) : null}
                {editing ? (
                  <input
                    type="hidden"
                    name={`rate_${index}_stateCode`}
                    value={rate.stateCode}
                  />
                ) : null}
              </TableCell>
              <TableCell className="text-right">
                {editing ? (
                  <RatePercentInput
                    name={`rate_${index}_ratePercent`}
                    rate={rate.rate}
                  />
                ) : (
                  <span className="tabular-nums">{formatRate(rate.rate)}</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function EslBody({
  schedule,
  editing,
}: {
  schedule: EslScheduleView;
  editing: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <input type="hidden" name="rateCount" value={schedule.rates.length} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>State</TableHead>
            <TableHead className="text-right">Construction %</TableHead>
            <TableHead className="text-right">Plant %</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schedule.rates.map((rate, index) => (
            <TableRow key={rate.stateCode}>
              <TableCell>
                {rate.stateCode}
                {rate.stateName ? (
                  <span className="text-muted-foreground">
                    {" "}
                    · {rate.stateName}
                  </span>
                ) : null}
                {editing ? (
                  <input
                    type="hidden"
                    name={`rate_${index}_stateCode`}
                    value={rate.stateCode}
                  />
                ) : null}
              </TableCell>
              {editing ? (
                <>
                  <TableCell className="text-right">
                    <RatePercentInput
                      name={`rate_${index}_constructionRatePercent`}
                      rate={rate.constructionRate}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <RatePercentInput
                      name={`rate_${index}_plantRatePercent`}
                      rate={rate.plantRate}
                    />
                  </TableCell>
                </>
              ) : (
                <>
                  <TableCell className="text-right tabular-nums">
                    {formatRate(rate.constructionRate)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatRate(rate.plantRate)}
                  </TableCell>
                </>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function PlantBody({
  schedule,
  editing,
}: {
  schedule: PlantScheduleView;
  editing: boolean;
}) {
  if (editing) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        <Field>
          <FieldLabel htmlFor="ratePercent">Rate %</FieldLabel>
          <RatePercentInput name="ratePercent" rate={schedule.rate} />
        </Field>
        <Field>
          <FieldLabel htmlFor="plantMinValue">Min value</FieldLabel>
          <NumInput
            name="plantMinValue"
            defaultValue={schedule.plantMinValue}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="plantMaxValue">Max value</FieldLabel>
          <NumInput
            name="plantMaxValue"
            defaultValue={schedule.plantMaxValue}
          />
        </Field>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div>
        <p className="text-muted-foreground">Rate %</p>
        <p className="font-medium tabular-nums">{formatRate(schedule.rate)}</p>
      </div>
      <div>
        <p className="text-muted-foreground">Min value</p>
        <p className="font-medium tabular-nums">
          {formatCurrency(schedule.plantMinValue)}
        </p>
      </div>
      <div>
        <p className="text-muted-foreground">Max value</p>
        <p className="font-medium tabular-nums">
          {formatCurrency(schedule.plantMaxValue)}
        </p>
      </div>
    </div>
  );
}

function TerrorBody({
  schedule,
  editing,
}: {
  schedule: TerrorScheduleView;
  editing: boolean;
}) {
  const rateByTier = useMemo(() => {
    const map = new Map<string, number>();
    for (const tier of schedule.tiers) {
      map.set(tier.tier, Number(tier.rate) || 0);
    }
    return map;
  }, [schedule.tiers]);

  const allPostcodes = useMemo(
    () =>
      schedule.tiers.flatMap((tier) =>
        tier.postcodes.map((pc) => ({
          postcode: pc.postcode,
          stateId: pc.stateId,
          stateCode: pc.stateCode,
          stateName: pc.stateName,
          tier: tier.tier,
          priceTerrorismRateId: tier.priceTerrorismRateId,
        })),
      ),
    [schedule.tiers],
  );

  const stateOptions = useMemo(() => {
    const codes = new Set(allPostcodes.map((p) => p.stateCode));
    return [...codes].sort();
  }, [allPostcodes]);

  const [tierFilter, setTierFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [postcodeQuery, setPostcodeQuery] = useState("");

  const filteredPostcodes = useMemo(() => {
    const q = postcodeQuery.trim();
    return allPostcodes.filter((row) => {
      if (tierFilter !== "all" && row.tier !== tierFilter) return false;
      if (stateFilter !== "all" && row.stateCode !== stateFilter) return false;
      if (q && !row.postcode.includes(q)) return false;
      return true;
    });
  }, [allPostcodes, tierFilter, stateFilter, postcodeQuery]);

  const postcodesCsv = useMemo(
    () =>
      allPostcodes
        .map((row) => `${row.postcode},${row.stateCode},${row.tier}`)
        .join("\n"),
    [allPostcodes],
  );

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <div>
          <h3 className="text-sm font-medium">Rates</h3>
          <p className="text-xs text-muted-foreground">
            <code className="text-[0.7rem]">price_terrorism_rate</code> — tier
            and rate
          </p>
        </div>
        <div className="overflow-x-auto">
          <input type="hidden" name="tierCount" value={schedule.tiers.length} />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Rate %</TableHead>
                <TableHead className="text-right">Postcodes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedule.tiers.map((tier, index) => (
                <TableRow key={tier.priceTerrorismRateId || tier.tier}>
                  <TableCell>
                    {editing ? (
                      <Input
                        name={`tier_${index}_tier`}
                        defaultValue={tier.tier}
                        className="h-7"
                        required
                      />
                    ) : (
                      tier.tier
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {editing ? (
                      <RatePercentInput
                        name={`tier_${index}_ratePercent`}
                        rate={tier.rate}
                      />
                    ) : (
                      <span className="tabular-nums">
                        {formatRate(tier.rate)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(tier.postcodes.length)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-2">
        <div>
          <h3 className="text-sm font-medium">Postcodes</h3>
          <p className="text-xs text-muted-foreground">
            <code className="text-[0.7rem]">price_terrorism_postcode</code> —
            postcode, state, and tier
          </p>
        </div>

        {editing ? (
          <Field>
            <FieldLabel htmlFor="postcodesCsv">
              Postcode rows (postcode,state,tier)
            </FieldLabel>
            <textarea
              id="postcodesCsv"
              name="postcodesCsv"
              defaultValue={postcodesCsv}
              rows={12}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground">
              One row per postcode. State must be an AU code (NSW, VIC, …). Tier
              must match a rate tier above.
            </p>
          </Field>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-2">
              <Field className="w-36">
                <FieldLabel htmlFor="terror-tier-filter">Tier</FieldLabel>
                <select
                  id="terror-tier-filter"
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
                  value={tierFilter}
                  onChange={(e) => setTierFilter(e.target.value)}
                >
                  <option value="all">All</option>
                  {schedule.tiers.map((tier) => (
                    <option key={tier.tier} value={tier.tier}>
                      {tier.tier}
                    </option>
                  ))}
                </select>
              </Field>
              <Field className="w-36">
                <FieldLabel htmlFor="terror-state-filter">State</FieldLabel>
                <select
                  id="terror-state-filter"
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
                  value={stateFilter}
                  onChange={(e) => setStateFilter(e.target.value)}
                >
                  <option value="all">All</option>
                  {stateOptions.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </Field>
              <Field className="min-w-[10rem] flex-1">
                <FieldLabel htmlFor="terror-postcode-filter">
                  Postcode
                </FieldLabel>
                <Input
                  id="terror-postcode-filter"
                  value={postcodeQuery}
                  onChange={(e) => setPostcodeQuery(e.target.value)}
                  placeholder="Filter…"
                  className="h-8"
                />
              </Field>
              <p className="pb-2 text-xs text-muted-foreground tabular-nums">
                {formatNumber(filteredPostcodes.length)} /{" "}
                {formatNumber(allPostcodes.length)}
              </p>
            </div>
            <div className="max-h-80 overflow-auto rounded-lg border border-border">
              <table className="w-full table-fixed caption-bottom text-sm">
                <TableHeader className="sticky top-0 z-10 bg-popover [&_tr]:border-b">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[9rem] bg-popover">State</TableHead>
                    <TableHead className="w-[7rem] bg-popover">
                      Postcode
                    </TableHead>
                    <TableHead className="w-[5rem] bg-popover">Tier</TableHead>
                    <TableHead className="w-[7rem] bg-popover text-right">
                      Rate %
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPostcodes.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No postcodes match.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPostcodes.map((row) => (
                      <TableRow
                        key={`${row.priceTerrorismRateId}-${row.postcode}`}
                      >
                        <TableCell>
                          <span className="font-medium">{row.stateCode}</span>
                          {row.stateName ? (
                            <span className="text-muted-foreground">
                              {" "}
                              · {row.stateName}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="font-mono tabular-nums">
                          {row.postcode}
                        </TableCell>
                        <TableCell>{row.tier}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatRate(rateByTier.get(row.tier) ?? 0)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function FeesBody({
  schedule,
  editing,
}: {
  schedule: FeesScheduleView;
  editing: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <input type="hidden" name="lineCount" value={schedule.lines.length} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="text-right">Fee</TableHead>
            <TableHead className="text-right">Fee GST</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schedule.lines.map((line, index) => (
            <TableRow key={line.sortOrder}>
              <TableCell className="tabular-nums">
                {editing ? (
                  <NumInput
                    name={`line_${index}_sortOrder`}
                    defaultValue={line.sortOrder}
                  />
                ) : (
                  line.sortOrder
                )}
              </TableCell>
              <TableCell>
                {editing ? (
                  <Input
                    name={`line_${index}_name`}
                    defaultValue={line.name}
                    className="h-7"
                    required
                  />
                ) : (
                  line.name
                )}
              </TableCell>
              <TableCell className="text-right">
                {editing ? (
                  <NumInput
                    name={`line_${index}_fee`}
                    defaultValue={line.fee}
                  />
                ) : (
                  <span className="tabular-nums">
                    {formatCurrency(line.fee)}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {editing ? (
                  <NumInput
                    name={`line_${index}_feeGst`}
                    defaultValue={line.feeGst}
                  />
                ) : (
                  <span className="tabular-nums">
                    {formatCurrency(line.feeGst)}
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function PriceDeleteDialog({
  label,
  closeHref,
  onClose,
  catalogue,
  id,
  error,
  formAction,
}: {
  label: string;
  closeHref?: string;
  onClose?: () => void;
  catalogue: string;
  id: number;
  error?: string | null;
  formAction?: string;
}) {
  const navigation = useNavigation();
  const deleting =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "delete";

  return (
    <DialogShell
      title="Delete schedule?"
      description={`This permanently removes ${label}. This cannot be undone.`}
      closeHref={closeHref}
      onClose={onClose}
      error={error}
      footer={
        <>
          <FooterButton
            href={closeHref}
            onClick={onClose}
            className="inline-flex h-8 items-center justify-center rounded-lg border border-foreground/25 bg-background px-2.5 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </FooterButton>
          <Form method="post" action={formAction}>
            <input type="hidden" name="intent" value="delete" />
            <input type="hidden" name="catalogue" value={catalogue} />
            <input type="hidden" name="id" value={id} />
            <LoadingButton
              type="submit"
              variant="destructive"
              loading={deleting}
              loadingLabel="Deleting…"
            >
              Delete
            </LoadingButton>
          </Form>
        </>
      }
    >
      {null}
    </DialogShell>
  );
}

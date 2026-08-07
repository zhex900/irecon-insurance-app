import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { XIcon } from "lucide-react";
import { Badge } from "~/components/reui/badge";
import { DateInput } from "~/components/ui/date-input";
import { Field, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { cn, formatDate, rateToPercent } from "~/lib/utils";
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

export function CloseControl({
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

export function DialogShell({
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
  const navigate = useNavigate();

  function dismiss() {
    if (onClose) {
      onClose();
      return;
    }
    void navigate(closeHref ?? "..");
  }

  const overlay = (
    <div
      className="fixed inset-x-0 top-14 bottom-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="price-schedule-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
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
          <CloseControl closeHref={closeHref} onClose={onClose ?? dismiss} />
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

export function PublishedBadge({ published }: { published: boolean }) {
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

export function MetaRow({
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
          <DateInput
            id="dateStart"
            name="dateStart"
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

export function NumInput({
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
export function RatePercentInput({
  name,
  rate,
}: {
  name: string;
  rate: number;
}) {
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

export function FooterButton({
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

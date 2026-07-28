import type { ReactNode } from "react";
import { Form, useNavigate, useNavigation } from "react-router";
import { Badge } from "~/components/reui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
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
import { formatCurrency, formatDate, formatNumber } from "~/lib/utils";

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
  tiers: Array<{ tier: string; rate: number; postcodeCount: number }>;
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

function DialogShell({
  title,
  description,
  closeHref,
  error,
  children,
  footer,
}: {
  title: string;
  description?: string;
  closeHref: string;
  error?: string | null;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) navigate(closeHref);
      }}
    >
      <DialogContent
        className="max-h-[min(90vh,56rem)] w-full overflow-y-auto sm:max-w-5xl"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {children}
        {footer ? (
          <DialogFooter className="border-0 bg-transparent p-0 sm:justify-end">
            {footer}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
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
}: {
  name: string;
  defaultValue: number | "";
  step?: string;
}) {
  return (
    <Input
      name={name}
      type="number"
      step={step}
      defaultValue={defaultValue === "" ? "" : String(defaultValue)}
      className="h-7 min-w-20 text-right tabular-nums"
      required
    />
  );
}

export function PriceScheduleDialog({
  title,
  closeHref,
  editHref,
  schedule,
  editing,
  canEdit,
  catalogue,
  id,
  error,
}: {
  title: string;
  closeHref: string;
  editHref: string;
  schedule: ScheduleView;
  editing: boolean;
  canEdit: boolean;
  catalogue: PriceCatalogueKind;
  id: number;
  error?: string | null;
}) {
  const navigation = useNavigation();
  const saving =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "update";

  const footer = editing ? (
    <>
      <a
        href={closeHref}
        className="inline-flex h-8 items-center justify-center rounded-lg border border-foreground/25 bg-background px-2.5 text-sm font-medium hover:bg-muted"
      >
        Cancel
      </a>
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
      <a
        href={closeHref}
        className="inline-flex h-8 items-center justify-center rounded-lg border border-foreground/25 bg-background px-2.5 text-sm font-medium hover:bg-muted"
      >
        Close
      </a>
      {canEdit ? (
        <a
          href={editHref}
          className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80"
        >
          Edit
        </a>
      ) : null}
    </>
  );

  return (
    <DialogShell
      title={title}
      closeHref={closeHref}
      error={error}
      footer={footer}
    >
      {editing ? (
        <form
          id="price-schedule-form"
          method="post"
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
        </form>
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
            <TableHead className="text-right">CW rate</TableHead>
            <TableHead className="text-right">CW min</TableHead>
            <TableHead className="text-right">$10m rate</TableHead>
            <TableHead className="text-right">$10m min</TableHead>
            <TableHead className="text-right">$20m rate</TableHead>
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
                    <NumInput
                      name={`band_${index}_contractWorksRate`}
                      defaultValue={band.contractWorksRate}
                      step="any"
                    />
                  </TableCell>
                  <TableCell>
                    <NumInput
                      name={`band_${index}_contractWorksMinPremium`}
                      defaultValue={band.contractWorksMinPremium}
                    />
                  </TableCell>
                  <TableCell>
                    <NumInput
                      name={`band_${index}_liability10mRate`}
                      defaultValue={band.liability10mRate}
                      step="any"
                    />
                  </TableCell>
                  <TableCell>
                    <NumInput
                      name={`band_${index}_liability10mMinPremium`}
                      defaultValue={band.liability10mMinPremium}
                    />
                  </TableCell>
                  <TableCell>
                    <NumInput
                      name={`band_${index}_liability20mRate`}
                      defaultValue={band.liability20mRate}
                      step="any"
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
                    {formatNumber(band.contractWorksRate)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(band.contractWorksMinPremium)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(band.liability10mRate)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(band.liability10mMinPremium)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(band.liability20mRate)}
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
            <TableHead className="text-right">Rate</TableHead>
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
                  <NumInput
                    name={`rate_${index}_rate`}
                    defaultValue={rate.rate}
                    step="any"
                  />
                ) : (
                  <span className="tabular-nums">
                    {formatNumber(rate.rate)}
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
            <TableHead className="text-right">Construction</TableHead>
            <TableHead className="text-right">Plant</TableHead>
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
                    <NumInput
                      name={`rate_${index}_constructionRate`}
                      defaultValue={rate.constructionRate}
                      step="any"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <NumInput
                      name={`rate_${index}_plantRate`}
                      defaultValue={rate.plantRate}
                      step="any"
                    />
                  </TableCell>
                </>
              ) : (
                <>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(rate.constructionRate)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(rate.plantRate)}
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
          <FieldLabel htmlFor="rate">Rate</FieldLabel>
          <NumInput name="rate" defaultValue={schedule.rate} step="any" />
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
        <p className="text-muted-foreground">Rate</p>
        <p className="font-medium tabular-nums">
          {formatNumber(schedule.rate)}
        </p>
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
  return (
    <div className="overflow-x-auto">
      <input type="hidden" name="tierCount" value={schedule.tiers.length} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tier</TableHead>
            <TableHead className="text-right">Rate</TableHead>
            <TableHead className="text-right">Postcodes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schedule.tiers.map((tier, index) => (
            <TableRow key={tier.tier}>
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
                  <NumInput
                    name={`tier_${index}_rate`}
                    defaultValue={tier.rate}
                    step="any"
                  />
                ) : (
                  <span className="tabular-nums">
                    {formatNumber(tier.rate)}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNumber(tier.postcodeCount)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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
  catalogue,
  id,
  error,
}: {
  label: string;
  closeHref: string;
  catalogue: string;
  id: number;
  error?: string | null;
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
      error={error}
      footer={
        <>
          <a
            href={closeHref}
            className="inline-flex h-8 items-center justify-center rounded-lg border border-foreground/25 bg-background px-2.5 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </a>
          <Form method="post">
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

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Form, Link, useFetcher, useNavigation } from "react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Controller,
  FormProvider,
  useForm,
  type Resolver,
} from "react-hook-form";
import { ChevronDownIcon } from "lucide-react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { LoadingButton } from "~/components/ui/loading-button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { Field, FieldError, FieldLabel } from "~/components/ui/field";
import { FieldInput } from "~/components/ui/form-controls";
import { FormulaTooltip } from "~/components/ui/formula-tooltip";
import type {
  AdjustmentBreakdown,
  AdjustmentSectionRow,
  Policy,
} from "~/lib/db/types";
import {
  flattenFieldErrors,
  focusFormIssue,
  orderFormIssues,
} from "~/lib/form-validation-ui";
import {
  carAdjustmentInputSchema,
  type CarAdjustmentInput,
} from "~/lib/zod/policy-adjustment";
import { cn, formatCurrency } from "~/lib/utils";

function AdjustmentTurnoverFormula() {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-medium">Absolute premiums at adjusted turnover</p>
      <pre className="font-mono text-[11px] whitespace-pre-wrap opacity-80">{`AdS1_Base = max(T_adj × r₁, m₁)
AdS2_Base = max(T_adj × r₂, m₂)
AdS1_Terror = AdS1_Base × τ
AdS1_ESL = (AdS1_Base + AdS1_Terror) × e
Ad_GST / Ad_SD from base + terror + ESL
Gross = Base + Terror + ESL + GST + SD`}</pre>
      <p className="opacity-80">
        Not the invoice delta — full premium as if rated on the adjusted
        turnover (uses frozen rates from the original policy).
      </p>
    </div>
  );
}

function TotalAdjustmentPremiumFormula() {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-medium">Premium difference vs original (delta)</p>
      <pre className="font-mono text-[11px] whitespace-pre-wrap opacity-80">{`if Ad_Base < Orig_Base and cut > 25%:
  Δ_Base = −(Orig_Base × 0.25)
else:
  Δ_Base = Ad_Base − Orig_Base

Δ_Terror / Δ_ESL / Δ_GST / Δ_SD
  recalculated on Δ_Base

Total = ΔS1_Gross + ΔS2_Gross`}</pre>
      <p className="opacity-80">
        The 25% cap is on original{" "}
        <span className="font-medium">base premium</span>
        refund, not on turnover. Finish also blocks refunds over 75% of original
        combined premium.
      </p>
    </div>
  );
}

const steps = ["Policy Information", "Pricing Information"] as const;

type ActionData = {
  breakdown?: AdjustmentBreakdown;
  formError?: string;
  errors?: Record<string, string[] | undefined>;
};

export function CarAdjustmentWizard({
  policy,
  initialBreakdown,
}: {
  policy: Policy;
  initialBreakdown?: AdjustmentBreakdown;
}) {
  const [step, setStep] = useState(0);
  const fetcher = useFetcher<ActionData>();

  const form = useForm<CarAdjustmentInput>({
    resolver: zodResolver(
      carAdjustmentInputSchema,
    ) as Resolver<CarAdjustmentInput>,
    defaultValues: {
      adjustmentTurnover:
        policy.car.adjustment?.adjustedTurnover ?? policy.car.estimatedTurnover,
      stampDutyExempt: policy.car.adjustment?.stampDutyExempt ? "yes" : "no",
    },
  });

  const breakdown = fetcher.data?.breakdown ?? initialBreakdown;
  const navigation = useNavigation();
  const isCalculating = fetcher.state !== "idle";
  const isFinishing =
    navigation.state !== "idle" &&
    navigation.formData?.get("intent") === "finish";

  const lastBreakdownRef = useRef(fetcher.data?.breakdown);
  useEffect(() => {
    if (lastBreakdownRef.current === fetcher.data?.breakdown) return;
    lastBreakdownRef.current = fetcher.data?.breakdown;
    if (!lastBreakdownRef.current) return;
    setStep(1);
  }, [fetcher.data?.breakdown]);

  async function goNext() {
    const valid = await form.trigger();
    if (!valid) {
      const issues = orderFormIssues(
        flattenFieldErrors(form.formState.errors),
        ["adjustmentTurnover", "stampDutyExempt"],
      );
      const first = issues[0];
      if (first) focusFormIssue(form.setFocus, first.path);
      return;
    }

    const body = new FormData();
    body.set("intent", "calculate");
    body.set("payload", JSON.stringify(form.getValues()));
    fetcher.submit(body, { method: "post" });
  }

  return (
    <FormProvider {...form}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          {steps.map((label, index) => (
            <span
              key={label}
              className={cn(
                "rounded-full px-3 py-1 text-sm",
                index === step
                  ? "bg-primary text-primary-foreground"
                  : index < step
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {index + 1}. {label}
            </span>
          ))}
        </div>

        {fetcher.data?.formError ? (
          <Alert variant="destructive">
            <AlertDescription>{fetcher.data.formError}</AlertDescription>
          </Alert>
        ) : null}

        {step === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>End of Term Adjustment</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:max-w-lg">
              <FieldInput
                label="Adjustment Turnover"
                name="adjustmentTurnover"
                type="text"
                inputMode="decimal"
                prefix="$"
                error={form.formState.errors.adjustmentTurnover?.message}
              />
              <Controller
                control={form.control}
                name="stampDutyExempt"
                render={({ field }) => (
                  <Field
                    orientation="horizontal"
                    data-invalid={
                      form.formState.errors.stampDutyExempt ? true : undefined
                    }
                  >
                    <Checkbox
                      id="stampDutyExempt"
                      ref={field.ref}
                      checked={field.value === "yes"}
                      onCheckedChange={(checked) =>
                        field.onChange(checked === true ? "yes" : "no")
                      }
                      onBlur={field.onBlur}
                      aria-invalid={!!form.formState.errors.stampDutyExempt}
                    />
                    <FieldLabel
                      htmlFor="stampDutyExempt"
                      className="font-normal"
                    >
                      Stamp Duty Exempt
                    </FieldLabel>
                    {form.formState.errors.stampDutyExempt?.message ? (
                      <FieldError>
                        {form.formState.errors.stampDutyExempt.message}
                      </FieldError>
                    ) : null}
                  </Field>
                )}
              />
            </CardContent>
          </Card>
        ) : null}

        {step === 1 && breakdown ? (
          <AdjustmentPricingTables breakdown={breakdown} />
        ) : step === 1 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              {isCalculating
                ? "Calculating adjustment premiums…"
                : "Complete step 1 and continue to see pricing."}
            </CardContent>
          </Card>
        ) : null}

        <div className="flex flex-wrap gap-3">
          {step > 0 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(step - 1)}
            >
              Back
            </Button>
          ) : null}

          {step === 0 ? (
            <LoadingButton
              type="button"
              onClick={goNext}
              loading={isCalculating}
              loadingLabel="Calculating…"
            >
              Next
            </LoadingButton>
          ) : null}

          {step === 1 && breakdown ? (
            <Form method="post">
              <input type="hidden" name="intent" value="finish" />
              <input
                type="hidden"
                name="payload"
                value={JSON.stringify(form.getValues())}
              />
              <LoadingButton
                type="submit"
                loading={isFinishing}
                loadingLabel="Finishing…"
              >
                Finish
              </LoadingButton>
            </Form>
          ) : null}

          <Link
            to={`/policies/${policy.policyId}`}
            className="inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </Link>
        </div>
      </div>
    </FormProvider>
  );
}

export function AdjustmentPricingTables({
  breakdown,
}: {
  breakdown: AdjustmentBreakdown;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Pricing information</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <p className="text-sm text-muted-foreground">
            Original Turnover: {formatCurrency(breakdown.originalTurnover)}
          </p>
          <AdjustmentTable
            title="Original"
            section1={breakdown.original.section1}
            section2={breakdown.original.section2}
            total={breakdown.original.total}
          />
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <span>
              Adjustment Turnover:{" "}
              {formatCurrency(breakdown.adjustmentTurnover)}
            </span>
            <FormulaTooltip label="How Adjustment Turnover premiums are calculated">
              <AdjustmentTurnoverFormula />
            </FormulaTooltip>
          </p>
          <AdjustmentTable
            title="Adjustment"
            section1={breakdown.adjustment.section1}
            section2={breakdown.adjustment.section2}
            total={breakdown.adjustment.total}
          />
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">
              Total Adjustment Premium
            </p>
            <FormulaTooltip label="How Total Adjustment Premium is calculated">
              <TotalAdjustmentPremiumFormula />
            </FormulaTooltip>
          </div>
          <AdjustmentTable
            title=""
            section1={breakdown.delta.section1}
            section2={breakdown.delta.section2}
            total={breakdown.delta.total}
          />
          <p className="text-sm font-medium text-muted-foreground uppercase">
            All policies are subject to a minimum premium of 75% of original
            estimated premium paid
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/** Legacy CARViewPolicy: tables under Premium Breakdown when Adjusted. */
export function PolicyViewAdjustmentCards({
  breakdown,
}: {
  breakdown: AdjustmentBreakdown;
}) {
  return (
    <div className="flex flex-col gap-6">
      <AdjustmentCollapsibleCard
        title="Adjustment Turnover"
        formulaLabel="How Adjustment Turnover premiums are calculated"
        formula={<AdjustmentTurnoverFormula />}
      >
        <p className="text-sm text-muted-foreground">
          Adjusted turnover: {formatCurrency(breakdown.adjustmentTurnover)}
        </p>
        <AdjustmentTable
          title=""
          section1={breakdown.adjustment.section1}
          section2={breakdown.adjustment.section2}
          total={breakdown.adjustment.total}
        />
      </AdjustmentCollapsibleCard>

      <AdjustmentCollapsibleCard
        title="Total Adjustment Premium"
        formulaLabel="How Total Adjustment Premium is calculated"
        formula={<TotalAdjustmentPremiumFormula />}
      >
        <AdjustmentTable
          title=""
          section1={breakdown.delta.section1}
          section2={breakdown.delta.section2}
          total={breakdown.delta.total}
        />
      </AdjustmentCollapsibleCard>
    </div>
  );
}

/**
 * Collapsed by default. Trigger is not a native <button> so expand/collapse
 * still works inside the Taken/view-only disabled fieldset.
 */
function AdjustmentCollapsibleCard({
  title,
  formulaLabel,
  formula,
  children,
}: {
  title: string;
  formulaLabel: string;
  formula: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CardHeader className="border-b p-0">
          <CollapsibleTrigger
            nativeButton={false}
            render={<div />}
            className="flex w-full cursor-pointer items-center justify-between gap-3 px-(--card-spacing) py-(--card-spacing) text-left transition-colors outline-none hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
            aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
          >
            <CardTitle className="flex min-w-0 items-center gap-2">
              {title}
              <span
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onKeyDown={(event) => {
                  event.stopPropagation();
                }}
              >
                <FormulaTooltip label={formulaLabel}>{formula}</FormulaTooltip>
              </span>
            </CardTitle>
            <ChevronDownIcon
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                open && "rotate-180",
              )}
            />
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsiblePanel>
          <CardContent className="flex flex-col gap-3 pt-(--card-spacing) pb-(--card-spacing)">
            {children}
          </CardContent>
        </CollapsiblePanel>
      </Card>
    </Collapsible>
  );
}

function AdjustmentTable({
  title,
  section1,
  section2,
  total,
}: {
  title: string;
  section1: AdjustmentSectionRow;
  section2: AdjustmentSectionRow;
  total: AdjustmentSectionRow;
}) {
  return (
    <div className="overflow-x-auto">
      {title ? (
        <p className="mb-2 text-sm font-semibold text-foreground">{title}</p>
      ) : null}
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="py-2 pr-4">Cover</th>
            <th className="py-2 pr-4">Total Premium</th>
            <th className="py-2 pr-4">True Base Premium</th>
            <th className="py-2 pr-4">Terrorism Levy</th>
            <th className="py-2 pr-4">ESL</th>
            <th className="py-2 pr-4">GST</th>
            <th className="py-2">Stamp Duty</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          <AdjustmentRow label="Contract Works" row={section1} />
          <AdjustmentRow label="Legal Liability" row={section2} />
          <AdjustmentRow label="TOTAL" row={total} strong />
        </tbody>
      </table>
    </div>
  );
}

function AdjustmentRow({
  label,
  row,
  strong = false,
}: {
  label: string;
  row: AdjustmentSectionRow;
  strong?: boolean;
}) {
  const cellClass = strong ? "py-2 pr-4 font-semibold" : "py-2 pr-4";
  return (
    <tr>
      <td className={cellClass}>{label}</td>
      <td className={cellClass}>{formatCurrency(row.totalPremium)}</td>
      <td className={cellClass}>{formatCurrency(row.trueBasePremium)}</td>
      <td className={cellClass}>{formatCurrency(row.terrorismPremium)}</td>
      <td className={cellClass}>{formatCurrency(row.esl)}</td>
      <td className={cellClass}>{formatCurrency(row.gst)}</td>
      <td className={cellClass}>{formatCurrency(row.sd)}</td>
    </tr>
  );
}

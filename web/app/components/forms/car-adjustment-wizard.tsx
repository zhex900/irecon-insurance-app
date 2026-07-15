import { useEffect, useState } from "react";
import { Form, Link, useFetcher } from "react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { FieldInput } from "~/components/ui/field";
import { Select } from "~/components/ui/select";
import type { AdjustmentBreakdown, AdjustmentSectionRow, Quote } from "~/lib/db/types";
import {
  carAdjustmentInputSchema,
  type CarAdjustmentInput,
} from "~/lib/zod/policy-adjustment";
import { formatCurrency } from "~/lib/utils";

const steps = ["Policy Information", "Pricing Confirmation"] as const;

type ActionData = {
  breakdown?: AdjustmentBreakdown;
  formError?: string;
  errors?: Record<string, string[] | undefined>;
};

export function CarAdjustmentWizard({
  quote,
  initialBreakdown,
}: {
  quote: Quote;
  initialBreakdown?: AdjustmentBreakdown;
}) {
  const [step, setStep] = useState(initialBreakdown ? 1 : 0);
  const fetcher = useFetcher<ActionData>();

  const form = useForm<CarAdjustmentInput>({
    resolver: zodResolver(carAdjustmentInputSchema) as Resolver<CarAdjustmentInput>,
    defaultValues: {
      adjustmentTurnover: quote.car.adjustment?.adjustedTurnover ?? quote.car.estimatedTurnover,
      stampDutyExempt: quote.car.adjustment?.stampDutyExempt ? "yes" : "no",
    },
  });

  const breakdown = fetcher.data?.breakdown ?? initialBreakdown;
  const isCalculating = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.data?.breakdown) {
      setStep(1);
    }
  }, [fetcher.data?.breakdown]);

  async function goNext() {
    const valid = await form.trigger();
    if (!valid) return;

    const body = new FormData();
    body.set("intent", "calculate");
    body.set("payload", JSON.stringify(form.getValues()));
    fetcher.submit(body, { method: "post" });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        {steps.map((label, index) => (
          <span
            key={label}
            className={`rounded-full px-3 py-1 text-sm ${
              index === step
                ? "bg-slate-900 text-white"
                : index < step
                  ? "bg-slate-300 text-slate-800"
                  : "bg-slate-200 text-slate-700"
            }`}
          >
            {index + 1}. {label}
          </span>
        ))}
      </div>

      {fetcher.data?.formError ? (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
          {fetcher.data.formError}
        </div>
      ) : null}

      {step === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>End of Term Adjustment</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:max-w-lg">
            <FieldInput
              label="Adjustment Turnover"
              type="number"
              step="0.01"
              min={0}
              error={form.formState.errors.adjustmentTurnover?.message}
              {...form.register("adjustmentTurnover")}
            />
            <Select
              label="Stamp Duty Exempt"
              error={form.formState.errors.stampDutyExempt?.message}
              {...form.register("stampDutyExempt")}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </Select>
          </CardContent>
        </Card>
      ) : null}

      {step === 1 && breakdown ? (
        <AdjustmentPricingTables breakdown={breakdown} />
      ) : step === 1 ? (
        <Card>
          <CardContent className="p-6 text-sm text-slate-500">
            {isCalculating
              ? "Calculating adjustment premiums…"
              : "Complete step 1 and continue to see pricing."}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {step > 0 ? (
          <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
            Back
          </Button>
        ) : null}

        {step === 0 ? (
          <Button type="button" onClick={goNext} disabled={isCalculating}>
            {isCalculating ? "Calculating…" : "Next"}
          </Button>
        ) : null}

        {step === 1 && breakdown ? (
          <Form method="post">
            <input type="hidden" name="intent" value="finish" />
            <input type="hidden" name="payload" value={JSON.stringify(form.getValues())} />
            <Button type="submit">Finish</Button>
          </Form>
        ) : null}

        <Link
          to={`/quotes/${quote.policyId}`}
          className="inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium hover:bg-slate-100"
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}

export function AdjustmentPricingTables({ breakdown }: { breakdown: AdjustmentBreakdown }) {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Pricing Confirmation</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <p className="text-sm text-slate-600">
            Original Turnover: {formatCurrency(breakdown.originalTurnover)}
          </p>
          <AdjustmentTable title="Original" section1={breakdown.original.section1} section2={breakdown.original.section2} total={breakdown.original.total} />
          <p className="text-sm font-medium text-slate-700">
            Adjustment Turnover: {formatCurrency(breakdown.adjustmentTurnover)}
          </p>
          <AdjustmentTable title="Adjustment" section1={breakdown.adjustment.section1} section2={breakdown.adjustment.section2} total={breakdown.adjustment.total} />
          <AdjustmentTable title="Total Adjustment Premium" section1={breakdown.delta.section1} section2={breakdown.delta.section2} total={breakdown.delta.total} />
          <p className="text-sm font-medium uppercase text-slate-700">
            All policies are subject to a minimum premium of 75% of original estimated premium paid
          </p>
        </CardContent>
      </Card>
    </div>
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
      <p className="mb-2 text-sm font-semibold text-slate-900">{title}</p>
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left">
            <th className="py-2 pr-4">Sections</th>
            <th className="py-2 pr-4">Total Premium</th>
            <th className="py-2 pr-4">True Base Premium</th>
            <th className="py-2 pr-4">Terrorism Levy</th>
            <th className="py-2 pr-4">ESL</th>
            <th className="py-2 pr-4">GST</th>
            <th className="py-2">Stamp Duty</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
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

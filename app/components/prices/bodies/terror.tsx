import { useMemo, useState } from "react";

import {
  RatePercentInput,
  type TerrorScheduleView,
} from "~/components/prices/shared";
import { AppSelect } from "~/components/ui/app-select";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Textarea } from "~/components/ui/textarea";
import { formatNumber, formatRate } from "~/lib/utils";

export function TerrorBody({
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
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
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

      <section className="flex flex-col gap-2">
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
            <Textarea
              id="postcodesCsv"
              name="postcodesCsv"
              defaultValue={postcodesCsv}
              rows={12}
              className="font-mono text-xs"
              spellCheck={false}
            />
            <FieldDescription>
              One row per postcode. State must be an AU code (NSW, VIC, …). Tier
              must match a rate tier above.
            </FieldDescription>
          </Field>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-2">
              <Field className="w-36">
                <FieldLabel htmlFor="terror-tier-filter">Tier</FieldLabel>
                <AppSelect
                  id="terror-tier-filter"
                  className="w-full"
                  size="sm"
                  value={tierFilter}
                  onValueChange={setTierFilter}
                  options={[
                    { value: "all", label: "All" },
                    ...schedule.tiers.map((tier) => ({
                      value: tier.tier,
                      label: tier.tier,
                    })),
                  ]}
                />
              </Field>
              <Field className="w-36">
                <FieldLabel htmlFor="terror-state-filter">State</FieldLabel>
                <AppSelect
                  id="terror-state-filter"
                  className="w-full"
                  size="sm"
                  value={stateFilter}
                  onValueChange={setStateFilter}
                  options={[
                    { value: "all", label: "All" },
                    ...stateOptions.map((code) => ({
                      value: code,
                      label: code,
                    })),
                  ]}
                />
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

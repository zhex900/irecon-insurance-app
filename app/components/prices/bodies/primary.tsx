import { Field, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { formatCurrency, formatRate } from "~/lib/utils";
import {
  NumInput,
  RatePercentInput,
  type CarScheduleView,
  type EslScheduleView,
  type PlantScheduleView,
  type StampScheduleView,
} from "~/components/prices/shared";
export function CarBody({
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
            <TableHead className="text-right">$10M rate %</TableHead>
            <TableHead className="text-right">$10M min</TableHead>
            <TableHead className="text-right">$20M rate %</TableHead>
            <TableHead className="text-right">$20M min</TableHead>
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

export function StampBody({
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

export function EslBody({
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

export function PlantBody({
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

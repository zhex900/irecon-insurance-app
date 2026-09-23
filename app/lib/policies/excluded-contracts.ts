import type { UseFormGetValues, UseFormSetValue } from "react-hook-form";

import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

const BELOW_20 = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
] as const;

const TENS = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
] as const;

/** Legacy wording: "eighteen (18)". */
export function formatMonthCountWording(months: number): string {
  if (!Number.isInteger(months) || months < 1) {
    return String(months);
  }
  if (months < 20) {
    return `${BELOW_20[months]} (${months})`;
  }
  if (months < 100) {
    const tens = Math.floor(months / 10);
    const ones = months % 10;
    const words = ones ? `${TENS[tens]}-${BELOW_20[ones]}` : TENS[tens];
    return `${words} (${months})`;
  }
  if (months < 1000) {
    const hundreds = Math.floor(months / 100);
    const rest = months % 100;
    const head = `${BELOW_20[hundreds]} hundred`;
    const tail = rest ? ` ${englishUnder1000(rest)}` : "";
    return `${head}${tail} (${months})`.replace(/\s+/g, " ").trim();
  }
  return String(months);
}

function englishUnder1000(n: number): string {
  if (n < 20) return BELOW_20[n];
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    return ones ? `${TENS[tens]}-${BELOW_20[ones]}` : TENS[tens];
  }
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return rest
    ? `${BELOW_20[hundreds]} hundred ${englishUnder1000(rest)}`
    : `${BELOW_20[hundreds]} hundred`;
}

export function constructionPeriodExcludedBullet(
  maximumConstructionPeriod: number,
): string {
  const wording = formatMonthCountWording(maximumConstructionPeriod);
  return `- With a construction period exceeding ${wording} months ; or`;
}

const CONSTRUCTION_PERIOD_BULLET =
  /- With a construction period exceeding [^;\n]+ months ; or/;

export function maintenancePeriodExcludedBullet(
  maximumMaintenancePeriod: number,
): string {
  const wording = formatMonthCountWording(maximumMaintenancePeriod);
  return `- With a maintenance/defects liability period exceeding ${wording} months; or`;
}

const MAINTENANCE_PERIOD_BULLET =
  /- With a maintenance\/defects liability period exceeding [^;\n]+ months; or/;

/** Default excluded-contracts activities list (paragraph 2). */
export function buildExcludedContracts2Activities(
  maximumConstructionPeriod: number,
  maximumMaintenancePeriod = 12,
): string {
  return (
    "- Underpinning, underground, tunnelling, bridging and dam works; or\n" +
    "- Airside or rail works; or\n" +
    "- Demolition exceeding 20 metres in height: or\n" +
    "- Works exceeding 10 levels; or\n" +
    "- Works above the 26th Parallel South; or\n" +
    `${constructionPeriodExcludedBullet(maximumConstructionPeriod)}\n` +
    `${maintenancePeriodExcludedBullet(maximumMaintenancePeriod)}\n` +
    "- Contract exceeds the Sum Insured specified against Cover Item 1 (a);"
  );
}

function validPeriodMonths(value: number): value is number {
  return Number.isFinite(value) && value > 0;
}

/** Replace standard period bullets when present; leave custom text unchanged. */
export function syncExcludedContracts2Periods(
  excludedContracts2: string,
  maximumConstructionPeriod: number,
  maximumMaintenancePeriod: number,
): string {
  const hasConstruction = validPeriodMonths(maximumConstructionPeriod);
  const hasMaintenance = validPeriodMonths(maximumMaintenancePeriod);

  if (!excludedContracts2.trim() && hasConstruction && hasMaintenance) {
    return buildExcludedContracts2Activities(
      maximumConstructionPeriod,
      maximumMaintenancePeriod,
    );
  }

  let text = excludedContracts2;

  if (hasConstruction && CONSTRUCTION_PERIOD_BULLET.test(text)) {
    text = text.replace(
      CONSTRUCTION_PERIOD_BULLET,
      constructionPeriodExcludedBullet(maximumConstructionPeriod),
    );
  }

  if (hasMaintenance && MAINTENANCE_PERIOD_BULLET.test(text)) {
    text = text.replace(
      MAINTENANCE_PERIOD_BULLET,
      maintenancePeriodExcludedBullet(maximumMaintenancePeriod),
    );
  }

  return text;
}

/** @deprecated Prefer syncExcludedContracts2Periods */
export function syncExcludedContracts2ConstructionPeriod(
  excludedContracts2: string,
  maximumConstructionPeriod: number,
): string {
  return syncExcludedContracts2Periods(
    excludedContracts2,
    maximumConstructionPeriod,
    12,
  );
}

export function syncExcludedContractsPeriodsFromForm(
  getValues: UseFormGetValues<CarPolicyFormValues>,
  setValue: UseFormSetValue<CarPolicyFormValues>,
) {
  const current = getValues("excludedContracts2") ?? "";
  const next = syncExcludedContracts2Periods(
    current,
    Number(getValues("maximumConstructionPeriod")),
    Number(getValues("maximumMaintenancePeriod")),
  );
  if (next === current) return;
  setValue("excludedContracts2", next, {
    shouldDirty: true,
    shouldValidate: false,
  });
}

/** @deprecated Prefer syncExcludedContractsPeriodsFromForm */
export function syncExcludedContractsConstructionPeriodFromMonths(
  maximumConstructionPeriod: number,
  getValues: UseFormGetValues<CarPolicyFormValues>,
  setValue: UseFormSetValue<CarPolicyFormValues>,
) {
  const current = getValues("excludedContracts2") ?? "";
  const next = syncExcludedContracts2Periods(
    current,
    maximumConstructionPeriod,
    Number(getValues("maximumMaintenancePeriod")),
  );
  if (next === current) return;
  setValue("excludedContracts2", next, {
    shouldDirty: true,
    shouldValidate: false,
  });
}

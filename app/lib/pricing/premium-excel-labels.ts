export function coverTypeLabel(coverTypeId: number): string {
  if (coverTypeId === 2) return "Single";
  if (coverTypeId === 3) return "Owner Builder";
  return "Annual";
}

export function liabilityBandLabel(band: number): string {
  if (band === 1) return "$10 Million";
  if (band === 2) return "$20 Million";
  if (band === 3) return "Not Insured";
  return String(band);
}

export function stateCode(stateId: number): string {
  const map: Record<number, string> = {
    1: "ACT",
    2: "NSW",
    3: "NT",
    4: "QLD",
    5: "SA",
    6: "TAS",
    7: "VIC",
    8: "WA",
  };
  return map[stateId] ?? String(stateId);
}

export function turnoverLabelForCover(coverTypeId: number): string {
  return coverTypeId === 2 || coverTypeId === 3
    ? "Project amount"
    : "Estimated turnover";
}

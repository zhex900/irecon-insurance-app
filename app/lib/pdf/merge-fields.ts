import { normalizeCustomWordings } from "~/lib/custom-wordings";
import type { CarWording, Policy } from "~/lib/db/types";
import { preferPremiumOverride } from "~/lib/premium-override";
import { combinedTrueBasePremium } from "~/lib/premium-totals";
import { referenceData as reference } from "~/lib/reference-data";
import { formatCurrency, formatDate } from "~/lib/utils";
import { isWordingHtmlEmpty } from "~/lib/wording/html";

const STATE_BY_ID = new Map(
  reference.states.map((s) => [s.stateId, s.code] as const),
);

const COVER_BY_ID = new Map(
  reference.coverTypes.map((c) => [c.coverTypeId, c.name] as const),
);

const LIABILITY_BY_ID = new Map(
  reference.liabilityLimitBands.map((b) => [b.id, b.name] as const),
);

function money(value: number | string | null | undefined) {
  if (value == null || value === "") return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    // Only format bare / $ amounts — leave free text (e.g. "Not Insured") alone.
    const bare = trimmed.replace(/[$,\s]/g, "");
    if (!/^-?\d+(\.\d+)?$/.test(bare)) return trimmed;
    const parsed = Number(bare);
    if (Number.isNaN(parsed)) return trimmed;
    return formatCurrency(parsed);
  }
  if (Number.isNaN(value)) return "";
  return formatCurrency(value);
}

function yesNo(value: boolean | null | undefined) {
  if (value == null) return "";
  return value ? "Yes" : "No";
}

function coverLabel(coverTypeId: number) {
  return COVER_BY_ID.get(coverTypeId) ?? "Annual";
}

function stateCode(stateId: number) {
  return STATE_BY_ID.get(stateId) ?? "";
}

/** Dropdown label as shown on Limits (incl. "Not Insured") — no money transform. */
function liabilityLabel(bandId: number | string | null | undefined) {
  // Form <select> values are strings; Map keys are numeric band ids.
  const id = Number(bandId);
  if (!Number.isFinite(id) || id <= 0) return "";
  return LIABILITY_BY_ID.get(id) ?? "";
}

/** pdfme table field used by Owner Builder ROA premium section. */
export const PREMIUM_CALCULATION_TABLE_FIELD = "PremiumCalculation";

/**
 * JSON `string[][]` of `[subject, content]` rows — data source for:
 * - Preferred: EndorsementSubject + EndorsementContent text pair (loops)
 * - Legacy: Table named `Endorsements`
 */
export const ENDORSEMENTS_TABLE_FIELD = "Endorsements";

type EndorsementPair = { subject: string; content: string };

/**
 * Endorsements rows = ticked Additional Wording (DB `car_wording` catalogue)
 * + free-form custom wordings. Shape is always `{ subject, content }`.
 */
export function collectEndorsementWordings(
  car: {
    selectedWordingIds?: number[] | null;
    customWordings?: Array<{
      id?: string;
      subject?: string | null;
      content?: string | null;
    }> | null;
    customWordingSubject?: string | null;
    customWordingContent?: string | null;
    customWordingSubject2?: string | null;
    customWordingContent2?: string | null;
  },
  wordingCatalogue: CarWording[] = [],
): EndorsementPair[] {
  const selected = new Set(
    (car.selectedWordingIds ?? [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id)),
  );

  const rows: EndorsementPair[] = [];

  // 1) Ticked fixed Additional Wording from catalogue
  for (const item of wordingCatalogue) {
    if (!selected.has(Number(item.carWordingId))) continue;
    const subject = item.subject ?? "";
    const content = item.content ?? "";
    if (isWordingHtmlEmpty(subject) && isWordingHtmlEmpty(content)) continue;
    rows.push({ subject, content });
  }

  // 2) Free-form custom wording ({ subject, content })
  const custom = normalizeCustomWordings(
    (car.customWordings ?? []).map((item) => ({
      id: typeof item.id === "string" ? item.id : "",
      subject: item.subject ?? "",
      content: item.content ?? "",
    })),
    {
      subject: car.customWordingSubject ?? undefined,
      content: car.customWordingContent ?? undefined,
      subject2: car.customWordingSubject2 ?? undefined,
      content2: car.customWordingContent2 ?? undefined,
    },
  );
  for (const item of custom) {
    const subject = item.subject ?? "";
    const content = item.content ?? "";
    if (isWordingHtmlEmpty(subject) && isWordingHtmlEmpty(content)) continue;
    rows.push({ subject, content });
  }

  return rows;
}

/** Build the Endorsements table body from policy additional wording. */
export function endorsementsTableContent(
  wordings:
    | Array<{ subject?: string | null; content?: string | null }>
    | null
    | undefined,
): string {
  const rows = (wordings ?? [])
    .map((item) => [String(item.subject ?? ""), String(item.content ?? "")])
    .filter(
      ([subject, content]) =>
        !isWordingHtmlEmpty(subject) || !isWordingHtmlEmpty(content),
    );
  // pdfme tables need at least one row; empty policy → blank pair.
  return JSON.stringify(rows.length > 0 ? rows : [["", ""]]);
}

const PT_TO_MM = 25.4 / 72;
/** A4 content area minus padding — pdfme cannot split a single table row across pages. */
const MAX_TABLE_ROW_HEIGHT_MM = 230;

type TableStyleLike = {
  fontSize?: number;
  lineHeight?: number;
  padding?: { top?: number; bottom?: number; left?: number; right?: number };
};

function estimateCellHeightMm(
  text: string,
  widthMm: number,
  styles: TableStyleLike | undefined,
): number {
  const fontSize = Number(styles?.fontSize ?? 9);
  const lineHeight = Number(styles?.lineHeight ?? 1.25);
  const padTop = Number(styles?.padding?.top ?? 2);
  const padBottom = Number(styles?.padding?.bottom ?? 2);
  const padLeft = Number(styles?.padding?.left ?? 2);
  const padRight = Number(styles?.padding?.right ?? 2);
  // Conservative glyph width — underestimate chars/line so we overestimate height.
  const charWidthMm = Math.max(fontSize * 0.62 * PT_TO_MM, 1.45);
  const lineMm = fontSize * lineHeight * PT_TO_MM;
  const innerWidth = Math.max(widthMm - padLeft - padRight, charWidthMm);
  const cols = Math.max(1, Math.floor(innerWidth / charWidthMm));
  let lines = 0;
  for (const para of String(text ?? "").split("\n")) {
    const len = para.length;
    if (!len) {
      lines += 1;
      continue;
    }
    lines += Math.max(1, Math.ceil(len / cols));
  }
  // pdfme’s table measure runs ~1–2 lines short of the painted text — pad for that.
  const EXTRA_LINES = 2.5;
  return padTop + padBottom + Math.max(lineMm, (lines + EXTRA_LINES) * lineMm);
}

function parseTableBody(raw: string): string[][] {
  try {
    const parsed = JSON.parse(raw || "[]") as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return [["", ""]];
    return parsed.map((row) =>
      Array.isArray(row) ? row.map((cell) => String(cell ?? "")) : [""],
    );
  } catch {
    return [["", ""]];
  }
}

/**
 * Split a long text into chunks that each fit within `maxHeightMm` when wrapped
 * in a cell of `widthMm`. Keeps paragraph breaks where possible.
 */
function splitTextToFitCellHeight(
  text: string,
  widthMm: number,
  styles: TableStyleLike | undefined,
  maxHeightMm: number,
): string[] {
  const value = String(text ?? "");
  if (!value.trim()) return [value];
  if (estimateCellHeightMm(value, widthMm, styles) <= maxHeightMm) {
    return [value];
  }

  const paragraphs = value.split("\n");
  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    if (current.length > 0) chunks.push(current);
    current = "";
  };

  for (const para of paragraphs) {
    const candidate = current.length > 0 ? `${current}\n${para}` : para;
    if (estimateCellHeightMm(candidate, widthMm, styles) <= maxHeightMm) {
      current = candidate;
      continue;
    }
    flush();
    if (estimateCellHeightMm(para, widthMm, styles) <= maxHeightMm) {
      current = para;
      continue;
    }
    // Hard-split an oversized paragraph by characters.
    const charWidthMm = Math.max(
      Number(styles?.fontSize ?? 9) * 0.62 * PT_TO_MM,
      1.45,
    );
    const padLeft = Number(styles?.padding?.left ?? 2);
    const padRight = Number(styles?.padding?.right ?? 2);
    const cols = Math.max(
      1,
      Math.floor(
        Math.max(widthMm - padLeft - padRight, charWidthMm) / charWidthMm,
      ),
    );
    const lineMm =
      Number(styles?.fontSize ?? 9) *
      Number(styles?.lineHeight ?? 1.25) *
      PT_TO_MM;
    const padV =
      Number(styles?.padding?.top ?? 2) + Number(styles?.padding?.bottom ?? 2);
    // Leave room for the same EXTRA_LINES slack used in estimateCellHeightMm.
    const maxLines = Math.max(1, Math.floor((maxHeightMm - padV) / lineMm) - 3);
    const chunkChars = Math.max(cols, maxLines * cols);
    for (let i = 0; i < para.length; i += chunkChars) {
      chunks.push(para.slice(i, i + chunkChars));
    }
    current = "";
  }
  flush();
  return chunks.length > 0 ? chunks : [value];
}

/**
 * pdfme cannot split one table row across pages. Long endorsement bodies are
 * broken into continuation rows (empty subject) so content is never clipped.
 */
export function splitEndorsementsTableBody(
  contentJson: string,
  schema: {
    width?: number;
    headWidthPercentages?: number[];
    bodyStyles?: TableStyleLike;
  },
  maxRowHeightMm = MAX_TABLE_ROW_HEIGHT_MM,
): string {
  const width = Math.max(Number(schema.width ?? 185), 20);
  const percentages =
    Array.isArray(schema.headWidthPercentages) &&
    schema.headWidthPercentages.length >= 2
      ? schema.headWidthPercentages
      : [30, 70];
  const contentWidth = (width * Number(percentages[1] ?? 70)) / 100;
  const body = parseTableBody(contentJson);
  const next: string[][] = [];

  for (const row of body) {
    const subject = String(row[0] ?? "");
    const content = String(row[1] ?? "");
    const chunks = splitTextToFitCellHeight(
      content,
      contentWidth,
      schema.bodyStyles,
      maxRowHeightMm,
    );
    chunks.forEach((chunk, index) => {
      next.push([index === 0 ? subject : "", chunk]);
    });
  }

  return JSON.stringify(next.length > 0 ? next : [["", ""]]);
}

/**
 * Grow a table schema's height to fit its JSON body (header + wrapped rows).
 * Used so Endorsements cells aren't clipped to the authored placeholder height.
 */
export function estimateTableHeightMm(
  schema: {
    width?: number;
    height?: number;
    showHead?: boolean;
    head?: string[];
    headWidthPercentages?: number[];
    headStyles?: TableStyleLike;
    bodyStyles?: TableStyleLike;
    content?: unknown;
  },
  contentJson?: string,
): number {
  const width = Math.max(Number(schema.width ?? 180), 20);
  const percentages =
    Array.isArray(schema.headWidthPercentages) &&
    schema.headWidthPercentages.length > 0
      ? schema.headWidthPercentages
      : [50, 50];
  const colWidths = percentages.map((p) => (width * Number(p)) / 100);

  const raw =
    typeof contentJson === "string"
      ? contentJson
      : typeof schema.content === "string"
        ? schema.content
        : "[]";
  const body = parseTableBody(raw);

  let total = 0;
  if (schema.showHead !== false && Array.isArray(schema.head)) {
    let headH = 0;
    schema.head.forEach((label, i) => {
      headH = Math.max(
        headH,
        estimateCellHeightMm(
          String(label ?? ""),
          colWidths[i] ?? width,
          schema.headStyles,
        ),
      );
    });
    total += headH;
  }
  for (const row of body) {
    let rowH = 0;
    row.forEach((cell, i) => {
      rowH = Math.max(
        rowH,
        estimateCellHeightMm(cell, colWidths[i] ?? width, schema.bodyStyles),
      );
    });
    total += rowH;
  }
  return Number(Math.max(total, Number(schema.height ?? 0), 12).toFixed(2));
}

/** Extra bottom padding (mm) so painted endorsement text isn’t clipped. */
const ENDORSEMENTS_EXTRA_BOTTOM_PADDING_MM = 6;

function withEndorsementsBodyPadding(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const bodyStyles = {
    ...((schema.bodyStyles as Record<string, unknown> | undefined) ?? {}),
  };
  const padding = {
    top: 2,
    right: 2,
    bottom: 2,
    left: 2,
    ...((bodyStyles.padding as Record<string, unknown> | undefined) ?? {}),
  };
  const bottom = Number(padding.bottom ?? 2);
  padding.bottom = bottom + ENDORSEMENTS_EXTRA_BOTTOM_PADDING_MM;
  bodyStyles.padding = padding;
  bodyStyles.verticalAlignment = "top";
  return { ...schema, bodyStyles };
}

/** Sync table `content` + grow `height` from merge inputs (Endorsements, etc.). */
export function syncTableSchemasToInputs<
  T extends { schemas: Array<Array<Record<string, unknown>>> },
>(template: T, inputs: Record<string, string>): T {
  return {
    ...template,
    schemas: template.schemas.map((page) =>
      page.map((schema) => {
        if (schema.type !== "table" || typeof schema.name !== "string") {
          return schema;
        }
        const canonical = canonicalMergeFieldName(schema.name);
        const isEndorsements = canonical === ENDORSEMENTS_TABLE_FIELD;
        const baseSchema = isEndorsements
          ? withEndorsementsBodyPadding(schema)
          : schema;

        let resolved = resolveTableMergeInput(
          schema.name,
          typeof schema.content === "string" ? schema.content : "[]",
          inputs,
        );
        if (isEndorsements) {
          resolved = splitEndorsementsTableBody(
            resolved,
            baseSchema as Parameters<typeof splitEndorsementsTableBody>[1],
          );
        }
        inputs[schema.name] = resolved;
        if (isEndorsements) {
          inputs[ENDORSEMENTS_TABLE_FIELD] = resolved;
        }
        const height = estimateTableHeightMm(
          baseSchema as Parameters<typeof estimateTableHeightMm>[0],
          resolved,
        );
        return { ...baseSchema, content: resolved, height };
      }),
    ),
  };
}

function isJsonArrayString(value: string): boolean {
  try {
    return Array.isArray(JSON.parse(value));
  } catch {
    return false;
  }
}

/** Designer copies: "Endorsements copy" → "Endorsements". */
function canonicalMergeFieldName(name: string): string {
  return name.replace(/(?: copy)+(?:\s+\d+)?$/i, "").trim();
}

/**
 * Resolve a table schema input.
 * Prefer a pre-built JSON array from merge inputs (dynamic fields like
 * Endorsements); otherwise substitute `{MergeField}` tokens in the schema body.
 */
export function resolveTableMergeInput(
  schemaName: string,
  schemaContent: string,
  inputs: Record<string, string>,
): string {
  const provided =
    inputs[schemaName] || inputs[canonicalMergeFieldName(schemaName)] || "";
  if (provided && isJsonArrayString(provided)) {
    return provided;
  }
  return resolveTableContentPlaceholders(schemaContent, inputs);
}

/**
 * PREMIUM CALCULATION table body with `{MergeField}` placeholders.
 * Columns: label | Contract Works | Legal Liability | Combined.
 */
export function premiumCalculationTablePlaceholderContent(): string {
  // Labels / column wording match the Owner Builder Word ROA table.
  return JSON.stringify([
    [
      "Base Premium:",
      "{ContractWorksBasePremium}",
      "{LegalLiabilityBasePremium}",
      "",
    ],
    ["Existing Structure:", "{ExistingStructurePremium}", "", ""],
    ["Display Homes:", "{DisplayHomesPremium}", "", ""],
    [
      "True Base Premium:",
      "{ContractWorksTrueBasePremium}",
      "{LegalLiabilityTrueBasePremium}",
      "{CombinedTrueBasePremium}",
    ],
    ["Terrorism Levy:", "{TerrorismLevy}", "", ""],
    ["Plant & Equipment Base Premium", "{PlantEquipmentPremium}", "", ""],
    [
      "Terrorism Levy: (Plant & Equipment)",
      "{PlantEquipmentTerrorismLevy}",
      "",
      "",
    ],
    ["ESL Plant & Equipment:", "{PlantEquipmentEsl}", "", ""],
    ["ESL:", "{ContractWorksEsl}", "{LegalLiabilityEsl}", "{CombinedEsl}"],
    ["GST:", "{ContractWorksGst}", "{LegalLiabilityGst}", "{CombinedGst}"],
    [
      "SD:",
      "{ContractWorksStampDuty}",
      "{LegalLiabilityStampDuty}",
      "{CombinedStampDuty}",
    ],
    ["Broker Fee:", "", "", "{BrokerFee}"],
    ["Total Fee GST:", "", "", "{BrokerFeeGst}"],
    ["Insurer Admin:", "", "", "{InsurerAdminFee}"],
    ["IAA Admin Fee:", "", "", "{IAAAdminFee}"],
    [
      "Total Premium:",
      "{ContractWorksTotalPremium}",
      "{LegalLiabilityTotalPremium}",
      "{CombinedTotalPremium}",
    ],
  ]);
}

/** Replace `{MergeField}` tokens in a pdfme table JSON body. */
export function resolveTableContentPlaceholders(
  content: string,
  inputs: Record<string, string>,
): string {
  let rows: unknown;
  try {
    rows = JSON.parse(content);
  } catch {
    return content;
  }
  if (!Array.isArray(rows)) return content;

  return JSON.stringify(
    rows.map((row) => {
      if (!Array.isArray(row)) return row;
      return row.map((cell) => {
        if (typeof cell !== "string") return cell;
        return cell.replace(/\{([^{}]+)\}/g, (_match, key: string) => {
          const name = key.trim();
          return name in inputs ? (inputs[name] ?? "") : "";
        });
      });
    }),
  );
}

function isJsonObjectString(value: string): boolean {
  try {
    const parsed = JSON.parse(value) as unknown;
    return (
      parsed != null && typeof parsed === "object" && !Array.isArray(parsed)
    );
  } catch {
    return false;
  }
}

function variableNamesFromText(text: string): string[] {
  const names: string[] = [];
  for (const match of text.matchAll(/\{([^{}]+)\}/g)) {
    const name = match[1]?.trim();
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

/**
 * pdfme multiVariableText requires `text`, `variables[]`, and JSON `content`.
 * Designer/hand edits sometimes leave only a template string in `content`.
 */
export function normalizeMultiVariableTextSchema<
  T extends Record<string, unknown>,
>(schema: T): T {
  if (schema.type !== "multiVariableText") return schema;

  const rawText = typeof schema.text === "string" ? schema.text : "";
  const rawContent = typeof schema.content === "string" ? schema.content : "";
  const contentIsValues = rawContent !== "" && isJsonObjectString(rawContent);

  const text =
    rawText ||
    (!contentIsValues && rawContent.includes("{") ? rawContent : "") ||
    " ";

  const fromSchema = Array.isArray(schema.variables)
    ? schema.variables.filter((v): v is string => typeof v === "string")
    : [];
  const variables =
    fromSchema.length > 0 ? fromSchema : variableNamesFromText(text);

  const values: Record<string, string> = contentIsValues
    ? (JSON.parse(rawContent) as Record<string, string>)
    : {};
  for (const name of variables) {
    if (!(name in values)) values[name] = "";
  }

  return {
    ...schema,
    text,
    variables,
    content: JSON.stringify(values),
  };
}

/** Build the JSON input string pdfme expects for a multiVariableText field. */
export function resolveMultiVariableTextInput(
  schema: Record<string, unknown>,
  inputs: Record<string, string>,
): string | null {
  if (schema.type !== "multiVariableText") return null;
  const normalized = normalizeMultiVariableTextSchema(schema);
  const variables = Array.isArray(normalized.variables)
    ? normalized.variables.filter((v): v is string => typeof v === "string")
    : [];

  const name = typeof schema.name === "string" ? schema.name : "";
  const existing = name ? inputs[name] : undefined;
  if (typeof existing === "string" && isJsonObjectString(existing)) {
    const parsed = JSON.parse(existing) as Record<string, unknown>;
    const values: Record<string, string> = {};
    for (const variable of variables) {
      const fromJson = parsed[variable];
      values[variable] =
        fromJson == null ? (inputs[variable] ?? "") : String(fromJson);
    }
    return JSON.stringify(values);
  }

  const values: Record<string, string> = {};
  for (const variable of variables) {
    values[variable] = inputs[variable] ?? "";
  }
  return JSON.stringify(values);
}

/** Ensure multiVariableText schemas have the shape pdfme generate() expects. */
export function normalizePdfmeTemplateSchemas<
  T extends { schemas: Array<Array<Record<string, unknown>>> },
>(template: T): T {
  return {
    ...template,
    schemas: template.schemas.map((page) =>
      page.map((schema) => normalizeMultiVariableTextSchema(schema)),
    ),
  };
}

/**
 * Map a policy snapshot to pdfme merge-field names (label-based, readable).
 * Prefer precomputed `car.endorsementWordings` (form snapshot); otherwise
 * resolve ticked IDs against `wordingCatalogue` from Postgres `car_wording`.
 */
export function policyToMergeInputs(
  policy: Policy,
  options?: { wordingCatalogue?: CarWording[] },
): Record<string, string> {
  const car = policy.car;
  const premium = car.premium;
  const adjustment = car.adjustment;
  const sub = car.subLimits ?? ({} as NonNullable<typeof car.subLimits>);
  const excess = car.excesses ?? ({} as NonNullable<typeof car.excesses>);
  const original = adjustment?.breakdown.original;
  const adjusted = adjustment?.breakdown.adjustment;
  const delta = adjustment?.breakdown.delta;
  const endorsementWordings =
    car.endorsementWordings && car.endorsementWordings.length > 0
      ? car.endorsementWordings
      : collectEndorsementWordings(car, options?.wordingCatalogue ?? []);

  const inputs: Record<string, string> = {
    PolicyNumber: policy.policyNumber,
    CoverType: coverLabel(car.coverTypeId),
    CoverTypeUpper: coverLabel(car.coverTypeId).toUpperCase(),
    InsuredName: car.insuredName,
    InceptionDate: formatDate(policy.dateStart),
    ExpiryDate: formatDate(policy.dateEnd),
    EstimatedTurnover: money(car.estimatedTurnover),
    State: stateCode(policy.stateId),
    PostCode: policy.postcode,
    StampDutyExempt: yesNo(adjustment?.stampDutyExempt ?? false),
    BusinessDescription: String(car.businessActivities ?? "").replace(
      /\s*\n\s*/g,
      " ",
    ),
    InsuredContracts: car.insuredContracts,
    GeographicalScope: car.geographicalScopes,
    MaximumConstructionPeriod: String(car.maximumConstructionPeriod ?? ""),
    MaximumMaintenancePeriod: String(car.maximumMaintenancePeriod ?? ""),
    ContractWorksLimit: money(car.contractWorksSumInsured),
    ExistingStructures: money(
      preferPremiumOverride(
        premium?.contractWorksExistingStructurePremium ??
          car.contractWorksExistingStructurePremium,
        car.existingStructure,
      ),
    ),
    DisplayHomes: money(
      preferPremiumOverride(
        premium?.contractWorksDisplayHomesPremium ??
          car.contractWorksDisplayHomesPremium,
        car.displayHomes,
      ),
    ),
    ConstructionPlantEquipment: money(
      preferPremiumOverride(
        premium?.contractWorksPlantPremium,
        car.plantEquipment,
      ),
    ),
    SiteAddress: car.siteAddress,
    RemovalOfDebris: String(sub.removalOfDebris ?? ""),
    ExpeditingExpenses: String(sub.expeditingExpenses ?? ""),
    ProfessionalFees: String(sub.professionalFees ?? ""),
    MitigationExpenses: String(sub.mitigationExpenses ?? ""),
    SearchAndLocateCosts: String(sub.searchAndLocateCosts ?? ""),
    PlantHireCharges: String(sub.plantHireCharges ?? ""),
    ClaimsPreparationCosts: String(sub.claimsPreparationCosts ?? ""),
    GovernmentCosts: String(sub.governmentCosts ?? ""),
    InflationProtection: String(sub.inflationProtection ?? ""),
    EmployeesProperty: String(sub.employeesProperty ?? ""),
    MaterialsInOffSiteStorage: String(sub.materialsInOffSiteStorage ?? ""),
    Transit: String(sub.transit ?? ""),
    LegalLiabilityLimit: liabilityLabel(car.liabilityLimitBand),
    ExcessPlantEquipment: money(excess.excessPlantEquipment),
    ExcessUpTo2MMinorPerils: money(excess.excessUpTo2MMinorPerils),
    ExcessUpTo2MMajorPerils: money(excess.excessUpTo2MMajorPerils),
    ExcessOver2MMinorPerils: money(excess.excessOver2MMinorPerils),
    ExcessOver2MMajorPerils: money(excess.excessOver2MMajorPerils),
    ExcessAdditionalNotes: excess.excessAdditionalNotes ?? "",
    ExcessWorkerToWorker: money(excess.excessWorkerToWorker),
    ExcessUpTo2MLimit10M: money(excess.excessUpTo2MLimit10M),
    ExcessUpTo2MLimit20M: money(excess.excessUpTo2MLimit20M),
    ExcessOver2MLimit10M: money(excess.excessOver2MLimit10M),
    ExcessOver2MLimit20M: money(excess.excessOver2MLimit20M),
    // Kept numbered — multi-slot excluded-contracts block.
    ExcludedContracts1: car.excludedContracts1 ?? "",
    ExcludedContracts2: car.excludedContracts2 ?? "",
    ExcludedContracts3: car.excludedContracts3 ?? "",
    ClaimsCountLast3Years: String(car.claimsCountLast3Years ?? ""),
    AnyClaimsExceed20k: yesNo(car.anyClaimsExceed20k),
    DutyOfDisclosureConfirmation: yesNo(car.declarationConfirmed),
    // Dynamic array field — catalogue selections + custom additional wording.
    [ENDORSEMENTS_TABLE_FIELD]: endorsementsTableContent(endorsementWordings),
    // Scalars kept for older templates that still use fixed subject/content slots.
    EndorsementSubject: endorsementWordings[0]?.subject ?? "",
    EndorsementContent: endorsementWordings[0]?.content ?? "",
    EndorsementSubject2: endorsementWordings[1]?.subject ?? "",
    EndorsementContent2: endorsementWordings[1]?.content ?? "",
    Notes: (policy.notes ?? [])
      .map((note) => note.description)
      .filter(Boolean)
      .join("\n\n"),
    // Same lines as Premium Summary “Referral reasons” (newline-separated).
    ReferralReasons: (car.referralReasons ?? []).join("\n"),
    // Legacy palette/template name — same value as ReferralReasons.
    ReferralName: (car.referralReasons ?? []).join("\n"),
  };

  if (premium) {
    const esPremium =
      premium.contractWorksExistingStructurePremium ??
      car.contractWorksExistingStructurePremium ??
      0;
    const dhPremium =
      premium.contractWorksDisplayHomesPremium ??
      car.contractWorksDisplayHomesPremium ??
      0;
    const plantPremium = premium.contractWorksPlantPremium ?? 0;
    const terror = premium.contractWorksTerrorismPremium ?? 0;
    const plantTerror = premium.contractWorksPlantTerrorismPremium ?? 0;
    const plantEsl = premium.contractWorksPlantESL ?? 0;
    const s1Esl = premium.contractWorksESL ?? 0;
    const s2Esl = premium.liabilityESL ?? 0;
    const s1Sd = premium.contractWorksStampDuty ?? 0;
    const s2Sd = premium.liabilityStampDuty ?? 0;
    const s1TrueBase = premium.contractWorksBasePremium ?? 0;
    const s2TrueBase = premium.liabilityBasePremium ?? 0;

    Object.assign(inputs, {
      // Premium Breakdown — always from live premium (includes manual overrides).
      ContractWorksBasePremium: money(
        premium.contractWorksCalculatedBasePremium,
      ),
      LegalLiabilityBasePremium: money(premium.liabilityCalculatedBasePremium),
      ContractWorksTrueBasePremium: money(s1TrueBase),
      LegalLiabilityTrueBasePremium: money(s2TrueBase),
      CombinedTrueBasePremium: money(combinedTrueBasePremium(premium)),
      TerrorismLevy: money(terror),
      ExistingStructurePremium: money(esPremium),
      DisplayHomesPremium: money(dhPremium),
      PlantEquipmentPremium: money(plantPremium),
      PlantEquipmentTerrorismLevy: money(plantTerror),
      PlantEquipmentEsl: money(plantEsl),
      ContractWorksEsl: money(s1Esl),
      LegalLiabilityEsl: money(s2Esl),
      CombinedEsl: money(s1Esl + s2Esl + plantEsl),
      ContractWorksGst: money(premium.contractWorksGST),
      LegalLiabilityGst: money(premium.liabilityGST),
      CombinedGst: money(
        (premium.contractWorksGST ?? 0) + (premium.liabilityGST ?? 0),
      ),
      ContractWorksStampDuty: money(s1Sd),
      LegalLiabilityStampDuty: money(s2Sd),
      CombinedStampDuty: money(s1Sd + s2Sd),
      ContractWorksTotalPremium: money(premium.contractWorksTotalPremium),
      LegalLiabilityTotalPremium: money(premium.liabilityTotalPremium),
      CombinedTotalPremium: money(premium.originalTotalPremium),
      BrokerFee: money(premium.combinedBrokerFee),
      BrokerFeeGst: money((premium.combinedBrokerFee ?? 0) * 0.1),
      // Adjustment "original turnover" calc columns (same as bind-time premium)
      CalcTerrorismLevy: money(terror),
      CalcContractWorksEsl: money(s1Esl),
      CalcContractWorksGst: money(premium.contractWorksGST),
      CalcContractWorksStampDuty: money(s1Sd),
      CalcContractWorksGross: money(premium.contractWorksTotalPremium),
      CalcLegalLiabilityEsl: money(s2Esl),
      CalcLegalLiabilityGst: money(premium.liabilityGST),
      CalcLegalLiabilityStampDuty: money(s2Sd),
      CalcLegalLiabilityGross: money(premium.liabilityTotalPremium),
      CalcCombinedBaseNoTerror: money(s1TrueBase + s2TrueBase),
      CalcCombinedGst: money(
        (premium.contractWorksGST ?? 0) + (premium.liabilityGST ?? 0),
      ),
      CalcCombinedStampDuty: money(s1Sd + s2Sd),
      CalcCombinedGross: money(premium.originalTotalPremium),
    });
  }

  if (adjustment && original && adjusted && delta) {
    Object.assign(inputs, {
      AdjustedTurnover: money(adjustment.adjustedTurnover),
      StampDutyExempt: yesNo(adjustment.stampDutyExempt),
      AdjustedContractWorksTrueBasePremium: money(
        adjusted.section1.trueBasePremium,
      ),
      AdjustedTerrorismLevy: money(adjusted.section1.terrorismPremium),
      AdjustedContractWorksEsl: money(adjusted.section1.esl),
      AdjustedContractWorksGst: money(adjusted.section1.gst),
      AdjustedContractWorksStampDuty: money(adjusted.section1.sd),
      AdjustedContractWorksGross: money(adjusted.section1.totalPremium),
      AdjustedLegalLiabilityTrueBasePremium: money(
        adjusted.section2.trueBasePremium,
      ),
      AdjustedLegalLiabilityEsl: money(adjusted.section2.esl),
      AdjustedLegalLiabilityGst: money(adjusted.section2.gst),
      AdjustedLegalLiabilityStampDuty: money(adjusted.section2.sd),
      AdjustedLegalLiabilityGross: money(adjusted.section2.totalPremium),
      AdjustedCombinedBaseNoTerror: money(adjusted.total.trueBasePremium),
      AdjustedCombinedGst: money(adjusted.total.gst),
      AdjustedCombinedStampDuty: money(adjusted.total.sd),
      AdjustedCombinedGross: money(adjusted.total.totalPremium),
      DeltaContractWorksTrueBasePremium: money(delta.section1.trueBasePremium),
      DeltaTerrorismLevy: money(delta.section1.terrorismPremium),
      DeltaContractWorksEsl: money(delta.section1.esl),
      DeltaContractWorksGst: money(delta.section1.gst),
      DeltaContractWorksStampDuty: money(delta.section1.sd),
      DeltaContractWorksGross: money(delta.section1.totalPremium),
      DeltaLegalLiabilityTrueBasePremium: money(delta.section2.trueBasePremium),
      DeltaLegalLiabilityEsl: money(delta.section2.esl),
      DeltaLegalLiabilityGst: money(delta.section2.gst),
      DeltaLegalLiabilityStampDuty: money(delta.section2.sd),
      DeltaLegalLiabilityGross: money(delta.section2.totalPremium),
      DeltaTrueBase: money(delta.total.trueBasePremium),
      DeltaCombinedGst: money(delta.total.gst),
      DeltaCombinedStampDuty: money(delta.total.sd),
      DeltaCombinedGross: money(delta.total.totalPremium),
    });
  }

  return inputs;
}

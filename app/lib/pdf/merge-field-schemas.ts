export function canonicalMergeFieldName(name: string): string {
  return name.replace(/(?: copy)+(?:\s+\d+)?$/i, "").trim();
}

function isJsonArrayString(value: string): boolean {
  try {
    return Array.isArray(JSON.parse(value));
  } catch {
    return false;
  }
}

/** Designer copies: "Endorsements copy" → "Endorsements". */

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
    ["Existing Structure:", "{PremiumExistingStructure}", "", ""],
    ["Display Homes:", "{PremiumDisplayHomes}", "", ""],
    [
      "True Base Premium:",
      "{ContractWorksTrueBasePremium}",
      "{LegalLiabilityTrueBasePremium}",
      "{CombinedTrueBasePremium}",
    ],
    ["Terrorism Levy:", "{TerrorismLevy}", "", ""],
    ["Plant & Equipment Base Premium", "{PremiumPlantAndEquipment}", "", ""],
    [
      "Terrorism Levy: (Plant & Equipment)",
      "{PremiumPlantAndEquipmentTerrorismLevy}",
      "",
      "",
    ],
    ["ESL Plant & Equipment:", "{PremiumPlantAndEquipmentEsl}", "", ""],
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
/** Schedule line shape used for named PDF fee merge fields. */

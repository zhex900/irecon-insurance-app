import type { Template } from "@pdfme/common";

const PT_TO_MM = 25.4 / 72;

export type FlowPushDown = {
  pageIndex: number;
  anchor: string;
  anchorOriginalHeightMm: number;
  followFields: string[];
  staticInputs: Record<string, string>;
};

type TextSchema = {
  name: string;
  type: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  fontSize?: number;
  lineHeight?: number;
  verticalAlignment?: string;
};

function estimateTextHeightMm(
  text: string,
  widthMm: number,
  fontSizePt: number,
  lineHeight: number,
): number {
  const charWidthMm = Math.max(fontSizePt * 0.48 * PT_TO_MM, 1.2);
  const lineMm = fontSizePt * lineHeight * PT_TO_MM;
  const paragraphs = String(text ?? "").split("\n");
  let lines = 0;
  for (const para of paragraphs) {
    const len = para.trim().length;
    if (!len) {
      lines += 1;
      continue;
    }
    lines += Math.max(1, Math.ceil(len / Math.floor(widthMm / charWidthMm)));
  }
  return Math.max(lineMm * 1.1, lines * lineMm);
}

/** Grow Excluded Contracts and shift Issued By / Premium Adjustment / ENDORSEMENTS down. */
export function applyFlowPushDown(
  template: Template,
  flow: FlowPushDown | null | undefined,
  inputs: Record<string, string>,
): Template {
  if (!flow) return template;

  Object.assign(inputs, flow.staticInputs);

  const schemas = template.schemas.map((page) =>
    page.map((schema) => {
      const s = schema as TextSchema;
      return {
        ...s,
        position: { ...s.position },
      };
    }),
  );

  const page = schemas[flow.pageIndex];
  if (!page) return template;

  const anchor = page.find((s) => s.name === flow.anchor) as
    TextSchema | undefined;
  if (!anchor || anchor.type !== "text") {
    return { ...template, schemas };
  }

  const needed = estimateTextHeightMm(
    inputs[flow.anchor] ?? "",
    Number(anchor.width),
    Number(anchor.fontSize ?? 9.5),
    Number(anchor.lineHeight ?? 1.25),
  );

  const followers = flow.followFields
    .map((name) => page.find((s) => s.name === name) as TextSchema | undefined)
    .filter(Boolean) as TextSchema[];

  const reservedMm =
    followers.reduce((sum, s) => sum + Number(s.height) + 3.2, 0) + 10;
  const pageBottomMm = 290;
  const maxHeight = Math.max(
    flow.anchorOriginalHeightMm,
    pageBottomMm - Number(anchor.position.y) - reservedMm,
  );

  const originalHeight = flow.anchorOriginalHeightMm;
  anchor.height = Number(
    Math.min(Math.max(needed, originalHeight), maxHeight).toFixed(2),
  );
  anchor.verticalAlignment = "top";

  const delta = Number(anchor.height) - originalHeight;
  if (delta > 0.4) {
    for (const schema of followers) {
      schema.position.y = Number(
        (Number(schema.position.y) + delta).toFixed(2),
      );
    }
  }

  const content = page.find((s) => s.name === "Content") as
    TextSchema | undefined;
  if (content) {
    content.verticalAlignment = "top";
    const contentNeeded = estimateTextHeightMm(
      inputs.Content ?? "",
      Number(content.width),
      Number(content.fontSize ?? 9.5),
      Number(content.lineHeight ?? 1.25),
    );
    const room = pageBottomMm - Number(content.position.y) - 8;
    content.height = Number(
      Math.min(Math.max(Number(content.height), contentNeeded), room).toFixed(
        2,
      ),
    );
  }

  return { ...template, schemas };
}

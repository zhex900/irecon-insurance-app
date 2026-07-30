import type { Template } from "@pdfme/common";

export type TemplateChangeKind = "added" | "removed" | "changed" | "meta";

export type TemplateChange = {
  kind: TemplateChangeKind;
  label: string;
};

type FieldSnap = {
  name: string;
  type: string;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
};

const POSITION_EPS_MM = 0.15;

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function collectFields(template: Template | null): Map<string, FieldSnap> {
  const map = new Map<string, FieldSnap>();
  if (!template) return map;
  template.schemas.forEach((page, pageIndex) => {
    for (const schema of page) {
      const name = str(schema.name).trim();
      if (!name) continue;
      map.set(name, {
        name,
        type: str(schema.type) || "unknown",
        pageIndex,
        x: num(schema.position?.x ?? schema.x),
        y: num(schema.position?.y ?? schema.y),
        width: num(schema.width),
        height: num(schema.height),
        content: str(schema.content),
      });
    }
  });
  return map;
}

function formatDelta(delta: number, unit = "mm"): string {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)} ${unit}`;
}

function describeFieldChange(prev: FieldSnap, next: FieldSnap): string[] {
  const parts: string[] = [];
  if (prev.pageIndex !== next.pageIndex) {
    parts.push(`page ${prev.pageIndex + 1} → ${next.pageIndex + 1}`);
  }
  const dx = next.x - prev.x;
  const dy = next.y - prev.y;
  if (Math.abs(dx) >= POSITION_EPS_MM || Math.abs(dy) >= POSITION_EPS_MM) {
    if (Math.abs(dx) >= POSITION_EPS_MM && Math.abs(dy) >= POSITION_EPS_MM) {
      parts.push(`moved (${formatDelta(dx)}, ${formatDelta(dy)})`);
    } else if (Math.abs(dy) >= POSITION_EPS_MM) {
      parts.push(`moved ${formatDelta(dy)} vertically`);
    } else {
      parts.push(`moved ${formatDelta(dx)} horizontally`);
    }
  }
  const dw = next.width - prev.width;
  const dh = next.height - prev.height;
  if (Math.abs(dw) >= POSITION_EPS_MM || Math.abs(dh) >= POSITION_EPS_MM) {
    parts.push(
      `resized ${prev.width.toFixed(0)}×${prev.height.toFixed(0)} → ${next.width.toFixed(0)}×${next.height.toFixed(0)} mm`,
    );
  }
  if (prev.content !== next.content) {
    parts.push("updated text/content");
  }
  if (prev.type !== next.type) {
    parts.push(`type ${prev.type} → ${next.type}`);
  }
  return parts;
}

const COVER_LABELS: Record<string, string> = {
  "1": "Annual",
  "2": "Single",
  "3": "Owner Builder",
  null: "All cover types",
};

function coverLabel(coverTypeId: number | null | undefined): string {
  if (coverTypeId == null) return COVER_LABELS.null!;
  return COVER_LABELS[String(coverTypeId)] ?? `Cover ${coverTypeId}`;
}

/** Diff two pdfme templates (+ optional meta) into itemized changelog lines. */
export function diffDocumentTemplates(
  previous: Template | null,
  next: Template,
  meta?: {
    previousTitle?: string;
    nextTitle?: string;
    previousCoverTypeId?: number | null;
    nextCoverTypeId?: number | null;
    published?: boolean;
  },
): TemplateChange[] {
  const changes: TemplateChange[] = [];
  const prevFields = collectFields(previous);
  const nextFields = collectFields(next);

  for (const [name, field] of nextFields) {
    if (!prevFields.has(name)) {
      changes.push({ kind: "added", label: `Added field ${name}` });
    } else {
      const prev = prevFields.get(name)!;
      const details = describeFieldChange(prev, field);
      if (details.length > 0) {
        changes.push({
          kind: "changed",
          label: `Changed ${name}: ${details.join("; ")}`,
        });
      }
    }
  }

  for (const [name] of prevFields) {
    if (!nextFields.has(name)) {
      changes.push({ kind: "removed", label: `Removed field ${name}` });
    }
  }

  const prevPages = previous?.schemas.length ?? 0;
  const nextPages = next.schemas.length;
  if (previous && nextPages !== prevPages) {
    changes.push({
      kind: "changed",
      label: `Pages ${prevPages} → ${nextPages}`,
    });
  }

  if (
    meta?.previousTitle != null &&
    meta.nextTitle != null &&
    meta.previousTitle.trim() !== meta.nextTitle.trim()
  ) {
    changes.push({
      kind: "meta",
      label: `Title “${meta.previousTitle.trim() || "(empty)"}” → “${meta.nextTitle.trim()}”`,
    });
  }

  if (
    meta &&
    "previousCoverTypeId" in meta &&
    "nextCoverTypeId" in meta &&
    meta.previousCoverTypeId !== meta.nextCoverTypeId
  ) {
    changes.push({
      kind: "meta",
      label: `Cover type ${coverLabel(meta.previousCoverTypeId)} → ${coverLabel(meta.nextCoverTypeId)}`,
    });
  }

  if (meta?.published) {
    changes.push({ kind: "meta", label: "Set as published (live)" });
  }

  if (changes.length === 0) {
    changes.push({ kind: "meta", label: "No field changes detected" });
  }

  return changes;
}

/** Compare a working (unsaved) template to the last saved baseline. */
export function diffUnsavedTemplate(
  baseline: Template,
  working: Template,
): TemplateChange[] {
  const changes = diffDocumentTemplates(baseline, working).filter(
    (change) => change.label !== "No field changes detected",
  );
  return changes.map((change) => ({
    ...change,
    label: `${change.label} — unsaved`,
  }));
}

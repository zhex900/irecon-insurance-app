/**
 * Rebuild CAR pdfme templates for full text editability WHILE preserving
 * Word layout chrome (lines, tables, logos, fills) and per-glyph font sizes.
 *
 * Approach:
 * 1. Start from the last committed templates (styled basePdf + merge schemas)
 * 2. Cover ALL text on the base PDF using the sampled background colour
 *    (not flat white — preserves header/table fills from the Word layout)
 * 3. Overlay every label as an editable text schema (transparent fill)
 * 4. Keep merge-value schemas; restore fontSize from the PDF when available
 *
 * Usage:
 *   node scripts/make-pdf-templates-editable.mjs
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";
import { PDFDocument, rgb } from "pdf-lib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const OUT_DIR = join(REPO_ROOT, "app/assets/pdf-templates");
const BASE_PDF_DIR = join(OUT_DIR, "base-pdfs");
const TMP_DIR = join(REPO_ROOT, ".tmp/editable-rebuild");
const PT_TO_MM = 25.4 / 72;
const SKIP_FIELDS = /^(TableStart|TableEnd)(:.*)?$/i;

const MULTILINE_FIELDS = new Set([
  "GeographicalScope",
  "InsuredContracts",
  "InsuredName",
  "Content",
  "Notes",
  "ExcessAdditionalNotes",
  "ExcludedContracts1",
  "SiteAddress",
]);

const SKIP_SCHEMA_FIELDS = new Set([
  "ExcludedContracts2",
  "ExcludedContracts3",
]);

function ensureDirs() {
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(BASE_PDF_DIR, { recursive: true });
  mkdirSync(TMP_DIR, { recursive: true });
}

function toDataUri(pdfBytes) {
  return `data:application/pdf;base64,${Buffer.from(pdfBytes).toString("base64")}`;
}

function loadCommittedSlot(fileName) {
  const outPath = join(TMP_DIR, fileName);
  execFileSync(
    "bash",
    [
      "-lc",
      `git show 'HEAD:app/assets/pdf-templates/${fileName}' > '${outPath}'`,
    ],
    { cwd: REPO_ROOT, maxBuffer: 50 * 1024 * 1024 },
  );
  return JSON.parse(readFileSync(outPath, "utf8"));
}

function coverRect(page, x, y, w, h, color) {
  page.drawRectangle({
    x,
    y,
    width: Math.max(w, 1),
    height: Math.max(h, 1),
    color,
    borderWidth: 0,
  });
}

function rgbFromBytes(r, g, b) {
  return rgb(r / 255, g / 255, b / 255);
}

/** Sample page background near a text run so redaction keeps Word fill colours. */
function sampleBackgroundColor(
  ctx,
  pageW,
  pageH,
  xPt,
  yPt,
  widthPt,
  fontSizePt,
) {
  const samples = [
    [xPt - 2, yPt + fontSizePt * 0.35],
    [xPt + widthPt + 2, yPt + fontSizePt * 0.35],
    [xPt + widthPt * 0.5, yPt + fontSizePt + 2],
    [xPt + 1, yPt + fontSizePt * 0.9],
    [xPt + Math.max(widthPt - 1, 1), yPt + fontSizePt * 0.9],
  ];
  /** @type {Array<[number, number, number]>} */
  const colors = [];
  for (const [sx, sy] of samples) {
    const x = Math.min(Math.max(Math.round(sx), 0), pageW - 1);
    // pdf.js canvas y is top-down; PDF text y is bottom-up.
    const canvasY = Math.min(Math.max(Math.round(pageH - sy), 0), pageH - 1);
    const px = ctx.getImageData(x, canvasY, 1, 1).data;
    colors.push([px[0], px[1], px[2]]);
  }
  // Median channel — ignores occasional glyph hits.
  const mid = (arr) => {
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] ?? 255;
  };
  return rgbFromBytes(
    mid(colors.map((c) => c[0])),
    mid(colors.map((c) => c[1])),
    mid(colors.map((c) => c[2])),
  );
}

async function renderPageContext(page) {
  const viewport = page.getViewport({ scale: 1 });
  const w = Math.ceil(viewport.width);
  const h = Math.ceil(viewport.height);
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return { ctx, width: w, height: h, viewport };
}

/**
 * Join split «FieldName» runs; return merge placeholders + indexes used.
 */
function collectMergePlaceholders(items, pageWidthPt = 595) {
  /** @type {Array<{ name: string, xPt: number, yPt: number, minY: number, maxY: number, fontSizePt: number, widthPt: number, wrapHeightPt: number, indexes: number[] }>} */
  const fields = [];
  const used = new Set();
  const PAGE_RIGHT_MARGIN_PT = 36;

  const runs = items
    .map((item, index) => {
      if (!item || typeof item.str !== "string" || !item.str.trim())
        return null;
      return {
        index,
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
        w: item.width || 0,
        fontSize: Math.abs(item.transform[0]) || 9.5,
      };
    })
    .filter(Boolean);

  for (let i = 0; i < items.length; i++) {
    if (used.has(i)) continue;
    const item = items[i];
    if (!item || typeof item.str !== "string" || !item.str.includes("«"))
      continue;

    let text = item.str;
    let widthPt = item.width || 0;
    let minY = item.transform[5];
    let maxY = item.transform[5];
    const fontSizePt = Math.abs(item.transform[0]) || 9.5;
    const xPt = item.transform[4];
    const yPt = item.transform[5];
    const indexes = [i];
    used.add(i);

    let j = i;
    while (!text.includes("»") && j + 1 < items.length) {
      let n = j + 1;
      while (n < items.length && (!items[n].str || items[n].str === "")) n += 1;
      if (n >= items.length) break;
      const next = items[n];
      if (typeof next.str !== "string") break;
      if (next.str.includes("«")) break;
      const token = next.str.replace(/\s+/g, "");
      if (!token || !/^[A-Za-z0-9_»]+$/.test(token)) break;

      const nextX = next.transform[4];
      const nextY = next.transform[5];
      const sameLine = Math.abs(nextY - yPt) <= 2;
      const wrappedContinuation =
        Math.abs(nextX - xPt) <= 4 &&
        nextY < yPt + 1 &&
        nextY >= yPt - fontSizePt * 1.6;
      if (!sameLine && !wrappedContinuation) break;

      for (let u = j + 1; u <= n; u++) {
        used.add(u);
        indexes.push(u);
      }
      text += next.str;
      if (sameLine) widthPt += next.width || 0;
      else widthPt = Math.max(widthPt, next.width || 0);
      minY = Math.min(minY, nextY);
      maxY = Math.max(maxY, nextY);
      j = n;
    }

    const match = text.match(/«([A-Za-z0-9_]+)/);
    if (!match) continue;
    const name = match[1];
    if (SKIP_FIELDS.test(name) || name.length < 2) continue;

    let clearanceRight = Infinity;
    for (const run of runs) {
      if (used.has(run.index)) continue;
      if (
        Math.abs(run.y - maxY) > fontSizePt * 0.7 &&
        Math.abs(run.y - minY) > fontSizePt * 0.7
      ) {
        continue;
      }
      if (run.x <= xPt + 1) continue;
      clearanceRight = Math.min(clearanceRight, run.x - xPt - 2);
    }

    const toPageEdge = Math.max(pageWidthPt - xPt - PAGE_RIGHT_MARGIN_PT, 8);
    const available =
      Number.isFinite(clearanceRight) && clearanceRight > 6
        ? Math.min(clearanceRight, toPageEdge)
        : toPageEdge;

    fields.push({
      name,
      xPt,
      yPt,
      minY,
      maxY,
      fontSizePt,
      widthPt: available,
      wrapHeightPt: maxY - minY + fontSizePt * 1.35,
      indexes,
    });
  }

  return { fields, used };
}

function groupStaticSegments(items, usedMergeIndexes) {
  /** @type {Map<number, Array<{str:string,x:number,y:number,w:number,fontSize:number,fontName:string,index:number}>>} */
  const byY = new Map();

  for (let index = 0; index < items.length; index++) {
    if (usedMergeIndexes.has(index)) continue;
    const item = items[index];
    if (!item || typeof item.str !== "string") continue;
    const str = item.str;
    if (!str.trim()) continue;
    if (/[«»]/.test(str)) continue;

    const fontSize = Math.abs(item.transform[0]) || 9.5;
    const x = item.transform[4];
    const y = item.transform[5];
    const yKey = Math.round(y * 2) / 2; // tighter banding for mixed sizes
    if (!byY.has(yKey)) byY.set(yKey, []);
    byY.get(yKey).push({
      str,
      x,
      y,
      w: item.width || 0,
      fontSize,
      fontName: String(item.fontName || ""),
      index,
    });
  }

  /** @type {Array<{text:string,xPt:number,yPt:number,widthPt:number,fontSizePt:number,bold:boolean,indexes:number[]}>} */
  const segments = [];

  for (const yKey of [...byY.keys()].sort((a, b) => b - a)) {
    const runs = byY.get(yKey).sort((a, b) => a.x - b.x);
    /** @type {typeof runs[]} */
    const chunks = [];
    let current = [];
    for (const run of runs) {
      if (current.length === 0) {
        current.push(run);
        continue;
      }
      const prev = current[current.length - 1];
      const gap = run.x - (prev.x + prev.w);
      const sizeJump = Math.abs(run.fontSize - prev.fontSize) > 0.6;
      if (gap > Math.max(prev.fontSize * 2.2, 12) || sizeJump) {
        chunks.push(current);
        current = [run];
      } else {
        current.push(run);
      }
    }
    if (current.length) chunks.push(current);

    for (const chunk of chunks) {
      const text = chunk
        .map((r) => r.str)
        .join("")
        .replace(/\s+/g, " ")
        .trim();
      if (!text) continue;
      const minX = Math.min(...chunk.map((r) => r.x));
      const maxX = Math.max(...chunk.map((r) => r.x + r.w));
      const fontSizePt = Math.max(...chunk.map((r) => r.fontSize));
      const yPt = Math.max(...chunk.map((r) => r.y));
      const bold = chunk.some((r) => /bold|black|heavy/i.test(r.fontName));
      segments.push({
        text,
        xPt: minX,
        yPt,
        widthPt: Math.max(maxX - minX, fontSizePt * text.length * 0.32),
        fontSizePt,
        bold,
        indexes: chunk.map((r) => r.index),
      });
    }
  }

  return segments;
}

function guessFontColor(fontSizePt, bold, text) {
  // Titles / section headers in the CAR docs are near-black; keep body black.
  // Slightly darker for bold/large headings to match Word emphasis.
  if (fontSizePt >= 14 || (bold && fontSizePt >= 11)) return "#0B0B0B";
  if (/^[A-Z0-9][A-Z0-9 \-/&]{8,}$/.test(text) && fontSizePt >= 10) {
    return "#0B0B0B";
  }
  return "#111111";
}

function schemaBoxMm(
  pageH,
  xPt,
  yPt,
  widthPt,
  fontSizePt,
  heightFactor = 1.35,
) {
  const xMm = xPt * PT_TO_MM;
  const yMm = (pageH - yPt - fontSizePt * 0.85) * PT_TO_MM;
  const widthMm = widthPt * PT_TO_MM;
  const heightMm = fontSizePt * heightFactor * PT_TO_MM;
  return {
    x: Number(xMm.toFixed(2)),
    y: Number(Math.max(0, yMm).toFixed(2)),
    width: Number(Math.max(widthMm, 4).toFixed(2)),
    height: Number(Math.max(heightMm, 3).toFixed(2)),
  };
}

async function rebuildSlot(fileName) {
  const committed = loadCommittedSlot(fileName);
  const basePdfDataUri = String(committed.template.basePdf);
  if (!basePdfDataUri.startsWith("data:application/pdf;base64,")) {
    throw new Error(`${fileName}: committed template missing data-URI basePdf`);
  }
  const originalBytes = Buffer.from(
    basePdfDataUri.replace(/^data:application\/pdf;base64,/, ""),
    "base64",
  );

  const srcDoc = await getDocument({
    data: new Uint8Array(originalBytes),
    useSystemFonts: true,
  }).promise;

  /** @type {Array<{width:number,height:number}>} */
  const pageSizes = [];
  /** @type {any[][]} */
  const pageItems = [];
  /** @type {Array<ReturnType<typeof collectMergePlaceholders>>} */
  const pageMerges = [];
  /** @type {Array<ReturnType<typeof groupStaticSegments>>} */
  const pageStatics = [];

  for (let pageNum = 1; pageNum <= srcDoc.numPages; pageNum++) {
    const page = await srcDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    pageSizes.push({ width: viewport.width, height: viewport.height });
    const content = await page.getTextContent();
    pageItems.push(content.items);
    const merge = collectMergePlaceholders(content.items, viewport.width);
    pageMerges.push(merge);
    pageStatics.push(groupStaticSegments(content.items, merge.used));
  }

  // Cover every text glyph with the local background colour (keeps blue/grey fills).
  const pdfDoc = await PDFDocument.load(originalBytes);
  const pages = pdfDoc.getPages();
  for (let p = 0; p < pages.length; p++) {
    const page = pages[p];
    const pdfJsPage = await srcDoc.getPage(p + 1);
    const {
      ctx,
      width: pageW,
      height: pageH,
    } = await renderPageContext(pdfJsPage);

    for (const item of pageItems[p]) {
      if (!item || typeof item.str !== "string" || !item.str.trim()) continue;
      const fontSizePt = Math.abs(item.transform[0]) || 9.5;
      const xPt = item.transform[4];
      const yPt = item.transform[5];
      const widthPt = Math.max(
        item.width || fontSizePt * item.str.length * 0.45,
        3,
      );
      const color = sampleBackgroundColor(
        ctx,
        pageW,
        pageH,
        xPt,
        yPt,
        widthPt,
        fontSizePt,
      );
      coverRect(
        page,
        xPt - 0.75,
        yPt - fontSizePt * 0.28,
        widthPt + 1.5,
        fontSizePt * 1.25,
        color,
      );
    }
  }
  const cleanedBytes = Buffer.from(await pdfDoc.save());
  writeFileSync(join(BASE_PDF_DIR, `${committed.key}.pdf`), cleanedBytes);

  /** @type {Array<Array<Record<string, unknown>>>} */
  const schemas = [];
  /** @type {string[]} */
  const mergeFields = [];
  const nameCounts = new Map();
  let labelCounter = 0;

  // Prefer committed merge schema geometry when present (cell widths).
  const committedPages = committed.template.schemas ?? [];

  for (let p = 0; p < pageSizes.length; p++) {
    const { width: pageW, height: pageH } = pageSizes[p];
    /** @type {Array<Record<string, unknown>>} */
    const pageSchemas = [];

    // --- Editable labels (original size / weight) ---
    for (const seg of pageStatics[p]) {
      labelCounter += 1;
      const box = schemaBoxMm(
        pageH,
        seg.xPt,
        seg.yPt,
        Math.min(seg.widthPt, pageW - seg.xPt - 8),
        seg.fontSizePt,
        seg.fontSizePt >= 14 ? 1.45 : 1.35,
      );
      pageSchemas.push({
        name: `_Label_${labelCounter}`,
        type: "text",
        content: seg.text,
        position: { x: box.x, y: box.y },
        width: Number(
          Math.min(box.width, pageW * PT_TO_MM - box.x - 2).toFixed(2),
        ),
        height: box.height,
        fontSize: Number(
          (seg.bold ? seg.fontSizePt * 1.02 : seg.fontSizePt).toFixed(1),
        ),
        lineHeight: 1.15,
        fontColor: guessFontColor(seg.fontSizePt, seg.bold, seg.text),
        // Empty = transparent so Word chrome / coloured fills show through.
        backgroundColor: "",
        verticalAlignment: "middle",
      });
    }

    // --- Merge values: reuse committed boxes when possible, else rebuild ---
    const committedPage = committedPages[p] ?? [];
    const committedByBase = new Map();
    for (const schema of committedPage) {
      const name = String(schema.name ?? "");
      if (!name || name.startsWith("_")) continue;
      const base = name.replace(/__\d+$/, "");
      if (!committedByBase.has(base)) committedByBase.set(base, []);
      committedByBase.get(base).push(schema);
    }

    const localCounts = new Map();
    for (const field of pageMerges[p].fields) {
      if (SKIP_SCHEMA_FIELDS.has(field.name)) {
        if (!mergeFields.includes(field.name)) mergeFields.push(field.name);
        continue;
      }

      const count = (localCounts.get(field.name) ?? 0) + 1;
      localCounts.set(field.name, count);
      const globalCount = (nameCounts.get(field.name) ?? 0) + 1;
      nameCounts.set(field.name, globalCount);
      const schemaName =
        globalCount === 1 ? field.name : `${field.name}__${globalCount}`;
      if (globalCount === 1) mergeFields.push(field.name);

      const committedMatch = (committedByBase.get(field.name) ?? [])[count - 1];
      const multiline = MULTILINE_FIELDS.has(field.name);
      const fontSizePt = Number(
        (committedMatch?.fontSize ?? field.fontSizePt ?? 9.5).toFixed?.(1) ??
          field.fontSizePt,
      );

      if (committedMatch) {
        const {
          fontName: _ignoredFont,
          backgroundColor: _ignoredBg,
          ...rest
        } = committedMatch;
        pageSchemas.push({
          ...rest,
          name: schemaName,
          type: "text",
          fontSize: fontSizePt,
          fontColor: committedMatch.fontColor ?? "#111111",
          backgroundColor: "",
          content: `{${field.name}}`,
        });
        continue;
      }

      const box = schemaBoxMm(
        pageH,
        field.xPt,
        field.yPt,
        field.widthPt,
        fontSizePt,
        multiline ? 2.4 : 1.35,
      );
      pageSchemas.push({
        name: schemaName,
        type: "text",
        content: `{${field.name}}`,
        position: { x: box.x, y: box.y },
        width: Number(
          Math.min(box.width, pageW * PT_TO_MM - box.x - 2).toFixed(2),
        ),
        height: box.height,
        fontSize: fontSizePt,
        lineHeight: multiline ? 1.25 : 1.15,
        fontColor: "#111111",
        backgroundColor: "",
        verticalAlignment: multiline ? "top" : "middle",
      });
    }

    // Keep any committed _Static_* footer overlays (with content from flowPushDown).
    for (const schema of committedPage) {
      const name = String(schema.name ?? "");
      if (!name.startsWith("_Static_")) continue;
      const content =
        committed.flowPushDown?.staticInputs?.[name] ??
        schema.content ??
        name.replace(/^_Static_/, "");
      const {
        fontName: _ignoredFont,
        backgroundColor: _ignoredBg,
        ...rest
      } = schema;
      pageSchemas.push({
        ...rest,
        content,
        fontSize: schema.fontSize ?? 9.5,
        fontColor: schema.fontColor ?? "#111111",
        backgroundColor: "",
      });
    }

    schemas.push(pageSchemas);
  }

  const payload = {
    ...committed,
    versionNumber: Number(committed.versionNumber ?? 1) + 1,
    publishedAt: new Date().toISOString(),
    mergeFields,
    pageCount: schemas.length,
    editableMode: "chrome-background-editable-text",
    note: "Word chrome kept on basePdf; all text whitened and re-laid as editable schemas with original font sizes.",
    basePdfFile: `base-pdfs/${committed.key}.pdf`,
    template: {
      basePdf: toDataUri(cleanedBytes),
      schemas,
    },
  };

  const outPath = join(OUT_DIR, fileName);
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
  return {
    key: committed.key,
    pages: schemas.length,
    schemas: schemas.reduce((n, p) => n + p.length, 0),
    labels: schemas.reduce(
      (n, p) =>
        n + p.filter((s) => String(s.name).startsWith("_Label_")).length,
      0,
    ),
    pdfBytes: cleanedBytes.length,
  };
}

async function main() {
  ensureDirs();
  const files = readdirSync(OUT_DIR)
    .filter((f) => f.endsWith(".json"))
    .filter((f) => !["index.json", "merge-field-catalogue.json"].includes(f));

  const results = [];
  for (const file of files) {
    const result = await rebuildSlot(file);
    results.push(result);
    console.log(
      `✓ ${result.key}: ${result.schemas} schemas (${result.labels} labels), basePdf ${(result.pdfBytes / 1024).toFixed(0)}KB`,
    );
  }

  writeFileSync(
    join(OUT_DIR, "index.json"),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        style:
          "Word chrome on basePdf; all text editable schemas (original font sizes)",
        slots: results,
      },
      null,
      2,
    )}\n`,
  );
  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

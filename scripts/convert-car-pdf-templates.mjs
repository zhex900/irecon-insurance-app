/**
 * Convert legacy CAR Word (.doc) mail-merge templates into pdfme Template JSON
 * while preserving original layout/style.
 *
 * Pipeline:
 * 1. LibreOffice (Docker) converts .doc → PDF (keeps fonts, tables, branding)
 * 2. pdf.js locates «MergeField» placeholders (joining split text runs)
 * 3. pdf-lib whites out those placeholders on the base PDF
 * 4. pdfme text schemas are placed exactly over those spots for values
 *
 * Usage:
 *   node scripts/convert-car-pdf-templates.mjs
 *   SKIP_LIBREOFFICE=1 node scripts/convert-car-pdf-templates.mjs
 *
 * Requires Docker + image linuxserver/libreoffice (pulled on first run).
 */
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { PDFDocument, rgb } from "pdf-lib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const SOURCE_DIR = join(REPO_ROOT, "_archive/car-pdf-templates/source");
const OUT_DIR = join(REPO_ROOT, "app/assets/pdf-templates");
const BASE_PDF_DIR = join(OUT_DIR, "base-pdfs");
const LIBRARY_OUT = join(REPO_ROOT, "public/library-documents");
const TMP_PDF_DIR = join(REPO_ROOT, ".tmp/base-pdfs");

const PT_TO_MM = 25.4 / 72;
/** Keep all merge-field / overlay body text the same size (Word body ≈ 9.5pt). */
const BODY_FONT_PT = 9.5;
const SKIP_FIELDS = /^(TableStart|TableEnd)(:.*)?$/i;

const SLOTS = [
  {
    key: "schedule-annual",
    documentTypeCode: "CARSCHED",
    coverTypeId: 1,
    title: "ANNUAL CONTRACT WORKS & LIABILITY INSURANCE — SCHEDULE",
    source: "CAR_iAnyware Schedule (Annual) [from 01.26].doc",
  },
  {
    key: "schedule-single",
    documentTypeCode: "CARSCHED",
    coverTypeId: 2,
    title: "SINGLE CONTRACT WORKS & LIABILITY INSURANCE — SCHEDULE",
    source: "CAR_iAnyware Schedule (Single) [from 01.26].doc",
  },
  {
    key: "schedule-owner-builder",
    documentTypeCode: "CARSCHED",
    coverTypeId: 3,
    title: "OWNER BUILDER CONTRACT WORKS & LIABILITY INSURANCE — SCHEDULE",
    source: "CAR_iAnyware Schedule (Owner Builder) [from 06.25] - v2.doc",
  },
  {
    key: "rating-annual",
    documentTypeCode: "CARRATING",
    coverTypeId: 1,
    title: "ANNUAL CAR — QUOTATION & RECORD OF ANSWERS",
    source: "CAR_Quotation & Record of Answers (Annual) [from 01.26].doc",
  },
  {
    key: "rating-single",
    documentTypeCode: "CARRATING",
    coverTypeId: 2,
    title: "SINGLE CAR — QUOTATION & RECORD OF ANSWERS",
    source: "CAR_Quotation & Record of Answers (Single) [from 01.26].doc",
  },
  {
    key: "rating-owner-builder",
    documentTypeCode: "CARRATING",
    coverTypeId: 3,
    title: "OWNER BUILDER CAR — QUOTATION & RECORD OF ANSWERS",
    source:
      "CAR_Quotation & Record of Answers (Owner Builder) [from 06.25] - v2.doc",
  },
  {
    key: "adjustment",
    documentTypeCode: "CARADJUST",
    coverTypeId: null,
    title: "CONTRACT WORKS & LIABILITY INSURANCE — ADJUSTMENT",
    source: "CAR_Adjustment.doc",
  },
];

const LIBRARY_PDFS = [
  "ATC Stamp duty Exemption.pdf",
  "POLICY COMPARISON JUNE 2024.pdf",
  "IA Annual CAR TPL Wording (eff Jan 2026) - Sample.pdf",
];

function ensureDirs() {
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(BASE_PDF_DIR, { recursive: true });
  mkdirSync(LIBRARY_OUT, { recursive: true });
  mkdirSync(TMP_PDF_DIR, { recursive: true });
}

function sourcePdfName(sourceDoc) {
  return sourceDoc.replace(/\.doc$/i, ".pdf");
}

function convertDocsWithLibreOffice() {
  if (process.env.SKIP_LIBREOFFICE === "1") {
    console.log("SKIP_LIBREOFFICE=1 — reusing PDFs in", TMP_PDF_DIR);
    return;
  }

  const args = [
    "run",
    "--rm",
    "-v",
    `${SOURCE_DIR}:/data:ro`,
    "-v",
    `${TMP_PDF_DIR}:/out`,
    "--entrypoint",
    "soffice",
    "linuxserver/libreoffice:latest",
    "--headless",
    "--nolockcheck",
    "--nodefault",
    "--nofirststartwizard",
    "--convert-to",
    "pdf",
    "--outdir",
    "/out",
    ...SLOTS.map((s) => `/data/${s.source}`),
  ];

  console.log("Converting Word → PDF via Docker LibreOffice…");
  execFileSync("docker", args, { stdio: "inherit" });
}

function toDataUri(pdfBytes) {
  return `data:application/pdf;base64,${Buffer.from(pdfBytes).toString("base64")}`;
}

/**
 * Join split/wrapped «FieldName» runs and cap width so overlays don't cover
 * static neighbours (e.g. "months (maximum)").
 */
function collectMergePlaceholders(items, pageWidthPt = 595) {
  /** @type {Array<{ name: string, xPt: number, yPt: number, minY: number, maxY: number, fontSizePt: number, widthPt: number, heightPt: number }>} */
  const fields = [];
  const used = new Set();
  const PAGE_RIGHT_MARGIN_PT = 36;

  /** Useful text runs for clearance checks. */
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
    used.add(i);

    let j = i;
    while (!text.includes("»") && j + 1 < items.length) {
      let n = j + 1;
      while (n < items.length && (!items[n].str || items[n].str === "")) n += 1;
      if (n >= items.length) break;
      const next = items[n];
      if (typeof next.str !== "string") break;
      if (next.str.includes("«")) break;

      const nextX = next.transform[4];
      const nextY = next.transform[5];
      // Only glue merge-name fragments (TrueBasePremium, rorism», …) — never
      // static cell text like "$0.00" or wide spacer runs.
      const token = next.str.replace(/\s+/g, "");
      if (!token || !/^[A-Za-z0-9_»]+$/.test(token)) break;

      const sameLine = Math.abs(nextY - yPt) <= 2;
      const wrappedContinuation =
        Math.abs(nextX - xPt) <= 4 &&
        nextY < yPt + 1 &&
        nextY >= yPt - fontSizePt * 1.6;

      if (!sameLine && !wrappedContinuation) break;

      for (let u = j + 1; u <= n; u++) used.add(u);
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

    // Stop before the next static text on this line (avoids covering "months", etc.).
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

    // Schema boxes should fill the value cell — not the short «PlaceholderName»
    // glyph span (long names often wrap and look like a forced return).
    const toPageEdge = Math.max(pageWidthPt - xPt - PAGE_RIGHT_MARGIN_PT, 8);
    const available =
      Number.isFinite(clearanceRight) && clearanceRight > 6
        ? Math.min(clearanceRight, toPageEdge)
        : toPageEdge;

    fields.push({
      name,
      xPt,
      yPt: yPt, // first-line baseline (where the value should sit)
      minY,
      maxY,
      fontSizePt,
      widthPt: available,
      // Full wrap span — used only for multi-line redaction of the placeholder name
      wrapHeightPt: maxY - minY + fontSizePt * 1.35,
    });
  }
  return fields;
}

/**
 * Lift "Issued By" / "Premium Adjustment" / "ENDORSEMENTS" off the base PDF
 * so Excluded Contracts can grow and push them down at generate time.
 */
function collectFooterStaticLines(items, pageWidthPt, pageHeightPt) {
  const specs = [
    {
      key: "IssuedBy",
      name: "_Static_IssuedBy",
      match: (s) => /^Issued\s*By\s*:/i.test(s.trim()),
    },
    {
      key: "PremiumAdjustment",
      name: "_Static_PremiumAdjustment",
      match: (s) => /^Premium\s*Adjustment\s*:/i.test(s.trim()),
    },
    {
      key: "Endorsements",
      name: "_Static_Endorsements",
      match: (s) => /^ENDORSEMENTS\b/i.test(s.trim()),
    },
  ];

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

  /** @type {Array<{ name: string, text: string, xPt: number, yPt: number, widthPt: number, fontSizePt: number, bandY0: number, bandY1: number }>} */
  const blocks = [];

  for (const spec of specs) {
    const seed = runs.find((r) => spec.match(r.str));
    if (!seed) continue;
    const line = runs
      .filter((r) => Math.abs(r.y - seed.y) <= seed.fontSize * 0.55)
      .sort((a, b) => a.x - b.x);
    const text = line
      .map((r) => r.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    const minX = Math.min(...line.map((r) => r.x));
    const maxX = Math.max(...line.map((r) => r.x + r.w));
    const fontSizePt = Math.max(...line.map((r) => r.fontSize));
    blocks.push({
      name: spec.name,
      text,
      xPt: Math.min(minX, 34),
      yPt: seed.y,
      widthPt: Math.max(pageWidthPt - Math.min(minX, 34) - 36, maxX - minX + 8),
      fontSizePt,
      bandY0: seed.y - fontSizePt * 0.3,
      bandY1: seed.y + fontSizePt * 0.95,
    });
  }

  return { blocks, pageHeightPt };
}

function whiteOutRect(page, x, y, w, h) {
  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    color: rgb(1, 1, 1),
    borderWidth: 0,
  });
}

async function buildStyledTemplate(pdfBytes) {
  const srcDoc = await getDocument({
    data: new Uint8Array(pdfBytes),
    useSystemFonts: true,
  }).promise;

  /** @type {Array<Array<{ name: string, xPt: number, yPt: number, fontSizePt: number, widthPt: number, heightPt: number }>>} */
  const pageFields = [];
  /** @type {Array<{ width: number, height: number }>} */
  const pageSizes = [];
  /** @type {Array<ReturnType<typeof collectFooterStaticLines>>} */
  const pageFooters = [];
  /** @type {any[]} */
  const pageItems = [];

  for (let pageNum = 1; pageNum <= srcDoc.numPages; pageNum++) {
    const page = await srcDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    pageSizes.push({ width: viewport.width, height: viewport.height });
    const content = await page.getTextContent();
    pageItems.push(content.items);
    pageFields.push(collectMergePlaceholders(content.items, viewport.width));
    pageFooters.push(
      collectFooterStaticLines(content.items, viewport.width, viewport.height),
    );
  }

  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  for (let p = 0; p < pages.length; p++) {
    const page = pages[p];
    const contentItems = pageItems[p];
    const { width: pageW } = pageSizes[p];

    // Glyph-level white-out of every «…» fragment (most reliable cover).
    for (const item of contentItems) {
      if (!item || typeof item.str !== "string") continue;
      if (!/[«»]/.test(item.str)) continue;
      const fontSizePt = Math.abs(item.transform[0]) || 9.5;
      const xPt = item.transform[4];
      const yPt = item.transform[5];
      const widthPt = Math.max(
        item.width || fontSizePt * item.str.length * 0.45,
        4,
      );
      whiteOutRect(
        page,
        xPt - 0.5,
        yPt - fontSizePt * 0.25,
        widthPt + 1,
        fontSizePt * 1.15,
      );
    }

    // Only lift footer lines off pages that also have Excluded Contracts —
    // otherwise we'd erase Issued By on a later page without replacing it.
    const pageHasEc = pageFields[p].some(
      (f) => f.name === "ExcludedContracts1",
    );
    if (pageHasEc) {
      for (const block of pageFooters[p].blocks) {
        whiteOutRect(
          page,
          8,
          block.bandY0,
          pageW - 16,
          Math.max(block.bandY1 - block.bandY0, block.fontSizePt * 1.2),
        );
      }
    }
  }
  const cleanedBytes = Buffer.from(await pdfDoc.save());

  // Keep single-line unless the Word cell is meant for wrapped prose.
  // BusinessDescriptionText stays single-line so values use the full row width.
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
  // Word had three stacked placeholders; runtime content is one block in #1.
  const SKIP_SCHEMA_FIELDS = new Set([
    "ExcludedContracts2",
    "ExcludedContracts3",
  ]);
  const EXCLUDED_CONTRACT_FIELDS = new Set([
    "ExcludedContracts1",
    "ExcludedContracts2",
    "ExcludedContracts3",
  ]);

  /** @type {Array<Array<Record<string, unknown>>>} */
  const schemas = [];
  /** @type {string[]} */
  const mergeFields = [];
  const nameCounts = new Map();
  /** @type {null | { pageIndex: number, anchor: string, anchorOriginalHeightMm: number, followFields: string[], staticInputs: Record<string, string> }} */
  let flowPushDown = null;

  for (let p = 0; p < pageFields.length; p++) {
    const { width: pageW, height: pageH } = pageSizes[p];
    const fields = pageFields[p];
    const footer = pageFooters[p];
    const issuedBy = footer.blocks.find((b) => b.name === "_Static_IssuedBy");
    /** @type {Array<Record<string, unknown>>} */
    const pageSchemas = [];

    for (const field of fields) {
      const count = (nameCounts.get(field.name) ?? 0) + 1;
      nameCounts.set(field.name, count);
      const schemaName = count === 1 ? field.name : `${field.name}__${count}`;
      if (count === 1) mergeFields.push(field.name);

      // Still catalogue + redact siblings; only #1 gets a value box.
      if (SKIP_SCHEMA_FIELDS.has(field.name)) continue;

      const multiline = MULTILINE_FIELDS.has(field.name);
      const isExcludedBlock = field.name === "ExcludedContracts1";

      // Available row height: distance down to the next field in this column.
      let availablePt = field.fontSizePt * (multiline ? 2.6 : 2.4);

      if (isExcludedBlock) {
        const siblings = fields.filter((f) =>
          EXCLUDED_CONTRACT_FIELDS.has(f.name),
        );
        const lowest = Math.min(...siblings.map((f) => f.yPt));
        // Baseline = Word's three placeholder lines (generate may grow further).
        availablePt = Math.max(
          availablePt,
          field.yPt - lowest + field.fontSizePt * 2.2,
        );
        // Prefer stopping just above Issued By when it shares this page.
        if (issuedBy) {
          availablePt = Math.min(
            availablePt,
            Math.max(field.yPt - issuedBy.yPt - 4, field.fontSizePt * 2),
          );
        }
      }

      for (const other of fields) {
        if (other === field) continue;
        if (isExcludedBlock && EXCLUDED_CONTRACT_FIELDS.has(other.name)) {
          continue;
        }
        if (other.yPt >= field.yPt - 1.5) continue; // not below
        const sameColumn = Math.abs(other.xPt - field.xPt) < 20;
        const xOverlap =
          other.xPt < field.xPt + field.widthPt + 4 &&
          other.xPt + other.widthPt > field.xPt - 4;
        if (!sameColumn && !xOverlap) continue;
        const gap = field.yPt - other.yPt;
        if (gap > 3) {
          availablePt = Math.min(
            availablePt,
            isExcludedBlock ? gap * 0.55 : gap,
          );
        }
      }

      const heightPt = Math.min(
        Math.max(availablePt * 0.88, BODY_FONT_PT * 1.2),
        availablePt * 0.92,
      );
      // One consistent face — do not shrink to fit the cell.
      const fontSizePt = BODY_FONT_PT;

      const xMm = field.xPt * PT_TO_MM;
      const yMm = (pageH - field.yPt - fontSizePt * 0.8) * PT_TO_MM;
      const heightMm = heightPt * PT_TO_MM;
      const widthMm = Math.max(field.widthPt * PT_TO_MM, 10);

      pageSchemas.push({
        name: schemaName,
        type: "text",
        position: {
          x: Number(xMm.toFixed(2)),
          y: Number(Math.max(0, yMm).toFixed(2)),
        },
        width: Number(Math.min(widthMm, pageW * PT_TO_MM - xMm - 4).toFixed(2)),
        height: Number(heightMm.toFixed(2)),
        fontSize: fontSizePt,
        lineHeight: multiline ? 1.25 : 1.15,
        fontColor: "#111111",
        verticalAlignment: multiline ? "top" : "middle",
      });
    }

    // Re-add footer lines as overlay schemas (same page as Excluded Contracts).
    const hasEc = pageSchemas.some((s) => s.name === "ExcludedContracts1");
    if (hasEc && footer.blocks.length) {
      /** @type {Record<string, string>} */
      const staticInputs = {};
      const followFields = [];
      for (const block of footer.blocks) {
        const yMm = (pageH - block.yPt - BODY_FONT_PT * 0.8) * PT_TO_MM;
        const heightMm = BODY_FONT_PT * 1.35 * PT_TO_MM;
        pageSchemas.push({
          name: block.name,
          type: "text",
          position: {
            x: Number((block.xPt * PT_TO_MM).toFixed(2)),
            y: Number(Math.max(0, yMm).toFixed(2)),
          },
          width: Number(
            Math.min(
              block.widthPt * PT_TO_MM,
              pageW * PT_TO_MM - block.xPt * PT_TO_MM - 4,
            ).toFixed(2),
          ),
          height: Number(heightMm.toFixed(2)),
          fontSize: BODY_FONT_PT,
          lineHeight: 1.15,
          fontColor: "#111111",
          verticalAlignment: "top",
        });
        staticInputs[block.name] = block.text;
        followFields.push(block.name);
      }
      for (const name of ["Subject", "Content"]) {
        if (pageSchemas.some((s) => s.name === name)) followFields.push(name);
      }
      const ecSchema = pageSchemas.find((s) => s.name === "ExcludedContracts1");
      if (ecSchema && !flowPushDown) {
        flowPushDown = {
          pageIndex: p,
          anchor: "ExcludedContracts1",
          anchorOriginalHeightMm: Number(ecSchema.height),
          followFields,
          staticInputs,
        };
      }
    }

    // Content should top-align and use remaining space toward page bottom.
    const contentSchema = pageSchemas.find((s) => s.name === "Content");
    if (contentSchema) {
      contentSchema.verticalAlignment = "top";
      const maxH = pageH * PT_TO_MM - Number(contentSchema.position.y) - 12;
      contentSchema.height = Number(
        Math.max(Number(contentSchema.height), Math.min(maxH, 40)).toFixed(2),
      );
    }

    schemas.push(pageSchemas);
  }

  return {
    cleanedBytes,
    schemas,
    mergeFields,
    pageCount: pageFields.length,
    flowPushDown,
  };
}

async function writeSlot(slot) {
  const pdfName = sourcePdfName(slot.source);
  const tmpPdf = join(TMP_PDF_DIR, pdfName);
  if (!existsSync(tmpPdf)) {
    throw new Error(`Missing converted PDF: ${tmpPdf}`);
  }

  const pdfBytes = readFileSync(tmpPdf);
  const { cleanedBytes, schemas, mergeFields, pageCount, flowPushDown } =
    await buildStyledTemplate(pdfBytes);

  writeFileSync(join(BASE_PDF_DIR, `${slot.key}.pdf`), cleanedBytes);

  const payload = {
    key: slot.key,
    documentTypeCode: slot.documentTypeCode,
    coverTypeId: slot.coverTypeId,
    title: slot.title,
    sourceFile: slot.source,
    basePdfFile: `base-pdfs/${slot.key}.pdf`,
    versionNumber: 1,
    publishedAt: new Date().toISOString(),
    mergeFields,
    pageCount,
    ...(flowPushDown ? { flowPushDown } : {}),
    template: {
      basePdf: toDataUri(cleanedBytes),
      schemas,
    },
  };

  const outPath = join(OUT_DIR, `${slot.key}.json`);
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
  return {
    outPath,
    fieldCount: mergeFields.length,
    schemaCount: schemas.reduce((n, p) => n + p.length, 0),
    pages: pageCount,
    pdfBytes: cleanedBytes.length,
  };
}

function writeCatalogue(allFields) {
  writeFileSync(
    join(OUT_DIR, "merge-field-catalogue.json"),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        note: "Derived from «MergeField» markers in LibreOffice-converted Word PDFs",
        fields: [...allFields].sort(),
      },
      null,
      2,
    )}\n`,
  );
}

function writeIndex(results) {
  writeFileSync(
    join(OUT_DIR, "index.json"),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        style: "Word layout preserved via LibreOffice PDF basePdf",
        slots: results.map((r) => ({
          key: r.key,
          documentTypeCode: r.documentTypeCode,
          coverTypeId: r.coverTypeId,
          sourceFile: r.sourceFile,
          fieldCount: r.fieldCount,
          schemaCount: r.schemaCount,
          pages: r.pages,
          file: `${r.key}.json`,
          basePdfFile: `base-pdfs/${r.key}.pdf`,
        })),
        libraryDocuments: LIBRARY_PDFS.map((name) => ({
          name,
          path: `/library-documents/${encodeURIComponent(name)}`,
        })),
      },
      null,
      2,
    )}\n`,
  );
}

function copyLibraryPdfs() {
  for (const name of LIBRARY_PDFS) {
    const src = join(SOURCE_DIR, name);
    if (!existsSync(src)) {
      console.warn(`Skip missing library PDF: ${name}`);
      continue;
    }
    copyFileSync(src, join(LIBRARY_OUT, name));
  }
}

function writeReadme() {
  writeFileSync(
    join(OUT_DIR, "README.md"),
    `# CAR pdfme templates

Generated from \`car-pdf-templates/*.doc\` with **original Word style preserved**.

## How style is kept

1. Docker LibreOffice converts each \`.doc\` → PDF (\`base-pdfs/*.pdf\`)
2. Merge-field markers (\`«FieldName»\`) are located (including split runs)
3. Placeholders are white-redacted on the base PDF
4. pdfme text schemas overlay those positions for live values

## Regenerate

\`\`\`bash
npm run pdf:templates
SKIP_LIBREOFFICE=1 npm run pdf:templates
\`\`\`

Requires Docker (\`linuxserver/libreoffice\`).
`,
  );
}

async function main() {
  ensureDirs();
  convertDocsWithLibreOffice();

  const allFields = new Set();
  const results = [];

  for (const slot of SLOTS) {
    const written = await writeSlot(slot);
    for (const name of JSON.parse(readFileSync(written.outPath, "utf8"))
      .mergeFields) {
      allFields.add(name);
    }
    console.log(
      `${slot.key}: ${written.fieldCount} fields, ${written.schemaCount} schemas, ${written.pages} page(s), basePdf ${written.pdfBytes} bytes`,
    );
    results.push({
      key: slot.key,
      documentTypeCode: slot.documentTypeCode,
      coverTypeId: slot.coverTypeId,
      sourceFile: slot.source,
      fieldCount: written.fieldCount,
      schemaCount: written.schemaCount,
      pages: written.pages,
    });
  }

  writeCatalogue(allFields);
  writeIndex(results);
  writeReadme();
  copyLibraryPdfs();
  console.log(`Catalogue: ${allFields.size} unique merge fields`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

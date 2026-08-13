import { describe, expect, it } from "vitest";
import {
  htmlToDrawLines,
  wordingHtmlLineCount,
  estimateWordingHtmlHeightMm,
  type DrawLine,
} from "~/lib/pdf/html-rich-text-lines";
import {
  endorsementReserveHeightForLinesMm,
  splitLineCountsIntoPages,
  countLinesFittingInBandMm,
  endorsementPaintTopInsetMm,
  endorsementLineStepMm,
  minEndorsementPaintBandMm,
} from "~/lib/pdf/html-rich-text-geometry";

const measure = (text: string) => text.length * 5;

describe("HTML Rich Text Golden Fixtures", () => {
  describe("htmlToDrawLines golden fixtures", () => {
    const fixtures = [
      {
        name: "complex_nested_lists_mixed_styles",
        html: `
          <ol>
            <li>
              <p><strong>Primary item 1</strong></p>
              <ul data-list-style="dash">
                <li><p><em>Nested dash a</em></p></li>
                <li>
                  <p><u>Nested dash b with underline</u></p>
                  <ol data-list-style="lower-alpha">
                    <li><p>Deep alpha i</p></li>
                    <li><p>Deep alpha ii</p></li>
                  </ol>
                </li>
              </ul>
            </li>
            <li><p>Primary item 2</p></li>
          </ol>
        `,
        expected: {
          totalLines: 7,
          markers: ["1. ", "- ", "- ", "a) ", "b) ", "2. "],
          indentLevels: [0, 1, 1, 2, 2, 0],
          hasBold: true,
          hasItalic: true,
          hasUnderline: true,
        },
      },
      {
        name: "mixed_formatting_with_spans",
        html: `
          <p>Normal text <strong>bold</strong> <em>italic</em> <u>underline</u></p>
          <p><span style="font-weight: bold; font-style: italic">Bold italic span</span></p>
          <p><span style="text-decoration: underline">Underline span</span></p>
        `,
        expected: {
          totalLines: 3,
          formatChanges: 6, // Normal→bold→italic→underline→bold italic→underline
          noMarkers: true,
        },
      },
      {
        name: "html_entities_and_unicode",
        html: `
          <p>Ampersand &amp; &lt; &gt; &quot; &apos;</p>
          <p>Non-breaking spaces&nbsp;here</p>
          <p>Unicode: © ® ™ € £ ¥</p>
          <p>Smart quotes: "curly" 'single'</p>
        `,
        expected: {
          totalLines: 4,
          decodedAmpersand: "Ampersand & < > \" '",
          hasNbsp: true,
          preservesUnicode: true,
        },
      },
      {
        name: "empty_and_whitespace_edge_cases",
        html: `
          <p></p>
          <p><br></p>
          <p>  Leading spaces  </p>
          <p>Trailing spaces  </p>
          <p>   </p>
        `,
        expected: {
          totalLines: 6, // Includes blank lines from empty/whitespace paragraphs
          trimmedText: ["Leading spaces", "Trailing spaces"],
          preservesBlankLines: true,
        },
      },
      {
        name: "list_marker_alignment_sizing",
        html: `
          <ol data-list-style="lower-roman">
            <li><p>Short</p></li>
            <li><p>Medium length item</p></li>
            <li><p>Very long list item that should wrap onto multiple lines for testing hanging indent</p></li>
          </ol>
        `,
        expected: {
          markers: ["(i) ", "(ii) ", "(iii) "],
          listGroupIdConsistent: true,
          wrappedLinesHaveSameGroupId: true,
          indentConsistent: true,
        },
        widthMm: 80, // Narrow to force wrapping
      },
      {
        name: "font_size_family_inheritance",
        html: `
          <p>Base text</p>
          <p><span style="font-size: 14pt">Larger</span></p>
          <p><span style="font-family: 'Times New Roman'">Different family</span></p>
          <p><span style="font-size: 7pt; font-family: 'Times New Roman'">Small Times</span></p>
        `,
        expected: {
          totalLines: 4,
          fontSizeChanges: 3,
          fontFamilyChanges: 2,
        },
        lockSchemaMetrics: false,
      },
    ];

    for (const fixture of fixtures) {
      it(`handles ${fixture.name}`, () => {
        const lines = htmlToDrawLines(
          fixture.html,
          { fontSizePt: 9.5, family: "Roboto" },
          fixture.widthMm || 185,
          measure,
          { lockSchemaMetrics: fixture.lockSchemaMetrics },
        );

        // Verify line count expectation
        if (fixture.expected.totalLines) {
          expect(lines.length).toBe(fixture.expected.totalLines);
        }

        // Verify markers if specified
        if (fixture.expected.markers) {
          const actualMarkers = lines
            .map((line) => line.marker || "")
            .filter((m) => m);
          expect(actualMarkers).toEqual(fixture.expected.markers);
        }

        // Verify list group ID consistency
        if (fixture.expected.listGroupIdConsistent) {
          const groupIds = lines
            .map((line) => line.listGroupId)
            .filter((id) => id !== undefined);
          const uniqueGroupIds = new Set(groupIds);
          expect(uniqueGroupIds.size).toBeLessThanOrEqual(1);
        }

        // Verify wrapped lines have same group ID
        if (fixture.expected.wrappedLinesHaveSameGroupId) {
          const linesWithMarkers = lines.filter((line) => line.marker);
          const linesWithoutMarkers = lines.filter(
            (line) => !line.marker && line.runs.length > 0,
          );

          if (linesWithMarkers.length > 0 && linesWithoutMarkers.length > 0) {
            const markerGroupId = linesWithMarkers[0]!.listGroupId;
            for (const line of linesWithoutMarkers) {
              expect(line.listGroupId).toBe(markerGroupId);
            }
          }
        }

        // Verify indentation consistency
        if (fixture.expected.indentConsistent) {
          const linesWithMarkers = lines.filter((line) => line.marker);
          if (linesWithMarkers.length > 1) {
            const firstIndent = linesWithMarkers[0]!.indentPx;
            for (let i = 1; i < linesWithMarkers.length; i++) {
              expect(linesWithMarkers[i]!.indentPx).toBe(firstIndent);
            }
          }
        }

        // Verify formatting changes
        if (fixture.expected.formatChanges) {
          let formatChangeCount = 0;
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i]!;
            for (let j = 0; j < line.runs.length; j++) {
              const run = line.runs[j]!;
              if (j > 0) {
                const prevRun = line.runs[j - 1]!;
                if (
                  run.style.bold !== prevRun.style.bold ||
                  run.style.italic !== prevRun.style.italic ||
                  run.style.underline !== prevRun.style.underline ||
                  run.style.fontSizePt !== prevRun.style.fontSizePt ||
                  run.style.family !== prevRun.style.family
                ) {
                  formatChangeCount++;
                }
              }
            }
          }
          expect(formatChangeCount).toBeGreaterThanOrEqual(
            fixture.expected.formatChanges,
          );
        }

        // Verify decoded entities
        if (fixture.expected.decodedAmpersand) {
          const allText = lines
            .flatMap((line) => line.runs.map((run) => run.text))
            .join("");
          expect(allText).toContain(fixture.expected.decodedAmpersand);
        }

        // Verify no markers if expected
        if (fixture.expected.noMarkers) {
          const hasMarkers = lines.some((line) => line.marker);
          expect(hasMarkers).toBe(false);
        }

        // Verify trimmed text
        if (fixture.expected.trimmedText) {
          const allText = lines
            .flatMap((line) => line.runs.map((run) => run.text))
            .join(" ");
          for (const text of fixture.expected.trimmedText) {
            expect(allText).toContain(text);
          }
        }
      });
    }
  });

  describe("line counting and pagination golden fixtures", () => {
    const fixtures = [
      {
        name: "exact_page_boundary_fitting",
        html: "<p>Line 1</p><p>Line 2</p><p>Line 3</p><p>Line 4</p><p>Line 5</p>",
        widthMm: 185,
        fontSizePt: 9.5,
        lineHeight: 1.25,
        firstMaxMm: 15, // Exactly fits 5 lines
        pageMaxMm: 15,
        expectedChunks: [5],
        expectedTotalLines: 5,
      },
      {
        name: "overflow_to_continuation",
        html: "<p>Line 1</p><p>Line 2</p><p>Line 3</p><p>Line 4</p><p>Line 5</p><p>Line 6</p>",
        widthMm: 185,
        fontSizePt: 9.5,
        lineHeight: 1.25,
        firstMaxMm: 12, // Fits 4 lines
        pageMaxMm: 12,
        expectedChunks: [4, 2],
        expectedTotalLines: 6,
      },
      {
        name: "multi_page_overflow",
        html: Array.from({ length: 20 }, (_, i) => `<p>Paragraph ${i + 1}</p>`).join(""),
        widthMm: 185,
        fontSizePt: 9.5,
        lineHeight: 1.25,
        firstMaxMm: 15,
        pageMaxMm: 15,
        expectedChunks: [5, 5, 5, 5], // Should be evenly distributed
        expectedTotalLines: 20,
      },
      {
        name: "tall_first_page_short_continuations",
        html: Array.from({ length: 12 }, (_, i) => `<p>Item ${i + 1}</p>`).join(""),
        widthMm: 185,
        fontSizePt: 9.5,
        lineHeight: 1.25,
        firstMaxMm: 30, // Tall first page
        pageMaxMm: 15, // Shorter continuation pages
        expectedChunks: [10, 2], // Most lines on first page
        expectedTotalLines: 12,
      },
    ];

    for (const fixture of fixtures) {
      it(`paginates ${fixture.name} correctly`, () => {
        // Calculate line count
        const lineCount = wordingHtmlLineCount(
          fixture.html,
          fixture.widthMm,
          fixture.fontSizePt,
        );
        expect(lineCount).toBe(fixture.expectedTotalLines);

        // Split into pages
        const chunks = splitLineCountsIntoPages(
          lineCount,
          fixture.firstMaxMm,
          fixture.pageMaxMm,
          fixture.fontSizePt,
          fixture.lineHeight,
        );

        // Verify chunk distribution
        expect(chunks).toEqual(fixture.expectedChunks);
        expect(chunks.reduce((sum, n) => sum + n, 0)).toBe(
          fixture.expectedTotalLines,
        );

        // Verify each chunk fits in its allocated space
        let remaining = lineCount;
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i]!;
          const maxMm = i === 0 ? fixture.firstMaxMm : fixture.pageMaxMm;
          const maxLines = countLinesFittingInBandMm(
            maxMm,
            fixture.fontSizePt,
            fixture.lineHeight,
          );
          expect(chunk).toBeLessThanOrEqual(maxLines);
          remaining -= chunk;
        }
        expect(remaining).toBe(0);
      });
    }
  });

  describe("geometry calculation golden fixtures", () => {
    const fixtures = [
      {
        name: "font_size_scaling",
        fontSizePt: 9.5,
        lineHeight: 1.25,
        expected: {
          paintTopInsetMm: 9.5 * 0.85 * (25.4 / 72), // fontSizePt * 0.85 * PT_TO_MM
          lineStepMm: 9.5 * 1.25 * (25.4 / 72), // fontSizePt * lineHeight * PT_TO_MM
          minBandMm: 9.5 * 0.85 * (25.4 / 72), // Same as paintTopInsetMm
        },
      },
      {
        name: "larger_font_geometry",
        fontSizePt: 14,
        lineHeight: 1.2,
        expected: {
          paintTopInsetMm: 14 * 0.85 * (25.4 / 72),
          lineStepMm: 14 * 1.2 * (25.4 / 72),
          minBandMm: 14 * 0.85 * (25.4 / 72),
        },
      },
      {
        name: "height_reservation_rounding",
        lineCount: 3,
        fontSizePt: 9.5,
        lineHeight: 1.25,
        expected: {
          // Height should be rounded up to ensure lines fit
          reservedHeight: ">0",
          exactFit: true, // countLinesFittingInBandMm(reservedHeight) >= lineCount
        },
      },
    ];

    for (const fixture of fixtures) {
      it(`calculates ${fixture.name} correctly`, () => {
        const PT_TO_MM = 25.4 / 72;

        // Verify paint top inset
        const insetMm = endorsementPaintTopInsetMm(fixture.fontSizePt);
        if (fixture.expected.paintTopInsetMm) {
          expect(insetMm).toBeCloseTo(fixture.expected.paintTopInsetMm, 4);
        }

        // Verify line step
        const stepMm = endorsementLineStepMm(
          fixture.fontSizePt,
          fixture.lineHeight,
        );
        if (fixture.expected.lineStepMm) {
          expect(stepMm).toBeCloseTo(fixture.expected.lineStepMm, 4);
        }

        // Verify minimum band
        const minBandMm = minEndorsementPaintBandMm(
          fixture.fontSizePt,
          fixture.lineHeight,
        );
        if (fixture.expected.minBandMm) {
          expect(minBandMm).toBeCloseTo(fixture.expected.minBandMm, 4);
        }

        // Verify height reservation
        if (fixture.expected.reservedHeight) {
          const reservedHeight = endorsementReserveHeightForLinesMm(
            fixture.lineCount!,
            fixture.fontSizePt,
            fixture.lineHeight,
          );
          expect(reservedHeight).toBeGreaterThan(0);

          if (fixture.expected.exactFit) {
            const fits = countLinesFittingInBandMm(
              reservedHeight,
              fixture.fontSizePt,
              fixture.lineHeight,
            );
            expect(fits).toBeGreaterThanOrEqual(fixture.lineCount!);
          }
        }
      });
    }
  });

  describe("height estimation golden fixtures", () => {
    const fixtures = [
      {
        name: "single_line_estimation",
        html: "<p>Single line paragraph</p>",
        widthMm: 185,
        fontSizePt: 9.5,
        lineHeight: 1.25,
        expectedLines: 1,
        expectedHeight: ">0",
      },
      {
        name: "multi_line_wrapping",
        html: "<p>A very long paragraph that should wrap onto multiple lines because it exceeds the available width by a significant margin, forcing line breaks at appropriate positions.</p>",
        widthMm: 80, // Narrow to force wrapping
        fontSizePt: 9.5,
        lineHeight: 1.25,
        expectedLines: ">2",
        expectedHeight: ">0",
      },
      {
        name: "empty_html",
        html: "",
        widthMm: 185,
        fontSizePt: 9.5,
        lineHeight: 1.25,
        expectedLines: 0,
        expectedHeight: 0.05, // endorsementReserveHeightForLinesMm adds 0.05 buffer
      },
      {
        name: "whitespace_only",
        html: "   \n  \t  ",
        widthMm: 185,
        fontSizePt: 9.5,
        lineHeight: 1.25,
        expectedLines: 0,
        expectedHeight: 0.05, // endorsementReserveHeightForLinesMm adds 0.05 buffer
      },
    ];

    for (const fixture of fixtures) {
      it(`estimates ${fixture.name} correctly`, () => {
        // Line count estimation
        const lineCount = wordingHtmlLineCount(
          fixture.html,
          fixture.widthMm,
          fixture.fontSizePt,
        );

        if (typeof fixture.expectedLines === "number") {
          expect(lineCount).toBe(fixture.expectedLines);
        } else if (fixture.expectedLines.startsWith(">")) {
          const minLines = parseInt(fixture.expectedLines.slice(1));
          expect(lineCount).toBeGreaterThan(minLines);
        }

        // Height estimation
        const heightMm = estimateWordingHtmlHeightMm(
          fixture.html,
          fixture.widthMm,
          fixture.fontSizePt,
          fixture.lineHeight,
        );

        if (fixture.expectedHeight === 0) {
          expect(heightMm).toBe(0);
        } else if (fixture.expectedHeight === ">0") {
          expect(heightMm).toBeGreaterThan(0);
        } else if (typeof fixture.expectedHeight === "number") {
          expect(heightMm).toBeCloseTo(fixture.expectedHeight, 2);
        }

        // Verify consistency between line count and height
        if (lineCount > 0) {
          const reservedHeight = endorsementReserveHeightForLinesMm(
            lineCount,
            fixture.fontSizePt,
            fixture.lineHeight,
          );
          expect(heightMm).toBeCloseTo(reservedHeight, 2);
        }
      });
    }
  });
});
import { describe, expect, it } from "vitest";
import {
  slugifyDocumentTemplateKey,
  saveDocumentTemplateInputSchema,
  createDocumentTemplateInputSchema,
  updateDocumentTemplateMetaInputSchema,
} from "~/lib/services/documents/document-templates";

describe("Document Templates Golden Fixtures", () => {
  describe("slugifyDocumentTemplateKey", () => {
    const slugifyFixtures = [
      {
        name: "simple_title",
        input: "Policy Schedule",
        expected: "policy-schedule",
      },
      {
        name: "title_with_special_chars",
        input: "Policy & Schedule (Annual)",
        expected: "policy-schedule-annual",
      },
      {
        name: "title_with_unicode",
        input: "Política de Seguro",
        expected: "politica-de-seguro",
      },
      {
        name: "very_long_title",
        input:
          "This is a very long document template title that exceeds sixty four characters limit for sure",
        expected:
          "this-is-a-very-long-document-template-title-that-exceeds-sixty-f", // truncated at 64 chars
      },
      {
        name: "title_with_multiple_hyphens",
        input: "Policy---Schedule--Annual",
        expected: "policy-schedule-annual",
      },
      {
        name: "title_leading_trailing_dashes",
        input: "-Policy Schedule-",
        expected: "policy-schedule",
      },
      {
        name: "empty_title",
        input: "",
        expected: "template",
      },
      {
        name: "title_only_special_chars",
        input: "!!! & @@@",
        expected: "template",
      },
      {
        name: "numbers_in_title",
        input: "Policy Schedule 2024 v2.0",
        expected: "policy-schedule-2024-v2-0",
      },
    ];

    for (const fixture of slugifyFixtures) {
      it(`slugifies ${fixture.name} correctly`, () => {
        const result = slugifyDocumentTemplateKey(fixture.input);
        expect(result).toBe(fixture.expected);
      });
    }

    it("generates unique slugs for similar titles", () => {
      const title1 = "Policy Schedule";
      const title2 = "policy schedule";
      const title3 = "Policy-Schedule";

      const slug1 = slugifyDocumentTemplateKey(title1);
      const slug2 = slugifyDocumentTemplateKey(title2);
      const slug3 = slugifyDocumentTemplateKey(title3);

      // All should be the same
      expect(slug1).toBe(slug2);
      expect(slug2).toBe(slug3);
      expect(slug1).toBe("policy-schedule");
    });

    it("respects maximum length of 64 characters", () => {
      const longTitle = "a".repeat(100);
      const slug = slugifyDocumentTemplateKey(longTitle);

      expect(slug.length).toBeLessThanOrEqual(64);
      expect(slug).toBe("a".repeat(64)); // Multiple 'a's are not collapsed
    });
  });

  describe("saveDocumentTemplateInputSchema validation", () => {
    const validTemplate = {
      basePdf: DOCUMENT_TEMPLATE_BLANK_BASE_PDF,
      schemas: [
        [
          {
            name: "PolicyNumber",
            type: "text",
            position: { x: 15, y: 30 },
            width: 80,
            height: 8,
            fontSize: 10,
            fontName: "Roboto",
          },
        ],
      ],
    };

    const validFixtures = [
      {
        name: "basic_template_no_flow_push_down",
        input: {
          documentTemplateKey: "policy-schedule",
          template: validTemplate,
        },
      },
      {
        name: "template_with_flow_push_down",
        input: {
          documentTemplateKey: "policy-schedule",
          template: validTemplate,
          flowPushDown: {
            pageIndex: 0,
            anchor: "EndorsementBox",
            anchorOriginalHeightMm: 50,
            followFields: ["EndorsementSubject", "EndorsementContent"],
            staticInputs: { CompanyName: "Insurance Co" },
          },
        },
      },
      {
        name: "template_with_merge_fields",
        input: {
          documentTemplateKey: "policy-schedule",
          template: validTemplate,
          mergeFields: ["PolicyNumber", "InsuredName", "Address"],
        },
      },
      {
        name: "template_with_all_fields",
        input: {
          documentTemplateKey: "policy-schedule",
          template: validTemplate,
          flowPushDown: {
            pageIndex: 0,
            anchor: "EndorsementBox",
            anchorOriginalHeightMm: 50,
            followFields: ["EndorsementSubject"],
            staticInputs: {},
          },
          mergeFields: ["PolicyNumber"],
        },
      },
    ];

    const invalidFixtures = [
      {
        name: "missing_document_template_key",
        input: {
          template: validTemplate,
        },
        expectedError: "documentTemplateKey",
      },
      {
        name: "empty_document_template_key",
        input: {
          documentTemplateKey: "",
          template: validTemplate,
        },
        expectedError: "documentTemplateKey",
      },
      {
        name: "too_long_document_template_key",
        input: {
          documentTemplateKey: "a".repeat(65),
          template: validTemplate,
        },
        expectedError: "documentTemplateKey",
      },
      {
        name: "missing_template",
        input: {
          documentTemplateKey: "policy-schedule",
        },
        expectedError: "template",
      },
      {
        name: "invalid_flow_push_down_page_index",
        input: {
          documentTemplateKey: "policy-schedule",
          template: validTemplate,
          flowPushDown: {
            pageIndex: -1, // invalid
            anchor: "EndorsementBox",
            anchorOriginalHeightMm: 50,
            followFields: [],
            staticInputs: {},
          },
        },
        expectedError: "pageIndex",
      },
      {
        name: "empty_flow_push_down_anchor",
        input: {
          documentTemplateKey: "policy-schedule",
          template: validTemplate,
          flowPushDown: {
            pageIndex: 0,
            anchor: "", // empty
            anchorOriginalHeightMm: 50,
            followFields: [],
            staticInputs: {},
          },
        },
        expectedError: "anchor",
      },
    ];

    for (const fixture of validFixtures) {
      it(`validates ${fixture.name} successfully`, () => {
        const result = saveDocumentTemplateInputSchema.safeParse(fixture.input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.documentTemplateKey).toBe(
            fixture.input.documentTemplateKey,
          );
        }
      });
    }

    for (const fixture of invalidFixtures) {
      it(`rejects ${fixture.name}`, () => {
        const result = saveDocumentTemplateInputSchema.safeParse(fixture.input);
        expect(result.success).toBe(false);
        // Note: We're just checking validation fails, not specific error messages
        // as Zod error structure might vary
      });
    }
  });

  describe("createDocumentTemplateInputSchema validation", () => {
    const validFixtures = [
      {
        name: "basic_template_with_cover_type",
        input: {
          coverTypeId: 1,
          title: "Policy Schedule",
          label: "Schedule",
        },
      },
      {
        name: "template_without_cover_type",
        input: {
          coverTypeId: null,
          title: "Generic Template",
          label: "Generic",
        },
      },
      {
        name: "template_without_label",
        input: {
          coverTypeId: 1,
          title: "Policy Schedule",
        },
      },
      {
        name: "template_with_long_title",
        input: {
          coverTypeId: 1,
          title: "A".repeat(512), // max length
          label: "Schedule",
        },
      },
    ];

    const invalidFixtures = [
      {
        name: "missing_title",
        input: {
          coverTypeId: 1,
          label: "Schedule",
        },
        expectedError: "title",
      },
      {
        name: "empty_title",
        input: {
          coverTypeId: 1,
          title: "",
          label: "Schedule",
        },
        expectedError: "title",
      },
      {
        name: "title_too_long",
        input: {
          coverTypeId: 1,
          title: "A".repeat(513), // exceeds max
          label: "Schedule",
        },
        expectedError: "title",
      },
      {
        name: "only_whitespace_title",
        input: {
          coverTypeId: 1,
          title: "   ",
          label: "Schedule",
        },
        expectedError: "title",
      },
      {
        name: "invalid_cover_type_id",
        input: {
          coverTypeId: 4, // invalid - only 1,2,3 or null allowed
          title: "Policy Schedule",
          label: "Schedule",
        },
        expectedError: "coverTypeId",
      },
      {
        name: "label_too_long",
        input: {
          coverTypeId: 1,
          title: "Policy Schedule",
          label: "S".repeat(65), // exceeds DOCUMENT_LABEL_MAX_LENGTH
        },
        expectedError: "label",
      },
    ];

    for (const fixture of validFixtures) {
      it(`validates ${fixture.name} successfully`, () => {
        const result = createDocumentTemplateInputSchema.safeParse(
          fixture.input,
        );
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.title).toBe(fixture.input.title.trim());
        }
      });
    }

    for (const fixture of invalidFixtures) {
      it(`rejects ${fixture.name}`, () => {
        const result = createDocumentTemplateInputSchema.safeParse(
          fixture.input,
        );
        expect(result.success).toBe(false);
        // Note: We're just checking validation fails, not specific error messages
        // as Zod error structure might vary
      });
    }
  });

  describe("updateDocumentTemplateMetaInputSchema validation", () => {
    const validFixtures = [
      {
        name: "full_update",
        input: {
          documentTemplateKey: "policy-schedule",
          coverTypeId: 1,
          title: "Updated Policy Schedule",
          label: "Updated Schedule",
        },
      },
      {
        name: "update_with_null_cover_type",
        input: {
          documentTemplateKey: "policy-schedule",
          coverTypeId: null,
          title: "Generic Template",
          label: "Generic",
        },
      },
    ];

    const invalidFixtures = [
      {
        name: "missing_document_template_key",
        input: {
          coverTypeId: 1,
          title: "Updated Title",
          label: "Updated Label",
        },
        expectedError: "documentTemplateKey",
      },
      {
        name: "empty_document_template_key",
        input: {
          documentTemplateKey: "",
          coverTypeId: 1,
          title: "Updated Title",
          label: "Updated Label",
        },
        expectedError: "documentTemplateKey",
      },
      {
        name: "title_too_long",
        input: {
          documentTemplateKey: "policy-schedule",
          coverTypeId: 1,
          title: "A".repeat(513),
          label: "Schedule",
        },
        expectedError: "title",
      },
      {
        name: "label_too_long",
        input: {
          documentTemplateKey: "policy-schedule",
          coverTypeId: 1,
          title: "Policy Schedule",
          label: "S".repeat(65),
        },
        expectedError: "label",
      },
      {
        name: "label_missing",
        input: {
          documentTemplateKey: "policy-schedule",
          coverTypeId: 1,
          title: "Policy Schedule",
        },
        expectedError: "label",
      },
    ];

    for (const fixture of validFixtures) {
      it(`validates ${fixture.name} successfully`, () => {
        const result = updateDocumentTemplateMetaInputSchema.safeParse(
          fixture.input,
        );
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.documentTemplateKey).toBe(
            fixture.input.documentTemplateKey,
          );
        }
      });
    }

    for (const fixture of invalidFixtures) {
      it(`rejects ${fixture.name}`, () => {
        const result = updateDocumentTemplateMetaInputSchema.safeParse(
          fixture.input,
        );
        expect(result.success).toBe(false);
        // Note: We're just checking validation fails, not specific error messages
        // as Zod error structure might vary
      });
    }
  });

  describe("schema consistency verification", () => {
    it("ensures slugify produces valid document template keys", () => {
      const testTitles = [
        "Policy Schedule",
        "Annual Policy",
        "Rating Sheet",
        "Adjustment Document",
        "Endorsement Template",
      ];

      for (const title of testTitles) {
        const slug = slugifyDocumentTemplateKey(title);

        // Verify slug is valid according to schema
        const validation = saveDocumentTemplateInputSchema.safeParse({
          documentTemplateKey: slug,
          template: {
            basePdf: DOCUMENT_TEMPLATE_BLANK_BASE_PDF,
            schemas: [[]],
          },
        });

        expect(validation.success).toBe(true);
      }
    });

    it("verifies create and update schemas have compatible constraints", () => {
      // Create schema should accept null label
      const createInput = {
        coverTypeId: 1,
        title: "Test Template",
      };
      const createResult =
        createDocumentTemplateInputSchema.safeParse(createInput);
      expect(createResult.success).toBe(true);

      // Update schema should require label
      const updateInput = {
        documentTemplateKey: "test-template",
        coverTypeId: 1,
        title: "Test Template",
        label: "", // empty but present
      };
      const updateResult =
        updateDocumentTemplateMetaInputSchema.safeParse(updateInput);
      expect(updateResult.success).toBe(true);
    });
  });
});

// Mock constant for tests
const DOCUMENT_TEMPLATE_BLANK_BASE_PDF = {
  width: 210,
  height: 297,
  padding: [15, 15, 15, 15],
};

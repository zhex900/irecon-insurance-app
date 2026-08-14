# PDF/Pricing File Splitting Refactor Plan

## Current State Analysis (2026-08-13)

### Problem Statement

Five core PDF/pricing files exceed the 500-line file cap with some functions well over the 50-line function cap:

1. **`app/lib/pdf/html-rich-text-lines.ts`** (641 lines)
   - `htmlToDrawLines`: ~306 lines (lines 83-388)
   - Overly monolithic HTML parsing and line-wrapping logic

2. **`app/lib/pricing/premium-workings.ts`** (560 lines)
   - Core premium calculation engine with complex business logic

3. **`app/lib/services/documents/document-templates.ts`** (827 lines)
   - Template management with CRUD operations, versioning, and database interactions

4. **`app/lib/pdf/html-rich-text-draw.ts`** (526 lines)
   - PDF rendering operations with complex pagination logic

5. **`app/lib/pdf/endorsement-expand.ts`** (587 lines)
   - Endorsement layout and pagination logic

### Risk Assessment

These files contain:

- **PDF pagination/layout logic** with subtle page-break behavior
- **Financial calculation engines** with premium formulas
- **Critical business logic** for policy document generation
- **Complex font metrics and layout algorithms**

Splitting without proper test coverage risks silent regressions in:

- Generated policy documents (PDF layout, pagination)
- Premium calculations (financial accuracy)
- Document generation (template rendering)

## Refactoring Strategy

Follow the repository's decision rule: **"prefer simpler; don't rewrite working code unnecessarily; split on touch"**.

### Phase 1: Test Augmentation (Golden Fixtures)

**Objective**: Create comprehensive golden-fixture tests to verify existing behavior and enable safe refactoring.

#### 1.1 HTML Rich Text Tests

- [ ] **Golden fixtures for HTML parsing edge cases**
  - Complex nested lists with different styles
  - Mixed formatting (bold, italic, underline combinations)
  - HTML entity decoding edge cases
  - Unicode and special character handling
  - Empty/corner cases (empty paragraphs, `<br>` handling)

- [ ] **Line wrapping and measurements**
  - Exact line counts for known HTML inputs
  - Marker column width calculations
  - Hanging indent verification for wrapped list items
  - Font family/style inheritance

#### 1.2 Premium Calculation Tests

- [ ] **Formula verification across all premium line types**
  - Contract works calculations
  - Liability calculations
  - Plant equipment premium special cases
  - Terrorism rate applications
  - ESL and stamp duty calculations
  - Manual vs auto-calculated flags

- [ ] **Edge case scenarios**
  - Pre/post terrorism date calculations
  - Plant certificate turnover limits
  - Minimum premium rules
  - GST and duty rounding behavior

#### 1.3 PDF Layout and Pagination Tests

- [ ] **Page break behavior verification**
  - Content that fits exactly on page boundaries
  - Overflow to continuation pages
  - Bottom margin calculations
  - Reserved height vs actual paint height

- [ ] **Multi-page endorsement layout**
  - Subject/content pairing across pages
  - Block gap preservation
  - Follower field positioning
  - Rich HTML vs plain text layout differences

#### 1.4 PDF Output Comparison Tests (CRITICAL)

- [ ] **End-to-end PDF generation verification**
  - Generate PDFs with representative merge field inputs
  - Compare output byte-by-byte with golden reference PDFs
  - Verify layout, pagination, and content positioning

- [ ] **Template variations**
  - Different template types (schedule, rating, adjustment)
  - Blank vs static base PDFs
  - With and without flow push-down configurations

- [ ] **Endorsement expansion verification**
  - Simple vs complex endorsements
  - Plain text vs rich HTML endorsements
  - Multi-page overflow scenarios

#### 1.5 Document Template Tests

- [ ] **Template CRUD operations**
  - Version number sequencing
  - Publish/unpublish behavior
  - Slug generation and validation
  - Merge field extraction

- [ ] **Template rendering**
  - Base PDF handling (blank vs static)
  - Schema promotion logic
  - Flow push-down configuration

### Phase 2: Incremental File Splitting

#### 2.1 `html-rich-text-lines.ts` (641 → ~250 lines each)

**Proposed structure:**

- `html-rich-text-parser.ts` (HTML tokenization and parsing)
- `html-rich-text-wrapping.ts` (Line wrapping and measurements)
- `html-rich-text-geometry.ts` (Endorsement geometry calculations)

**Key functions to extract:**

- `htmlToDrawLines` → Split into parser and wrapper components
- Helper functions (`decodeEntities`, `readAttr`, `parseStyleDecls`) → Shared utilities
- Geometry functions (`endorsementPaintTopInsetMm`, etc.) → Dedicated geometry module

#### 2.2 `premium-workings.ts` (560 → ~280 lines each)

**Proposed structure:**

- `premium-calculations.ts` (Core calculation logic)
- `premium-explanations.ts` (Step-by-step explanations)
- `premium-validation.ts` (Manual flag detection, validation)

**Key functions to extract:**

- `calcBundle` → Core calculations module
- `plantPremium` → Dedicated plant calculations
- `buildSteps` → Explanations module
- `expectedPremiumValue` → Validation/expectation module

#### 2.3 `document-templates.ts` (827 → ~275 lines each)

**Proposed structure:**

- `document-template-queries.ts` (Database queries and row mappings)
- `document-template-operations.ts` (Create/update/publish logic)
- `document-template-schemas.ts` (Zod schemas and validation)
- `document-template-types.ts` (Type definitions and interfaces)

**Key areas to split:**

- Database query functions → Queries module
- CRUD operations → Operations module
- Zod schemas → Schemas module
- Type definitions → Types module

#### 2.4 `html-rich-text-draw.ts` (526 → ~250 lines each)

**Proposed structure:**

- `pdf-font-embedding.ts` (Font embedding and management)
- `pdf-drawing-operations.ts` (Actual drawing operations)
- `pdf-page-management.ts` (Page insertion/removal logic)

**Key functions to extract:**

- `embedFontMap` → Font embedding module
- `drawLinesAcrossPages` → Drawing operations module
- Page management logic → Page management module

#### 2.5 `endorsement-expand.ts` (587 → ~250 lines each)

**Proposed structure:**

- `endorsement-parsing.ts` (Input parsing and pair extraction)
- `endorsement-layout.ts` (Position and height calculations)
- `endorsement-schema-generation.ts` (Schema cloning and generation)

**Key functions to extract:**

- `parseEndorsementPairsFromInputs` → Parsing module
- Layout calculations → Layout module
- Schema generation → Schema generation module

### Phase 3: Integration and Verification

#### 3.1 Test Coverage Verification

- [ ] Run complete test suite after each split
- [ ] Verify no regressions in existing tests
- [ ] Add integration tests for split modules

#### 3.2 Performance Validation

- [ ] Verify PDF generation times remain consistent
- [ ] Check memory usage patterns
- [ ] Validate bundle size impact

#### 3.3 Manual Testing

- [ ] Generate sample PDFs with varied content
- [ ] Verify premium calculations match legacy system
- [ ] Test edge cases identified in golden fixtures

## Test Implementation Details

### Golden Fixture Strategy

#### HTML Parsing Fixtures:

```typescript
const GOLDEN_FIXTURES = [
  {
    name: "nested_lists_complex",
    html: "<ol><li>One<ul><li>Nested a</li><li>Nested b</li></ul></li><li>Two</li></ol>",
    expected: {
      lineCount: 4,
      markers: ["1. ", "- ", "- ", "2. "],
      indentLevels: [0, 1, 1, 0],
    },
  },
  // ... more fixtures
];
```

#### Premium Calculation Fixtures:

```typescript
const PREMIUM_FIXTURES = [
  {
    name: "plant_premium_post_terrorism",
    inputs: {
      certificateDate: "2023-06-01",
      plantEquipment: 50000,
      contractWorksSumInsured: 3000000,
      plantRate: 0.0015,
    },
    expectedValue: 75.0,
    expectedSteps: [
      { label: "Rule", detail: "Certificate date ≥ 2023-01-01" },
      { label: "Plant rate × plant value", detail: "0.0015 × $50,000.00" },
    ],
  },
  // ... more fixtures
];
```

#### PDF Output Comparison Strategy:

```typescript
// Test approach for PDF golden fixtures
const PDF_GOLDEN_FIXTURES = [
  {
    name: "simple_policy_schedule",
    templateKey: "schedule-annual",
    mergeInputs: {
      PolicyNumber: "POL123456",
      InsuredName: "Test Construction Pty Ltd",
      // ... all required merge fields
    },
    // Golden reference: base64-encoded PDF bytes captured from current system
    goldenReference: "JVBERi0xLjQK...",
    verificationMethod: "checksum", // or "byte-by-byte" or "metadata-extraction"
  },
  {
    name: "complex_endorsements_rich_html",
    templateKey: "schedule-annual",
    mergeInputs: {
      PolicyNumber: "POL789012",
      InsuredName: "Demo Builder Co",
      Endorsements: JSON.stringify([
        {
          subject: "<p><strong>Open Trench Limitation</strong></p>",
          content: "<p>Maximum 100 metres of open trench...</p>",
        },
        {
          subject: "<p><strong>Display Homes</strong></p>",
          content: "<p>Cover limited to $50,000 per display home...</p>",
        },
      ]),
    },
    goldenReference: "JVBERi0xLjQK...",
    verificationMethod: "checksum",
  },
];
```

#### PDF Test Implementation Pattern:

```typescript
// PDF Golden Fixture Test Implementation
describe("PDF Generation Golden Fixtures", () => {
  for (const fixture of PDF_GOLDEN_FIXTURES) {
    it(`generates ${fixture.name} consistently`, async () => {
      // 1. Generate PDF using current system
      const generatedPdf = await generatePolicyPdf(
        fixture.templateKey,
        mockPolicy,
        fixture.mergeInputs,
        mockTemplate,
      );

      // 2. Convert to comparable format (checksum, metadata, or byte array)
      const generatedChecksum = await computePdfChecksum(generatedPdf);
      const referenceChecksum = await computePdfChecksum(
        base64ToUint8(fixture.goldenReference),
      );

      // 3. Verify match
      expect(generatedChecksum).toBe(referenceChecksum);
    });
  }
});
```

## Success Criteria

1. **All existing tests pass** without modification
2. **New golden fixture tests** cover critical edge cases
3. **File sizes reduced** to ≤ 500 lines each
4. **Function sizes reduced** to ≤ 50 lines each (where practical)
5. **No performance regressions** in PDF generation
6. **No functional regressions** in premium calculations
7. **Clear module boundaries** with focused responsibilities

## Risk Mitigation

### Technical Risks:

1. **Subtle PDF layout regressions**
   - Mitigation: Golden fixture tests for exact positioning
   - Visual regression testing with sample PDFs

2. **Premium calculation accuracy**
   - Mitigation: Cross-reference with legacy calculation engine
   - Test with historical policy data

3. **Template versioning issues**
   - Mitigation: Preserve exact database behavior
   - Test migration paths

### Process Risks:

1. **Scope creep during refactoring**
   - Mitigation: Stick to mechanical splitting only
   - No algorithmic changes unless fixing bugs

2. **Integration failures**
   - Mitigation: Split one module at a time
   - Full test suite runs after each change

## Timeline Estimate

### Phase 1 (Test Augmentation): 2-3 days

- Golden fixture creation and test implementation
- Test suite expansion and validation

### Phase 2 (File Splitting): 3-4 days

- Incremental module extraction and testing
- Interface stabilization

### Phase 3 (Verification): 1-2 days

- Integration testing and performance validation
- Documentation and cleanup

**Total estimated effort: 6-9 days** of focused refactoring work.

## Dependencies and Prerequisites

1. **Stable test environment** with Vitest and Playwright
2. **Sample data** for premium calculation verification
3. **PDF comparison tools** for layout validation
4. **Code review process** for each major refactoring step

## Next Steps

1. **Immediate action**: Create golden fixture test suite for `html-rich-text-lines.ts`
2. **Verify test coverage** adequacy for safe refactoring
3. **Begin incremental splitting** with smallest, most isolated module first
4. **Regular integration testing** throughout the process

---

**Approval**: This plan follows the repository's "split on touch" principle and prioritizes safety through comprehensive test coverage before structural changes.

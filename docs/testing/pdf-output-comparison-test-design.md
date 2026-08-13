# PDF Output Comparison Test Design

## Overview
End-to-end integration tests that verify PDF generation produces identical output byte-by-byte when given the same inputs. These tests serve as **golden fixtures** for the PDF generation pipeline, ensuring refactoring doesn't introduce silent regressions in:
- PDF layout and pagination
- Font embedding and rendering
- Endorsement expansion logic
- Merge field population

## Test Strategy

### 1. Golden Reference Capture
**Goal**: Capture known-good PDF outputs from the current system.

**Approach**:
```bash
# Script to capture golden references
npm run test:capture-golden-pdfs
```

**Process**:
1. Run PDF generation with predefined test inputs
2. Save outputs as base64-encoded reference files
3. Store with metadata (template key, inputs, checksum)
4. Commit to version control as test assets

### 2. Test Execution Pattern
```typescript
// PDF Golden Fixture Test Pattern
describe("PDF Generation Consistency", () => {
  beforeEach(async () => {
    // Mock template fetching if needed
    vi.mock("~/lib/pdf/template-override-cache");
  });

  it("generates identical PDF for simple policy schedule", async () => {
    // Arrange
    const fixture = POLICY_SCHEDULE_FIXTURE;
    const goldenBytes = base64ToUint8(fixture.goldenReference);
    
    // Act
    const generatedBytes = await generatePolicyPdf(
      fixture.templateKey,
      createTestPolicy(),
      fixture.mergeInputs,
      createTestTemplate()
    );
    
    // Assert - byte-by-byte comparison
    expect(generatedBytes).toEqual(goldenBytes);
  });
  
  it("generates identical PDF for complex endorsements", async () => {
    // Test rich HTML endorsements with pagination
  });
  
  it("generates identical PDF with flow push-down", async () => {
    // Test templates with flow push-down configuration
  });
});
```

## Test Categories

### Category 1: Template Variations
| Template Type | Purpose | Key Test Points |
|--------------|---------|-----------------|
| `schedule-annual` | Basic policy schedule | Merge field placement, basic layout |
| `schedule-owner-builder` | Different cover type | Different template, same core logic |
| `rating-annual` | Premium breakdown | Financial formatting, calculations |
| `adjustment` | Policy adjustments | Adjustment-specific fields |

### Category 2: Endorsement Complexity
| Complexity Level | Test Focus | Verification Method |
|-----------------|------------|-------------------|
| **No endorsements** | Basic template rendering | Byte-by-byte comparison |
| **Simple plain text** | Endorsement expansion | Checksum + metadata validation |
| **Rich HTML** | HTML parsing/drawing | Visual diff for complex cases |
| **Multi-page overflow** | Pagination logic | Page count + content verification |

### Category 3: Merge Field Scenarios
| Scenario | Input Variation | Expected PDF Change |
|----------|-----------------|----------------------|
| **Empty fields** | All fields empty | Placeholder positions |
| **Maximum length** | Field values at max length | Text wrapping, overflow |
| **Special characters** | Unicode, formatting chars | Character encoding |
| **Premium calculations** | Different premium values | Number formatting |

## Test Implementation Details

### 1. PDF Comparison Methods

#### Method A: Byte-by-Byte Comparison (Primary)
```typescript
function comparePdfBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
```
**Pros**: Exact matching, catches all changes
**Cons**: Sensitive to non-functional changes (timestamps, IDs)

#### Method B: Checksum Comparison
```typescript
async function computePdfChecksum(bytes: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}
```
**Pros**: Fast, handles minor non-functional differences if needed
**Cons**: May miss structural changes that produce same checksum

#### Method C: Metadata Extraction
```typescript
async function extractPdfMetadata(bytes: Uint8Array): Promise<{
  pageCount: number;
  textContent: string[];
  fontNames: string[];
}> {
  // Parse PDF and extract key metadata
}
```
**Pros**: More flexible, focuses on functional aspects
**Cons**: More complex implementation

### 2. Test Data Management

#### Golden Reference Storage
```
tests/fixtures/pdf-golden-references/
├── schedule-annual/
│   ├── simple-policy.base64.txt
│   ├── complex-endorsements.base64.txt
│   └── metadata.json
├── rating-annual/
│   ├── premium-breakdown.base64.txt
│   └── metadata.json
└── endorsement-expansion/
    ├── plain-text.base64.txt
    └── rich-html.base64.txt
```

#### Metadata Format
```json
{
  "fixtureName": "simple-policy-schedule",
  "templateKey": "schedule-annual",
  "capturedAt": "2026-08-13T12:00:00Z",
  "gitCommit": "abc123def",
  "inputs": {
    "PolicyNumber": "POL123456",
    "InsuredName": "Test Construction Pty Ltd"
  },
  "checksum": "sha256:abc123...",
  "verificationMethod": "byte-by-byte"
}
```

### 3. Mocking Strategy

```typescript
// Mock template fetching to avoid external dependencies
vi.mock("~/lib/pdf/template-override-cache", () => ({
  getCachedPublishedTemplate: vi.fn((key: string) => {
    const templates = {
      "schedule-annual": createTestTemplate("schedule-annual"),
      "rating-annual": createTestTemplate("rating-annual"),
    };
    return templates[key] || null;
  }),
  setCachedPublishedTemplate: vi.fn(),
}));

// Mock font catalog for consistent PDF generation
vi.mock("~/lib/pdf/font-config", () => ({
  getFontCatalog: vi.fn(() => createMockFontCatalog()),
}));
```

## Test Execution Workflow

### 1. Golden Reference Capture Phase
```bash
# Capture golden references from current system
npm run test:capture-golden-pdfs -- --template schedule-annual --fixture simple-policy

# Update all golden references
npm run test:update-golden-references
```

### 2. Normal Test Execution
```bash
# Run PDF integration tests
npm run test:integration -- --run pdf-output-comparison.test.ts

# Run with specific test pattern
npm run test:integration -- --run "**/*pdf*.test.ts"
```

### 3. Golden Reference Update (When Intentional Changes Occur)
```bash
# Update golden references after intentional PDF format changes
npm run test:update-golden-references -- --confirm
```

## Integration with Refactoring Workflow

### Before Refactoring
1. **Establish baseline**: Capture golden references from current system
2. **Verify tests pass**: Ensure golden fixtures match current output
3. **Document known issues**: Note any test failures that represent actual bugs

### During Refactoring
1. **Run after each change**: Execute PDF comparison tests
2. **Investigate differences**: Analyze byte-level changes
3. **Update if intentional**: Only update golden references for intentional changes

### After Refactoring
1. **Final verification**: Complete test suite execution
2. **Performance check**: Compare PDF generation times
3. **Documentation update**: Update test documentation

## Example Test Implementation

### `tests/integration/pdf-output-comparison.test.ts`
```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import { generatePolicyPdf } from "~/lib/pdf/generate";
import { base64ToUint8 } from "~/lib/pdf/generate";
import { createTestPolicy } from "../fixtures/policy";
import { createTestTemplate } from "../fixtures/template";

// Import golden references
import SIMPLE_SCHEDULE from "../fixtures/pdf-golden-references/schedule-annual/simple-policy.base64.txt";
import COMPLEX_ENDORSEMENTS from "../fixtures/pdf-golden-references/schedule-annual/complex-endorsements.base64.txt";

describe("PDF Output Comparison - Schedule Annual", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Setup mocks
  });

  describe("simple policy schedule", () => {
    const GOLDEN_REFERENCE = base64ToUint8(SIMPLE_SCHEDULE);
    const FIXTURE = {
      templateKey: "schedule-annual",
      mergeInputs: {
        PolicyNumber: "POL123456",
        InsuredName: "Test Construction Pty Ltd",
        Address: "123 Test Street, Sydney NSW 2000",
        CoverType: "Annual",
        Period: "01/01/2026 to 31/12/2026",
        SumInsured: "$5,000,000",
        Premium: "$12,345.67",
        BrokerName: "Test Broker Pty Ltd",
        BrokerLicense: "123456789",
      },
    };

    it("generates identical byte output", async () => {
      const result = await generatePolicyPdf(
        FIXTURE.templateKey,
        createTestPolicy(),
        FIXTURE.mergeInputs,
        createTestTemplate("schedule-annual"),
      );

      // Byte-by-byte comparison
      expect(result.pdf.length).toBe(GOLDEN_REFERENCE.length);
      
      // Compare first 100 bytes for quick failure
      for (let i = 0; i < Math.min(100, result.pdf.length); i++) {
        expect(result.pdf[i]).toBe(GOLDEN_REFERENCE[i]);
      }
      
      // Full comparison
      expect(result.pdf).toEqual(GOLDEN_REFERENCE);
    });

    it("maintains identical checksum", async () => {
      const result = await generatePolicyPdf(
        FIXTURE.templateKey,
        createTestPolicy(),
        FIXTURE.mergeInputs,
        createTestTemplate("schedule-annual"),
      );

      const generatedChecksum = await computeSha256(result.pdf);
      const goldenChecksum = await computeSha256(GOLDEN_REFERENCE);
      
      expect(generatedChecksum).toBe(goldenChecksum);
    });
  });

  describe("complex endorsements with rich HTML", () => {
    const GOLDEN_REFERENCE = base64ToUint8(COMPLEX_ENDORSEMENTS);
    const FIXTURE = {
      templateKey: "schedule-annual",
      mergeInputs: {
        PolicyNumber: "POL789012",
        InsuredName: "Demo Builder Co",
        Endorsements: JSON.stringify([
          {
            subject: "<p><strong>Open Trench Limitation (100 metres)</strong></p>",
            content: "<p>Maximum 100 metres of open trench at any one time...</p>",
          },
          {
            subject: "<p><strong>Display Homes</strong></p>",
            content: "<p>Cover limited to $50,000 per display home...</p>",
          },
          {
            subject: "<p><strong>Existing Structure Exclusion</strong></p>",
            content: "<p>No cover for damage to existing structures...</p>",
          },
        ]),
      },
    };

    it("generates identical multi-page PDF", async () => {
      const result = await generatePolicyPdf(
        FIXTURE.templateKey,
        createTestPolicy(),
        FIXTURE.mergeInputs,
        createTestTemplate("schedule-annual"),
      );

      // Verify page count through metadata extraction
      const pageCount = await extractPdfPageCount(result.pdf);
      const goldenPageCount = await extractPdfPageCount(GOLDEN_REFERENCE);
      
      expect(pageCount).toBe(goldenPageCount);
      
      // Byte comparison
      expect(result.pdf).toEqual(GOLDEN_REFERENCE);
    });
  });
});

// Helper functions
async function computeSha256(bytes: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

async function extractPdfPageCount(bytes: Uint8Array): Promise<number> {
  // Simple regex to count PDF page markers
  const text = new TextDecoder().decode(bytes.slice(0, 1000));
  const pageMatches = text.match(/\/Type\s*\/Page/g);
  return pageMatches ? pageMatches.length : 0;
}
```

## Success Criteria

1. **All PDF golden fixtures pass** byte-by-byte comparison
2. **No unintended differences** between refactored and original output
3. **Graceful handling of intentional changes** with documented updates
4. **Performance maintained** within acceptable thresholds
5. **Comprehensive coverage** of all critical PDF generation scenarios

## Integration with CI/CD

```yaml
# GitHub Actions workflow
name: PDF Integration Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    paths:
      - 'app/lib/pdf/**'
      - 'app/lib/pricing/**'
      - 'tests/integration/pdf-*.test.ts'

jobs:
  pdf-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run PDF integration tests
        run: npm run test:integration -- --run pdf-output-comparison.test.ts
        
      - name: Capture golden references (on schedule)
        if: github.event_name == 'schedule'
        run: npm run test:capture-golden-pdfs
```

## Next Steps

1. **Implement golden reference capture script**
2. **Create initial golden reference set**
3. **Build PDF comparison test infrastructure**
4. **Integrate with existing test suite**
5. **Document update procedures for golden references**

This test approach provides maximum safety for refactoring the PDF generation pipeline while maintaining exact output consistency.
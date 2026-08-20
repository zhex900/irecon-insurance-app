#!/usr/bin/env node
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// This script captures golden reference PDFs for integration testing
// Run before major refactoring to establish baseline PDF outputs

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "../..");
const OUTPUT_DIR = join(PROJECT_ROOT, "tests/fixtures/pdf-golden-references");

// Import the PDF generation module
const generateModule = await import(
  join(PROJECT_ROOT, "app/lib/pdf/generate.ts")
);
const { generatePolicyPdf } = generateModule;

// Helper to convert Uint8Array to base64
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// Helper to compute SHA-256 checksum
async function computeSha256(bytes: Uint8Array): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    // Fallback for environments without Web Crypto API
    return "no-crypto-available";
  }

  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Test fixtures - these should match actual template keys and merge fields
const PDF_FIXTURES = [
  {
    name: "simple-policy-schedule",
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
    description: "Basic policy schedule with minimal endorsements",
  },
  {
    name: "complex-endorsements",
    templateKey: "schedule-annual",
    mergeInputs: {
      PolicyNumber: "POL789012",
      InsuredName: "Demo Builder Co",
      Endorsements: JSON.stringify([
        {
          subject:
            "<p><strong>Open Trench Limitation (100 metres)</strong></p>",
          content:
            "<p>Maximum 100 metres of open trench at any one time. All trenches must be backfilled at the end of each working day.</p>",
        },
        {
          subject: "<p><strong>Display Homes</strong></p>",
          content:
            "<p>Cover limited to $50,000 per display home. Excess applies per display home.</p>",
        },
      ]),
      Address: "456 Demo Road, Melbourne VIC 3000",
      CoverType: "Annual",
      Period: "01/07/2026 to 30/06/2027",
      SumInsured: "$3,000,000",
      Premium: "$8,765.43",
    },
    description: "Schedule with rich HTML endorsements",
  },
  {
    name: "premium-breakdown-rating",
    templateKey: "rating-annual",
    mergeInputs: {
      PolicyNumber: "POL345678",
      InsuredName: "Sample Builder Pty Ltd",
      Turnover: "$2,500,000",
      ContractWorksPremium: "$12,345.67",
      LiabilityPremium: "$6,789.01",
      TerrorismPremium: "$654.32",
      PlantPremium: "$1,234.56",
      GST: "$2,109.88",
      StampDuty: "$1,901.23",
      TotalPremium: "$24,035.67",
      BrokerFee: "$1,200.00",
    },
    description: "Premium rating document with breakdown",
  },
];

// Mock objects for testing
function createMockPolicy() {
  return {
    policyId: 1,
    policyNumber: "POL123456",
    insuredName: "Test Construction Pty Ltd",
    inceptionDate: "2026-01-01",
    expiryDate: "2026-12-31",
    coverTypeId: 1,
    policyStatus: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createMockTemplate(templateKey: string) {
  // Create a minimal blank PDF template
  return {
    key: templateKey,
    coverTypeId: null,
    title: `${templateKey} Template`,
    label: `${templateKey} Label`,
    versionNumber: 1,
    mergeFields: Object.keys(PDF_FIXTURES[0]?.mergeInputs || {}),
    flowPushDown: null,
    template: {
      basePdf: {
        width: 210,
        height: 297,
        padding: [15, 15, 15, 15] as [number, number, number, number],
      },
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
          {
            name: "InsuredName",
            type: "text",
            position: { x: 15, y: 45 },
            width: 180,
            height: 8,
            fontSize: 12,
            fontName: "Roboto Bold",
          },
          {
            name: "Address",
            type: "text",
            position: { x: 15, y: 60 },
            width: 180,
            height: 8,
            fontSize: 10,
            fontName: "Roboto",
          },
          {
            name: "EndorsementSubject",
            type: "text",
            position: { x: 15, y: 100 },
            width: 180,
            height: 6,
            fontSize: 11,
            fontName: "Roboto Bold",
          },
          {
            name: "EndorsementContent",
            type: "text",
            position: { x: 15, y: 110 },
            width: 180,
            height: 40,
            fontSize: 9.5,
            fontName: "Roboto",
            lineHeight: 1.25,
          },
        ],
      ],
    },
  };
}

async function captureGoldenReference(fixture: (typeof PDF_FIXTURES)[0]) {
  console.log(`Capturing: ${fixture.name} (${fixture.templateKey})`);

  try {
    // Generate PDF
    const result = await generatePolicyPdf(
      fixture.templateKey,
      createMockPolicy() as any,
      fixture.mergeInputs,
      createMockTemplate(fixture.templateKey) as any,
      {
        // Optional: add wording catalogue or broker fee lines
      },
    );

    // Convert to base64
    const base64Output = uint8ToBase64(result.pdf);

    // Compute checksum
    const checksum = await computeSha256(result.pdf);

    // Create output directory
    const fixtureDir = join(OUTPUT_DIR, fixture.templateKey);
    if (!existsSync(fixtureDir)) {
      mkdirSync(fixtureDir, { recursive: true });
    }

    // Save base64 PDF
    writeFileSync(
      join(fixtureDir, `${fixture.name}.base64.txt`),
      base64Output,
      "utf8",
    );

    // Save metadata
    const metadata = {
      fixtureName: fixture.name,
      templateKey: fixture.templateKey,
      capturedAt: new Date().toISOString(),
      description: fixture.description,
      mergeInputs: fixture.mergeInputs,
      checksum,
      pdfSize: result.pdf.length,
      verificationMethod: "byte-by-byte",
    };

    writeFileSync(
      join(fixtureDir, `${fixture.name}.metadata.json`),
      JSON.stringify(metadata, null, 2),
      "utf8",
    );

    console.log(
      `  ✓ Saved: ${fixture.name}.base64.txt (${result.pdf.length} bytes)`,
    );
    console.log(`  ✓ Checksum: ${checksum.substring(0, 16)}...`);

    return { success: true, checksum, size: result.pdf.length };
  } catch (error) {
    console.error(`  ✗ Failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log("📄 PDF Golden Reference Capture Tool");
  console.log("=====================================\n");

  // Create output directory
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`Created output directory: ${OUTPUT_DIR}`);
  }

  const results = [];
  for (const fixture of PDF_FIXTURES) {
    const result = await captureGoldenReference(fixture);
    results.push({
      fixture: fixture.name,
      ...result,
    });
    console.log();
  }

  // Summary
  console.log("📊 Summary");
  console.log("==========");

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`Total fixtures: ${PDF_FIXTURES.length}`);
  console.log(`Succeeded: ${succeeded}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.log("\n❌ Failed fixtures:");
    for (const result of results.filter((r) => !r.success)) {
      console.log(`  - ${result.fixture}: ${result.error}`);
    }
    process.exit(1);
  }

  console.log(`\n✅ All golden references captured successfully!`);
  console.log(`Output directory: ${OUTPUT_DIR}`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export {
  PDF_FIXTURES,
  captureGoldenReference,
  createMockPolicy,
  createMockTemplate,
};

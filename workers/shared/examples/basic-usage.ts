/**
 * Basic usage examples for the shared RPC infrastructure
 */

import {
  ExcelServiceClient,
  createExcelServiceClient,
  ValidationError,
  generatePremiumWorkbookInputSchema,
} from "../index";

// Example 1: Creating and using a client
async function example1(env: any) {
  // Create Excel service client
  const excelClient = new ExcelServiceClient({
    serviceBinding: env.EXCEL_SERVICE,
    timeoutMs: 30000,
    maxRetries: 3,
  });

  // Type-safe RPC call
  const result = await excelClient.generatePremiumWorkbook(
    {
      policy: {
        policyId: "pol-123456",
        policyNumber: "POL-2024-001",
        clientName: "Acme Corporation",
      },
      premium: {
        contractWorksBasePremium: 15000,
        // other premium fields...
      },
      options: {
        includeAdjustment: true,
        policyNumber: "POL-2024-001",
        clientName: "Acme Corporation",
        generatedBy: "system/admin",
        appVersion: "1.0.0",
      },
    },
    {
      requestId: `excel-${Date.now()}`,
      correlationId: `corr-${Date.now()}`,
    },
  );

  console.log("Generated workbook:", result.workbook.url);
  console.log("Generation time:", result.metadata.generationTime, "ms");
}

// Example 2: Using factory function
async function example2(env: any) {
  const excelClient = createExcelServiceClient(env.EXCEL_SERVICE);

  // Convenience method
  const result = await excelClient.generatePremiumReport(
    {
      policyId: "pol-123456",
      policyNumber: "POL-2024-001",
      clientName: "Acme Corporation",
    },
    {
      contractWorksBasePremium: 15000,
    },
    {
      includeAdjustment: true,
      requestId: "test-request-123",
    },
  );

  return result;
}

// Example 3: Error handling
async function example3(excelClient: ExcelServiceClient) {
  try {
    const result = await excelClient.generatePremiumWorkbook({
      policy: {} as any, // Invalid policy
      premium: {} as any, // Invalid premium
    });

    console.log("Success:", result);
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error("Validation failed:", error.details);
      // Show user-friendly error message
    } else if (error instanceof RpcError) {
      console.error(`RPC error ${error.code}:`, error.message);

      if (error.code === "SERVICE_UNAVAILABLE") {
        // Show user that service is temporarily unavailable
        console.error(
          "Excel service is temporarily unavailable. Please try again later.",
        );
      }
    } else {
      console.error("Unexpected error:", error);
    }

    throw error;
  }
}

// Example 4: Input validation before RPC call
async function example4(input: any) {
  // Validate input before making expensive RPC call
  const validationResult = generatePremiumWorkbookInputSchema.safeParse(input);

  if (!validationResult.success) {
    // Return validation errors early
    return {
      success: false,
      error: {
        code: "VALIDATION_FAILED",
        message: "Invalid input",
        details: validationResult.error.format(),
      },
    };
  }

  // Proceed with RPC call if validation passes
  // const result = await excelClient.generatePremiumWorkbook(validationResult.data);
  // return result;
}

// Example 5: Health checking and monitoring
async function example5(excelClient: ExcelServiceClient) {
  // Check service health
  const isHealthy = await excelClient.healthCheck();

  if (!isHealthy) {
    console.warn("Excel service is unhealthy - proceeding with caution");
    // Implement fallback logic or show warning to user
  }

  // Get service info for monitoring
  try {
    const serviceInfo = await excelClient.getServiceInfo();
    console.log("Service info:", serviceInfo);
  } catch (error) {
    console.warn("Could not fetch service info:", error);
  }
}

// Example 6: Using RPC client directly for custom services
import { RpcClient } from "../index";

async function example6(env: any) {
  // Create generic RPC client for custom service
  const customClient = new RpcClient({
    serviceBinding: env.CUSTOM_SERVICE,
    serviceName: "custom-service",
    timeoutMs: 10000,
    maxRetries: 2,
  });

  // Generic RPC call
  const result = await customClient.call<"processData", any, any>(
    "processData",
    { data: "test" },
    { requestId: "custom-req-123" },
  );

  return result;
}

// Example 7: Integration with existing codebase
async function example7(
  excelClient: ExcelServiceClient,
  policyData: any,
  premiumData: any,
) {
  // Convert from existing format to RPC format
  const input = {
    policy: {
      policyId: policyData.id,
      policyNumber: policyData.number,
      clientName: policyData.client?.name,
      // Map other fields as needed
    },
    premium: {
      contractWorksBasePremium: premiumData.basePremium,
      // Map other fields...
    },
    options: {
      includeAdjustment: premiumData.adjustmentAvailable,
      policyNumber: policyData.number,
      clientName: policyData.client?.name,
      generatedBy: "migration-script",
      appVersion: "2.0.0",
    },
  };

  return excelClient.generatePremiumWorkbook(input);
}

// Run examples
// Note: These are example functions - they need to be called with actual environment variables
export { example1, example2, example3, example4, example5, example6, example7 };

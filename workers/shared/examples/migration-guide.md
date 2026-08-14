# Migration Guide: From Custom Signed Requests to RPC Infrastructure

This guide walks through migrating from the current custom signed request implementation to the new type-safe RPC infrastructure.

## Current State (Before Migration)

```typescript
// Current implementation using custom signed requests
import { callExcelWorkerService } from "~/lib/reports/excel-worker.client.server";

// Manual fetch with custom signing
async function generatePremiumReportOld(env: any, policy: any, premium: any) {
  return callExcelWorkerService(env.EXCEL_SERVICE, {
    reportType: "premiumWorkbook",
    data: {
      policy,
      premium,
    },
    options: {
      premiumWorkbook: {
        includeAdjustment: true,
        policyNumber: policy.policyNumber,
        clientName: policy.clientName,
      },
    },
  });
}
```

## Migration Steps

### Step 1: Install/Import Shared Infrastructure

The shared infrastructure is already part of the workers monorepo. No installation needed.

```typescript
import { ExcelServiceClient } from "../../workers/shared";
```

### Step 2: Replace Client Creation

**Before:**

```typescript
// Using service binding directly with manual fetch
const service = env.EXCEL_SERVICE; // ServiceBinding type
```

**After:**

```typescript
// Create type-safe client
const excelClient = new ExcelServiceClient({
  serviceBinding: env.EXCEL_SERVICE,
  timeoutMs: 30000,
  maxRetries: 3,
});
```

### Step 3: Replace Function Calls

**Before (Manual fetch with signing):**

```typescript
const response = await callExcelWorkerService(env.EXCEL_SERVICE, {
  reportType: "premiumWorkbook",
  data: { policy, premium },
  options: {/* ... */},
});
```

**After (Type-safe RPC):**

```typescript
const result = await excelClient.generatePremiumWorkbook({
  policy,
  premium,
  options: {
    includeAdjustment: true,
    policyNumber: policy.policyNumber,
    clientName: policy.clientName,
  },
});
```

### Step 4: Update Error Handling

**Before (Manual error handling):**

```typescript
try {
  const response = await callExcelWorkerService(env.EXCEL_SERVICE, request);
  if (!response.success) {
    throw new Error(response.error);
  }
  return response.excelBase64;
} catch (error) {
  console.error("Excel generation failed:", error);
  throw error;
}
```

**After (Structured error handling):**

```typescript
import { RpcError, ValidationError } from "../../workers/shared";

try {
  const result = await excelClient.generatePremiumWorkbook(input);
  return result.workbook.url;
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation errors specifically
    notifyUser("Invalid input data", error.details);
  } else if (error instanceof RpcError) {
    // Handle RPC errors based on error code
    if (error.code === "SERVICE_UNAVAILABLE") {
      showServiceUnavailableMessage();
    } else if (error.code === "TIMEOUT") {
      showTimeoutMessage(error.details?.timeoutMs);
    }
  }
  throw error;
}
```

## Complete Migration Example

### Before Migration

```typescript
// File: app/lib/services/report.service.ts

import { callExcelWorkerService } from "~/lib/reports/excel-worker.client.server";
import type { Policy, PremiumBreakdown } from "~/lib/db/types";

export class ReportService {
  constructor(private env: any) {}

  async generatePremiumReport(
    policy: Policy,
    premium: PremiumBreakdown,
  ): Promise<string> {
    const request = {
      reportType: "premiumWorkbook",
      data: {
        policy,
        premium,
      },
      options: {
        premiumWorkbook: {
          includeAdjustment: premium.adjustmentAvailable,
          policyNumber: policy.policyNumber,
          clientName: policy.clientName,
          appVersion: "1.0.0",
          generatedBy: "report-service",
        },
      },
    };

    const response = await callExcelWorkerService(
      this.env.EXCEL_SERVICE,
      request,
      {
        timeoutMs: 30000,
        requestId: `report-${Date.now()}`,
      },
    );

    if (!response.success) {
      throw new Error(`Excel generation failed: ${response.error}`);
    }

    if (!response.excelBase64) {
      throw new Error("No Excel data returned");
    }

    return response.excelBase64;
  }
}
```

### After Migration

```typescript
// File: app/lib/services/report.service.ts

import {
  ExcelServiceClient,
  ValidationError,
  RpcError,
} from "../../workers/shared";
import type { Policy, PremiumBreakdown } from "~/lib/db/types";

export class ReportService {
  private excelClient: ExcelServiceClient;

  constructor(private env: any) {
    this.excelClient = new ExcelServiceClient({
      serviceBinding: env.EXCEL_SERVICE,
      timeoutMs: 30000,
      maxRetries: 3,
    });
  }

  async generatePremiumReport(
    policy: Policy,
    premium: PremiumBreakdown,
  ): Promise<string> {
    try {
      const result = await this.excelClient.generatePremiumWorkbook(
        {
          policy: {
            policyId: policy.id,
            policyNumber: policy.policyNumber,
            clientName: policy.clientName,
            // Map other policy fields as needed
          },
          premium: {
            contractWorksBasePremium: premium.basePremium,
            // Map other premium fields as needed
          },
          options: {
            includeAdjustment: premium.adjustmentAvailable,
            policyNumber: policy.policyNumber,
            clientName: policy.clientName,
            generatedBy: "report-service-v2",
            appVersion: "2.0.0",
          },
        },
        {
          requestId: `report-${Date.now()}`,
          correlationId: `corr-${policy.id}`,
        },
      );

      return result.workbook.url;
    } catch (error) {
      if (error instanceof ValidationError) {
        console.error("Invalid input for premium report:", {
          policyId: policy.id,
          errorDetails: error.details,
        });
        throw new Error("Invalid report data. Please check your inputs.");
      } else if (error instanceof RpcError) {
        switch (error.code) {
          case "SERVICE_UNAVAILABLE":
            console.error("Excel service unavailable:", error);
            throw new Error(
              "Excel generation service is temporarily unavailable. Please try again later.",
            );

          case "TIMEOUT":
            console.error("Excel generation timeout:", {
              policyId: policy.id,
              timeoutMs: error.details?.timeoutMs,
            });
            throw new Error(
              "Excel generation timed out. Please try again or contact support.",
            );

          default:
            console.error("Excel generation failed:", {
              policyId: policy.id,
              error: error.message,
              code: error.code,
            });
            throw new Error(`Failed to generate report: ${error.message}`);
        }
      } else {
        console.error("Unexpected error generating report:", error);
        throw new Error("An unexpected error occurred. Please try again.");
      }
    }
  }

  async healthCheck(): Promise<boolean> {
    return this.excelClient.healthCheck();
  }
}
```

## Benefits Gained

### 1. **Type Safety**

```typescript
// ✅ Compile-time checking
const result = await excelClient.generatePremiumWorkbook({
  policy: {/* typed policy object */},
  premium: {/* typed premium object */},
  // TypeScript will error if fields are missing or wrong type
});

// ✅ Auto-completion in IDE
// IDE will suggest available methods and their parameters
```

### 2. **Structured Error Handling**

```typescript
// ✅ Standardized error codes
try {
  await excelClient.generatePremiumWorkbook(input);
} catch (error) {
  if (error.code === "VALIDATION_FAILED") {
    // Handle validation errors
  } else if (error.code === "SERVICE_UNAVAILABLE") {
    // Handle service unavailable
  }
  // Consistent structure across all services
}
```

### 3. **Automatic Retry Logic**

```typescript
// ✅ Built-in retry with exponential backoff
const client = new ExcelServiceClient({
  serviceBinding: env.EXCEL_SERVICE,
  maxRetries: 3, // Automatically retries on network errors
  retryBaseDelayMs: 1000, // With exponential backoff
});
```

### 4. **Observability**

```typescript
// ✅ Request IDs for tracing
const result = await excelClient.generatePremiumWorkbook(input, {
  requestId: "unique-request-id", // Used across all logs
  correlationId: "business-transaction-id", // For business context
});

// All logs will include these IDs for easy correlation
```

### 5. **Validation**

```typescript
// ✅ Schema validation before RPC call
import { generatePremiumWorkbookInputSchema } from "../../workers/shared";

// Validate early
const validation = generatePremiumWorkbookInputSchema.safeParse(input);
if (!validation.success) {
  // Return validation errors without making network call
  return { error: validation.error.format() };
}
```

## Migration Checklist

### Phase 1: Setup & Testing

- [ ] Import shared RPC infrastructure
- [ ] Create test client instances
- [ ] Write integration tests with new infrastructure
- [ ] Test error handling scenarios

### Phase 2: Gradual Migration

- [ ] Identify all service binding usage points
- [ ] Create wrapper functions using new clients
- [ ] Add feature flags for gradual rollout
- [ ] Monitor both old and new implementations

### Phase 3: Full Migration

- [ ] Replace all manual fetch calls with type-safe RPC
- [ ] Update error handling in all call sites
- [ ] Remove legacy signing implementation
- [ ] Update documentation and examples

### Phase 4: Cleanup & Optimization

- [ ] Remove unused legacy code
- [ ] Optimize RPC client configurations
- [ ] Add circuit breaker patterns if needed
- [ ] Implement advanced retry policies

## Testing Migration

### Unit Tests

```typescript
import { ExcelServiceClient } from "../../workers/shared";

describe("ExcelServiceClient", () => {
  let mockBinding: any;
  let client: ExcelServiceClient;

  beforeEach(() => {
    mockBinding = {
      fetch: jest.fn(),
    };
    client = new ExcelServiceClient({
      serviceBinding: mockBinding,
    });
  });

  it("should make type-safe RPC calls", async () => {
    mockBinding.fetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: { workbook: { url: "test.xlsx", size: 1024 } },
        }),
    });

    const result = await client.generatePremiumWorkbook({
      policy: mockPolicy,
      premium: mockPremium,
    });

    expect(result.workbook.url).toBe("test.xlsx");
    expect(mockBinding.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/rpc/generatePremiumWorkbook"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
  });
});
```

### Integration Tests

```typescript
import { createExcelServiceClient } from "../../workers/shared";

describe("Excel Service Integration", () => {
  it("should generate premium workbook", async () => {
    // Requires actual service binding
    const client = createExcelServiceClient(env.EXCEL_SERVICE);

    const result = await client.generatePremiumWorkbook({
      policy: testPolicy,
      premium: testPremium,
    });

    expect(result.success).toBe(true);
    expect(result.workbook.url).toMatch(/\.xlsx$/);
  });
});
```

## Rollback Plan

If issues occur during migration:

1. **Immediate Rollback**: Revert to using `callExcelWorkerService` function
2. **Feature Flag**: Keep both implementations behind a feature flag
3. **Monitoring**: Watch error rates and latency during migration
4. **Gradual Rollout**: Migrate non-critical paths first

## Performance Comparison

### Before (Custom Signed Requests)

- Manual JSON serialization
- Custom HMAC signing overhead
- Manual retry logic
- Inconsistent error handling

### After (Type-safe RPC)

- Automatic serialization
- No custom crypto overhead
- Built-in retry with backoff
- Structured error responses
- Type validation at compile time

## Support

For migration assistance:

1. Refer to the examples in `workers/shared/examples/`
2. Check the README.md for usage patterns
3. Review the schema definitions for data structures
4. Contact the infrastructure team for complex migrations

## Next Steps

After successful migration:

1. **Add Metrics**: Implement RPC call metrics and monitoring
2. **Add Circuit Breakers**: Implement fault tolerance patterns
3. **Add Caching**: Cache responses where appropriate
4. **Add Rate Limiting**: Protect services from overload
5. **Expand to Other Services**: Apply same pattern to document worker, etc.

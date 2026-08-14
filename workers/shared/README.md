# Shared RPC Infrastructure

This module provides shared infrastructure for RPC-based communication between workers in the Irecon Insurance application.

## Overview

The shared RPC infrastructure implements:

1. **Type-safe RPC communication** using Zod schemas for validation
2. **Error handling** with standardized RPC error codes
3. **Retry logic** with exponential backoff
4. **Telemetry and logging** for observability
5. **Service client wrappers** for type-safe API calls

## Architecture

```
┌─────────────────────────────────────────────┐
│              Main Application                │
│  • Uses typed service clients                │
│  • Automatic retry and error handling        │
└─────────────┬───────────────────────────────┘
              │ RPC Calls (Type-safe)
              │ Service Binding
              ▼
┌─────────────────────────────────────────────┐
│           Excel Service Client               │
│  • generatePremiumWorkbook()                │
│  • generateAdjustmentSheet()                │
│  • exportReport()                           │
└─────────────┬───────────────────────────────┘
              │ Private Network
              │ Cloudflare Service Binding
              ▼
┌─────────────────────────────────────────────┐
│                Excel Worker                  │
│  • RPC Service Implementation               │
│  • Zod Schema Validation                    │
│  • Business Logic                           │
└─────────────────────────────────────────────┘
```

## Installation

The shared infrastructure is part of the workers monorepo. No separate installation is required.

## Usage

### 1. Using the Excel Service Client

```typescript
import { ExcelServiceClient } from "./workers/shared";

// Create client with service binding
const excelClient = new ExcelServiceClient({
  serviceBinding: env.EXCEL_SERVICE,
  timeoutMs: 30000,
  maxRetries: 3,
});

// Type-safe RPC call
const result = await excelClient.generatePremiumWorkbook(
  {
    policy: policyData,
    premium: premiumData,
    options: {
      includeAdjustment: true,
      policyNumber: "POL123",
      clientName: "Acme Corp",
    },
  },
  {
    requestId: "req-123456",
    correlationId: "corr-789012",
  },
);

console.log(result.workbook.url);
```

### 2. Using RPC Client Directly

```typescript
import { RpcClient } from "./workers/shared";

const client = new RpcClient({
  serviceBinding: env.DOCUMENT_SERVICE,
  serviceName: "document-worker",
});

const result = await client.call(
  "generatePolicyPdf",
  { policyId: "123", template: "standard" },
  { requestId: "req-123" },
);
```

### 3. Error Handling

```typescript
import { RpcError, ValidationError } from "./workers/shared";

try {
  const result = await excelClient.generatePremiumWorkbook(input);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error("Validation failed:", error.details);
  } else if (error instanceof RpcError) {
    console.error(`RPC error ${error.code}:`, error.message);
  }
}
```

### 4. Schemas for Validation

```typescript
import { generatePremiumWorkbookInputSchema } from "./workers/shared";

// Validate input before making RPC call
const validationResult = generatePremiumWorkbookInputSchema.safeParse(input);
if (!validationResult.success) {
  throw new ValidationError("Invalid input", validationResult.error);
}
```

## RPC Error Codes

Standardized error codes for consistent error handling:

| Code                      | Description                          | HTTP Equivalent |
| ------------------------- | ------------------------------------ | --------------- |
| `VALIDATION_FAILED`       | Input validation failed              | 400             |
| `SERVICE_UNAVAILABLE`     | Downstream service unavailable       | 503             |
| `TIMEOUT`                 | Request timeout                      | 408             |
| `UNAUTHORIZED`            | Authentication/authorization failure | 401             |
| `NOT_FOUND`               | Resource not found                   | 404             |
| `INTERNAL_ERROR`          | Internal server error                | 500             |
| `BUSINESS_RULE_VIOLATION` | Business rule violation              | 422             |
| `RATE_LIMITED`            | Rate limit exceeded                  | 429             |

## Configuration

### RpcClient Options

| Option                | Type             | Default                          | Description                        |
| --------------------- | ---------------- | -------------------------------- | ---------------------------------- |
| `serviceBinding`      | `ServiceBinding` | Required                         | Cloudflare service binding         |
| `serviceName`         | `string`         | Required                         | Service name for logging           |
| `baseUrl`             | `string`         | `https://{serviceName}.internal` | Service base URL                   |
| `timeoutMs`           | `number`         | 30000                            | Request timeout in milliseconds    |
| `maxRetries`          | `number`         | 3                                | Maximum retry attempts             |
| `retryBaseDelayMs`    | `number`         | 1000                             | Base retry delay in milliseconds   |
| `retryMaxDelayMs`     | `number`         | 10000                            | Maximum retry delay                |
| `retryOnNetworkError` | `boolean`        | `true`                           | Whether to retry on network errors |
| `requestIdGenerator`  | `() => string`   | Auto-generated                   | Function to generate request IDs   |

### ExcelServiceClient Options

| Option           | Type             | Default        | Description           |
| ---------------- | ---------------- | -------------- | --------------------- |
| `serviceBinding` | `ServiceBinding` | Required       | Excel service binding |
| `baseUrl`        | `string`         | Auto-generated | Excel service URL     |
| `timeoutMs`      | `number`         | 30000          | Request timeout       |
| `maxRetries`     | `number`         | 3              | Maximum retries       |

## Schema Definitions

### Base Schemas (`workers/shared/schemas/common/base.schema.ts`)

- `rpcMetadataSchema`: Standard metadata for RPC calls
- `rpcResponseSchema`: Standard RPC response format
- `healthCheckSchema`: Health check response format

### Excel Worker Schemas (`workers/shared/schemas/excel/premium-workbook.schema.ts`)

- `generatePremiumWorkbookInputSchema`: Input for premium workbook generation
- `generatePremiumWorkbookOutputSchema`: Output from premium workbook generation
- `generateAdjustmentSheetInputSchema`: Input for adjustment sheet generation
- `generateAdjustmentSheetOutputSchema`: Output from adjustment sheet generation
- `exportReportInputSchema`: Input for generic report export
- `exportReportOutputSchema`: Output from generic report export

## Migration Guide

### From Custom Signed Requests to RPC

**Before (Custom Signed Requests):**

```typescript
// Old way with manual fetch
const response = await env.EXCEL_SERVICE.fetch(
  "https://excel-service/api/generate",
  {
    method: "POST",
    body: JSON.stringify({
      payload: {/* complex data */},
      signature: "...",
      timestamp: Date.now(),
      serviceName: "excel-worker",
    }),
  },
);
```

**After (Type-safe RPC):**

```typescript
import { ExcelServiceClient } from "./workers/shared";

const excelClient = new ExcelServiceClient({
  serviceBinding: env.EXCEL_SERVICE,
});

const result = await excelClient.generatePremiumWorkbook({
  policy: policyData,
  premium: premiumData,
});
```

### Benefits

1. **Type Safety**: Compile-time validation of all inputs/outputs
2. **Auto-completion**: IDE support for RPC methods and parameters
3. **Standardized Error Handling**: Consistent error codes and responses
4. **Retry Logic**: Built-in retry with exponential backoff
5. **Observability**: Request IDs, logging, and telemetry
6. **Security**: No custom crypto implementation needed

## Testing

### Unit Testing RPC Clients

```typescript
import { ExcelServiceClient } from "./workers/shared";

const mockBinding = {
  fetch: jest.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        success: true,
        data: { workbook: { url: "test.xlsx", size: 1024 } },
      }),
  }),
} as any;

const client = new ExcelServiceClient({
  serviceBinding: mockBinding,
});

const result = await client.generatePremiumWorkbook({
  policy: mockPolicy,
  premium: mockPremium,
});

expect(result.workbook.url).toBe("test.xlsx");
```

### Integration Testing

```typescript
import { createExcelServiceClient } from "./workers/shared";

// Test with actual service binding
const client = createExcelServiceClient(env.EXCEL_SERVICE);

// Mock environment variables for testing
const result = await client.generatePremiumWorkbook({
  policy: testPolicy,
  premium: testPremium,
});

expect(result.success).toBe(true);
```

## Performance Considerations

1. **Connection Pooling**: RPC clients reuse service binding connections
2. **Retry Timing**: Exponential backoff prevents thundering herd
3. **Serialization**: Zod validation adds minimal overhead compared to benefits
4. **Caching**: Consider caching responses for repeatable operations

## Monitoring & Observability

### Logging

All RPC calls generate structured logs:

- Request ID
- Service name
- Method called
- Duration
- Success/failure status
- Error codes if failed

### Metrics

Key metrics to monitor:

- RPC call duration (p50, p90, p99)
- Success rate by service and method
- Retry count distribution
- Error rate by error code

## Best Practices

### 1. Always Use Type-safe Clients

```typescript
// ✅ Good - Type-safe
const result = await excelClient.generatePremiumWorkbook(input);

// ❌ Bad - Manual fetch
const response = await env.EXCEL_SERVICE.fetch("...");
```

### 2. Provide Request IDs for Tracing

```typescript
await excelClient.generatePremiumWorkbook(input, {
  requestId: `excel-${Date.now()}-${uuid()}`,
});
```

### 3. Handle Errors Gracefully

```typescript
try {
  return await excelClient.generatePremiumWorkbook(input);
} catch (error) {
  if (error.code === "VALIDATION_FAILED") {
    // Show user-friendly message
  } else if (error.code === "SERVICE_UNAVAILABLE") {
    // Show retry option
  }
  throw error;
}
```

### 4. Validate Inputs Early

```typescript
import { generatePremiumWorkbookInputSchema } from "./workers/shared";

// Validate before making RPC call
const validation = generatePremiumWorkbookInputSchema.safeParse(input);
if (!validation.success) {
  return { error: validation.error };
}
```

## Future Extensions

1. **Document Worker Client**: Add type-safe client for document worker
2. **Authentication Middleware**: Add auth token validation
3. **Rate Limiting**: Add built-in rate limiting
4. **Circuit Breaker**: Add circuit breaker pattern for fault tolerance
5. **Distributed Tracing**: Add OpenTelemetry integration

## Contributing

When adding new RPC methods:

1. Add Zod schemas in the appropriate schema file
2. Add method to the service interface in `rpc/types.ts`
3. Implement client method in the appropriate client file
4. Update documentation
5. Add tests

## License

Internal use only.

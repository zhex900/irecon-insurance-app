# Worker-to-Worker Communication Using Cloudflare RPC Features

## Overview

This document outlines the recommended patterns for worker-to-worker communication in the Irecon Insurance application using Cloudflare's RPC (Remote Procedure Call) features. The current implementation uses custom signed requests with HMAC signatures, but we should migrate to Cloudflare's built-in RPC capabilities for better performance, security, and maintainability.

## Current Implementation: Custom Signed Requests

### Current Pattern

The application currently uses a custom request signing system for worker-to-worker communication:

```typescript
// workers/shared/security/signing.ts
export interface SignedRequest {
  payload: unknown;
  signature: string;
  timestamp: number;
  serviceName: string;
}

export async function createSignedRequest(
  payload: unknown,
  serviceName: string,
  sharedSecret: string,
): Promise<SignedRequest> {
  // Custom HMAC-based signing implementation
}
```

### Issues with Current Approach

1. **Manual Security Implementation**: Custom HMAC signing requires careful implementation
2. **Performance Overhead**: Extra serialization/deserialization steps
3. **Maintenance Burden**: Need to maintain custom security logic
4. **Type Safety**: Manual type validation instead of compile-time checking

## Cloudflare RPC Features

Cloudflare Workers provides built-in RPC capabilities through:

1. **Service Bindings** (already configured)
2. **Worker RPC** (experimental, for TypeScript-to-TypeScript communication)

### Service Bindings (Recommended)

Service bindings provide secure, low-latency communication between Workers without going over the public internet.

#### Current Configuration

```jsonc
// wrangler.jsonc
"services": [
  {
    "binding": "EXCEL_SERVICE",
    "service": "insurance-excel-worker-staging",
  },
  {
    "binding": "DOCUMENT_SERVICE",
    "service": "insurance-document-worker-staging",
  },
]
```

#### Using Service Bindings

**Current approach (manual fetch):**

```typescript
// From main app to Excel worker
const response = await env.EXCEL_SERVICE.fetch(
  "https://excel-service/api/generate",
  {
    method: "POST",
    headers: {/* custom headers */},
    body: JSON.stringify(signedRequest),
  },
);
```

**RPC Approach (recommended):**
Define TypeScript interfaces for type-safe RPC:

```typescript
// workers/shared/rpc/types.ts
export interface ExcelWorkerRPC {
  generatePremiumWorkbook(
    input: GeneratePremiumWorkbookInput,
  ): Promise<GeneratePremiumWorkbookOutput>;

  generateAdjustmentSheet(
    input: GenerateAdjustmentSheetInput,
  ): Promise<GenerateAdjustmentSheetOutput>;
}

export interface DocumentWorkerRPC {
  generatePolicyPdf(
    input: GeneratePolicyPdfInput,
  ): Promise<GeneratePolicyPdfOutput>;

  validateDocumentTemplate(
    input: ValidateTemplateInput,
  ): Promise<ValidateTemplateOutput>;
}
```

### Worker RPC (Experimental)

Cloudflare's Worker RPC allows direct method calls between Workers with TypeScript type safety.

#### Implementation Pattern

**1. Define RPC Service Interface**

```typescript
// workers/excel/rpc-service.ts
import { RpcService } from "workerd";

export class ExcelRpcService implements RpcService {
  async generatePremiumWorkbook(
    input: GeneratePremiumWorkbookInput,
  ): Promise<GeneratePremiumWorkbookOutput> {
    // Implementation logic
  }
}
```

**2. Export Service from Worker**

```typescript
// workers/excel/index.ts
import { ExcelRpcService } from "./rpc-service";

export default {
  fetch: /* ... */,
  rpc: new ExcelRpcService(),
};
```

**3. Call from Main Worker**

```typescript
// workers/app.ts
export default {
  async fetch(request: Request, env: Env) {
    // Type-safe RPC call
    const result = await env.EXCEL_SERVICE.rpc.generatePremiumWorkbook({
      policy: policyData,
      premium: premiumData,
    });

    return Response.json(result);
  },
};
```

## Migration Plan

### Phase 1: Type-Safe Service Binding Wrappers

Replace manual fetch calls with type-safe wrappers:

```typescript
// workers/shared/rpc/excel-client.ts
export class ExcelServiceClient {
  constructor(private readonly binding: Fetcher) {}

  async generatePremiumWorkbook(
    input: GeneratePremiumWorkbookInput,
  ): Promise<GeneratePremiumWorkbookOutput> {
    const response = await this.binding.fetch(
      "https://excel-service/api/generate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "generatePremiumWorkbook",
          data: input,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Excel service error: ${response.status}`);
    }

    return response.json() as Promise<GeneratePremiumWorkbookOutput>;
  }
}

// Usage in main app
const excelClient = new ExcelServiceClient(env.EXCEL_SERVICE);
const result = await excelClient.generatePremiumWorkbook({/* input */});
```

### Phase 2: Shared Type Definitions

Create shared Zod schemas and TypeScript types:

```typescript
// workers/shared/types/schemas.ts
import { z } from "zod";

export const generatePremiumWorkbookInputSchema = z.object({
  policy: policySchema,
  premium: premiumBreakdownSchema,
  options: z
    .object({
      includeAdjustment: z.boolean().optional(),
      policyNumber: z.string().optional(),
      clientName: z.string().optional(),
    })
    .optional(),
});

export type GeneratePremiumWorkbookInput = z.infer<
  typeof generatePremiumWorkbookInputSchema
>;

export const generatePremiumWorkbookOutputSchema = z.object({
  workbook: z.object({
    url: z.string(),
    size: z.number(),
    mimeType: z.string(),
  }),
  metadata: z.object({
    generationTime: z.number(),
    sheetCount: z.number(),
  }),
});

export type GeneratePremiumWorkbookOutput = z.infer<
  typeof generatePremiumWorkbookOutputSchema
>;
```

### Phase 3: RPC Method Migration

Migrate from REST endpoints to RPC methods:

**Before (REST):**

```typescript
// Client
const response = await fetch("https://excel-service/api/generate", {
  method: "POST",
  body: JSON.stringify({/* complex payload */}),
});

// Server
if (url.pathname === "/api/generate") {
  // Parse and validate request
  const data = await request.json();
  const validated = excelWorkerRequestSchema.parse(data);
  // Process request
}
```

**After (RPC):**

```typescript
// Client
const result = await excelService.generatePremiumWorkbook({
  // Type-safe input
});

// Server
class ExcelRpcService {
  async generatePremiumWorkbook(input: GeneratePremiumWorkbookInput) {
    // Input is already validated by TypeScript
    // Process request
  }
}
```

## Security Considerations

### 1. Service Binding Security

- **Already secure**: Service bindings provide private communication channels
- **No public endpoints**: Workers only accessible via bindings
- **Automatic authentication**: Cloudflare handles service authentication

### 2. Input Validation

Even with RPC, maintain validation:

```typescript
class ExcelRpcService {
  async generatePremiumWorkbook(input: unknown) {
    // Validate input even with TypeScript
    const validated = generatePremiumWorkbookInputSchema.parse(input);
    // Use validated data
  }
}
```

### 3. Rate Limiting & DoS Protection

Implement worker-level protections:

```typescript
import { rateLimit } from "workerd";

export default {
  fetch: async (request: Request, env: Env) => {
    // Apply rate limiting
    const limiter = rateLimit({
      requests: 100, // 100 requests per...
      window: 60, // ...60 seconds
      key: (request) => request.headers.get("x-request-id"),
    });

    if (!limiter.limit(request)) {
      return new Response("Too many requests", { status: 429 });
    }

    // Process request
  },
};
```

## Performance Benefits

### 1. Reduced Latency

- **Service bindings**: ~1ms overhead vs public network calls
- **RPC serialization**: More efficient than JSON over HTTP

### 2. Better Type Safety

- **Compile-time validation**: Catch errors before runtime
- **Auto-completion**: IDE support for RPC methods
- **Refactoring safety**: TypeScript ensures API compatibility

### 3. Simplified Error Handling

```typescript
// Before: Manual error handling
try {
  const response = await fetch(/* ... */);
  if (!response.ok) {
    // Parse error response
    const error = await response.json();
    throw new Error(error.message);
  }
} catch (error) {
  // Handle fetch errors
}

// After: Standardized errors
try {
  const result = await excelService.generatePremiumWorkbook(input);
} catch (error) {
  if (error instanceof ExcelServiceError) {
    // Type-safe error handling
  }
}
```

## Implementation Steps

### Step 1: Create Shared Types Package

```bash
mkdir -p workers/shared/types
# Define all RPC interfaces and Zod schemas
```

### Step 2: Create Type-Safe Client Wrappers

```typescript
// workers/shared/rpc/clients.ts
export { ExcelServiceClient } from "./excel-client";
export { DocumentServiceClient } from "./document-client";
```

### Step 3: Update Main Worker

```typescript
// workers/app.ts
import {
  ExcelServiceClient,
  DocumentServiceClient,
} from "./shared/rpc/clients";

export default {
  async fetch(request: Request, env: Env) {
    const excelClient = new ExcelServiceClient(env.EXCEL_SERVICE);
    const documentClient = new DocumentServiceClient(env.DOCUMENT_SERVICE);

    // Use type-safe clients
  },
};
```

### Step 4: Update Service Workers

```typescript
// workers/excel/index.ts
import { ExcelRpcService } from "./rpc-service";

export default {
  async fetch(request: Request, env: ExcelWorkerEnv) {
    // Handle traditional HTTP requests
  },

  // Export RPC service
  rpc: new ExcelRpcService(),
};
```

## Migration Checklist

- [ ] Define shared TypeScript interfaces for all RPC methods
- [ ] Create Zod schemas for input/output validation
- [ ] Implement type-safe client wrappers for service bindings
- [ ] Update main worker to use new client wrappers
- [ ] Add RPC service exports to worker services
- [ ] Update documentation and examples
- [ ] Run integration tests to ensure backward compatibility
- [ ] Monitor performance metrics before/after migration

## Example: Complete RPC Implementation

### Shared Types

```typescript
// workers/shared/types/excel.ts
export interface GeneratePremiumWorkbookInput {
  policy: Policy;
  premium: PremiumBreakdown;
  options?: {
    includeAdjustment?: boolean;
    policyNumber?: string;
    clientName?: string;
  };
}

export interface GeneratePremiumWorkbookOutput {
  workbook: {
    url: string;
    size: number;
    mimeType: string;
  };
  metadata: {
    generationTime: number;
    sheetCount: number;
  };
}
```

### RPC Service

```typescript
// workers/excel/rpc-service.ts
export class ExcelRpcService {
  async generatePremiumWorkbook(
    input: GeneratePremiumWorkbookInput,
  ): Promise<GeneratePremiumWorkbookOutput> {
    // Implementation using existing business logic
    const workbook = await generatePremiumExcel(input);

    return {
      workbook: {
        url: workbook.url,
        size: workbook.size,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
      metadata: {
        generationTime: workbook.generationTime,
        sheetCount: workbook.sheetCount,
      },
    };
  }
}
```

### Client Usage

```typescript
// app/lib/services/excel.service.ts
export class ExcelService {
  constructor(private readonly excelClient: ExcelServiceClient) {}

  async generatePremiumReport(
    policy: Policy,
    premium: PremiumBreakdown,
  ): Promise<string> {
    const result = await this.excelClient.generatePremiumWorkbook({
      policy,
      premium,
      options: {
        includeAdjustment: true,
        policyNumber: policy.policyNumber,
        clientName: policy.clientName,
      },
    });

    return result.workbook.url;
  }
}
```

## Summary

Migrating to Cloudflare's RPC features provides:

1. **Enhanced Security**: Built-in authentication via service bindings
2. **Better Performance**: Lower latency than public HTTP calls
3. **Improved Developer Experience**: Type-safe APIs with autocomplete
4. **Reduced Complexity**: Eliminates custom security implementation
5. **Future-proofing**: Aligns with Cloudflare's evolving RPC capabilities

Start with type-safe wrappers around existing service bindings, then gradually migrate to full RPC implementation as Cloudflare's RPC features mature.

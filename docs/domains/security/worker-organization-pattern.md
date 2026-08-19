# Worker Organization Pattern & Standards

## Overview

Standardized pattern for domain-based worker organization within the insurance broker application. Based on analysis of current worker implementations and best practices.

## Current State Analysis

### ✅ **Excel Worker Pattern (Well-Organized)**

```
workers/excel/
├── index.ts           # HTTP handler entry point
└── modules/           # Domain logic modules
    ├── index.ts       # Central module exports
    ├── excel-types.ts # Type definitions
    ├── excel-build.ts # Orchestrator
    ├── excel-*.ts     # Specialized modules
    └── worker-types.ts # Worker-specific types
```

**Strengths:**

- Clear domain separation (`excel/` folder)
- Modular organization (`modules/` directory)
- Central exports for clean imports
- Proper separation of handler vs. logic

### ⚠️ **Document Worker Pattern (Needs Reorganization)**

```
workers/
├── documents.ts       # Main handler (flat file)
├── document-fonts.ts  # Font logic (separate but flat)
└── document-worker-env.d.ts # Types (flat)
```

**Issues:**

- Files scattered in root `workers/` directory
- No organized folder structure
- Mixed concerns across files
- Inconsistent with Excel worker pattern

## Standard Worker Pattern

### **Folder Structure Template**

```bash
workers/
├── {domain}-worker/           # Domain-specific worker
│   ├── index.ts              # Main HTTP handler (export default { fetch })
│   ├── handler/              # Request handling layer
│   │   ├── routes.ts         # Route definitions & mapping
│   │   ├── validation.ts     # Zod schemas & validation logic
│   │   └── middleware.ts     # Auth, logging, rate limiting
│   ├── services/             # Business logic layer
│   │   ├── {service-name}.ts # Individual service logic
│   │   └── index.ts          # Service exports
│   ├── utils/                # Shared utilities
│   │   ├── logging.ts        # Structured logging
│   │   ├── metrics.ts        # Performance metrics
│   │   └── security.ts       # Security helpers
│   ├── types/                # TypeScript definitions
│   │   ├── schemas.ts        # Zod schemas (single source of truth)
│   │   ├── domain.ts         # Domain types
│   │   └── index.ts          # Type exports
│   └── constants/            # Constants & configuration
│       ├── config.ts         # Configuration values
│       └── index.ts          # Constant exports
└── shared/                  # Cross-worker utilities
    ├── client/              # Worker client library
    ├── security/            # Shared security logic
    └── logging/             # Centralized logging
```

### **File Templates**

#### **1. Main Handler (`index.ts`)**

```typescript
// workers/{domain}/index.ts
// Recommended: Clean export pattern
import { handler } from "./handler";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handler(request, env);
  },
};

// Alternative: For simple workers (1-2 endpoints)
// export default {
//   async fetch(request: Request, env: Env): Promise<Response> {
//     // Simple routing logic directly here (<100 lines)
//   }
// };
```

**Decision Guide:**

- **< 100 lines & simple routing**: Keep handler in `index.ts`
- **> 100 lines or complex routing**: Separate `handler/` folder
- **Current Excel worker (607 lines)**: **Definitely needs handler separation**

#### **2. Handler Layer (`handler/index.ts`)**

```typescript
// workers/{domain}/handler/index.ts
import { routes } from "./routes";
import { validateRequest } from "./validation";
import { applyMiddleware } from "./middleware";

export async function handler(request: Request, env: Env): Promise<Response> {
  // Apply middleware (auth, logging, rate limiting)
  const middlewareContext = await applyMiddleware(request, env);

  if (middlewareContext.response) {
    return middlewareContext.response;
  }

  // Route request
  const routeHandler = routes.match(request);
  if (!routeHandler) {
    return new Response("Not found", { status: 404 });
  }

  // Validate request
  const validationResult = await validateRequest(request, routeHandler.schema);
  if (!validationResult.success) {
    return new Response(
      JSON.stringify({
        error: "Validation failed",
        details: validationResult.errors,
      }),
      { status: 400 },
    );
  }

  // Execute handler
  return await routeHandler.handler(request, env, validationResult.data);
}
```

#### **3. Route Definitions (`handler/routes.ts`)**

```typescript
// workers/{domain}/handler/routes.ts
import { routesSchema } from "../types/schemas";
import { generateService } from "../services";

interface Route {
  method: string;
  path: string;
  schema: ZodSchema;
  handler: (request: Request, env: Env, data: unknown) => Promise<Response>;
}

export const routes: Route[] = [
  {
    method: "POST",
    path: "/api/generate",
    schema: routesSchema.generate,
    handler: async (request, env, data) => {
      const result = await generateService(data);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  },
  // Add more routes...
];
```

## Implementation Roadmap

### **Phase 1: Document Worker Reorganization (Week 1)**

**Current Structure:**

```
workers/
├── documents.ts
├── document-fonts.ts
└── document-worker-env.d.ts
```

**Target Structure:**

```
workers/documents/
├── index.ts              # Main handler (replaces documents.ts)
├── handler/
│   ├── routes.ts         # Route definitions
│   ├── validation.ts     # Zod schemas
│   └── middleware.ts     # Auth & security
├── services/
│   ├── pdf-generation.ts # PDF logic (from documents.ts)
│   ├── font-management.ts # Font logic (from document-fonts.ts)
│   └── index.ts          # Service exports
├── types/
│   ├── schemas.ts        # Zod schemas
│   ├── domain.ts         # Domain types
│   └── env.d.ts          # Environment types (from document-worker-env.d.ts)
└── constants/
    ├── config.ts         # Configuration
    └── index.ts          # Constant exports
```

**Migration Steps:**

1. Create `workers/documents/` folder structure
2. Extract logic from `documents.ts` into `services/`
3. Move `document-fonts.ts` logic to `services/font-management.ts`
4. Update `document-worker-env.d.ts` to `types/env.d.ts`
5. Update wrangler configuration paths

### **Phase 2: Excel Worker Enhancement (Week 2)**

**Current Structure:**

```
workers/excel/
├── index.ts
└── modules/
    ├── excel-*.ts
    └── index.ts
```

**Enhanced Structure:**

```
workers/excel/
├── index.ts              # Main handler
├── handler/              # Add handler layer
│   ├── routes.ts         # Route definitions
│   ├── validation.ts     # Zod schemas
│   └── middleware.ts     # Security middleware
├── services/             # Rename modules/ to services/
│   ├── excel-build.ts    # Orchestrator
│   ├── excel-*.ts        # Specialized services
│   └── index.ts          # Service exports
├── types/                # Add types folder
│   ├── schemas.ts        # Zod schemas
│   └── domain.ts         # Domain types
└── constants/            # Add constants
    ├── config.ts
    └── index.ts
```

**Migration Steps:**

1. Add `handler/` layer for routing and validation
2. Rename `modules/` to `services/` for consistency
3. Create `types/` folder with Zod schemas
4. Extract constants to `constants/` folder
5. Maintain backward compatibility through export re-exports

### **Phase 3: Shared Worker Infrastructure (Week 3)**

**Create Shared Layer:**

```
workers/shared/
├── client/               # Worker client library
│   ├── base-client.ts    # Base client with retry logic
│   ├── excel-client.ts  # Excel worker client
│   ├── document-client.ts # Document worker client
│   └── index.ts          # Client exports
├── security/             # Shared security logic
│   ├── auth.ts          # Authentication & authorization
│   ├── signing.ts       # Request signing & validation
│   └── validation.ts    # Shared validation utilities
└── logging/              # Centralized logging
    ├── structured.ts    # Structured logging
    ├── metrics.ts       # Performance metrics
    └── tracing.ts       # Distributed tracing
```

**Implementation Steps:**

1. Create shared client library with retry logic
2. Implement request signing utilities
3. Add structured logging framework
4. Create metrics collection system

### **Phase 4: Pattern Standardization (Week 4)**

**Create Standards:**

1. **Documentation**: Create worker development guide
2. **Templates**: Generate worker scaffold template
3. **Code Review**: Add worker pattern checks to code review
4. **Testing**: Standardize worker testing patterns

## File-by-File Migration Guide

### **Document Worker Migration**

**Step 1: Create Folder Structure**

```bash
mkdir -p workers/documents/{handler,services,types,constants}
```

**Step 2: Extract Services**

```typescript
// workers/documents/services/pdf-generation.ts
// Extract from documents.ts
export async function generatePolicyPdf(data: PdfRequest): Promise<PdfResult> {
  // PDF generation logic from documents.ts
}

// workers/documents/services/font-management.ts
// Extract from document-fonts.ts
export async function getDocumentWorkerFonts(): Promise<FontData> {
  // Font logic from document-fonts.ts
}
```

**Step 3: Create Handler**

```typescript
// workers/documents/handler/routes.ts
import { pdfRenderRequestSchema } from "../types/schemas";
import { generatePolicyPdf } from "../services/pdf-generation";

export const routes = [
  {
    method: "POST",
    path: "/render",
    schema: pdfRenderRequestSchema,
    handler: async (request, env, data) => {
      const pdf = await generatePolicyPdf(data);
      return new Response(pdf, {
        headers: { "Content-Type": "application/pdf" },
      });
    },
  },
];
```

**Step 4: Update Main Handler**

```typescript
// workers/documents/index.ts
import { handler } from "./handler";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handler(request, env);
  },
};
```

**Step 5: Update Wrangler Config**

```json
{
  "main": "workers/documents/index.ts"
  // Rest of configuration...
}
```

## Success Criteria

### **Organization Metrics**

- ✅ All workers follow domain-based folder structure
- ✅ Consistent file organization across all workers
- ✅ Clear separation of handler vs. business logic
- ✅ Centralized exports for clean imports
- ✅ Shared utilities reused across workers

### **Code Quality Metrics**

- ✅ Zero breaking changes to external APIs
- ✅ All existing tests continue to pass
- ✅ Improved type safety with Zod schemas
- ✅ Better separation of concerns
- ✅ Reduced code duplication

### **Maintainability Metrics**

- ✅ Easier onboarding with consistent patterns
- ✅ Simplified code navigation
- ✅ Reduced cognitive load
- ✅ Better test isolation
- ✅ Improved code reuse

## Benefits

### **Immediate Benefits**

- Consistent code organization
- Improved developer experience
- Better separation of concerns
- Enhanced maintainability

### **Long-term Benefits**

- Scalable worker architecture
- Easier addition of new workers
- Simplified debugging and troubleshooting
- Better team collaboration

### **Technical Benefits**

- Single source of truth for types via Zod schemas
- Shared security implementation
- Centralized logging and monitoring
- Consistent error handling patterns

## Verification Checklist

### **Pre-Migration Verification**

- [ ] All existing tests pass
- [ ] No breaking API changes
- [ ] Performance benchmarks established
- [ ] Rollback plan documented

### **Post-Migration Verification**

- [ ] All functionality preserved
- [ ] Performance maintained or improved
- [ ] Code organization meets standards
- [ ] Documentation updated
- [ ] Team trained on new patterns

## Conclusion

This standardized worker organization pattern addresses current inconsistencies while establishing a scalable foundation for future worker development. The phased approach ensures smooth migration with minimal disruption to existing functionality.

**Implementation Priority: HIGH** - Standardizing worker patterns improves maintainability, security, and team productivity.

**Timeline: 4 weeks** with weekly verification milestones.

**Success:** All workers following consistent domain-based organization patterns with improved separation of concerns and enhanced security.

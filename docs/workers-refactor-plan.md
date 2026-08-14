# Workers Refactor Plan

## Executive Summary

This plan outlines a comprehensive refactor of the Irecon Insurance worker infrastructure to implement:

1. **RPC-based communication** instead of public-facing HTTP endpoints
2. **Full Zod validation** with schema-first type generation
3. **Consistent organization** following project standards
4. **Improved security** with private service-to-service communication

**Status**: Current worker implementation uses custom signed requests with HMAC signatures and public HTTP endpoints
**Target**: Private RPC communication with Cloudflare service bindings, full Zod validation, consistent architecture

## Current State Analysis

### Architecture Issues Identified

#### 1. Communication Pattern

- **Public HTTP endpoints**: Workers expose public APIs
- **Custom security**: Manual HMAC signing implementation
- **Mixed patterns**: Some REST endpoints, some custom RPC-like calls
- **No type safety**: Limited TypeScript validation at boundaries

#### 2. Validation Issues

- **Inconsistent validation**: Some endpoints validate, others don't
- **Partial Zod usage**: Schemas exist but not consistently used
- **TypeScript `any` usage**: Multiple places using `any` instead of proper types
- **No single source of truth**: Types defined in multiple places

#### 3. Organization Issues

- **Inconsistent naming**: Mixed file naming conventions
- **Fragmented structure**: Similar code duplicated across workers
- **No shared contracts**: Each worker defines its own interfaces
- **Mixed concerns**: Business logic mixed with communication logic

#### 4. Security Issues

- **Public endpoints**: Workers accessible from internet
- **Manual security**: Custom HMAC implementation prone to errors
- **No audit logging**: Limited request/response tracking
- **Inconsistent auth**: Some endpoints authenticated, others not

## Target Architecture

### Guiding Principles

1. **Zero Public Endpoints**: All worker communication via private service bindings
2. **Schema-First Development**: Zod schemas define contracts, TypeScript types derived
3. **Consistent Patterns**: Same organization across all workers
4. **Type Safety End-to-End**: Compile-time validation of all communication
5. **Secure by Default**: Built-in Cloudflare security features

### High-Level Architecture

```
┌─────────────────────────────────────────────┐
│              Main Application                │
│  • React Router + Cloudflare Worker         │
│  • Business Logic Orchestration              │
└─────────────┬───────────────────────────────┘
              │ RPC Calls (Type-safe)
              ▼
┌─────────────────────────────────────────────┐
│        Shared Worker Infrastructure          │
│  • RPC Client Wrappers                       │
│  • Shared Zod Schemas                        │
│  • Common Types & Interfaces                 │
└─────────────┬───────────────────────────────┘
              │ Consistent RPC Pattern
              ▼
┌─────────────────────────────────────────────┐
│                Excel Worker                  │
│  • RPC Service Implementation               │
│  • Excel Generation Logic                    │
│  • Private (no public endpoints)            │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│              Document Worker                 │
│  • RPC Service Implementation               │
│  • PDF Generation Logic                     │
│  • Private (no public endpoints)            │
└─────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Foundation (Week 1-2)

#### 1.1 Create Shared RPC Infrastructure

**Goal**: Establish core RPC patterns and shared contracts

**Tasks**:

1. **Create shared Zod schema library**
   - Location: `workers/shared/schemas/`
   - Organization: By domain (excel, documents, common)
   - Export pattern: `export const schema = z.object({...}); export type Type = z.infer<typeof schema>;`

2. **Implement RPC client pattern**
   - Create `RpcClient` base class with error handling
   - Implement retry logic, timeouts, connection pooling
   - Add telemetry and logging

3. **Define TypeScript interfaces**
   - Derive all types from Zod schemas using `z.infer`
   - Create shared interface files in `workers/shared/types/`
   - Ensure no `any` types in communication layer

**Files to Create**:

```
workers/shared/
├── schemas/
│   ├── excel/
│   │   ├── premium-workbook.schema.ts
│   │   ├── adjustment-sheet.schema.ts
│   │   └── index.ts
│   ├── documents/
│   │   ├── pdf-generation.schema.ts
│   │   └── index.ts
│   └── common/
│       ├── base.schema.ts
│       └── index.ts
├── types/
│   ├── excel-types.ts
│   ├── document-types.ts
│   └── rpc-types.ts
├── rpc/
│   ├── RpcClient.ts
│   ├── errors.ts
│   └── telemetry.ts
└── index.ts
```

### Phase 2: Excel Worker Refactor (Week 3-4)

#### 2.1 Migrate to RPC Pattern

**Goal**: Convert Excel worker from public REST to private RPC

**Tasks**:

1. **Create RPC service interface**

   ```typescript
   // workers/excel/rpc-service.ts
   export interface ExcelRpcService {
     generatePremiumWorkbook(
       input: GeneratePremiumWorkbookInput,
     ): Promise<GeneratePremiumWorkbookOutput>;

     generateAdjustmentSheet(
       input: GenerateAdjustmentSheetInput,
     ): Promise<GenerateAdjustmentSheetOutput>;
   }
   ```

2. **Implement RPC service**
   - Wrap existing business logic
   - Add comprehensive error handling
   - Implement input validation using shared schemas

3. **Update worker entry point**
   - Remove public HTTP routes
   - Export RPC service via Cloudflare RPC
   - Keep backward compatibility during migration

4. **Create type-safe client**
   ```typescript
   // workers/shared/clients/excel-client.ts
   export class ExcelServiceClient extends RpcClient {
     async generatePremiumWorkbook(
       input: GeneratePremiumWorkbookInput,
     ): Promise<GeneratePremiumWorkbookOutput> {
       return this.call("generatePremiumWorkbook", input);
     }
   }
   ```

**File Organization**:

```
workers/excel/
├── rpc-service/           # RPC implementation
│   ├── premium-workbook.ts
│   ├── adjustment-sheet.ts
│   └── index.ts
├── services/              # Business logic (existing)
│   ├── excel-types.ts
│   └── excel-workbook.ts
├── types/
│   ├── env.ts            # Environment types
│   └── index.ts
├── handler/              # Keep for backward compatibility
│   ├── routes.ts
│   └── validation.ts
└── index.ts              # Updated entry point
```

### Phase 3: Document Worker Refactor (Week 5-6)

#### 3.1 Apply Same Pattern to Document Worker

**Goal**: Standardize document worker with same RPC pattern

**Tasks**:

1. **Create document RPC service interface**
2. **Implement PDF generation RPC methods**
3. **Update worker entry point**
4. **Create document service client**

**File Organization**:

```
workers/documents/
├── rpc-service/
│   ├── pdf-generation.ts
│   ├── template-validation.ts
│   └── index.ts
├── services/
│   ├── pdf-generation.ts
│   └── template-service.ts
├── types/
│   ├── env.ts
│   └── index.ts
└── index.ts
```

### Phase 4: Main Application Integration (Week 7-8)

#### 4.1 Update Main Application

**Goal**: Migrate main app to use RPC clients instead of direct HTTP calls

**Tasks**:

1. **Replace manual fetch calls**

   ```typescript
   // BEFORE
   const response = await env.EXCEL_SERVICE.fetch(url, options);

   // AFTER
   const excelClient = new ExcelServiceClient(env.EXCEL_SERVICE);
   const result = await excelClient.generatePremiumWorkbook(input);
   ```

2. **Update service wrappers**
   - Modify `app/lib/reports/excel-worker-wrapper.server.ts`
   - Update `app/lib/pdf/document-worker.client.server.ts`
   - Ensure backward compatibility during transition

3. **Add feature flags**
   - Support both old and new communication patterns
   - Gradual rollout with monitoring

4. **Update tests**
   - Migrate integration tests to use RPC pattern
   - Add unit tests for new RPC clients
   - Update e2e tests if needed

### Phase 5: Cleanup & Optimization (Week 9-10)

#### 5.1 Remove Legacy Code

**Goal**: Eliminate old patterns and consolidate architecture

**Tasks**:

1. **Remove public HTTP endpoints** from workers
2. **Delete custom signing implementation** (`workers/shared/security/signing.ts`)
3. **Update configuration** to enforce private bindings only
4. **Consolidate types** into shared schemas
5. **Update documentation** with new patterns

#### 5.2 Performance Optimization

1. **Connection pooling**: Optimize RPC client connections
2. **Serialization**: Optimize Zod schema parsing performance
3. **Caching**: Add response caching where appropriate
4. **Monitoring**: Add comprehensive RPC telemetry

## Technical Specifications

### RPC Communication Pattern

```typescript
// Base RPC call pattern
interface RpcCall<TInput, TOutput> {
  method: string;
  input: TInput;
  metadata?: {
    requestId: string;
    timestamp: number;
    timeoutMs?: number;
  };
}

// Error handling
class RpcError extends Error {
  constructor(
    message: string,
    readonly code: RpcErrorCode,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

enum RpcErrorCode {
  ValidationFailed = "VALIDATION_FAILED",
  ServiceUnavailable = "SERVICE_UNAVAILABLE",
  Timeout = "TIMEOUT",
  // ...
}
```

### Zod Schema Pattern

```typescript
// Schema definition pattern
export const generatePremiumWorkbookInputSchema = z.object({
  policy: policySchema,
  premium: premiumBreakdownSchema,
  options: z
    .object({
      includeAdjustment: z.boolean().optional().default(false),
      policyNumber: z.string().optional(),
      clientName: z.string().optional(),
    })
    .optional(),
});

// Type derivation (single source of truth)
export type GeneratePremiumWorkbookInput = z.infer<
  typeof generatePremiumWorkbookInputSchema
>;

export type GeneratePremiumWorkbookOutput = z.infer<
  typeof generatePremiumWorkbookOutputSchema
>;
```

### File Naming Standards

#### Consistent Patterns

- **Schemas**: `*.schema.ts` (e.g., `premium-workbook.schema.ts`)
- **Types**: `*-types.ts` (e.g., `excel-types.ts`)
- **Services**: `*.service.ts` (e.g., `excel-rpc.service.ts`)
- **Clients**: `*-client.ts` (e.g., `excel-client.ts`)
- **Handlers**: `*.handler.ts` (e.g., `pdf-generation.handler.ts`)

#### Directory Structure

```
workers/
├── shared/                    # Shared infrastructure
│   ├── schemas/              # Zod schemas
│   ├── types/               # TypeScript types
│   ├── rpc/                  # RPC infrastructure
│   ├── clients/             # Service clients
│   └── utils/               # Shared utilities
├── excel/                    # Excel worker
│   ├── rpc-service/         # RPC implementation
│   ├── services/            # Business logic
│   ├── types/               # Worker-specific types
│   └── index.ts             # Entry point
├── documents/               # Document worker
│   ├── rpc-service/
│   ├── services/
│   ├── types/
│   └── index.ts
└── [future-worker]/         # Additional workers
```

### Security Implementation

#### 1. Service Binding Security

- **No public endpoints**: All communication via Cloudflare service bindings
- **Automatic encryption**: Cloudflare handles transport security
- **Private network**: Communication stays within Cloudflare network

#### 2. Input Validation

- **Zod schema validation** on all RPC inputs
- **Runtime type checking** despite TypeScript
- **Sanitization** of all external data

#### 3. Audit Logging

- **Request/response logging** with request IDs
- **Error tracking** with structured error information
- **Performance metrics** for RPC calls

## Migration Strategy

### Gradual Migration Path

#### Step 1: Parallel Operation

- Keep existing HTTP endpoints during migration
- Add RPC service alongside existing functionality
- Feature flag to choose communication method

#### Step 2: Client Migration

- Update main app to use RPC clients
- Keep fallback to HTTP for transition period
- Monitor performance and errors

#### Step 3: Server Migration

- Remove HTTP endpoints from workers
- Update configuration to private-only
- Validate all functionality works with RPC

#### Step 4: Cleanup

- Remove legacy HTTP code
- Delete custom signing implementation
- Update documentation

### Rollback Plan

**If RPC issues occur**:

1. Re-enable HTTP endpoints via configuration
2. Revert to using service binding fetch calls
3. Maintain data compatibility between versions

**Monitoring during migration**:

- Error rates for RPC vs HTTP calls
- Latency comparison
- Memory usage differences
- Success rates for critical operations

## Success Criteria

### Technical Metrics

- ✅ **Zero public endpoints**: All workers accessible only via service bindings
- ✅ **100% Zod validation**: All RPC inputs validated with Zod schemas
- ✅ **TypeScript compatibility**: All types derived from schemas, no `any` usage
- ✅ **Performance parity**: RPC calls no slower than HTTP calls
- ✅ **Zero breaking changes**: Existing functionality preserved

### Quality Metrics

- ✅ **Consistent patterns**: Same organization across all workers
- ✅ **Comprehensive tests**: All RPC methods have unit and integration tests
- ✅ **Complete documentation**: All new patterns documented
- ✅ **Backward compatibility**: Old clients continue to work during migration

### Security Metrics

- ✅ **No custom crypto**: Remove manual HMAC implementation
- ✅ **Built-in security**: Rely on Cloudflare service binding security
- ✅ **Audit logging**: All RPC calls logged with request IDs
- ✅ **Input validation**: All inputs validated before processing

## Risks & Mitigations

### Technical Risks

1. **Cloudflare RPC stability**: New feature, potential bugs
   - **Mitigation**: Feature flags, gradual rollout, monitoring

2. **Performance overhead**: RPC serialization may add latency
   - **Mitigation**: Performance testing, optimization, caching

3. **Type compatibility**: Zod-derived types may not match existing
   - **Mitigation**: Comprehensive type checking, gradual migration

### Migration Risks

1. **Breaking existing functionality**
   - **Mitigation**: Parallel operation, feature flags, extensive testing

2. **Developer learning curve**
   - **Mitigation**: Comprehensive documentation, examples, pair programming

3. **Timeline overruns**
   - **Mitigation**: Phased approach, MVP first, iterative improvements

## Timeline

**Total Estimate**: 10 weeks (2 weeks per phase)

### Detailed Timeline

- **Weeks 1-2**: Foundation (shared infrastructure)
- **Weeks 3-4**: Excel worker refactor
- **Weeks 5-6**: Document worker refactor
- **Weeks 7-8**: Main application integration
- **Weeks 9-10**: Cleanup & optimization

### Milestones

1. **M1**: Shared schemas and RPC infrastructure complete
2. **M2**: Excel worker migrated to RPC pattern
3. **M3**: Document worker migrated to RPC pattern
4. **M4**: Main application using RPC clients
5. **M5**: Legacy code removed, full migration complete

## Dependencies

### Technical Dependencies

- Cloudflare Workers service bindings (already configured)
- Cloudflare RPC features (available)
- Zod validation library (already in use)
- TypeScript 6.0+ (already configured)

### Team Dependencies

- Developer availability for 10-week effort
- Testing resources for validation
- Review process for architectural changes

### External Dependencies

- Cloudflare platform stability
- No breaking changes to service binding API
- Zod library compatibility with TypeScript

## Next Steps

### Immediate Actions (Week 1)

1. **Review and approve** this refactor plan
2. **Create shared schema directory structure**
3. **Implement base RpcClient class**
4. **Define initial Zod schemas for Excel worker**

### Success Metrics Review

Weekly review of:

- Progress against timeline
- Technical metrics achievement
- Quality metrics validation
- Security requirements met

---

_Last Updated: 2026-08-14_  
_Owner: Engineering Team_  
_Status: Planning Phase_

# Worker Security Implementation Plan

## Overview

Critical security improvements required for worker service communication between main application and Excel/PDF/document workers.

## Critical Security Issues Identified

### 1. **Public Worker Endpoints**

- Excel worker endpoints publicly accessible without authentication
- No restriction that only main app can call worker services
- Missing service-to-service authentication

### 2. **No Request Validation**

- Missing signature verification on worker requests
- No HMAC validation of request payloads
- No timestamp-based replay attack protection

### 3. **Schema Validation Gaps**

- Types not derived from Zod schemas
- Inconsistent validation across worker endpoints
- No single source of truth for data structures

## Implementation Strategy

### Phase 1: Authentication & Authorization (Week 1)

**Goal:** Implement service authentication for all workers

#### 1.1 Add Service Token Validation to Excel Worker

```typescript
// workers/excel/index.ts
async function validateServiceToken(request: Request): Promise<boolean> {
  const token = request.headers.get("X-Service-Token");
  if (!token) return false;

  // Validate token against shared secret or JWT
  const isValid = await verifyServiceToken(token);
  return isValid;
}
```

#### 1.2 Restrict Endpoints to Authenticated Services

```typescript
// Update all worker endpoints to require authentication
if (!(await validateServiceToken(request))) {
  return new Response(JSON.stringify({ error: "Unauthorized service" }), {
    status: 401,
  });
}
```

#### 1.3 Create Shared Secret Management

```diff
# .env
+EXCEL_WORKER_SHARED_SECRET=your-secure-secret-here
+WORKER_SERVICE_TOKEN_TTL=300000 # 5 minutes
```

### Phase 2: Request Signing & Validation (Week 2)

**Goal:** Implement cryptographically secure request signing

#### 2.1 Add Request Signing to Worker Client

```typescript
// app/lib/reports/excel-worker-wrapper.server.ts
async function signWorkerRequest(payload: unknown): Promise<SignedRequest> {
  const timestamp = Date.now();
  const dataToSign = JSON.stringify(payload) + timestamp;
  const signature = await createHmacSignature(dataToSign);

  return {
    payload,
    signature,
    timestamp,
    serviceToken: await getServiceToken(),
  };
}
```

#### 2.2 Add Signature Validation to Worker

```typescript
// workers/excel/index.ts
async function validateRequestSignature(
  payload: unknown,
  signature: string,
  timestamp: number,
): Promise<boolean> {
  // Check timestamp freshness (prevent replay attacks)
  if (Date.now() - timestamp > 5 * 60 * 1000) {
    return false; // More than 5 minutes old
  }

  // Reconstruct and verify signature
  const dataToVerify = JSON.stringify(payload) + timestamp;
  return await verifyHmacSignature(dataToVerify, signature);
}
```

### Phase 3: Zod Schema Validation (Week 3)

**Goal:** Create single source of truth for worker data structures

#### 3.1 Create Zod Schemas for Worker Requests

```typescript
// app/lib/zod/worker-schemas.ts
import { z } from "zod";

export const excelWorkerRequestSchema = z.object({
  reportType: z.enum([
    "policy",
    "client",
    "premium",
    "custom",
    "export",
    "premiumWorkbook",
  ]),
  data: z.unknown(),
  options: z
    .object({
      includeFormulas: z.boolean().optional(),
      formatCurrency: z.boolean().optional(),
      sheetName: z.string().optional(),
      title: z.string().optional(),
      includeTimestamp: z.boolean().optional(),
      premiumWorkbook: z
        .object({
          policyNumber: z.string().optional(),
          clientName: z.string().optional(),
          appVersion: z.string().optional(),
          includeAdjustment: z.boolean().optional(),
          generatedBy: z.string().optional(),
          existing: z.array(z.unknown()).optional(),
        })
        .optional(),
    })
    .optional(),
});

export const signedWorkerRequestSchema = z.object({
  payload: excelWorkerRequestSchema,
  signature: z.string(),
  timestamp: z.number(),
  serviceToken: z.string(),
});

// Derive TypeScript types from schemas
export type ExcelWorkerRequest = z.infer<typeof excelWorkerRequestSchema>;
export type SignedWorkerRequest = z.infer<typeof signedWorkerRequestSchema>;
```

#### 3.2 Update Worker Validation

```typescript
// Update Excel worker to use Zod validation
const validationResult = signedWorkerRequestSchema.safeParse(requestBody);
if (!validationResult.success) {
  return new Response(
    JSON.stringify({
      error: "Invalid request format",
      details: validationResult.error.errors,
    }),
    { status: 400 },
  );
}
```

### Phase 4: Monitoring & Observability (Week 4)

**Goal:** Add comprehensive monitoring for worker security

#### 4.1 Add Security Event Logging

```typescript
// Track authentication failures, validation errors, etc.
function logSecurityEvent(event: SecurityEvent) {
  console.warn(`[SECURITY] ${event.type}: ${event.message}`, {
    timestamp: new Date().toISOString(),
    ip: request.headers.get("CF-Connecting-IP"),
    endpoint: request.url,
    ...event.metadata,
  });
}
```

#### 4.2 Implement Rate Limiting

```typescript
// Add rate limiting per service token
const rateLimiter = new RateLimiter({
  tokensPerInterval: 100, // 100 requests per interval
  interval: "minute", // per minute
});

if (!(await rateLimiter.tryConsume(serviceToken, 1))) {
  return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
    status: 429,
  });
}
```

## Success Criteria

### Security Requirements

- ✅ All worker endpoints require service authentication
- ✅ All requests include cryptographically validated signatures
- ✅ All request payloads validated against Zod schemas
- ✅ All authentication failures logged and monitored
- ✅ Rate limiting implemented per service token

### Technical Requirements

- ✅ Zero breaking changes to existing public APIs
- ✅ All existing tests continue to pass
- ✅ No performance degradation in worker calls
- ✅ Comprehensive documentation of new security patterns
- ✅ TypeScript types derived from Zod schemas

### Monitoring Requirements

- ✅ Security events logged with structured format
- ✅ Authentication failure rate monitoring
- ✅ Request validation error rate monitoring
- ✅ Performance metrics for signed request handling

## Implementation Timeline

### Week 1: Authentication Foundation

- [ ] Add service token validation to Excel worker
- [ ] Create shared secret management
- [ ] Update worker client to include service tokens
- [ ] Add authentication rejection tests

### Week 2: Request Signing

- [ ] Implement HMAC signature generation
- [ ] Add signature validation to worker
- [ ] Implement timestamp-based replay protection
- [ ] Create signature verification tests

### Week 3: Schema Validation

- [ ] Create Zod schemas for all worker requests
- [ ] Update worker to validate against schemas
- [ ] Derive TypeScript types from schemas
- [ ] Add comprehensive validation tests

### Week 4: Monitoring & Polish

- [ ] Add security event logging
- [ ] Implement rate limiting per service token
- [ ] Add monitoring dashboards
- [ ] Create developer documentation
- [ ] Perform security audit & penetration testing

## Rollout Strategy

### Phase 1: Development Environment

- Implement all changes in development environment first
- Test with local worker instances
- Validate no breaking changes to existing APIs

### Phase 2: UAT environment

- Deploy to UAT with feature flags
- Perform integration testing
- Validate security patterns end-to-end
- Gather performance metrics

### Phase 3: Production Rollout

- Enable feature flags gradually
- Monitor for authentication failures
- Watch for performance impacts
- Gather production metrics

## Risk Mitigation

### Technical Risks

- **Risk**: Breaking existing API integrations
  - **Mitigation**: Feature flags, backward compatibility mode
- **Risk**: Performance degradation from request signing
  - **Mitigation**: Benchmark before/after, optimize critical paths
- **Risk**: Complex rollback if issues arise
  - **Mitigation**: Comprehensive testing, canary deployments

### Security Risks

- **Risk**: Shared secret compromise
  - **Mitigation**: Regular secret rotation, key management service
- **Risk**: Implementation bugs bypassing security
  - **Mitigation**: Comprehensive testing, security code review
- **Risk**: DDoS attacks on authentication endpoints
  - **Mitigation**: Rate limiting, circuit breakers, monitoring

## Verification Checklist

### Pre-Deployment Verification

- [ ] All existing unit tests pass
- [ ] Integration tests for authenticated worker calls pass
- [ ] Performance benchmarks show no degradation
- [ ] Security tests validate all protection mechanisms
- [ ] Documentation updated with new patterns

### Post-Deployment Verification

- [ ] Production monitoring shows no authentication failures
- [ ] Rate limiting effectively prevents abuse
- [ ] Security event logs capture expected events
- [ ] No performance degradation in production
- [ ] All worker endpoints properly secured

## Conclusion

This implementation plan addresses the critical security gaps identified in the code review while maintaining backward compatibility and performance. The phased approach allows for methodical implementation with comprehensive testing at each stage.

**Priority**: **HIGH** - These security issues must be resolved before production deployment.

**Timeline**: 4 weeks with weekly milestones and verification checkpoints.

**Success**: Production deployment with all worker endpoints properly secured and all validation requirements met.

# Worker Network Security Plan - Option A (Fully Private)

**Date:** August 14, 2026  
**Status:** Approved for Implementation  
**Architecture:** Option A - Fully Private Network  
**Priority:** HIGH - Security critical

## Executive Summary

This plan implements **Option A (Fully Private Network)** for all worker communication within the Irecon Insurance application. All worker services will be locked within the internal network and not exposed to public internet access.

## Architecture Decision

### **Chosen Option: Fully Private Network (Option A)**

```
Internet → [Public Facing] Cloudflare Worker (Main App)
                    ↓
            [Service Binding] (Internal Only)
                    ↓
        [Private Network] Cloudflare Workers
          ↙               ↘
Excel Worker          Document Worker
    (Internal)          (Internal)
```

### **Key Characteristics:**

1. **No Public Endpoints** for worker services
2. **Internal Communication Only** via Service Bindings
3. **Zero Public Attack Surface** for backend services
4. **Service-to-Service Authentication** still required for defense-in-depth

## Implementation Goals

### **Primary Goals**

- ✅ Remove all public routes from worker services
- ✅ Force all communication through Service Bindings
- ✅ Maintain existing functionality via internal communication only
- ✅ Zero breaking changes to public APIs

### **Security Goals**

- ✅ Eliminate public exposure of sensitive processing services
- ✅ Implement defense-in-depth with service authentication
- ✅ Add request signing for internal communication
- ✅ Comprehensive monitoring of service-to-service calls

## Technical Implementation

### **Phase 1: Worker Configuration Updates (Week 1)**

#### **1.1 Remove Public Routes**

Current worker configurations will be updated to have:

- **No `routes`** configuration in worker wrangler files
- **Only Service Bindings** for internal access

```jsonc
// wrangler.excel.jsonc - AFTER
{
  "name": "insurance-excel-worker-uat",
  // NO routes defined - internal only
  "main": "./workers/excel/index.ts",
  "observability": {/* ... */},
}
```

#### **1.2 Verify Service Bindings**

Main application worker (`wrangler.jsonc`) already has:

```jsonc
"services": [
  {
    "binding": "DOCUMENT_SERVICE",
    "service": "insurance-document-worker-uat",
  },
],
```

**Add Excel Worker Binding:**

```jsonc
"services": [
  {
    "binding": "EXCEL_SERVICE",
    "service": "insurance-excel-worker-uat",
  },
  {
    "binding": "DOCUMENT_SERVICE",
    "service": "insurance-document-worker-uat",
  },
]
```

### **Phase 2: Authentication Middleware (Week 2)**

Even though communication is internal, we implement authentication for defense-in-depth:

#### **2.1 Shared Secret Management**

```env
# .env.local
WORKER_SHARED_SECRET=your-secure-random-secret
SERVICE_TOKEN_TTL=300000  # 5 minutes
```

#### **2.2 Service Token Validation**

```typescript
// workers/shared/security/auth.ts
export async function validateServiceToken(
  request: Request,
  env: Env,
): Promise<boolean> {
  const token = request.headers.get("X-Service-Token");
  if (!token) return false;

  // Simple shared secret validation for internal services
  return token === env.WORKER_SHARED_SECRET;
}
```

#### **2.3 Apply to All Workers**

```typescript
// workers/excel/handler/middleware.ts
import { validateServiceToken } from "../../shared/security/auth";

export async function authenticateRequest(
  request: Request,
  env: Env,
): Promise<Response | null> {
  const isValid = await validateServiceToken(request, env);
  if (!isValid) {
    return new Response(JSON.stringify({ error: "Unauthorized service" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}
```

### **Phase 3: Request Signing & Validation (Week 3)**

Implement HMAC signing for additional security:

#### **3.1 Signing Implementation**

```typescript
// workers/shared/security/signing.ts
export async function createSignedRequest(
  payload: unknown,
  serviceName: string,
): Promise<SignedRequest> {
  const timestamp = Date.now();
  const dataToSign = `${JSON.stringify(payload)}${timestamp}${serviceName}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(env.WORKER_SHARED_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(dataToSign),
  );

  return {
    payload,
    signature: Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(""),
    timestamp,
    serviceToken: env.WORKER_SHARED_SECRET,
    serviceName,
  };
}
```

#### **3.2 Validation Implementation**

```typescript
export async function validateSignedRequest(
  signedRequest: SignedRequest,
  env: Env,
): Promise<boolean> {
  // Check timestamp freshness (5 minute window)
  if (Date.now() - signedRequest.timestamp > 5 * 60 * 1000) {
    return false;
  }

  // Reconstruct and verify signature
  const dataToVerify = `${JSON.stringify(signedRequest.payload)}${signedRequest.timestamp}${signedRequest.serviceName}`;
  const expectedSignature = await createSignature(
    dataToVerify,
    env.WORKER_SHARED_SECRET,
  );

  return signedRequest.signature === expectedSignature;
}
```

### **Phase 4: Monitoring & Observability (Week 4)**

#### **4.1 Security Event Logging**

```typescript
// workers/shared/logging/security.ts
export function logSecurityEvent(event: SecurityEvent) {
  console.warn(`[SECURITY] ${event.type}: ${event.message}`, {
    timestamp: new Date().toISOString(),
    service: event.serviceName,
    endpoint: event.endpoint,
    ip: event.request.headers.get("CF-Connecting-IP"),
    ...event.metadata,
  });
}
```

#### **4.2 Service Communication Metrics**

```typescript
// Track service-to-service call patterns
export function trackServiceCall(
  fromService: string,
  toService: string,
  duration: number,
  success: boolean,
) {
  // Log to structured logging system
  // Send to metrics system
}
```

## Worker Configuration Files

### **Main Application Worker (`wrangler.jsonc`)**

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "insurance-app-uat",
  "compatibility_date": "2026-07-20",
  "compatibility_flags": ["nodejs_compat"],
  "main": "./workers/app.ts",

  // Service Bindings - Internal Only
  "services": [
    {
      "binding": "EXCEL_SERVICE",
      "service": "insurance-excel-worker-uat",
    },
    {
      "binding": "DOCUMENT_SERVICE",
      "service": "insurance-document-worker-uat",
    },
  ],

  // Observability configuration
  "observability": {
    "enabled": true,
    "logs": {
      "enabled": true,
      "head_sampling_rate": 1,
      "destinations": ["sentry-logs-irecon-insurance-app"],
    },
    "traces": {
      "enabled": true,
      "head_sampling_rate": 1,
      "destinations": ["sentry-traces-irecon-insurance-app"],
    },
  },

  // Environment variables
  "vars": {
    "SUPABASE_URL": "https://tjnsygunohylofihoksl.supabase.co",
    "SESSION_INACTIVITY_TIMEOUT_MINUTES": "30",
    "SESSION_ABSOLUTE_TIMEOUT_HOURS": "12",
    "WORKER_SHARED_SECRET": "{{ secrets.WORKER_SHARED_SECRET }}",
  },

  // Bindings continue...
}
```

### **Excel Worker (`wrangler.excel.jsonc`) - INTERNAL ONLY**

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "insurance-excel-worker-uat",
  "compatibility_date": "2026-08-08",
  "compatibility_flags": ["nodejs_compat"],
  "main": "./workers/excel/index.ts",

  // NO ROUTES - Internal only via Service Binding
  // No "routes" configuration present

  "observability": {
    "enabled": true,
    "logs": { "enabled": true, "head_sampling_rate": 1 },
    "traces": { "enabled": true, "head_sampling_rate": 1 },
  },

  "vars": {
    "EXCEL_WORKER_VERSION": "1.0.0",
    "WORKER_SHARED_SECRET": "{{ secrets.WORKER_SHARED_SECRET }}",
  },

  "placement": { "mode": "smart" },
  "upload_source_maps": true,
}
```

### **PDF Worker (`wrangler.pdf.jsonc`) - INTERNAL ONLY**

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "insurance-document-worker-uat",
  "compatibility_date": "2026-08-08",
  "compatibility_flags": ["nodejs_compat"],
  "main": "./workers/documents/index.ts",

  // NO ROUTES - Internal only via Service Binding
  // No "routes" configuration present

  "observability": {
    "enabled": true,
    "logs": { "enabled": true, "head_sampling_rate": 1 },
    "traces": { "enabled": true, "head_sampling_rate": 1 },
  },

  "vars": {
    "WORKER_SHARED_SECRET": "{{ secrets.WORKER_SHARED_SECRET }}",
  },
}
```

## Code Changes Required

### **1. Remove Public Endpoints**

**Current excel worker:**

```typescript
// Remove any direct public endpoint handling
// Current: Handles requests from anyone
// Future: Only accepts requests via Service Binding
```

**Update main app to use Service Bindings:**

```typescript
// app/lib/services/excel-worker-wrapper.server.ts
export async function generateExcelReport(data: ExcelReportData) {
  // Use Service Binding instead of public URL
  const response = await env.EXCEL_SERVICE.fetch(
    new Request("https://excel-worker.internal/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Token": env.WORKER_SHARED_SECRET,
      },
      body: JSON.stringify(await createSignedRequest(data, "excel")),
    }),
  );

  return response;
}
```

### **2. Update Worker Client Libraries**

Create shared client for service-to-service communication:

```typescript
// workers/shared/client/base-client.ts
export class ServiceClient {
  constructor(
    private serviceBinding: ServiceBinding,
    private serviceName: string,
    private sharedSecret: string,
  ) {}

  async post<T>(path: string, data: unknown): Promise<T> {
    const signedRequest = await createSignedRequest(data, this.serviceName);

    const response = await this.serviceBinding.fetch(
      new Request(`https://internal${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Service-Token": this.sharedSecret,
        },
        body: JSON.stringify(signedRequest),
      }),
    );

    if (!response.ok) {
      throw new Error(`Service ${this.serviceName} error: ${response.status}`);
    }

    return response.json();
  }
}
```

## Testing Strategy

### **Integration Testing**

```typescript
// tests/integration/worker-communication.test.ts
describe("Service-to-Service Communication", () => {
  test("Excel worker accessible via service binding", async () => {
    const client = new ServiceClient(
      env.EXCEL_SERVICE,
      "excel",
      env.WORKER_SHARED_SECRET,
    );

    const result = await client.post("/api/generate", testData);
    expect(result).toHaveProperty("success", true);
  });

  test("Public access to worker endpoint fails", async () => {
    // Attempt to access worker via public URL (should not exist)
    const response = await fetch(
      "https://excel-worker.example.com/api/generate",
    );
    expect(response.status).toBe(404); // No public route
  });
});
```

### **Security Testing**

```typescript
describe("Worker Security", () => {
  test("Service token validation", async () => {
    // Without token
    const response1 = await env.EXCEL_SERVICE.fetch(
      new Request("https://internal/api/generate", { method: "POST" }),
    );
    expect(response1.status).toBe(401);

    // With invalid token
    const response2 = await env.EXCEL_SERVICE.fetch(
      new Request("https://internal/api/generate", {
        method: "POST",
        headers: { "X-Service-Token": "invalid-token" },
      }),
    );
    expect(response2.status).toBe(401);
  });
});
```

## Deployment Plan

### **Phase 1: Development Environment**

1. Update local worker configurations
2. Test Service Bindings locally with `wrangler dev`
3. Validate authentication middleware
4. Run integration tests

### **Phase 2: UAT environment**

1. Deploy updated worker configurations
2. Enable Service Bindings without routes
3. Monitor for any functionality breaks
4. Gather performance metrics

### **Phase 3: Production Rollout**

1. Deploy main app with new Service Bindings
2. Deploy workers without public routes
3. Enable authentication middleware
4. Monitor security events

## Rollback Plan

### **If Issues Arise:**

1. **Immediate**: Re-add public routes to worker configurations
2. **Fallback**: Disable authentication middleware via feature flag
3. **Contingency**: Use previous worker URLs while debugging

### **Rollback Steps:**

```bash
# 1. Revert wrangler configuration changes
git checkout wrangler.excel.jsonc wrangler.pdf.jsonc wrangler.jsonc

# 2. Redeploy with previous configuration
wrangler deploy --config wrangler.jsonc
wrangler deploy --config wrangler.excel.jsonc
```

## Success Criteria

### **Security Criteria**

- [ ] No public endpoints for Excel/Document workers
- [ ] All service-to-service calls authenticated
- [ ] Request signing implemented for internal calls
- [ ] Security event logging operational
- [ ] Rate limiting per service token implemented

### **Functional Criteria**

- [ ] All existing functionality preserved
- [ ] No performance degradation in worker calls
- [ ] Zero breaking changes to public APIs
- [ ] All existing tests pass
- [ ] Integration tests for service communication

### **Operational Criteria**

- [ ] Monitoring dashboards for service calls
- [ ] Alerting on authentication failures
- [ ] Documentation updated for new patterns
- [ ] Team trained on Service Binding usage

## Risk Matrix

| Risk                                    | Impact | Probability | Mitigation                        |
| --------------------------------------- | ------ | ----------- | --------------------------------- |
| Service Binding connectivity issues     | High   | Medium      | Comprehensive integration testing |
| Authentication breaking existing flows  | High   | Low         | Feature flags, gradual rollout    |
| Performance impact from request signing | Medium | Low         | Benchmark before/after, optimize  |
| Monitoring gaps for internal calls      | Medium | Medium      | Enhanced logging, alert rules     |
| Complexity increase for developers      | Low    | High        | Clear documentation, examples     |

## Next Steps

### **Immediate (Week 1-2)**

1. Update worker configurations to remove public routes
2. Add Excel Service Binding to main app
3. Implement shared secret management
4. Add authentication middleware skeleton

### **Short-term (Week 3-4)**

1. Implement request signing for internal calls
2. Add comprehensive logging
3. Create integration test suite
4. Update developer documentation

### **Long-term (Week 5+)**

1. Implement advanced rate limiting
2. Add circuit breaker patterns
3. Enhance monitoring and alerting
4. Regular security audits

## References

- [Cloudflare Service Bindings Documentation](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)
- [Worker Security Best Practices](https://developers.cloudflare.com/workers/security/)
- [HMAC Implementation Guide](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [WORKER_SECURITY_IMPLEMENTATION_PLAN.md](WORKER_SECURITY_IMPLEMENTATION_PLAN.md)
- [WORKER_ORGANIZATION_PATTERN.md](WORKER_ORGANIZATION_PATTERN.md)

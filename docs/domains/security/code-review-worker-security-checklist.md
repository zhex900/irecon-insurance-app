# Code Review Checklist - Worker Security (Option A)

**Date:** August 14, 2026  
**Status:** Active Checklist for All Worker Changes  
**Related:** [WORKER_NETWORK_SECURITY_PLAN.md](WORKER_NETWORK_SECURITY_PLAN.md) | [WORKER_SECURITY_IMPLEMENTATION_PLAN.md](WORKER_SECURITY_IMPLEMENTATION_PLAN.md)

## Overview

This checklist MUST be completed for any changes to worker services (Excel, Documents, or any new workers). It ensures compliance with Option A (Fully Private Network) security standards.

## Pre-Review Questions

Before starting code review, answer these questions:

1. **Does this change involve worker services?** (Excel, Documents, PDF generation, etc.)
2. **Does this change service-to-service communication patterns?**
3. **Does this add new dependencies to worker code?**
4. **Does this change authentication or authorization flows?**

If **YES** to any question, this checklist applies.

## ✅ Configuration Checklist

### **1. Worker Configuration Files**

#### **Main Worker (`wrangler.jsonc`)**

- [ ] Service Bindings defined for all internal workers
- [ ] No hardcoded secrets in configuration
- [ ] Observability enabled (logs, traces)
- [ ] Source maps uploaded for debugging
- [ ] Environment variables use `{{ secrets.* }}` syntax

#### **Service Workers (Excel/Documents)**

- [ ] **NO `routes` configuration present** (Internal only)
- [ ] Service name follows pattern: `insurance-{domain}-worker-{env}`
- [ ] Observability enabled
- [ ] No public URLs referenced
- [ ] Do not declare unused `WORKER_SHARED_SECRET` / `EXCEL_WORKER_SHARED_SECRET` vars (service bindings are the trust boundary; do not imply HTTP token auth that is not implemented)

### **2. Environment Configuration**

- [ ] `.env.local` and `workers/*-local.env` never committed to version control
- [ ] Local worker env files have a committed `.example` without real secrets
- [ ] Development vs production secrets separated

## ✅ Security Implementation Checklist

### **3. Authentication & Authorization**

- [ ] Excel/PDF workers are RPC-only (`WorkerEntrypoint`); `fetch` returns 404
- [ ] Callers use service bindings, not public HTTP + `X-Service-Token`
- [ ] Do not add unused shared-secret vars that are never checked

### **4. Request Signing & Validation**

- [ ] All service-to-service requests include:
  - [ ] HMAC signature
  - [ ] Timestamp (prevent replay attacks)
  - [ ] Service identification
- [ ] Signature validation checks:
  - [ ] Timestamp freshness (< 5 minutes)
  - [ ] Signature matches recalculated hash
  - [ ] Service token valid
- [ ] Failed validation returns 400 Bad Request with details

### **5. Input Validation**

- [ ] Zod schemas define all request/response types
- [ ] Schemas are single source of truth (types derived from schemas)
- [ ] Validation happens at entry points (before business logic)
- [ ] Invalid input returns 400 with structured error details
- [ ] No raw `any` or `unknown` types bypassing validation

### **6. Rate Limiting & Protection**

- [ ] Rate limiting per service token implemented
- [ ] Circuit breakers for dependent service failures
- [ ] Request timeouts configured (default: 30 seconds)
- [ ] Request size limits enforced
- [ ] Concurrent request limits per service

## ✅ Code Quality Checklist

### **7. Worker Organization**

- [ ] Follows [WORKER_ORGANIZATION_PATTERN.md](WORKER_ORGANIZATION_PATTERN.md)
- [ ] Clear separation: handler/services/utils/types
- [ ] Single entry point (`index.ts`) for each worker
- [ ] Centralized exports in each directory
- [ ] No circular dependencies between modules

### **8. Error Handling**

- [ ] Structured error responses (not plain text)
- [ ] No stack traces exposed in production
- [ ] Graceful degradation when dependent services fail
- [ ] Retry logic with exponential backoff
- [ ] All errors logged with context

### **9. Logging & Monitoring**

- [ ] Structured logging (JSON format)
- [ ] Security events logged separately
- [ ] Performance metrics for service calls
- [ ] Request/response correlation IDs
- [ ] No sensitive data in logs (PII, secrets)

### **10. Type Safety**

- [ ] TypeScript strict mode enabled
- [ ] No explicit `any` types
- [ ] Zod schemas for runtime validation
- [ ] Environment types properly defined
- [ ] Return types explicit for all public functions

## ✅ Testing Checklist

### **11. Unit Tests**

- [ ] Authentication middleware tests
- [ ] Request signing/validation tests
- [ ] Zod schema validation tests
- [ ] Error case handling tests
- [ ] Mock service binding tests

### **12. Integration Tests**

- [ ] Service-to-service communication tests
- [ ] Authentication failure tests
- [ ] Rate limiting tests
- [ ] End-to-end workflow tests
- [ ] Load/performance tests

### **13. Security Tests**

- [ ] Replay attack prevention tests
- [ ] Token validation brute force tests
- [ ] Invalid signature handling tests
- [ ] Request size limit tests
- [ ] Dependency failure tests

## ✅ Performance & Operations Checklist

### **14. Bundle Size**

- [ ] Worker bundle < Cloudflare limits (Error 1102 prevention)
- [ ] No heavy libraries imported statically in routes
- [ ] Dynamic imports for expensive dependencies
- [ ] Tree-shaking verified
- [ ] No unnecessary polyfills

### **15. Resource Usage**

- [ ] Memory usage monitored
- [ ] CPU time within limits (paid plan) or optimized (free plan)
- [ ] No memory leaks in long-running operations
- [ ] File descriptors properly closed
- [ ] Connection pooling for databases

### **16. Deployment Safety**

- [ ] Zero-downtime deployment possible
- [ ] Backward compatibility maintained
- [ ] Feature flags for risky changes
- [ ] Rollback procedures documented
- [ ] Health checks implemented

## ✅ Documentation Checklist

### **17. Code Documentation**

- [ ] JSDoc comments for public APIs
- [ ] Architecture decisions documented
- [ ] Security considerations noted
- [ ] Performance characteristics documented
- [ ] Error scenarios documented

### **18. Developer Documentation**

- [ ] Updated [WORKER_NETWORK_SECURITY_PLAN.md](WORKER_NETWORK_SECURITY_PLAN.md)
- [ ] Updated [WORKER_ORGANIZATION_PATTERN.md](WORKER_ORGANIZATION_PATTERN.md)
- [ ] Service Binding usage examples
- [ ] Local development setup instructions
- [ ] Troubleshooting guide

## ✅ Special Cases & Exceptions

### **For Emergency Changes**

If change must bypass normal review process:

- [ ] Security team notified
- [ ] Temporary exception documented
- [ ] Full review scheduled within 24 hours
- [ ] Monitoring alerts enabled for affected services
- [ ] Rollback plan tested

### **For New Worker Services**

When adding a new worker service:

- [ ] Added to this checklist review process
- [ ] Security architecture reviewed before implementation
- [ ] Added to main app Service Bindings
- [ ] Added to monitoring dashboards
- [ ] Added to disaster recovery plan

## Review Process

### **Step 1: Self-Review**

Developer completes checklist before requesting review.

### **Step 2: Peer Review**

Another team member reviews using this checklist.

### **Step 3: Security Review**

Security team reviews all worker changes (mandatory).

### **Step 4: Approval & Merge**

All checkboxes completed → Approve and merge.

## Failure Scenarios

If checklist items are missing:

| Missing Item     | Action                                     |
| ---------------- | ------------------------------------------ |
| Authentication   | **BLOCK** - Cannot proceed without auth    |
| Request Signing  | **BLOCK** - Security violation             |
| Input Validation | **BLOCK** - Security violation             |
| Rate Limiting    | **WARNING** - Can proceed with monitoring  |
| Documentation    | **WARNING** - Must be completed post-merge |

## Post-Merge Verification

After merge, verify:

1. **Deployment**: Services deploy successfully
2. **Functionality**: All existing tests pass
3. **Security**: No authentication failures in logs
4. **Performance**: No degradation in response times
5. **Monitoring**: Dashboards show expected patterns

## Common Issues to Watch For

### **Security Anti-Patterns**

- ❌ Hardcoded secrets in source code
- ❌ Public endpoints for internal services
- ❌ Missing authentication on internal calls
- ❌ Raw SQL queries without parameterization
- ❌ Lack of input validation

### **Performance Anti-Patterns**

- ❌ Large bundle sizes pushing Cloudflare limits
- ❌ N+1 queries in worker logic
- ❌ Synchronous blocking operations
- ❌ Memory leaks in long-running tasks
- ❌ No connection pooling

### **Operational Anti-Patterns**

- ❌ Lack of health checks
- ❌ No circuit breakers
- ❌ Missing retry logic
- ❌ Poor error messages
- ❌ No monitoring

## Template for PR Description

When creating a PR for worker changes, include:

```
## Worker Security Checklist

**This PR includes changes to worker services and MUST follow security checklist.**

### Changes Made:
1. [Brief description of changes]
2. [Impact on security configuration]
3. [New dependencies added]

### Checklist Completion:
- [ ] Configuration files updated
- [ ] Authentication implemented
- [ ] Request signing added
- [ ] Input validation complete
- [ ] Tests written and passing
- [ ] Documentation updated

### Security Considerations:
[Describe any security implications]

### Testing Performed:
[Describe security testing performed]

### Rollback Plan:
[Describe how to rollback if issues arise]
```

## Contact & Escalation

### **Primary Contacts:**

- Security Team: `#security` channel
- Infrastructure Team: `#infra` channel
- On-Call Engineer: Check rotation schedule

### **Emergency Contacts:**

- Security Incident Response: Follow [Security Incident Runbook](../runbooks/security-incident.md)
- Production Outage: Follow [Production Outage Runbook](../runbooks/production-outage.md)

---

**Last Updated:** August 14, 2026  
**Next Review:** September 14, 2026 (Monthly review required)  
**Approved By:** Security Architecture Team

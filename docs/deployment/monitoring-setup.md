# Internal Application Monitoring Setup

_Created: August 13, 2026_
_Plan: Internal App Refactor Plan_

## Overview

This monitoring setup focuses on **what matters for internal insurance broker applications**:

- Broker productivity (not public performance)
- Critical workflow completion times
- System reliability (Cloudflare Worker stability)
- Bundle size management (critical for deployments)

## What's Implemented

### 1. Bundle Size Validation (Critical for Cloudflare Workers)

**File:** `scripts/validate-bundle.js`
**Purpose:** Prevent Cloudflare Worker deployment failures (Error 1102)

**Usage:**

```bash
npm run check-bundle     # Generates bundle reports via wrangler
npm run validate:bundle  # Validates bundle sizes against Cloudflare limits
```

**What it checks:**

- Application Worker (`index.js`) ≤ 2.5MB (Cloudflare hard limit)
- Gzipped size ≤ 750KB (practical limit)
- Document Worker size validation if exists

**Integration:**

- Added to `package.json` scripts
- Runs before deployments (can be added to CI/CD)
- Provides actionable error messages with fixes

### 2. Critical Operation Performance Monitoring

**File:** `app/lib/performance/internal-monitoring.server.ts`
**Purpose:** Monitor only operations that genuinely affect broker productivity

**Key Features:**

- **Sentry Free Plan Compatible**: Uses error messages for performance alerts
- **Realistic Timeouts**: Based on actual broker workflow needs
- **Minimal Overhead**: Only logs genuinely problematic delays (> timeout)

**Operation Timeouts:**

```typescript
OPERATION_TIMEOUTS = {
  policyCreation: 3000, // 3 seconds
  premiumCalculation: 2000, // 2 seconds
  documentGeneration: 5000, // 5 seconds
  formSave: 1000, // 1 second
  policyLoad: 2000, // 2 seconds
  clientSearch: 1500, // 1.5 seconds
  clientCreation: 2000, // 2 seconds
};
```

### 3. Integration Points

**Already Monitored:**

1. **Premium Calculation** (`premium.service.ts`)
   - Critical for broker workflow
   - 2-second timeout threshold

2. **Policy Submission** (`orchestration.service.ts`)
   - Complex workflow with premium calc + validation + save
   - Monitored as single operation

3. **Client Creation** (`clients/service.ts`)
   - Common broker operation
   - 2-second timeout

**Usage Pattern:**

```typescript
import { monitorCriticalOperation } from "~/lib/performance/internal-monitoring.server";

export async function yourCriticalFunction() {
  return monitorCriticalOperation("operationName", async () => {
    // Your implementation
    return result;
  });
}
```

**Or using monitorFunction helper:**

```typescript
import { monitorFunction } from "~/lib/performance/internal-monitoring.server";

const monitoredFunction = monitorFunction("operationName", originalFunction);
```

### 4. What Gets Logged

**To Sentry (as error messages):**

- Operations exceeding timeout thresholds
- Workflow failures
- Critical performance issues

**Thresholds:**

- > timeout: Warning level
- > timeout × 2: Error level

**Example Sentry Message:**

```
SLOW_OPERATION: premiumCalculation took 3500ms (threshold: 2000ms)
```

**Extra Data:**

- Operation name
- Actual duration
- Timeout threshold
- Overrun amount
- Timestamp
- Environment

## Configuration

### Bundle Validation

**Script:** `scripts/validate-bundle.js`
**Limits:**

- `MAX_BUNDLE_SIZE`: 2,500,000 bytes (2.5MB)
- `MAX_GZIP_SIZE`: 750,000 bytes (750KB)

**To adjust limits:**

```javascript
// In scripts/validate-bundle.js
const MAX_BUNDLE_SIZE = 3_000_000; // Increase if needed
const MAX_GZIP_SIZE = 1_000_000; // Increase if needed
```

### Operation Timeouts

**File:** `app/lib/performance/internal-monitoring.server.ts`

**To adjust timeouts:**

```typescript
const OPERATION_TIMEOUTS = {
  // Adjust based on broker feedback
  policyCreation: 5000, // Increase to 5 seconds
  // Add new operation types
  reportExport: 4000,
};
```

**To add new operation monitoring:**

1. Add timeout to `OPERATION_TIMEOUTS`
2. Wrap function with `monitorCriticalOperation()`
3. Test with realistic data

## Testing the Setup

### 1. Test Bundle Validation

```bash
# First, generate bundle reports
npm run check-bundle

# Then validate
npm run validate:bundle
```

### 2. Test Monitoring Integration

```typescript
// Add to any route loader/action
import { monitorCriticalOperation } from "~/lib/performance/internal-monitoring.server";

export async function loader() {
  return monitorCriticalOperation("dataLoad", async () => {
    // Your loader logic
    return json({ data: "test" });
  });
}
```

### 3. Force Test Slow Operations

```typescript
// For testing, you can simulate slow operations
export async function testSlowOperation() {
  return monitorCriticalOperation("testOperation", async () => {
    await new Promise((resolve) => setTimeout(resolve, 6000)); // 6 seconds
    return "done";
  });
}
```

## Sentry Dashboard Setup

### 1. Alert Configuration

Create alerts for:

- `SLOW_OPERATION:*` messages (warning level)
- `CRITICAL_SLOW_OPERATION:*` messages (error level)
- `WORKFLOW_FAILED:*` messages (error level)

### 2. Query Examples

```
message:"SLOW_OPERATION:"
level:warning

message:"SLOW_OPERATION:premiumCalculation"
environment:production

message:"WORKFLOW_FAILED:"
```

### 3. Alert Destinations

- Email to engineering team
- Slack channel for critical alerts
- PagerDuty for production incidents

## Best Practices

### 1. What to Monitor

**DO Monitor:**

- Policy creation workflow
- Premium calculation
- Document generation
- Data exports/reports
- Authentication flows
- Form submissions with validation

**DON'T Monitor:**

- Static asset serving
- Health check endpoints
- Public documentation pages
- Page navigation (already handled by browser)

### 2. Timeout Guidelines

- **Critical workflows**: 3-5 seconds max
- **Common operations**: 1-2 seconds max
- **Background tasks**: 5-10 seconds (with progress indication)
- **Data exports**: 5+ seconds (warn user)

### 3. Performance Baseline

Establish baseline performance:

- Run `npm run validate:bundle` weekly
- Review slow operations weekly in Sentry
- Adjust timeouts based on broker feedback
- Track trend of operation durations

### 4. Incident Response

**When alert triggers:**

1. Check Sentry for operation details
2. Check Cloudflare Analytics for Worker metrics
3. Check database query performance
4. Check bundle size history

**Common fixes:**

- Optimize database queries
- Cache expensive calculations
- Split large bundles
- Add pagination for large data

## Next Steps

### Phase 1 (Complete)

- [x] Bundle validation script
- [x] Critical operation monitoring utility
- [x] Integration with premium calculation
- [x] Integration with policy submission
- [x] Integration with client creation

### Phase 2 (Recommended)

- [ ] Add monitoring to document generation
- [ ] Add monitoring to report exports
- [ ] Add monitoring to search operations
- [ ] Create performance dashboard
- [ ] Add CI/CD integration for bundle validation

### Phase 3 (Optional)

- [ ] User workflow timing (start to completion)
- [ ] Custom performance metrics dashboard
- [ ] Automated performance regression detection
- [ ] Historical performance trending

## Maintenance

### Weekly Tasks

1. Review Sentry slow operation alerts
2. Run bundle validation
3. Check Cloudflare Worker metrics
4. Review operation timeout effectiveness

### Monthly Tasks

1. Adjust timeouts based on broker feedback
2. Review monitoring coverage
3. Update documentation
4. Clean up old alerts/rules

### Quarterly Tasks

1. Performance review with brokers
2. Monitoring effectiveness assessment
3. Tooling review (Sentry, Cloudflare, etc.)
4. Documentation update

## Troubleshooting

### Bundle Validation Failing

**Error:** `Bundle exceeds Cloudflare limit`
**Solution:**

1. Check for new dependencies
2. Review static imports in routes
3. Use dynamic imports for heavy libraries
4. Split helper modules
5. Review `docs/performance.md`

### Monitoring Not Logging

**Issue:** No Sentry messages for slow operations
**Solution:**

1. Check Sentry DSN configuration
2. Verify operation exceeds timeout
3. Check Sentry rate limits (free plan)
4. Verify import paths

### False Positives

**Issue:** Legitimate operations triggering alerts
**Solution:**

1. Increase timeout for that operation
2. Add contextual filtering
3. Review operation complexity
4. Consider caching or optimization

## Support

**Primary Contact:** Engineering Team
**Documentation:** `docs/performance.md`
**Alert Channel:** #engineering-alerts
**On-call Rotation:** Engineering team roster

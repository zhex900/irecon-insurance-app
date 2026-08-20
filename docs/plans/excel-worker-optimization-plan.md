# Excel-Only HTTP Worker Optimization Plan

_Created: August 13, 2026_
_Target: Reduce Main Worker from 2.22MB to <2MB with minimal risk_
_Timeline: 2 weeks | Resources: 1 engineer_

## Executive Summary

**Problem:** Main Worker at 2.22MB (93% of 2.5MB Cloudflare limit) risks Error 1102 failures.
**Solution:** Move ExcelJS (≈4MB bundle contributor) to a simple HTTP Worker service.
**Approach:** Minimal viable solution with lowest business impact.

---

## Current State Analysis

### **Bundle Size Critical Metrics**

- **Main Worker:** 2.22MB (93% of 2.5MB limit) - **CRITICAL**
- **Browser Bundle:** 10.74MB PDF worker - Large but not critical for Worker
- **ExcelJS Contribution:** Estimated 0.8-1.2MB of Main Worker bundle

### **Excel Usage in Current Codebase**

1. **Report Generation** (`report-excel.server.ts`)
   - Policy reports
   - Client lists
   - Financial summaries

2. **Premium Calculation Excel** (multiple files)
   - Premium workings sheets
   - Rate adjustment sheets
   - Policy data exports

3. **Data Export Functions**
   - CSV/Excel data dumps
   - Historical data exports

---

## Simplified Architecture Proposal

### **Current Architecture (Problematic):**

```
┌─────────────────────────────────────────────┐
│         Main Worker (2.22MB)               │
├─────────────────────────────────────────────┤
│ • Authentication & Routing                 │
│ • Policy/Client Management                 │
│ • Premium Calculation                      │
│ • Excel Report Generation ← PROBLEM       │
│   (ExcelJS bloats bundle)                  │
└─────────────────────────────────────────────┘
```

### **Proposed Architecture (Solved):**

```
┌─────────────────────────────────────────────┐
│         Main Worker (Target: <2MB)         │
├─────────────────────────────────────────────┤
│ • Authentication & Routing                 │
│ • Policy/Client Management                 │
│ • Premium Calculation                      │
│ • Excel API Orchestration                  │
│   (HTTP calls to Excel Worker)             │
└───────────────┬─────────────────────────────┘
                │ Simple HTTP Request
                ▼
┌─────────────────────────────────────────────┐
│       Excel-only HTTP Worker                │
├─────────────────────────────────────────────┤
│ • ExcelJS Library                           │
│ • Excel Report Generation                   │
│ • Basic Error Handling                      │
│ • Minimal Business Logic                    │
└─────────────────────────────────────────────┘
```

## Why This Approach Wins

### **Minimal Business Risk**

- Broker workflow unchanged (API interface identical)
- No feature regression risk
- Simple HTTP pattern (no complex Worker bindings)

### **Fastest Implementation**

- 2 weeks vs 6 weeks for Analytics Worker
- 1 engineer vs 2+ engineers
- Immediate bundle relief

### **Clean Technology Separation**

- Excel logic isolated in dedicated service
- Main Worker cleans up bundle
- Future-proof for additional Excel features

### **Deployment Simplicity**

- Independent deployment (no coordination)
- Simple HTTP service (standard pattern)
- Easy testing/validation

---

## Implementation Plan (2 Weeks)

### **Week 1: Excel Worker Proof of Concept**

**Day 1-2: Create Excel Worker Skeleton**

```bash
# Create new Worker directory
mkdir -p workers/excel

# Create wrangler.excel.jsonc configuration
echo '{
  "$schema": "../node_modules/wrangler/config-schema.json",
  "name": "insurance-excel-worker-uat",
  "compatibility_date": "2026-08-13",
  "main": "./workers/excel/index.ts"
}' > wrangler.excel.jsonc

# Create basic Worker with ExcelJS
# - Simple HTTP endpoints
# - No integration with main app yet
```

**Day 3-4: Test Excel Generation Accuracy**

```typescript
// Test with current production data
const testData = getProductionReportData();
const excelBuffer = await excelWorker.generateReport(testData);

// Validate:
// 1. File can be opened in Excel
// 2. Data matches expected format
// 3. Formulas calculate correctly
```

**Day 5: Performance Baseline**

```bash
# Measure Excel generation performance
# - Time per report type
# - Memory usage
# - Concurrent request handling

# Validate bundle size impact
npm run check:bundle:quick  # Should show ~1MB reduction
```

### **Week 2: Production Migration**

**Day 1-2: Update Main Worker Endpoints**

```typescript
// Before: Direct ExcelJS usage
import { buildReportExcelBuffer } from "~/lib/reports/report-excel.server";

// After: HTTP call to Excel Worker
export async function generateExcelReport(options) {
  const response = await fetch(`${EXCEL_WORKER_URL}/api/reports/excel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });

  if (!response.ok) throw new Error("Excel generation failed");
  return await response.arrayBuffer();
}
```

**Day 3-4: Comprehensive Testing**

1. **Unit Tests:** Verify Excel Worker API responses
2. **Integration Tests:** Main Worker → Excel Worker workflow
3. **Performance Tests:** Compare before/after timing
4. **Bundle Validation:** Confirm Main Worker <2MB

**Day 5: Deployment Preparation**

1. **Create migration checklist**
2. **Prepare rollback procedure**
3. **Notify stakeholders**
4. **Schedule deployment window**

---

## Technical Design Details

### **1. Excel Worker Configuration**

```jsonc
// wrangler.excel.jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "insurance-excel-worker-uat",
  "compatibility_date": "2026-08-13",
  "compatibility_flags": ["nodejs_compat"],
  "main": "./workers/excel/index.ts",
  "observability": {
    "enabled": true,
    "logs": { "enabled": true },
    "traces": { "enabled": true },
  },
  "vars": {
    "EXCEL_WORKER_VERSION": "1.0.0",
  },
}
```

### **2. Excel Worker API Design**

```typescript
// workers/excel/index.ts
interface ExcelWorkerRequest {
  reportType: "policy" | "client" | "premium" | "custom";
  data: any;
  options?: {
    includeFormulas?: boolean;
    formatCurrency?: boolean;
    sheetName?: string;
  };
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/reports/excel" && request.method === "POST") {
      return handleExcelReport(request);
    }

    return new Response("Not found", { status: 404 });
  },
};

async function handleExcelReport(request: Request): Promise<Response> {
  try {
    const { reportType, data, options } = await request.json();

    // Load ExcelJS dynamically to keep Worker small
    const ExcelJS = await import("exceljs");
    const workbook = await generateExcel(ExcelJS, reportType, data, options);

    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (error) {
    console.error("Excel generation failed:", error);
    return new Response(JSON.stringify({ error: "Excel generation failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
```

### **3. Main Worker Integration Points**

Identify all current Excel generation endpoints:

```typescript
// Files to update in Main Worker:
1. app/lib/reports/report-excel.server.ts
2. app/lib/pricing/premium-excel-workbook.ts (or create wrapper)
3. Any route handlers generating Excel reports
```

### **4. Error Handling Strategy**

```typescript
// Main Worker wrapper with fallback
export async function generateExcelWithFallback(options) {
  try {
    // Primary: Excel Worker
    return await callExcelWorker(options);
  } catch (error) {
    console.warn("Excel Worker failed, attempting fallback:", error);

    // Fallback: Direct ExcelJS (if Worker unavailable)
    // This ensures broker workflow continues during migration
    return generateExcelFallback(options);
  }
}
```

### **5. Monitoring & Observability**

```typescript
// Track Excel Worker performance
export async function monitorExcelGeneration(operation) {
  const startTime = Date.now();

  try {
    const result = await operation();
    const duration = Date.now() - startTime;

    // Send to Sentry/SaaS monitoring
    trackMetric("excel_worker_generation_time", duration);

    return result;
  } catch (error) {
    trackError("excel_worker_failure", error);
    throw error;
  }
}
```

---

## Success Metrics & Validation

### **Primary Metrics (Must Achieve)**

1. ✅ **Bundle Size:** Main Worker <2MB (80% utilization)
2. ✅ **Error 1102:** Zero occurrences post-migration
3. ✅ **Broker Workflow:** Zero regression in completion time

### **Performance Metrics**

```bash
# Before/After Comparison
- Excel generation latency: <2 seconds (same or better)
- Worker memory usage: No increase
- Concurrent requests: Handle at least 5 brokers simultaneously
```

### **Quality Metrics**

```bash
# Validation Tests
- All existing Excel reports generate correctly
- File format compatibility (Excel 2016+)
- Formula calculation accuracy
- Data integrity (no data loss/corruption)
```

---

## Risk Assessment & Mitigation

### **Technical Risks**

| Risk                    | Likelihood | Impact | Mitigation                       |
| ----------------------- | ---------- | ------ | -------------------------------- |
| Excel Worker downtime   | Low        | Medium | Fallback to direct ExcelJS       |
| Data corruption         | Low        | High   | Comprehensive data validation    |
| Performance degradation | Medium     | Medium | Performance monitoring + caching |
| Integration failures    | Medium     | High   | Feature flags + gradual rollout  |

### **Business Risks**

| Risk                       | Likelihood | Impact | Mitigation                   |
| -------------------------- | ---------- | ------ | ---------------------------- |
| Broker workflow disruption | Low        | High   | Feature flags, rollback plan |
| Report generation delays   | Medium     | Medium | Performance monitoring       |
| Data security concerns     | Low        | High   | Data validation + encryption |

---

## Rollback Procedure

### **If Issues Arise:**

```bash
# Step 1: Enable feature flag fallback
export EXCEL_WORKER_ENABLED=false

# Step 2: Revert Main Worker changes
git revert <excel-worker-migration-commit>

# Step 3: Deploy reverted version
npm run deploy:uat

# Step 4: Monitor broker workflows
# Confirm all Excel reports work with direct ExcelJS
```

### **Rollback Time Estimate:** <30 minutes

- **Detection:** 5 minutes (monitoring alerts)
- **Decision:** 5 minutes (engineer assessment)
- **Execution:** 10-15 minutes (deployment)
- **Verification:** 5 minutes (broker workflow test)

---

## Deployment Strategy

### **Phase 1: UAT validation (Day 1)**

```bash
# Deploy Excel Worker to UAT
wrangler deploy --config wrangler.excel.jsonc

# Test with UAT data
# Validate all report types
```

### **Phase 2: Canary Release (Day 2)**

```bash
# Enable Excel Worker for 10% of brokers
# Monitor performance & errors
# Collect feedback
```

### **Phase 3: Gradual Rollout (Day 3-4)**

```bash
# Increase to 50% of brokers
# Monitor for 24 hours
# Fix any issues discovered
```

### **Phase 4: Full Production (Day 5)**

```bash
# Enable for 100% of brokers
# Monitor for 1 week
# Declare success if stable
```

---

## Resource Requirements

### **Engineering Resources**

- **Primary Engineer:** 1 × 2 weeks (full-time)
- **Review/Tech Lead:** 2 × 2 hours (design review)
- **QA Engineer:** 1 × 1 day (testing validation)

### **Infrastructure Costs**

- **Excel Worker:** $0 (Cloudflare free tier)
- **Monitoring:** $0 (Sentry free tier)
- **Total Additional Cost:** $0

### **Timeline Summary**

| Phase          | Duration             | Key Deliverables                          |
| -------------- | -------------------- | ----------------------------------------- |
| Design & Setup | 3 days               | Excel Worker skeleton, API design         |
| Migration      | 3 days               | Updated endpoints, testing                |
| Testing        | 2 days               | Performance, integration, user acceptance |
| Deployment     | 2 days               | UAT → Canary → Production                 |
| **Total**      | **10 business days** | **Production-ready solution**             |

---

## Next Immediate Steps

### **Day 1 (Today):**

```bash
# 1. Create Excel Worker directory structure
mkdir -p workers/excel

# 2. Create wrangler.excel.jsonc configuration
# 3. Create basic Excel Worker with ExcelJS
# 4. Test basic Excel generation
```

### **Day 2 (Tomorrow):**

```bash
# 1. Identify all Excel generation endpoints in Main Worker
# 2. Create integration wrapper functions
# 3. Test end-to-end workflow
# 4. Measure bundle size impact
```

### **Day 3-4:**

```bash
# 1. Performance benchmarking
# 2. Error handling implementation
# 3. Monitoring setup
# 4. Begin testing plan
```

---

## Conclusion

**Current Risk:** High - Main Worker at 93% of Cloudflare limit
**Target State:** Safe - Main Worker at <80% with Excel isolation
**Strategic Choice:** Excel-only HTTP Worker for maximum risk/reward ratio

**Why This Plan Wins:**

1. **Minimal Business Impact:** Broker workflows unchanged
2. **Fastest Relief:** Solves Error 1102 risk in 2 weeks
3. **Simplest Architecture:** HTTP service pattern well-understood
4. **Lowest Cost:** $0 infrastructure, minimal engineering
5. **Foundation for Growth:** Pattern reusable for other heavy dependencies

**Key Insight:** ExcelJS is likely the single largest contributor to Worker bundle bloat. By isolating just Excel functionality into a simple HTTP Worker, we achieve 80% of the benefit with 20% of the effort compared to a full Analytics Worker split.

**Ready to Begin:** This plan is minimal, focused, and ready for immediate execution. The Excel Worker approach provides the fastest path to solving the immediate bundle crisis while maintaining broker productivity and system stability.

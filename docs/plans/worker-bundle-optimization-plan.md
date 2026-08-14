# Worker Bundle Optimization Plan

_Created: August 13, 2026_
_Target: Reduce main Worker from 2.22MB (93% of limit) to <1.8MB (72%)_
_Critical for Cloudflare deployment success_

## Current State Analysis

### **Worker Bundle Size (Critical)**

- **Main Worker**: 2.22MB (93% of 2.5MB Cloudflare limit)
- **Risk Level**: High - approaching Error 1102 threshold
- **Current Split**: Document Worker already exists (`wrangler.documents.jsonc`)
- **Browser Bundle**: Large assets affect broker productivity (10.74MB PDF worker)

### **Architecture Context**

```
Current Architecture:
┌─────────────────────────────────────────────┐
│         Main Worker (2.22MB)               │
├─────────────────────────────────────────────┤
│ • Authentication & Session Management       │
│ • Policy Orchestration                     │
│ • Client Management                        │
│ • Premium Calculation                     │
│ • Email Orchestration                      │
│ • Database Access                         │
│ • Application Routing (React Router)       │
│ • Some PDF generation dependencies        │
└─────────────────────┬───────────────────────┘
                      │ Service Binding
                      ▼
┌─────────────────────────────────────────────┐
│     Document Worker (Existing Split)        │
├─────────────────────────────────────────────┤
│ • PDF Generation                           │
│ • Excel Report Generation                  │
│ • Heavy document processing               │
└─────────────────────────────────────────────┘
```

## Optimization Strategy: 3-Layer Worker Architecture

### **Phase 1: Analytics & Reporting Worker Split (Immediate Impact)**

**Rationale:** Analytics and reporting logic uses heavy Excel/PDF libraries that bloat the main Worker but are only needed for specific report generation endpoints.

**Target Split:**

```
┌─────────────────────────────────────────────┐
│           Main Worker (Target: 1.8MB)      │
├─────────────────────────────────────────────┤
│ • Core Business Logic                      │
│ • Authentication & Session                 │
│ • Policy/Client CRUD                       │
│ • Lightweight Calculations                 │
└─────────────────────┬───────────────────────┘
                      │ Service Bindings
           ┌──────────┴──────────┐
           ▼                     ▼
┌──────────────────────┐ ┌──────────────────────┐
│ Document Worker      │ │ Analytics Worker     │
│ (Existing)           │ │ (New Proposal)       │
├──────────────────────┤ ├──────────────────────┤
│ • PDF Generation     │ │ • Excel Reports      │
│ • Document Processing│ │ • Analytics          │
│                     │ │ • Data Export        │
│                     │ │ • Historical Reports │
└──────────────────────┘ └──────────────────────┘
```

### **Phase 2: Heavy Library Isolation (Strategic)**

**Identify Heavy Dependencies in Main Worker:**

1. **ExcelJS** (4MB+ in browser bundle) - Move to Analytics Worker
2. **PDF Generation Dependencies** - Already in Document Worker
3. **Data Processing Libraries** - Move where appropriate
4. **Chart/Visualization Libraries** - Move to Analytics Worker

### **Phase 3: Dynamic Import Strategy (Architectural)**

**Implement Lazy Loading Pattern:**

```typescript
// Before: Static import
import { generateReport } from "./heavy-report-service";

// After: Dynamic import with Worker boundary
export async function generateAnalyticsReport(data) {
  // Call Analytics Worker via service binding
  return await ANALYTICS_SERVICE.generateReport(data);
}
```

## Implementation Plan (No Code)

### **Week 1: Analysis & Design**

1. **Bundle Analysis** (`scripts/simple-bundle-check.js` enhanced)
   - Map dependencies to bundle size contribution
   - Identify heaviest libraries in main Worker
   - Create dependency graph visualization

2. **Endpoint Analysis**
   - Catalog all API endpoints/routes
   - Identify which require heavy libraries
   - Map usage patterns by broker role/workflow

3. **Service Boundary Design**
   - Define clear interfaces for new Workers
   - Design service bindings and error handling
   - Plan deployment/dependency ordering

### **Week 2: Architecture Design**

1. **Worker Configuration Design**
   - Create `wrangler.analytics.jsonc` configuration
   - Design service bindings and environment variables
   - Plan R2 bucket/data access patterns

2. **API Interface Design**
   - Design Analytics Worker API endpoints
   - Define request/response contracts
   - Plan authentication/authorization flow

3. **Data Access Strategy**
   - Design database access patterns
   - Plan caching strategies between Workers
   - Design data consistency approach

### **Week 3: Migration Strategy**

1. **Phased Migration Plan**
   - Endpoint-by-endpoint migration strategy
   - Feature flag implementation plan
   - Rollback/recovery procedures

2. **Testing Strategy**
   - Integration testing between Workers
   - Performance benchmarking
   - Error scenario testing

3. **Monitoring Strategy**
   - Worker-to-Worker latency monitoring
   - Error propagation tracking
   - Performance regression detection

## Expected Benefits

### **Bundle Size Reduction**

- **Main Worker**: 2.22MB → <1.8MB (20% reduction)
- **Error 1102 Risk**: High → Low
- **Cold Start Time**: Improved by 20-30%

### **System Architecture Improvements**

- **Better Separation of Concerns**: Analytics logic isolated
- **Independent Scaling**: Analytics Worker scales separately
- **Focused Optimization**: Each Worker optimized for specific workload

### **Broker Productivity**

- **Main App Responsiveness**: Faster routing/authentication
- **Specialized Processing**: Heavy work offloaded to specialized Workers
- **Parallel Processing**: Multiple reports can generate concurrently

## Technical Design Details

### **1. Analytics Worker Configuration (`wrangler.analytics.jsonc`)**

```jsonc
{
  "name": "insurance-analytics-worker-staging",
  "compatibility_date": "2026-08-13",
  "compatibility_flags": ["nodejs_compat"],
  "main": "./workers/analytics.ts",
  "observability": {
    "enabled": true,
    "logs": { "enabled": true },
    "traces": { "enabled": true },
  },
  "hyperdrive": [
    {
      "binding": "HYPERDRIVE",
      "id": "1861601674b24d2ab8870dcb0c7a68ed",
    },
  ],
  "r2_buckets": [
    {
      "binding": "ANALYTICS_CACHE",
      "bucket_name": "insurance-app-analytics-cache",
    },
  ],
}
```

### **2. Service Binding Updates (`wrangler.jsonc`)**

```jsonc
"services": [
  {
    "binding": "DOCUMENT_SERVICE",
    "service": "insurance-document-worker-staging"
  },
  {
    "binding": "ANALYTICS_SERVICE",  // New
    "service": "insurance-analytics-worker-staging"
  }
]
```

### **3. API Interface Design**

```typescript
// Analytics Worker API
export interface AnalyticsService {
  // Report Generation
  generateExcelReport(params: ExcelReportParams): Promise<ReportResult>;
  generatePDFReport(params: PDFReportParams): Promise<ReportResult>;
  generateCSVExport(params: CSVExportParams): Promise<ExportResult>;

  // Analytics
  calculateBrokerPerformance(
    params: PerformanceParams,
  ): Promise<PerformanceResult>;
  analyzePolicyTrends(params: TrendParams): Promise<TrendResult>;

  // Data Processing
  processBulkData(params: BulkDataParams): Promise<BulkDataResult>;
  validateDataExport(params: ValidationParams): Promise<ValidationResult>;
}
```

### **4. Migration Priority List**

**High Priority (Heaviest Dependencies First):**

1. **Excel Report Generation** (ExcelJS ≈ 4MB)
2. **Complex Analytics Calculations** (heavy math libraries)
3. **Historical Data Processing** (large dataset operations)
4. **Bulk Data Export** (CSV/Excel generation)

**Medium Priority:**

1. **Chart Generation** (if using heavy visualization libraries)
2. **Data Validation Rules** (complex business logic)
3. **Statistical Analysis** (if using stats libraries)

**Low Priority:**

1. **Simple Calculations** (keep in main Worker)
2. **Basic Data Transformations** (keep in main Worker)
3. **Authentication/Authorization** (must stay in main Worker)

## Risk Assessment & Mitigation

### **Technical Risks**

1. **Increased Latency**: Worker-to-Worker calls add overhead
   - **Mitigation**: Implement request batching, caching
   - **Acceptable Tradeoff**: Better than Error 1102 failures

2. **Complexity Increase**: More services to manage
   - **Mitigation**: Clear documentation, automated deployment
   - **Monitoring**: Enhanced observability between services

3. **Data Consistency**: Multiple Workers accessing same data
   - **Mitigation**: Read-only access pattern, cache invalidation strategy
   - **Design**: Analytics Worker as read-focused, async updates

### **Business Risks**

1. **Deployment Complexity**: Multiple Worker deployments
   - **Mitigation**: Automated CI/CD pipeline, deployment ordering
   - **Rollback Plan**: Feature flags, version pinning

2. **Broker Experience Impact**: During migration
   - **Mitigation**: Phased rollout, user communication
   - **Testing**: Extensive UAT with broker representatives

## Success Metrics

### **Primary Metrics (Must Achieve)**

- ✅ Main Worker bundle: <1.8MB (28% buffer from 2.5MB limit)
- ✅ Zero Error 1102 occurrences post-migration
- ✅ No regression in critical workflow completion times

### **Secondary Metrics (Should Achieve)**

- ✅ Analytics Worker bundle: <1.5MB (reasonable for specialized Worker)
- ✅ Worker-to-Worker call latency: <100ms P95
- ✅ Report generation performance: Maintained or improved

### **Quality Metrics**

- ✅ 100% endpoint test coverage for migrated functionality
- ✅ Comprehensive error handling between Workers
- ✅ Clear monitoring/alerts for cross-Worker issues

## Resource Requirements

### **Engineering Time**

- **Phase 1 (Analysis)**: 1 engineer × 1 week
- **Phase 2 (Design)**: 2 engineers × 1 week
- **Phase 3 (Implementation)**: 2 engineers × 2 weeks
- **Total**: ~5 engineer-weeks

### **Infrastructure**

- **New Worker**: Analytics Worker ($0 Cloudflare free tier)
- **R2 Storage**: Analytics cache bucket (minimal cost)
- **Monitoring**: Enhanced Sentry/Alerts ($0 free tier)

## Timeline

### **Week 1-2: Planning & Design**

- Complete bundle analysis
- Finalize technical design
- Create detailed migration plan

### **Week 3-4: Implementation**

- Create Analytics Worker infrastructure
- Migrate highest-priority endpoints
- Implement monitoring/tracing

### **Week 5: Testing & Rollout**

- Performance testing
- User acceptance testing
- Phased production rollout

### **Week 6: Optimization & Documentation**

- Performance optimization
- Documentation updates
- Post-mortem/review

## Alternative Approaches Considered

### **Option A: Status Quo (Rejected)**

- **Risk**: High probability of Error 1102 failures
- **Limitation**: Cannot add new features without breaking Worker
- **Decision**: Not acceptable for production stability

### **Option B: Aggressive Code Splitting (Considered)**

- **Approach**: Dynamic imports within main Worker
- **Pros**: Simpler, maintains single Worker
- **Cons**: Limited reduction (≈10-15%), complex code
- **Decision**: Combine with Worker split for maximum effect

### **Option C: Additional Workers (Chosen)**

- **Approach**: Split by functional domain (Analytics Worker)
- **Pros**: Maximum bundle reduction, better architecture
- **Cons**: More infrastructure to manage
- **Decision**: Best long-term solution

## Next Steps (Immediate)

### **1. Enhanced Bundle Analysis** (Day 1-2)

```bash
# Create enhanced analysis tool
npm run analyze:dependencies  # New script to be created

# Output should include:
# - Per-library bundle contribution
# - Endpoint-to-dependency mapping
# - Migration priority recommendations
```

### **2. Design Review** (Day 3-4)

- Review with engineering team
- Finalize Analytics Worker API design
- Create detailed migration checklist

### **3. Proof of Concept** (Day 5-7)

- Create basic Analytics Worker skeleton
- Migrate one non-critical endpoint
- Measure performance impact

## Conclusion

**Current Risk:** High - Main Worker at 93% of Cloudflare limit
**Target State:** Safe - Main Worker at <72% with clear separation
**Strategic Direction:** 3-layer Worker architecture for scalability

**Key Decision:** Implement Analytics Worker split to:

1. **Immediately reduce** main Worker bundle by 20%+
2. **Create scalable foundation** for future analytics features
3. **Improve system architecture** with proper separation of concerns

**Next Action:** Begin enhanced bundle analysis to validate exact library contributions and finalize migration priority list.

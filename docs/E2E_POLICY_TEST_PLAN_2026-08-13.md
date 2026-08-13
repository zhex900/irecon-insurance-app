# Comprehensive E2E Test Plan - Policy Calculation, Adjustment & Document Generation

**Version:** 1.0.0 | **Date:** August 13, 2026 | **Scope:** Critical E2E Testing Coverage

## Executive Summary

This document outlines a comprehensive end-to-end test strategy focusing on the three most critical business workflows in the insurance application:

1. **Policy Calculation** - Accurate premium calculations across all scenarios
2. **Policy Adjustment** - Premium adjustments with 25%/75% rules and validation
3. **Document Generation** - PDF and Excel document creation and delivery

The plan builds upon existing test infrastructure ([docs/e2e-test-plan.md](e2e-test-plan.md)) and addresses identified gaps in current coverage.

## 1. Test Strategy Overview

### 1.1 Testing Layers

| Layer | Tool | Focus | Current Status |
|-------|------|-------|----------------|
| **E2E (Critical Workflows)** | Playwright | Quote→Taken→Adjust→Document full journey | Partial coverage, needs expansion |
| **Integration (PDF/Excel)** | Vitest | Document generation logic, premium calculations | Established, needs enhancement |
| **Unit (Business Logic)** | Vitest | Formula calculations, validation rules | Comprehensive |
| **Performance** | Custom scripts | PDF generation speed, Excel worker performance | Initial benchmarks |

### 1.2 Success Criteria

- **Quote-to-Taken workflow** - 95% success rate in CI
- **Adjustment calculation** - 100% accuracy verification
- **Document generation** - <5s response time for PDF/Excel
- **Bundle safety** - No static pdfme imports in routes (Worker rule)

## 2. Critical User Workflows (E2E Focus)

### 2.1 Quote-to-Taken Journey (Primary Business Flow)

**Workflow Steps:**
1. Login as broker
2. Create/select client
3. New policy wizard with premium calculation
4. Save as "Pending" (draft)
5. Generate policy documents (PDF schedule)
6. Email documents (mocked Resend)
7. Mark policy as "Taken"
8. Verify audit trail entry

**Test Coverage Needed:**
- ✅ Step 1-4: Partial coverage in `e2e/policy.spec.ts`
- ⚠️ Step 5: Missing PDF generation flow
- ⚠️ Step 6: Mocked email validation exists but limited
- ⚠️ Step 7: Missing status transition tests
- ⚠️ Step 8: Missing audit log verification

### 2.2 Policy Adjustment Flow (Regulatory Compliance)

**Workflow Steps:**
1. Select "Taken" policy with saved premium
2. Enter adjustment flow
3. Modify insured values (turnover, sum insured)
4. Apply 25%/75% rule validation
5. Save adjusted premium
6. Confirm new premium summary visible
7. Generate new Excel working sheet
8. Email adjusted documents

**Test Coverage Needed:**
- ⚠️ All steps: Limited entry point test only

### 2.3 Document Generation & Delivery

**Workflow Steps:**
1. Policy summary with premium
2. Trigger document generation (PDF schedule)
3. Trigger Excel working sheet generation
4. Email document packages
5. Download individual documents
6. Verify document content (basic validation)

**Test Coverage Needed:**
- ⚠️ Step 2-3: Missing integration tests
- ✅ Step 4: Partial email validation
- ⚠️ Step 5-6: Missing download/document validation

## 3. E2E Test Specifications

### 3.1 New Test Files Required

#### `e2e/policy-flow-quote-to-taken.spec.ts`
```typescript
// Comprehensive policy creation workflow
describe("quote-to-taken workflow", () => {
  // Full flow: client → policy wizard → premium calc → documents → email → status update
});
```

#### `e2e/policy-adjustment-flow.spec.ts`
```typescript
// Complete adjustment validation
describe("policy adjustment flow", () => {
  // Adjustment entry → 25%/75% validation → premium recalc → document regeneration
});
```

#### `e2e/document-generation.spec.ts`
```typescript
// PDF and Excel generation testing
describe("document generation workflows", () => {
  // PDF schedule generation, Excel working sheet, download verification
});
```

### 3.2 Enhanced Existing Tests

#### `e2e/policy.spec.ts` Enhancements
```typescript
// Current file needs expansion to cover:
// 1. Policy status transitions (Pending → Taken → Not taken)
// 2. Document generation UI interactions
// 3. Premium calculation visibility in wizard
```

## 4. Integration Tests (PDF/Excel Generation)

### 4.1 PDF Generation Tests

#### Current Status:
- ✅ `tests/integration/pdf-output-comparison.test.ts` (needs fixing)
- ✅ `tests/unit/pdf-generation-smoke.test.ts`
- ⚠️ Missing golden reference comparison

#### Required Enhancements:
1. **Fix PDF Output Comparison Tests**
   - Resolve mocking issues in `pdf-output-comparison.test.ts`
   - Implement proper golden reference capture using `scripts/capture-pdf-golden-references.mts`
   - Establish byte-by-byte comparison with tolerance

2. **Add Performance Benchmarks**
   - Measure PDF generation time (< 5s target)
   - Track memory usage during concurrent generation

3. **Endorsement Handling Tests**
   - Empty endorsements
   - Plain text endorsements
   - Rich HTML endorsements
   - Complex nested endorsements

### 4.2 Excel Generation Tests

#### Current Status:
- ✅ `tests/unit/premium-excel.test.ts` (unit helpers)
- ⚠️ Missing integration tests with Excel worker
- ⚠️ Missing golden reference comparison

#### Required Enhancements:
1. **Excel Worker Integration Tests**
   - Test complete Excel generation flow
   - Verify cell formatting and calculations
   - Test adjustment fingerprint changes

2. **Performance & Bundle Testing**
   - Ensure Excel worker doesn't bloat bundle
   - Test concurrent document generation
   - Validate download response times

## 5. Business Logic Coverage

### 5.1 Premium Calculation Rules

**Documentation:** [docs/pricing/car-premium-formulas.md](pricing/car-premium-formulas.md)

**Test Coverage Matrix:**

| Formula | Unit Tests | Integration Tests | E2E UI Tests |
|---------|------------|-------------------|---------------|
| Contract Works Base Premium | ✅ Comprehensive | ⚠️ Needs policy flow | ⚠️ Needs wizard |
| Terrorism Premium | ✅ Covered | ⚠️ Needs integration | ⚠️ Needs wizard |
| Plant & Equipment | ✅ Covered | ⚠️ Needs integration | ⚠️ Needs wizard |
| Liability Calculations | ✅ Covered | ⚠️ Needs integration | ⚠️ Needs wizard |
| Manual Premium Overrides | ✅ Partial | ⚠️ Missing | ⚠️ Missing |

### 5.2 Adjustment Validation (25%/75% Rule)

**Critical Business Rule:** Premium after adjustment must be between 25% and 75% of original premium.

**Test Scenarios:**
1. Adjustment within bounds (should succeed)
2. Adjustment below 25% (should show warning/error)
3. Adjustment above 75% (should show warning/error)
4. Edge cases (exactly 25%, exactly 75%)

## 6. Performance & Reliability Requirements

### 6.1 Performance Targets

| Operation | Target Time | Current Status |
|-----------|-------------|----------------|
| Policy Wizard Loading | < 2s | ✅ Meets |
| Premium Calculation | < 1s | ✅ Meets |
| PDF Generation | < 5s | ⚠️ Monitor |
| Excel Generation | < 3s | ⚠️ Monitor |
| Document Package | < 8s | ⚠️ Monitor |

### 6.2 Bundle Size Constraints

**Critical Rule:** [.cursor/rules/worker-bundle.mdc](../.cursor/rules/worker-bundle.mdc)

**Verification Tests Needed:**
1. No static `@pdfme/generator` imports in route modules
2. PDF generation dynamically imported
3. Excel worker properly bundled/isolated
4. Bundle size monitoring in CI

## 7. Test Data & Environment Setup

### 7.1 Test Data Requirements

**Seeded Data (Required for E2E):**
```typescript
// Minimum required test data
const seededTestData = {
  // Users
  brokerUser: "broker@demo.local",
  adminUser: "admin@demo.local",
  
  // Clients
  atLeastOneClient: true, // For policy creation
  
  // Policies
  takenPolicyWithPremium: true, // For adjustment flow
  policyWithDocuments: true, // For email/documents flow
  
  // Templates
  pdfTemplatePublished: true, // For document generation
  excelTemplatePublished: true // For Excel working sheets
};
```

### 7.2 Mocked External Services

| Service | Mock Strategy | Status |
|---------|---------------|--------|
| Resend Email | `mockResendEmailApi` | ✅ Implemented |
| Turnstile | `waitForTurnstileIfPresent` | ✅ Implemented |
| Sentry | Error boundary testing | ⚠️ Needs integration |
| PDF Worker | Local generation | ✅ Implemented |
| Excel Worker | Local generation | ✅ Implemented |

## 8. Implementation Phases

### Phase 1: Foundation (Week 1)
1. **Fix PDF integration tests** - Resolve mocking issues
2. **Create deterministic seed fixtures** - Ensure test data availability
3. **Enhance `policy.spec.ts`** - Add basic status transition tests

### Phase 2: Critical Workflows (Week 2)
1. **Create `policy-flow-quote-to-taken.spec.ts`** - Complete quote-to-taken journey
2. **Create `policy-adjustment-flow.spec.ts`** - 25%/75% rule validation
3. **Create `document-generation.spec.ts`** - PDF/Excel generation flows

### Phase 3: Integration & Performance (Week 3)
1. **Enhance PDF golden reference tests** - Byte-by-byte comparison
2. **Add Excel worker integration tests** - Complete generation flow
3. **Implement performance benchmarks** - CI monitoring

### Phase 4: Validation & Polish (Week 4)
1. **Cross-browser compatibility** - Chrome, Firefox, Safari
2. **Accessibility testing** - Screen reader compatibility
3. **Error boundary testing** - Network failures, malformed data
4. **Load testing** - Multiple concurrent users

## 9. Risk Assessment & Mitigation

### High Risk Areas:
1. **PDF Generation Performance** - Could exceed 5s target
   - Mitigation: Implement progressive loading, background generation
2. **Excel Worker Bundle Size** - Could violate Worker limits
   - Mitigation: Monitor bundle size, implement code splitting
3. **25%/75% Rule Complexity** - Edge cases and validation
   - Mitigation: Comprehensive unit test coverage

### Medium Risk Areas:
1. **Document Template Management** - Versioning and publish workflows
2. **Email Delivery Validation** - Mocking completeness
3. **Audit Trail Verification** - Complete action tracking

## 10. Success Metrics & Reporting

### Quantitative Metrics:
- **Test Coverage**: 95% of critical workflows covered
- **Pass Rate**: >90% in CI across all test suites
- **Performance**: Meet all target response times
- **Bundle Size**: No violations of Worker bundle limits

### Qualitative Metrics:
- **User Journey Completeness**: All primary business flows testable
- **Regression Detection**: Immediate failure on behavior changes
- **Maintainability**: Clear test documentation and fixtures
- **Reproducibility**: Consistent results across environments

## 11. Integration with CI/CD

### CI Pipeline Integration:
```yaml
# Sample CI pipeline steps
steps:
  - test:unit          # Unit tests (Vitest)
  - test:integration   # Integration tests (Vitest)
  - test:e2e:critical  # Critical E2E workflows
  - test:e2e:full      # Full E2E suite
  - test:smoke        # Post-deploy smoke tests
  - bundle:check       # Bundle size validation
  - performance:check  # Performance benchmarks
```

### Quality Gates:
1. **Must Pass**: Unit, integration, critical E2E tests
2. **Should Pass**: Full E2E suite (< 5% failure tolerance)
3. **Performance Gate**: All target times met
4. **Bundle Gate**: No Worker bundle violations

## 12. Maintenance & Evolution

### Regular Updates:
- **Monthly**: Review and update golden references
- **Quarterly**: Audit test coverage against new features
- **Bi-annually**: Performance benchmark re-evaluation

### Documentation Synchronization:
- Keep test plans synchronized with [docs/e2e-test-plan.md](e2e-test-plan.md)
- Update golden reference capture procedures
- Maintain test data seed procedures

---

**Next Action:** Begin Phase 1 implementation by fixing PDF integration test mocking issues and creating deterministic seed fixtures for E2E tests.

**Priority:** HIGH - Critical for safe refactoring and production deployment confidence.

**Estimated Completion:** 4 weeks for full implementation, with incremental value delivery each week.
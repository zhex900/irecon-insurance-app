# Refactoring Roadmap: File Organization Standards

**Date:** August 16, 2026  
**Status:** Phase 1 Completed (Hooks) | Planning Next Phases

## Executive Summary

We have successfully implemented new naming and organization standards for hook files with common prefixes. The established pattern (`prefix/use-feature.ts` for 2+ files with same prefix) provides a foundation for broader codebase improvements.

## Completed Work (Phase 1)

✅ **Hook Files Refactoring** - SUCCESSFULLY IMPLEMENTED

- **Pattern:** `prefix/use-feature.ts` for 2+ files with same prefix
- **Scope:** 6 hook files grouped into 3 directories
- **Impact:** Improved organization, cleaner imports, better scalability
- **Documentation:** Created comprehensive code review at `docs/.temp/code-review-2026-08-16-hook-refactoring.md`

## ⚠️ **In Progress: Excel Service File Organization** ✅ **COMPLETED**

Excel service files have been refactored with consistent naming patterns:

### **Changes Implemented:**

1. **File Renaming:**
   - `excel-service.server.ts` → `excel-worker.server.ts` (consistent with `pdf-worker.server.ts`)
   - `excel-client.ts` → `client.ts` (generic name with context)
   - `excel-worker-types.ts` → moved to `app/lib/excel/types.ts` (grouped with excel files)

2. **Binding Naming Pattern Update:**
   - `PdfServiceBinding` → `PdfWorkerBinding`
   - `ExcelServiceBinding` → `ExcelWorkerBinding`
   - All imports updated across codebase

3. **Created barrel exports:**
   - Created `app/lib/excel/index.ts` for clean imports
   - Export pattern: `export type { ExcelWorkerBinding } from "./excel-worker.server";`

4. **Documentation Updates:**
   - Updated `docs/guidelines/organization-naming-standards.md`
   - Updated `docs/guidelines/file-organization-standards.md`
   - Added worker service naming patterns to standards

### **Result:**

- ✅ TypeScript compilation passes (no type errors)
- ✅ All imports updated consistently
- ✅ Consistent naming: `[domain]-worker.server.ts` pattern
- ✅ Clear binding names: `[Domain]WorkerBinding` pattern

## Identified Refactoring Opportunities

### **High Priority Opportunities**

#### 1. **Auth Component Consolidation**

- **Files:**
  - `app/components/auth/auth-hash-session-bridge.tsx`
  - `app/components/layout/session-timeout-dialog.tsx`
- **Issue:** Auth-related components scattered
- **Solution:** Consolidate into `app/components/auth/` directory
- **Benefit:** Centralized authentication UI components

#### 2. **Session-related Utility Consolidation**

- **Files:**
  - `app/lib/auth/session-client.ts`
  - `app/lib/auth/session.server.ts`
  - `app/lib/auth/session-timeout.ts`
  - `app/lib/auth/session-timeout.server.ts`
  - `app/lib/services/broker-session.ts`
- **Issue:** Session logic spread across directories
- **Solution:** Review and potentially group session utilities
- **Benefit:** Clearer session management boundaries

#### 3. **Excel Service File Organization**

- **Files:**
  - `app/lib/excel/excel-service.server.ts`
  - `app/lib/excel/excel-client.ts`
  - `app/lib/excel/constants.ts`
  - `app/lib/types/excel-worker-types.ts`
- **Current:** Already in `excel/` directory
- **Opportunity:** Check for redundant naming patterns
- **Benefit:** Potential cleanup of naming conventions

### **Medium Priority Opportunities**

#### 4. **PDF Utility Naming Consistency**

- **Files:** Multiple files in `app/lib/pdf/`
- **Current:** Well-organized but check naming patterns
- **Opportunity:** Ensure consistent naming (e.g., `pdf-*` vs mixed)
- **Benefit:** Consistent naming conventions

#### 5. **Component Naming Patterns**

- **Scope:** Review root-level component files
- **Files:** `root-error-boundary.tsx`, `error-illustration.tsx`, etc.
- **Opportunity:** Check for non-descriptive or redundant names
- **Benefit:** Clearer component naming

#### 6. **Hook Files Additional Grouping** ✅ COMPLETED

- **Scope:** Monitor new hook file creation
- **Criteria:** Apply pattern when 2+ new hooks with same prefix
- **Benefit:** Proactive organization as codebase grows
- **Status:** ✅ **Monitoring system implemented** (`scripts/check-hook-grouping.sh`, `docs/guidelines/hook-file-monitoring.md`)

### **Low Priority Opportunities**

#### 7. **Service File Naming Patterns**

- **Scope:** `.service.ts` suffix usage
- **Current:** Already well-organized
- **Opportunity:** Ensure consistent service naming
- **Benefit:** Maintain naming consistency

#### 8. **Validation Schema Organization**

- **Files:** Zod schemas in `app/lib/zod/`
- **Current:** Already well-organized
- **Opportunity:** Minor naming cleanup if needed
- **Benefit:** Clean validation layer

## Implementation Roadmap

### **Phase 2: Immediate Next Steps (Next 1-2 Weeks)**

#### **2.1 Auth Component Consolidation**

1. Create `app/components/auth/` directory if not exists
2. Move `auth-hash-session-bridge.tsx` to auth directory
3. Move `session-timeout-dialog.tsx` to auth directory
4. Update all imports
5. Create index file for exports
6. Verify functionality

#### **2.2 Session Utility Review**

1. Audit all session-related files
2. Map dependencies and usage patterns
3. Determine optimal organization strategy
4. Implement consolidation if beneficial
5. Update imports across codebase

#### **2.3 Documentation Updates**

1. Add refactoring pattern to coding standards
2. Update `docs/guidelines/coding-standards.md`
3. Create team guidelines for file organization
4. Document when to apply the pattern

### **Phase 3: Medium-Term Improvements (Next Month)**

#### **3.1 Excel Service Naming Review**

1. Analyze excel file naming patterns
2. Identify redundant naming
3. Implement naming consistency improvements
4. Update affected imports

#### **3.2 PDF Utility Naming Review**

1. Review PDF utility file names
2. Ensure consistent `pdf-*` prefix usage
3. Implement naming improvements if needed

#### **3.3 Component Naming Patterns**

1. Audit root component file names
2. Identify opportunities for clearer naming
3. Implement improvements with team consensus

### **Phase 4: Long-Term Maintenance**

#### **4.1 Proactive Pattern Application**

1. Establish code review checklist item
2. Train team on new standards
3. Monitor new file creation for pattern application
4. Regular audits (quarterly) for organization consistency

#### **4.2 Tooling Support**

1. Consider ESLint rules for file organization
2. Explore automated refactoring tools
3. Develop git hooks for naming validation

## Success Metrics

### **Quantitative Metrics**

- Number of files successfully refactored
- Reduction in duplicate prefixes
- Improvement in import path clarity
- Reduction in cognitive load (measured via team surveys)

### **Qualitative Metrics**

- Team adoption of new patterns
- Consistency in file organization
- Maintenance efficiency improvements
- Code discovery improvements

## Risk Assessment

### **Technical Risks**

- **Low:** File moves with import updates
- **Mitigation:** Comprehensive testing, TypeScript validation
- **Impact:** Minimal if imports properly updated

### **Team Adoption Risks**

- **Medium:** Resistance to new patterns
- **Mitigation:** Clear documentation, team consensus, gradual rollout
- **Impact:** Temporary productivity dip during adjustment

### **Maintenance Risks**

- **Low:** Established patterns easy to maintain
- **Mitigation:** Documentation, code review enforcement
- **Impact:** Improved long-term maintenance

## Team Guidelines Proposal

### **When to Apply Refactoring Pattern**

1. **Trigger:** When 2+ files share same prefix
2. **Scope:** Start with hook files, expand to components/utilities
3. **Approval:** Team consensus for significant changes
4. **Documentation:** Update pattern documentation

### **Naming Standards**

1. **Pattern:** `prefix/feature-name.ts` (remove redundant prefixes)
2. **Exports:** Create index files for clean exports
3. **Imports:** Use directory imports (`prefix/feature`) not file imports
4. **Consistency:** Follow established patterns in each directory

## Next Immediate Actions

1. **✅ Phase 1 Complete:** Hook refactoring implemented and documented
2. **Phase 2 Planning:** Detailed auth component consolidation plan
3. **Team Communication:** Share success and gather feedback
4. **Documentation:** Update coding standards with new patterns
5. **Monitoring:** Track Phase 1 impact and gather metrics

---

**Conclusion:** The successful hook refactoring establishes a proven pattern for file organization improvements. The roadmap focuses on high-impact opportunities while maintaining code stability and team productivity.

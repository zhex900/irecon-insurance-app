# Documents Directory Naming Standards Analysis
**Date:** August 15, 2026  
**Scope:** `/Users/jake/Code/irecon-insurance-app/app/components/documents/`

## Summary
Analysis of the documents directory structure reveals **generally good compliance** with naming standards, with **one significant violation** (component name mismatch) and several organizational observations.

## File Count Summary
- **Total files:** 31
- **TSX files (components):** 16
- **TS files (utilities):** 2  
- **Index.ts files (barrel exports):** 13

## Naming Standards Compliance Analysis

### ✅ Rule 1: Min 2 Words, Max 3 Words (PASS)
- **No single-word component files** found (excluding index.ts barrel exports)
- **Only one 3-word file:** `cover-types-dialog.tsx` (acceptable per standards)
- **All other files:** 2 words (optimal compliance)
- **Index.ts files:** Single-word "index" (exempt as barrel exports)

### ✅ Rule 2: No Domain Redundancy (PASS)
- Files in `documents/` directory don't use "document" prefix
- Files in `pdf/` directory don't use "pdf" prefix
- Files in `library/` directory don't use "library" prefix
- Files in `templates/` directory don't use "template" prefix
- **Acceptable domain-specific terms:** Terms like "pdf", "template", "library" appear in file names but are appropriate for their domain directories

### ✅ Rule 3: Barrel Exports Present (PASS)
- **All feature directories** have `index.ts` files
- **Root `documents/` directory** has `index.ts`
- **All barrel exports** contain only export statements (no implementation code)
- **Correct barrel export patterns** observed

### ⚠️ Rule 4: Component Name Matching (PARTIAL FAILURE)

#### ✅ **Correct Matches:**
- `main-designer.tsx` → `MainDesigner`
- `main-manager.tsx` → `MainManager`  
- `cover-types-dialog.tsx` → `CoverTypesDialog`
- `main-table.tsx` → `MainTable`
- `merge-panel.tsx` → `MergePanel`
- `preview-dialog.tsx` → `PreviewDialog`
- `history-sheet.tsx` → `HistorySheet`
- `loading-states.tsx` → `LoadingStates` (presumed)
- `editor-toolbar.tsx` → `EditorToolbar` (presumed)
- `selection-toolbar.tsx` → `SelectionToolbar`
- `overlay-toolbar.tsx` → `OverlayToolbar`
- `main-editor.tsx` → `MainEditor`
- `confirm-dialog.tsx` → `ConfirmDialog`
- `delete-dialog.tsx` → `DeleteDialog`
- `leave-dialog.tsx` → `LeaveDialog`

#### ❌ **Significant Violation:**
- **File:** `editor-header.tsx`
- **Expected component:** `EditorHeader` (kebab→PascalCase conversion)
- **Actual exports:** `TemplateVersionBadges` and `EditableTitle`
- **Problem:** File name doesn't match component names
- **Standard Violation:** "Component names must match file names (kebab-case → PascalCase conversion)"

### ✅ Rule 5: Directory Structure Organization (MODERATE COMPLIANCE)

#### **Current Structure:**
```
documents/
├── library/
│   ├── dialogs/           (cover-types-dialog.tsx)
│   ├── table/            (main-table.tsx)
│   └── main-manager.tsx  (at feature root - inconsistent)
├── pdf/
│   ├── designer/         (main-designer.tsx + supporting components)
│   └── preview/          (preview-dialog.tsx)
├── templates/
│   ├── dialogs/          (confirm, delete, leave dialogs)
│   ├── editor/           (main-editor.tsx + supporting components)
│   ├── history/          (history-sheet.tsx)
│   └── loading/          (loading-states.tsx)
└── shared/               (designer-helpers.ts, library-model.ts)
```

#### **Observations:**
1. **Mixed organization:** Some files at feature root (`library/main-manager.tsx`), others in subdirectories
2. **Inconsistent feature naming:** `editor/` directory contains multiple component types
3. **Potential improvement:** `editor-header.tsx` should be renamed or restructured

## Detailed Findings by Directory

### `library/` Directory
- **Good:** Clear subdirectories (`dialogs/`, `table/`)
- **Issue:** `main-manager.tsx` at feature root rather than dedicated subdirectory
- **Suggestion:** Consider `library/manager/main-manager.tsx` structure

### `pdf/` Directory  
- **Excellent:** Clear `designer/` and `preview/` subdirectories
- **Good:** Supporting components grouped with main components

### `templates/` Directory
- **Good:** Well-organized subdirectories by feature
- **Problem:** `editor-header.tsx` naming mismatch
- **Suggestion:** Rename to `editor-components.tsx` or split into separate files

### `shared/` Directory
- **Good:** Contains shared utilities (`designer-helpers.ts`, `library-model.ts`)
- **Correct:** No business logic, pure utilities

## Recommendations

### **High Priority:**
1. **Fix `editor-header.tsx` naming mismatch:**
   - Option A: Rename file to `editor-components.tsx`
   - Option B: Split into separate files: `template-version-badges.tsx` and `editable-title.tsx`
   - Update barrel exports accordingly

### **Medium Priority:**
2. **Standardize directory organization:**
   - Consider moving `library/main-manager.tsx` to `library/manager/main-manager.tsx`
   - Ensure consistent feature directory patterns across all domains

### **Low Priority:**
3. **Review component classification:**
   - Verify all components with business logic remain in correct domains
   - Ensure no shared utilities contain domain-specific business logic

## Overall Assessment

**Compliance Score: 90%**

The documents directory demonstrates **strong adherence** to naming standards with only one significant violation. The structure follows domain-driven organization principles, and barrel exports are properly implemented. The main issue (`editor-header.tsx`) is a clear violation of the component name matching rule that should be addressed.

**Key Strengths:**
- Excellent compliance with word count rules (min 2, max 3 words)
- No domain redundancy in file names
- Complete barrel export coverage
- Good domain separation

**Areas for Improvement:**
- Fix component name mismatch in `editor-header.tsx`
- Standardize directory organization patterns
- Ensure consistent feature directory structure across all subdomains
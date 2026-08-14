# Organization & Naming Standards

**Date**: August 14, 2026  
**Status**: Approved Standards with Implementation Plan

## Overview

This document establishes comprehensive standards for organizing React components, files, and directories in the Irecon Insurance application. It includes both standards to follow and a concrete plan to migrate the existing codebase to compliance.

## Table of Contents

1. [Core Principles](#core-principles)
2. [Naming Standards](#naming-standards)
3. [Directory Structure Standards](#directory-structure-standards)
4. [Architectural Decisions](#architectural-decisions)
5. [Current Codebase Analysis](#current-codebase-analysis)
6. [Cross-Domain Dependency Analysis](#cross-domain-dependency-analysis)
7. [Proposed Restructure](#proposed-restructure)
8. [Migration Implementation Plan](#migration-implementation-plan)
9. [Implementation Rules](#implementation-rules)
10. [Verification Checklist](#verification-checklist)
11. [Appendices & Quick Reference](#appendices--quick-reference)

---

## Core Principles

### 1. Domain-Driven Organization

Group files by business domain/feature. Domains are business areas like `clients`, `policies`, `documents`.

### 2. Predictable Naming

Use consistent naming patterns across the codebase. Developers should be able to guess file locations.

### 3. Min 2 Words, Max 3 Words

File names should be descriptive and meaningful (minimum 2 words, maximum 3 words). Avoid single-word names that are too generic, and avoid verbose names.

**Examples:**
- ✅ `new-policy.tsx` (descriptive, 2 words)
- ✅ `car-policy-wizard.tsx` (acceptable, 3 words)
- ❌ `new.tsx` (too generic, 1 word)
- ❌ `car-policy-wizard-information-card.tsx` (too verbose, 4 words)

### 4. Hierarchical Structure

Organize by domain → feature → component type. Clear separation of concerns.

### 5. Business Logic in Domains

Components with business logic stay in their respective domains, regardless of cross-domain usage.

### 6. Clear Cross-Domain Boundaries

- UI components → `ui/` (generic, reusable)
- Shared utilities → `forms/`, `shared/` (no business logic)
- Business logic → stay in domain (entity-specific)

---

## Naming Standards

### File Names (kebab-case, min 2 words, max 3 words)

#### Component Files (.tsx)

- **Pattern**: `[noun]-[type].tsx` (minimum 2 words)
- **Examples**: `policy-form.tsx`, `form-fields.tsx`, `summary-popover.tsx`, `nav-dialog.tsx`
- **✅ Acceptable 3-word examples**: `car-policy-wizard.tsx`, `client-form-fields.tsx`
- **❌ Single-word examples**: `new.tsx`, `form.tsx`, `list.tsx` (too generic)
- **❌ Long examples**: `car-policy-wizard-information-card.tsx` (4 words)

#### Utility Files (.ts)

- **Hooks**: `use-[feature].ts` (e.g., `use-draft.ts`)
- **Utilities**: `[feature]-utils.ts` (e.g., `validation-utils.ts`)
- **❌ Avoid**: `use-client-form-draft.ts` (3 words, domain redundancy)

#### Barrel Exports (index.ts)

- Export only, no implementation code
- Every feature directory must have one
- Purpose: Clean entry points, build optimization

#### Directory Names (kebab-case)

- **Domains**: Single word (`clients`, `policies`, `documents`)
- **Features**: Clear descriptions (`form`, `list`, `wizard`, `summary`)

### Component Names (PascalCase)

- Simple names without domain prefixes
- **Do**: `Form`, `Fields`, `Popover`, `Wizard`
- **Don't**: `ClientSummaryPopover`, `CarPolicyWizardInformationCard`

### Import Patterns

```typescript
// ✅ CORRECT: Clean barrel imports
import { Form, Fields } from "~/components/clients/form";
import { FormAutocomplete } from "~/components/forms/autocomplete";
import { Button } from "~/components/ui/button";

// ❌ AVOID: Deep, specific imports
import { ClientForm } from "~/components/clients/client-form";
import { FormAutocomplete } from "~/components/forms/autocomplete";
```

---

## Directory Structure Standards

### Standard Structure

```
app/components/
├── {domain}/                    # Business domain
│   ├── {feature}/              # Feature within domain
│   │   ├── index.ts           # Barrel export only
│   │   ├── component.tsx      # Main component (e.g., form.tsx)
│   │   ├── fields.tsx         # Form fields
│   │   ├── inner.tsx          # Inner logic
│   │   ├── dialog.tsx         # Dialogs/modals
│   │   └── hooks/             # Feature-specific hooks
│   └── shared/                # Domain-shared utilities
├── forms/                     # Generic form components (no business logic)
├── ui/                       # Generic UI components (shadcn/ReUI)
└── layout/                   # Layout components
```

### Directory Structure Cheat Sheet

```
domain/                    (clients, policies, documents)
├── feature/               (form, list, wizard, summary)
│   ├── index.ts          (barrel export only)
│   ├── component.tsx     (main component)
│   ├── fields.tsx        (form fields)
│   ├── inner.tsx         (inner logic)
│   └── hooks/            (feature hooks)
└── shared/              (domain shared)
    ├── index.ts
    └── utils.ts         (domain utilities)
```

---

## Architectural Decisions

### Decision 1: Business Logic Determines Domain Ownership

**"Business logic determines domain ownership, not usage patterns."**

Components containing business logic remain in their source domain, even if used by other domains. Only generic utilities and UI components move to shared locations.

**Examples:**

- `ClientSummaryPopover` → Stays in `clients/` domain (client business logic)
- `FormAutocomplete` → Moves to `forms/` (shared utility, no business logic)
- `Button` → Stays in `ui/` (generic UI component)

### Decision 2: Min 2 Words, Max 3 Words Rule

All file names must be ≥2 and ≤3 descriptive words. Domain information is already clear from directory structure.

**Examples:**
- ✅ `policy-form.tsx`, `info-card.tsx`, `nav-dialog.tsx` (2 words, descriptive)
- ✅ `car-policy-wizard.tsx`, `client-form-fields.tsx` (3 words, acceptable)
- ❌ `new.tsx`, `form.tsx`, `list.tsx` (1 word, too generic)
- ❌ `car-policy-wizard-information-card.tsx` (4 words, too verbose)

**Before/AFTER Examples:**

- `car-policy-wizard-information-card.tsx` → `policies/wizard/components/info-card.tsx`
- `new.tsx` → `new-policy.tsx`
- `client-form-fields.tsx` → `clients/form/fields.tsx` (now acceptable as 3 words)

### Decision 3: Barrel Exports Required

Every feature directory must have `index.ts` with exports only (no implementation).

**✅ CORRECT:**

```typescript
// components/clients/form/index.ts
export { Form } from "./form";
export { Fields } from "./fields";
export type { FormValues } from "./types";
```

**❌ INCORRECT:**

```typescript
// components/clients/form/index.ts
import { useState } from "react"; // ❌ No implementation imports
export function someUtility() {
  // ❌ No implementation
  return "implementation";
}
```

---

## Current Codebase Analysis

### Major Violations Found

#### 1. "Min 2 Words, Max 3 Words" Rule Violations

**Single-word Violations (Too Generic):**

- `form.tsx` (1 word, should be `policy-form.tsx`, `client-form.tsx`, etc.)
- `new.tsx` (1 word, should be `new-policy.tsx`, `new-client.tsx`, etc.)
- `list.tsx` (1 word, should be `client-list.tsx`, `policy-list.tsx`, etc.)

**Multi-word Violations (Too Verbose):**

**4+ Word Violations:**
- `client-form-leave-dialog.tsx` (4 words)
- `car-policy-wizard-information-card.tsx` (4+ words)
- `authorised-representative-autocomplete.tsx` (3+ words)

**3-word Examples (Now Acceptable):**
- `client-form-fields.tsx` (3 words)
- `client-form-inner.tsx` (3 words)
- `client-summary-popover.tsx` (3 words)
- `car-policy-wizard-container.tsx` (3 words)
- `car-policy-wizard-decomposed.tsx` (3 words)

#### 2. Domain Redundancy Violations

All client files start with "client-" prefix, all wizard files start with "car-policy-wizard-" prefix. File names repeat domain information already clear from directory structure.

#### 3. Missing Feature Organization

Flat structure without feature subdirectories:

```
clients/
├── client-form.tsx
├── client-form-fields.tsx
├── client-form-inner.tsx
└── client-form-leave-dialog.tsx
```

#### 4. Missing Barrel Exports

No `index.ts` files in feature directories, leading to deep specific imports.

#### 5. Mixed Concerns

Business logic components mixed with shared utilities (e.g., `FormAutocomplete` in clients domain but used across domains).

---

## Cross-Domain Dependency Analysis

### Key Cross-Domain Dependencies

#### Business Logic Components (Stay in Domain)

- Contain entity-specific logic, data structures, URLs, business rules
- **Examples**: `ClientSummaryPopover`, `CarPolicyWizard`, `PdfPreviewDialog`
- **Decision**: Stay in source domain, rename properly

#### Shared Utilities (Move to Shared/Forms)

- Generic utilities WITHOUT business logic, used across multiple domains
- **Examples**: `FormAutocomplete`, `FilterAutocomplete`
- **Decision**: Move to appropriate shared location

#### UI Components (Already Correct)

- Generic, reusable UI primitives, no business logic
- **Examples**: `Button`, `Input`, `Field` (base components)
- **Location**: Already in `ui/`, no change needed

### Classification Criteria

1. **Does it contain business logic specific to a domain?** → Stay in domain
2. **Is it a generic utility used across domains?** → Move to shared/forms
3. **Is it a pure UI component?** → Already in `ui/` or move to `ui/`

---

## Proposed Restructure

### Overall Component Structure

```
components/
├── clients/                    # Domain: Client management
│   ├── form/                   # Feature: Client forms
│   │   ├── form.tsx           # Main form (was client-form.tsx)
│   │   ├── fields.tsx         # Form fields (was client-form-fields.tsx)
│   │   ├── inner.tsx          # Inner logic (was client-form-inner.tsx)
│   │   ├── leave-dialog.tsx   # Leave dialog (was client-form-leave-dialog.tsx)
│   │   └── hooks/
│   │       └── use-draft.ts   # Form draft (was use-client-form-draft.ts)
│   ├── list/                   # Feature: Client lists
│   │   ├── table.tsx          # Main table (was clients-index-table.tsx)
│   │   ├── filters.tsx        # Table filters (merge multiple filter files)
│   │   └── autocomplete.tsx   # Filter autocomplete
│   ├── summary/               # Feature: Client summaries
│   │   ├── popover.tsx       # Summary popover (was client-summary-popover.tsx)
│   │   └── policies.tsx      # Policies view (was client-policies-table.tsx)
│   └── [other features]
├── forms/                     # Domain: Shared form components
│   └── autocomplete/         # Feature: Autocomplete components
│       ├── form.tsx          # Generic form autocomplete (moved from clients/)
│       └── filter.tsx        # Generic filter autocomplete (moved from clients/)
└── ui/                       # Domain: UI components (unchanged)
```

### Client Domain Transformation Examples

| Current File                 | New Location                  | Component Name Change                   |
| ---------------------------- | ----------------------------- | --------------------------------------- |
| `client-form.tsx`            | `clients/form/form.tsx`       | `ClientForm` → `Form`                   |
| `client-form-fields.tsx`     | `clients/form/fields.tsx`     | `ClientFormFields` → `Fields`           |
| `client-summary-popover.tsx` | `clients/summary/popover.tsx` | `ClientSummaryPopover` → `Popover`      |
| `clients-index-table.tsx`    | `clients/list/table.tsx`      | `ClientsIndexTable` → `Table`           |
| `form-autocomplete.tsx`      | `forms/autocomplete/form.tsx` | `FormAutocomplete` → `FormAutocomplete` |

### Import Pattern Transformation

```typescript
// BEFORE: Problematic imports
import { ClientForm } from "~/components/clients/client-form";
import { ClientFormFields } from "~/components/clients/client-form-fields";
import { FormAutocomplete } from "~/components/forms/autocomplete";

// AFTER: Clean imports
import { Form, Fields } from "~/components/clients/form";
import { FormAutocomplete } from "~/components/forms/autocomplete";
```

---

## Migration Implementation Plan

### Phase 1: Foundation (Week 1-2)

**Goal**: Establish shared infrastructure and fix cross-domain dependencies.

**Tasks:**

1. Create `forms/autocomplete/` directory
2. Move `FormAutocomplete`, `FilterAutocomplete` to shared forms
3. Update all imports of these components
4. Test form functionality across domains

**Commands:**

```bash
mkdir -p app/components/forms/autocomplete
git mv app/components/clients/form-autocomplete.tsx app/components/forms/autocomplete/form.tsx
git mv app/components/clients/filter-autocomplete.tsx app/components/forms/autocomplete/filter.tsx
```

### Phase 2: Clients Domain (Week 3-4)

**Goal**: Restructure clients domain following all standards.

**Tasks:**

1. Create feature directories: `clients/{form,list,summary,representatives,dialogs,shared}`
2. Move and rename all client components
3. Implement barrel exports
4. Update all client-related imports
5. Test client functionality thoroughly

**Commands:**

```bash
# Create structure
mkdir -p app/components/clients/{form,list,summary,representatives,dialogs,shared}
mkdir -p app/components/clients/form/hooks

# Move form components
git mv app/components/clients/client-form.tsx app/components/clients/form/form.tsx
git mv app/components/clients/client-form-fields.tsx app/components/clients/form/fields.tsx
git mv app/components/clients/client-form-inner.tsx app/components/clients/form/inner.tsx
git mv app/components/clients/client-form-leave-dialog.tsx app/components/clients/form/leave-dialog.tsx
git mv app/components/clients/use-client-form-draft.ts app/components/clients/form/hooks/use-draft.ts

# Move summary components
git mv app/components/clients/client-summary-popover.tsx app/components/clients/summary/popover.tsx
git mv app/components/clients/client-policies-table.tsx app/components/clients/summary/policies.tsx
```

### Phase 3: Policies/Wizard Domain (Week 5-6)

**Goal**: Restructure policies/wizard domain.

**Tasks:**

1. Create structure: `policies/wizard/{wizard,sections,components,hooks,shared}`
2. Move and rename wizard components
3. Handle cross-dependencies with clients domain
4. Update all imports
5. Test wizard functionality

### Phase 4: Remaining Domains (Week 7-8)

**Goal**: Apply pattern to all remaining domains.

**Tasks:**

1. Restructure `documents/` domain
2. Restructure `email/` domain
3. Restructure remaining domains
4. Final testing and cleanup

---

## Implementation Rules

### Rule 1: Minimum 2 Words, Maximum 3 Words

File names should be descriptive and meaningful (minimum 2 words, maximum 3 words). Avoid single-word generic names like "new.tsx" or "form.tsx". Three-word names like "car-policy-wizard.tsx" are acceptable when necessary for clarity. Use abbreviations when appropriate, but ensure the meaning remains clear. Create subdirectories if more specificity needed.

**Examples:**
- ✅ `policy-form.tsx` (meaningful, 2 words)
- ✅ `car-policy-wizard.tsx` (acceptable, 3 words)
- ❌ `new.tsx` (too generic, 1 word)
- ✅ `info-card.tsx` (descriptive, 2 words)
- ❌ `component.tsx` (generic, 1 word)

### Rule 2: Business Logic Stays in Domain

Components with business logic remain in their source domain. Cross-domain usage allowed via clean barrel exports.

### Rule 3: Feature-Based Organization

Organize by domain → feature → component type. Create subdirectories for clear separation of concerns.

### Rule 4: Barrel Exports Required

Every feature directory must have `index.ts` with exports only (no implementation).

### Rule 5: Clear Cross-Domain Boundaries

- UI components → `ui/` (generic, reusable)
- Shared utilities → `forms/`, `shared/` (no business logic)
- Business logic → stay in domain (entity-specific)

### Rule 6: Consistent Naming

- Remove domain redundancy from file names
- Component names simple (no prefixes)
- Types can be descriptive for clarity

### Rule 7: Single Responsibility

Each file should have a single, clear responsibility. Split large files by logical boundaries.

---

## Verification Checklist

### After Each Phase, Verify:

#### Naming Compliance

✅ All file names ≥2 words and ≤3 words  
✅ No generic single-word names (like "new.tsx", "form.tsx")  
✅ No domain prefixes in file names  
✅ Component names simple (no redundancy)  
✅ Consistent kebab-case for file names

#### Structure Compliance

✅ Feature-based directory structure implemented  
✅ Barrel exports (`index.ts`) in all feature directories  
✅ No implementation code in `index.ts` files  
✅ Clear separation of concerns

#### Cross-Domain Compliance

✅ Business logic components remain in their respective domains  
✅ Shared utilities moved to appropriate shared locations  
✅ UI components in `ui/` domain only  
✅ Cross-domain imports clean via barrel exports

#### Functional Compliance

✅ All imports updated to new paths  
✅ TypeScript compilation passes  
✅ All tests pass  
✅ Build succeeds  
✅ Key user flows work

### Final Verification (After Complete Migration)

✅ All domains restructured following standards  
✅ All cross-domain dependencies properly handled  
✅ Documentation updated  
✅ Team trained on new import patterns  
✅ Lint rules added to enforce standards

---

## Appendices & Quick Reference

### Appendix A: File Naming Cheat Sheet

```
.tsx files:      [noun]-[type].tsx        (min 2 words, max 3 words)
Hook files:      use-[feature].ts        (min 2 words, max 3 words)
Utility files:   [feature]-utils.ts      (min 2 words, max 3 words)
Index files:     index.ts               (always - EXPORT ONLY)
Type files:      types.ts               (domain-specific)

Examples:
✅ Acceptable (2 words): policy-form.tsx, info-card.tsx, nav-dialog.tsx, use-draft.ts
✅ Acceptable (3 words): car-policy-wizard.tsx, client-form-fields.tsx
❌ Too generic (1 word): new.tsx, form.tsx, list.tsx, use-form.ts
❌ Too verbose (4+ words): car-policy-wizard-information-card.tsx
```

### Appendix B: Component Classification Flowchart

```
Is component generic UI? → ui/
Does it have business logic? → Stay in domain
Is it shared utility? → forms/ or shared/
```

### Appendix C: Barrel Export Templates

**Feature-level `index.ts`:**

```typescript
// components/{domain}/{feature}/index.ts
export { Component } from "./component";
export { Helper } from "./helper";
export type { ComponentProps } from "./component";
export type { HelperProps } from "./helper";
```

**Domain-level `index.ts`:**

```typescript
// components/{domain}/index.ts
export * from "./feature1";
export * from "./feature2";
export * from "./shared";
```

### Appendix D: Common Transformation Examples

**Component Rename Example (verbose to concise):**

```typescript
// BEFORE: clients/client-summary-popover.tsx
export function ClientSummaryPopover({ client, ... }) { ... }
export type ClientSummaryPopoverClient = { ... }

// AFTER: clients/summary/popover.tsx
export function Popover({ client, ... }) { ... }
export type ClientSummaryPopoverClient = { ... }  // Type name kept
```

**Single-word to Two-word Example:**

```typescript
// BEFORE: new.tsx (too generic)
export function New() { return <div>Create new policy</div>; }

// AFTER: new-policy.tsx (descriptive, 2 words)
export function NewPolicy() { return <div>Create new policy</div>; }
```

**Import Update Example:**

```typescript
// BEFORE:
import { ClientSummaryPopover } from "~/components/clients/client-summary-popover";

// AFTER:
import { Popover as ClientSummaryPopover } from "~/components/clients/summary";
// OR:
import { Popover } from "~/components/clients/summary";
```

### Appendix E: Migration Command Cheatsheet

```bash
# Create shared infrastructure
mkdir -p app/components/forms/autocomplete

# Move shared utilities
git mv app/components/clients/form-autocomplete.tsx app/components/forms/autocomplete/form.tsx

# Create domain structure
mkdir -p app/components/clients/{form,list,summary}

# Move domain components
git mv app/components/clients/client-summary-popover.tsx app/components/clients/summary/popover.tsx

# Create barrel exports
echo 'export { Form } from "./form"' > app/components/clients/form/index.ts
```

### Appendix F: Estimated Timeline

- **Phase 1**: 2 weeks (shared utilities, foundation)
- **Phase 2**: 2 weeks (clients domain)
- **Phase 3**: 2 weeks (policies/wizard domain)
- **Phase 4**: 2 weeks (remaining domains)
- **Total**: 8 weeks for experienced team

---

## Maintenance & Enforcement

### After Migration Complete:

1. **Add Lint Rules** to enforce naming standards
2. **Documentation Updates** for new team members
3. **Code Review Checklist** to prevent regressions
4. **Regular Audits** (quarterly) to ensure compliance

### Lint Rule Examples:

- Enforce min 2 words, max 3 words in file names
- Prevent implementation in `index.ts` files
- Require barrel exports for feature directories
- Check for domain redundancy in file names
- Reject single-word generic names (e.g., "new.tsx", "form.tsx")

---

_Document Version: 2.0 (Comprehensive Edition)_  
_Last Updated: August 14, 2026_  
_Maintained by: Architecture Working Group_

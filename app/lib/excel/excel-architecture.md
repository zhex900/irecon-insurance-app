# Excel Architecture & Naming Conventions

## Overview

This document defines the clean architecture for Excel functionality after the worker refactoring.

## Architecture Layers

### 1. Excel Layer (Client/Server)

- **Purpose**: Provide Excel-related utilities to the app
- **Location**: `app/lib/excel/*.ts`
- **Key Principle**: Never imports ExcelJS directly, delegates to worker

### 2. Worker Layer (Excel Generation)

- **Purpose**: Actual Excel generation logic
- **Location**: `workers/excel/modules/*`
- **Key Principle**: Contains all ExcelJS-dependent code

### 3. Bridge Layer (Communication)

- **Purpose**: Connect app to worker
- **Location**: `app/lib/reports/excel-worker-wrapper.server.ts`
- **Key Principle**: Abstracts worker communication details

## File Naming Convention

### Excel Layer Files (`app/lib/excel/`)

```
prefix-function-type.ts
```

**Prefixes:**

- `excel-` - Excel-related functionality
- `premium-` - Premium calculation (not Excel-specific)

**Examples:**

- `excel-types.ts` - Type definitions for Excel
- `excel-client.ts` - Client-side Excel utilities
- `excel-document.ts` - Document creation implementation (formerly excel-document.impl.ts)
- `excel-build.server.ts` - Excel building orchestrator (worker wrapper)

**Current Files in `app/lib/excel/`:**

1. `constants.ts` - Shared constants (client/server safe)
2. `constants.server.ts` - Server-only constants (env variables)
3. `excel-types.ts` - Type definitions for Excel
4. `excel-client.ts` - Client-side Excel utilities
5. `excel-document.ts` - Document creation implementation
6. `excel-build.server.ts` - Excel building orchestrator (worker wrapper)
7. `excel-architecture.md` (this documentation)

### Worker Layer Files (`workers/excel/modules/`)

```
excel-[sheet|module]-purpose.ts
```

**Examples:**

- `excel-workbook.ts` - Workbook utilities
- `excel-policy-sheet.ts` - Policy sheet generation
- `excel-premium-sheet.ts` - Premium sheet generation
- `excel-rates-sheet.ts` - Rates sheet generation
- `excel-adjustment-sheet.ts` - Adjustment sheet generation
- `excel-labels.ts` - Label utilities
- `excel-types.ts` - Worker-specific types

## Key Principles

1. **Single Source of Truth**: Each concept has exactly one authoritative location
2. **Clear Dependencies**: App never imports ExcelJS, worker handles all generation
3. **Proper Abstractions**: Bridges abstract worker communication
4. **Consistent Naming**: Files clearly indicate their purpose and layer

## Migration Guide

### To Remove Duplication:

1. Move shared types to `excel-types.ts`
2. Extract shared constants to dedicated constants files
3. Ensure worker has its own types for its simplified needs

### To Improve Readability:

1. Use `excel-` prefix for all Excel-related files
2. Add `.impl.ts` suffix for implementation details
3. Add `.server.ts` suffix for server-only code
4. Add `.client.ts` suffix for client-only code

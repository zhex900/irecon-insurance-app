# Consistent Logging & Error Handling Guidelines

These guidelines ensure consistent observability and error handling across the Irecon Insurance application and its workers.

## Overview

The goal is to have predictable, structured logging and error handling that:
- Provides good observability for debugging
- Maintains user privacy (no PII in logs)
- Correlates errors across services via request IDs
- Integrates with Cloudflare Workers Logs and Sentry

## Logging

### When to Log

| Level   | Use                                                                                                                              |
|---------|----------------------------------------------------------------------------------------------------------------------------------|
| `debug` | Detailed information for debugging only, never in production (sampled)                                                          |
| `info`  | Normal operations: service start/stop, significant lifecycle events, performance metrics                                          |
| `warn`  | Unusual but expected conditions (deprecation warnings, rate limiting, external service transient failures)                       |
| `error` | Unexpected errors that prevent normal operation (database failures, validation errors, unhandled exceptions, service unavailability) |

### Structured Logging Format

Always use the structured logger from `app/lib/observability/logger.server.ts`:

```typescript
import { logger } from "~/lib/observability/logger.server";

// Correct: Structured logging with context
logger.info("Client created successfully", {
  clientId: "123",
  operation: "client.create",
  durationMs: 150,
});

// Wrong: Direct console usage
console.log("Client created successfully");
```

### Context Fields

Always include relevant context in log fields:

| Field           | Description                                                                                             | When to Include                           |
|-----------------|---------------------------------------------------------------------------------------------------------|-------------------------------------------|
| `requestId`     | The request correlation ID (auto-included by main logger)                                             | Always (auto-included)                    |
| `userId`        | User ID performing the action (auto-included by main logger)                                           | When available                            |
| `route`         | Route path being executed (auto-included by main logger)                                                | When available                            |
| `operation`     | High-level operation name (e.g., "client.create", "policy.submit")                                      | Always                                    |
| `durationMs`    | Operation duration in milliseconds                                                                      | For performance tracking                  |
| `resourceId`    | ID of the affected resource (clientId, policyId, etc.)                                                 | When relevant                             |
| `errorType`     | Type of error (e.g., "ValidationError", "ExternalServiceError")                                         | For errors                                |
| `externalService`| Name of external service when relevant (e.g., "excel-worker", "email-service")                         | When calling external services            |
| `workerType`    | For workers: type of worker ("excel", "documents")                                                      | In worker environments                    |

### Privacy Rules (Never Log)

- Passwords, tokens, API keys, JWTs
- Personal information (full names, addresses, email content beyond IDs)
- Policy details beyond IDs
- Request/response payloads outside of development debugging

## Error Handling

### Use Domain Error Classes

Use typed domain errors from `app/lib/errors.ts` instead of generic `Error`:

```typescript
import { ValidationError, NotFoundError, ExternalServiceError } from "~/lib/errors";

// Correct: Domain error with proper type and HTTP status
throw new ValidationError("Invalid email format");

// Correct: External service error
throw new ExternalServiceError("Excel Worker service unavailable");

// Wrong: Generic error
throw new Error("Invalid email format");
```

### Domain Error Classes

| Class                  | HTTP Status | Use                                                                 |
|------------------------|-------------|---------------------------------------------------------------------|
| `ValidationError`      | 400         | Bad input (after Zod or domain rules)                                |
| `AuthorizationError`   | 403         | Authenticated but not allowed                                      |
| `NotFoundError`        | 404         | Missing entity                                                     |
| `ConflictError`        | 409         | Version / unique / state conflict                                  |
| `ExternalServiceError` | 502         | Supabase, R2, email, workers, etc.                                |

### Worker-Specific Error Handling

For worker environments, use appropriate status codes and structured error responses:

```typescript
// In Excel Worker or Document Worker
if (!response.ok) {
  logger.error("External service failed", {
    service: "excel-worker",
    status: response.status,
    operation: "generate-report",
  });
  
  // Return structured error response
  return new Response(
    JSON.stringify({
      error: "Excel generation failed",
      status: response.status,
    }), 
    { status: 502 }
  );
}
```

### Public Error Messages

Use `publicErrorMessage` from `app/lib/http/public-error.server.ts` to return safe error messages to clients:

```typescript
import { publicErrorMessage } from "~/lib/http/public-error.server";

try {
  // ... operation that may fail ...
} catch (error) {
  const message = publicErrorMessage(error, {
    fallback: "An error occurred",
    operation: "policy.create",
  });
  
  // Return error to client
  return json({ error: message }, { status: 500 });
}
```

## Performance Logging

For performance-critical operations, log key metrics:

```typescript
const startTime = Date.now();

try {
  // ... operation ...
  
  const duration = Date.now() - startTime;
  logger.info("Operation completed", {
    operation: "excel.generate",
    durationMs: duration,
    bufferBytes: buffer.byteLength,
  });
  
} catch (error) {
  const duration = Date.now() - startTime;
  logger.error("Operation failed", {
    operation: "excel.generate",
    durationMs: duration,
    error: error instanceof Error ? error.message : "unknown",
    errorType: error instanceof Error ? error.name : typeof error,
  });
  
  throw error;
}
```

## Migration Checklist

When updating code for consistency:

1. ✅ Replace `console.log/warn/error` with `logger.*`
2. ✅ Include context fields (operation, resourceId, etc.)
3. ✅ Replace generic `Error` throws with domain error classes
4. ✅ Add duration tracking for performance-critical operations
5. ✅ Use structured error responses in workers
6. ✅ Use `publicErrorMessage` for client-facing errors

## Examples

### Before (Inconsistent)
```typescript
console.warn(`Excel Worker request timed out after ${timeoutMs}ms`);
throw new Error("Excel Worker failed with status 500");
```

### After (Consistent)
```typescript
logger.warn("Excel Worker request timed out", {
  operation: "excel.generate",
  timeoutMs,
  service: "excel-worker",
  workerType: "excel",
});

throw new ExternalServiceError("Excel Worker service unavailable");
```
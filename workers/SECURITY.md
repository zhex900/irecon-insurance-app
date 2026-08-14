# Worker Security Implementation

This document outlines the security measures implemented for the Excel and Document workers.

## Overview

The worker security system provides multi-layered protection for service-to-service communication, including:

1. **Authentication** - Verify service identity
2. **Authorization** - Control access to resources  
3. **Data Integrity** - Ensure data hasn't been tampered with
4. **Rate Limiting** - Prevent abuse and DoS attacks
5. **Input Validation** - Protect against injection attacks
6. **Network Security** - Secure headers and CORS policies

## Architecture

### Security Layers

```
┌─────────────────────────────────────┐
│         Request Processing          │
├─────────────────────────────────────┤
│ 1️⃣ Suspicious User Agent Detection │
│ 2️⃣ Path Traversal Prevention       │
│ 3️⃣ Rate Limiting                  │
│ 4️⃣ Content-Type Validation         │
├─────────────────────────────────────┤
│ 5️⃣ Authentication & Authorization │
├─────────────────────────────────────┤
│ 6️⃣ HMAC Signature Validation       │
├─────────────────────────────────────┤
│ 7️⃣ Input/Schema Validation         │
└─────────────────────────────────────┘
```

### Components

- **`/workers/shared/security/`** - Core security utilities
- **`/workers/excel/handler/security.ts`** - Excel-specific security
- **`/workers/excel/handler/middleware.ts`** - Security middleware
- **`/workers/excel/types/schemas.ts`** - Zod validation schemas

## Authentication Methods

### 1. Signed Requests (Recommended)
For service-to-service communication, use signed requests with HMAC signatures:

```typescript
// Client-side request creation
const signedRequest = {
  payload: { /* your data */ },
  signature: "hmac-hex-signature",
  timestamp: Date.now(),
  serviceToken: "SHARED_SECRET"
};
```

**Features:**
- HMAC-SHA256 signatures
- Timestamp freshness (5-minute window)
- Replay attack prevention
- Data integrity verification

### 2. Service Token Authentication
Simple shared secret for internal services:

```http
X-Service-Token: YOUR_SHARED_SECRET
```

### 3. CORS-Based Authentication
For browser-based requests with CORS protection.

## Zod Validation

All worker endpoints use Zod schemas for input validation:

- **`excelWorkerRequestSchema`** - Base request validation
- **`premiumWorkbookDataSchema`** - Premium data validation
- **`signedWorkerRequestSchema`** - Signed request validation
- **`healthResponseSchema`** - Health check response validation

## Security Headers

All responses include comprehensive security headers:

```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; 
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

## Rate Limiting

- **Default**: 100 requests/minute per IP
- **Storage**: In-memory (use Cloudflare KV for production)
- **Response**: 429 Too Many Requests with Retry-After header

## Threat Protection

### Path Traversal Prevention
Blocks patterns like `../`, `..%2f`, `%2e%2e%2f`

### Suspicious User Agent Detection
Blocks scanning tools like cURL, wget, nmap, sqlmap

### Header Injection Protection
Sanitizes headers to prevent CRLF injection

### Request Size Limiting
10MB maximum request size

## Environment Configuration

Required environment variables:

```env
# Shared secret for service authentication
WORKER_SHARED_SECRET=your-secret-here

# Worker version for health checks
WORKER_VERSION=1.0.0

# App URL for CORS
APP_URL=https://your-app.example.com
```

## Testing Security

### Test Authentication Failure
```bash
curl -X POST https://worker.example.com/api/excel/generate \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
# Should return 401 Unauthorized
```

### Test Rate Limiting
```bash
# Make rapid requests
for i in {1..150}; do
  curl -s -o /dev/null -w "%{http_code}" \
    -X GET https://worker.example.com/health
  echo
  sleep 0.1
done
# Should start returning 429 after 100 requests
```

### Test Signed Request
```bash
# With proper signature (see client/base-client.ts for implementation)
curl -X POST https://worker.example.com/api/excel/generate \
  -H "Content-Type: application/json" \
  -d '{"payload": {...}, "signature": "...", "timestamp": 1234567890, "serviceToken": "..."}'
```

## Monitoring and Logging

Security events are logged with severity levels:

- **High**: Authentication failures, signature validation failures
- **Medium**: Rate limiting, CORS violations, suspicious patterns
- **Low**: Normal security checks

Logs include:
- Timestamp
- Client IP
- Request path and method  
- User Agent
- Security event details

## Migration Path

### Current → Signed Requests
1. Update services to use `createSignedRequest()` from `/workers/shared/security/signing.ts`
2. Configure `WORKER_SHARED_SECRET` environment variable
3. Update route configurations to require signed requests

### Development → Production
1. Replace in-memory rate limiting with Cloudflare KV
2. Add request tracing with Cloudflare Workers analytics
3. Implement circuit breaker pattern for dependent services
4. Add request/response encryption for sensitive data

## Code Review Checklist

When reviewing security-related changes:

- [ ] All endpoints validate input with Zod schemas
- [ ] Authentication required for sensitive endpoints
- [ ] Rate limiting implemented
- [ ] Security headers applied to all responses
- [ ] No secrets in logs or error messages
- [ ] Error messages don't leak system information
- [ ] Request validation happens before processing
- [ ] Path traversal attempts are blocked
- [ ] Suspicious user agents are detected
- [ ] Backward compatibility maintained where needed

## Troubleshooting

### Common Issues

**"Invalid service token" error:**
- Check `WORKER_SHARED_SECRET` environment variable
- Verify the token matches exactly
- Check for trailing spaces

**"Request timestamp expired" error:**
- Client and server clocks must be synchronized
- Requests older than 5 minutes are rejected
- Use NTP time synchronization

**"Invalid signature" error:**
- Ensure signing implementation matches on client and server
- Check that payload hasn't been modified
- Verify timestamp format

**Rate limiting issues:**
- In-memory rate limiting resets on worker restart
- For production, implement KV-based rate limiting
- Consider per-user or per-organization rate limits

## Future Enhancements

1. **JWT Support** - Add JSON Web Token authentication
2. **OAuth 2.0** - External service authentication
3. **IP Allowlisting** - Restrict to trusted IP ranges
4. **Request Encryption** - End-to-end encryption for sensitive data
5. **Advanced Rate Limiting** - AI-based abuse detection
6. **Web Application Firewall** - Cloudflare WAF integration
/**
 * Session management module
 *
 * This module provides a unified interface for session-related functionality,
 * including authentication, session timeout management, and utility functions.
 */

// Export timeout functionality (shared between client and server)
export type {
  SessionTimeoutClientState,
  SessionTimeoutConfig,
  SessionTimeoutVerdict,
  SessionTiming,
} from "./timeout";
export { evaluateSessionTimeout } from "./timeout";

// Export utility functions
export { toBrokerSession } from "./utils";

// Client-side session hook (placeholder - currently unused)
export type { SessionData } from "./client";
export { useSession } from "./client";

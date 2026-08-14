// Document worker main entry point
import { handler } from "./handler";
import type { DocumentWorkerEnv } from "./types/env";

/**
 * Document worker handler - internal service communication only
 * This worker is accessible via Service Bindings, not public routes
 */
export default {
  async fetch(request: Request, env: DocumentWorkerEnv): Promise<Response> {
    return handler(request, env);
  },
};

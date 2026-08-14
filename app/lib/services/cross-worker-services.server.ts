import type { CloudflareEnv } from "../cloudflare.server";

interface CrossWorkerSession {
  userId: string;
  email: string;
  accessToken: string;
  expiresAt: number;
  permissions: string[];
}

interface SessionData {
  userId: string;
  email: string;
  accessToken: string;
  expiresAt: number;
  permissions?: string[];
  role?: string;
}

interface WorkerConfig {
  name: string;
  url: string;
  allowedRoutes: string[];
  requiresAuth: boolean;
}

export class CrossWorkerAuthentication {
  private workerConfigs: Map<string, WorkerConfig>;

  constructor() {
    this.workerConfigs = new Map([
      [
        "documents-ui",
        {
          name: "documents-ui",
          url:
            process.env.DOCUMENTS_UI_URL || "https://documents-ui.example.com",
          allowedRoutes: ["/designer", "/templates", "/preview"],
          requiresAuth: true,
        },
      ],
      [
        "admin-ui",
        {
          name: "admin-ui",
          url: process.env.ADMIN_UI_URL || "https://admin-ui.example.com",
          allowedRoutes: ["/admin", "/settings"],
          requiresAuth: true,
        },
      ],
    ]);
  }

  async validateSessionForWorker(
    sessionId: string,
    workerName: string,
    env: CloudflareEnv,
  ): Promise<CrossWorkerSession | null> {
    const workerConfig = this.workerConfigs.get(workerName);
    if (!workerConfig) {
      throw new Error(`Worker ${workerName} not configured`);
    }

    // Retrieve session from main app session store
    const session = await this.getSessionFromStore(sessionId, env);
    if (!session) {
      return null;
    }

    // Create cross-worker session with worker-specific permissions
    return {
      userId: session.userId,
      email: session.email,
      accessToken: session.accessToken,
      expiresAt: session.expiresAt,
      permissions: this.getWorkerPermissions(session, workerName),
    };
  }

  async forwardRequestToWorker(
    request: Request,
    workerName: string,
    env: CloudflareEnv,
  ): Promise<Response> {
    const workerConfig = this.workerConfigs.get(workerName);
    if (!workerConfig) {
      throw new Error(`Worker ${workerName} not configured`);
    }

    const sessionId = this.extractSessionId(request);
    if (!sessionId && workerConfig.requiresAuth) {
      return new Response("Unauthorized", { status: 401 });
    }

    const crossWorkerSession = sessionId
      ? await this.validateSessionForWorker(sessionId, workerName, env)
      : null;

    if (workerConfig.requiresAuth && !crossWorkerSession) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Forward the request
    const url = new URL(request.url);
    const forwardUrl = `${workerConfig.url}${url.pathname}${url.search}`;

    const forwardHeaders = new Headers(request.headers);
    forwardHeaders.set("X-Forwarded-From", "main-worker");
    forwardHeaders.set("X-Worker-Name", workerName);

    if (crossWorkerSession) {
      // Include worker-specific session token
      const workerToken = await this.generateWorkerToken(
        crossWorkerSession,
        workerName,
      );
      forwardHeaders.set("Authorization", `Bearer ${workerToken}`);
    }

    const forwardRequest = new Request(forwardUrl, {
      method: request.method,
      headers: forwardHeaders,
      body: request.body,
      redirect: "manual",
    });

    return fetch(forwardRequest);
  }

  private async getSessionFromStore(
    sessionId: string,
    env: CloudflareEnv,
  ): Promise<SessionData | null> {
    // Implementation depends on your session storage
    // This is a simplified example
    const sessionKey = `session:${sessionId}`;

    // Using KV, R2, or database session store
    // Replace with actual session storage implementation
    try {
      const sessionData = await env.SESSIONS?.get(sessionKey, "json");
      return sessionData as SessionData | null;
    } catch (error) {
      console.error("Failed to retrieve session:", error);
      return null;
    }
  }

  private extractSessionId(request: Request): string | null {
    // Extract session from cookie or Authorization header
    const cookie = request.headers.get("Cookie");
    if (cookie) {
      const match = cookie.match(/sessionId=([^;]+)/);
      if (match) return match[1];
    }

    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      return authHeader.slice(7);
    }

    return null;
  }

  private getWorkerPermissions(session: SessionData, workerName: string): string[] {
    // Base permissions from user role
    const basePermissions = session.permissions || [];

    // Worker-specific permissions
    const workerPermissions: Record<string, string[]> = {
      "documents-ui": ["documents:read", "documents:write", "templates:edit"],
      "admin-ui": ["admin:read", "settings:write", "users:manage"],
    };

    const specificPermissions = workerPermissions[workerName] || [];

    // Filter permissions based on user role
    return [...basePermissions, ...specificPermissions].filter((permission) =>
      this.userHasPermission(permission, session.role || ""),
    );
  }

  private async generateWorkerToken(
    session: CrossWorkerSession,
    workerName: string,
  ): Promise<string> {
    // Generate a JWT or signed token for cross-worker authentication
    // This is a simplified example - implement proper JWT generation in production

    const tokenData = {
      sub: session.userId,
      email: session.email,
      worker: workerName,
      permissions: session.permissions,
      exp: session.expiresAt,
      iat: Math.floor(Date.now() / 1000),
    };

    // In production, sign this with a shared secret
    const token = Buffer.from(JSON.stringify(tokenData)).toString("base64");

    return token;
  }

  private userHasPermission(permission: string, userRole: string): boolean {
    // Simplified permission checking
    const rolePermissions: Record<string, string[]> = {
      admin: [
        "documents:read",
        "documents:write",
        "admin:read",
        "settings:write",
      ],
      user: ["documents:read"],
      editor: ["documents:read", "documents:write", "templates:edit"],
    };

    const allowedPermissions = rolePermissions[userRole] || [];
    return allowedPermissions.includes(permission);
  }
}

// Request handler for route coordination
export function createRouteCoordinator(env: CloudflareEnv) {
  const authService = new CrossWorkerAuthentication();

  return async function routeCoordinator(
    request: Request,
  ): Promise<Response | null> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Route coordination logic
    if (
      pathname.startsWith("/documents/designer") ||
      pathname.startsWith("/templates/edit/") ||
      pathname.match(/^\/preview\//)
    ) {
      return authService.forwardRequestToWorker(request, "documents-ui", env);
    }

    if (
      pathname.startsWith("/admin") ||
      pathname.startsWith("/settings") ||
      pathname.startsWith("/reports/admin")
    ) {
      return authService.forwardRequestToWorker(request, "admin-ui", env);
    }

    // Return null to let main app handle the route
    return null;
  };
}

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { R2Bucket } from "@cloudflare/workers-types";

interface SessionData {
  userId: string;
  email: string;
  accessToken: string;
  expiresAt: number;
  permissions?: string[];
  role?: string;
}

interface UserData {
  id: string;
  email: string;
  name?: string;
  role?: string;
}

interface Env {
  ASSETS: R2Bucket;
  TEMPLATES: R2Bucket;
  APP_URL: string;
  MAIN_WORKER_URL: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

declare global {
  var env: Env;
}

type Variables = {
  session: SessionData;
  user: UserData;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Middleware
app.use(
  "*",
  cors({
    origin: (origin) => {
      // Allow requests from main app domain
      const allowedOrigins = [
        env.APP_URL,
        "http://localhost:3000",
        "http://localhost:3001",
      ];
      return allowedOrigins.includes(origin) ? origin : null;
    },
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization", "X-Session-Token"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

app.use("*", logger());

// JWT middleware for session validation
app.use("*", async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.slice(7);

  try {
    // Validate token with main worker
    const validationResponse = await fetch(
      `${env.MAIN_WORKER_URL}/api/auth/verify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!validationResponse.ok) {
      return c.json({ error: "Invalid session" }, 401);
    }

    const sessionData = await validationResponse.json();
    c.set("session", sessionData.session);
    c.set("user", sessionData.user);

    await next();
  } catch (error) {
    console.error("Session validation failed:", error);
    return c.json({ error: "Session validation failed" }, 500);
  }
});

// Health check
app.get("/health", (c) => c.text("OK"));

// Document designer route
app.get("/designer", async (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Document Designer</title>
      <script>
        // Listen for parent window messages
        window.addEventListener('message', (event) => {
          if (event.data.type === 'INIT_DESIGNER') {
            console.log('Designer initialized with template:', event.data.templateId);
            
            // Send ready message back
            window.parent.postMessage({
              type: 'DESIGNER_READY',
              templateId: event.data.templateId
            }, event.origin);
          }
        });
        
        // Notify parent that designer is loaded
        window.addEventListener('load', () => {
          window.parent.postMessage({
            type: 'DESIGNER_LOADED'
          }, '*');
        });
      </script>
    </head>
    <body>
      <div id="designer-root"></div>
    </body>
    </html>
  `);
});

// Designer API endpoints
app.post("/api/templates/:id", async (c) => {
  const templateId = c.req.param("id");
  const data = await c.req.json();

  // Save template to R2
  await env.TEMPLATES.put(`templates/${templateId}.json`, JSON.stringify(data));

  return c.json({ success: true, id: templateId });
});

app.get("/api/templates/:id", async (c) => {
  const templateId = c.req.param("id");

  // Get template from R2
  const template = await env.TEMPLATES.get(`templates/${templateId}.json`);

  if (!template) {
    return c.json({ error: "Template not found" }, 404);
  }

  return c.json(JSON.parse(await template.text()));
});

// PDF preview generation
app.post("/api/preview/:templateId", async (c) => {
  const templateId = c.req.param("templateId");
  const data = await c.req.json();

  // Call document service for PDF generation
  const response = await fetch(
    `${env.MAIN_WORKER_URL}/api/documents/generate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: c.req.header("Authorization")!,
      },
      body: JSON.stringify({
        templateId,
        data: data.mergeFields,
      }),
    },
  );

  if (!response.ok) {
    return c.json({ error: "PDF generation failed" }, 500);
  }

  const pdfBuffer = await response.arrayBuffer();
  return new Response(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="preview-${templateId}.pdf"`,
    },
  });
});

// Static assets
app.get("/assets/*", async (c) => {
  const path = c.req.path.replace("/assets/", "");
  const object = await env.ASSETS.get(path);

  if (!object) {
    return c.notFound();
  }

  // Create headers manually to avoid type conflicts with Cloudflare's Headers interface
  const headers = new Headers();
  // Set content-type from object metadata if available
  if (object.httpMetadata?.contentType) {
    headers.set("content-type", object.httpMetadata.contentType);
  }
  // Set other cache headers if needed
  headers.set("etag", object.httpEtag);
  
  // Handle the ReadableStream type incompatibility between Cloudflare and standard types
  // Use unknown as an intermediate type for type safety
  const body = object.body as unknown as ReadableStream;
  return new Response(body, { headers });
});

export default {
  fetch: app.fetch,
};

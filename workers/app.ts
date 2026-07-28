import { createRequestHandler, RouterContextProvider } from "react-router";
import { withRequestDb } from "../app/lib/db/client";
import {
  cloudflareContext,
  type CloudflareEnv,
} from "../app/lib/cloudflare.server";

declare global {
  interface Env extends CloudflareEnv {}
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

function applyDatabaseEnv(env: Env) {
  const hyperdrive = env.HYPERDRIVE;
  if (hyperdrive?.connectionString) {
    process.env.DATABASE_URL = hyperdrive.connectionString;
  } else if (env.DATABASE_URL) {
    process.env.DATABASE_URL = env.DATABASE_URL;
  }
  if (env.SUPABASE_URL) process.env.SUPABASE_URL = env.SUPABASE_URL;
  if (env.SUPABASE_ANON_KEY)
    process.env.SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;
  if (env.SUPABASE_SERVICE_ROLE_KEY) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  }
  if (env.APP_URL) process.env.APP_URL = env.APP_URL;
  if (env.RESEND_API_KEY) process.env.RESEND_API_KEY = env.RESEND_API_KEY;
  if (env.EMAIL_FROM) process.env.EMAIL_FROM = env.EMAIL_FROM;
  if (env.EMAIL_REPLY_TO) process.env.EMAIL_REPLY_TO = env.EMAIL_REPLY_TO;
}

export default {
  async fetch(request: Request, env: Env, ctx: unknown) {
    applyDatabaseEnv(env);

    return withRequestDb(async () => {
      const context = new RouterContextProvider();
      context.set(cloudflareContext, { env, ctx });
      return requestHandler(request, context);
    });
  },
};

export { cloudflareContext };

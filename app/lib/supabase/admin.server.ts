import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  getSupabaseSecretKey,
  getSupabaseUrl,
} from "~/lib/supabase/env.server";

let adminClient: SupabaseClient | null = null;

/** Service-role client for Auth Admin + privileged server ops. Never import from client code. */
export function getSupabaseAdmin() {
  if (adminClient) return adminClient;
  adminClient = createClient(getSupabaseUrl(), getSupabaseSecretKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return adminClient;
}

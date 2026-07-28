import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from "~/lib/supabase/env.server";

let adminClient: SupabaseClient | null = null;

/** Service-role client for Auth Admin + privileged server ops. Never import from client code. */
export function getSupabaseAdmin() {
  if (adminClient) return adminClient;
  adminClient = createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return adminClient;
}

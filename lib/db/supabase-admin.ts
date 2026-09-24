import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Service-role Supabase client. Bypasses Row Level Security entirely —
 * see db/schema/012_rls.sql. Only for trusted server-side work that must
 * cross user boundaries (e.g. the grading engine reading hidden test cases,
 * webhook handlers). NEVER import this into anything that runs in, or
 * ships to, the browser — the `server-only` import above enforces that
 * at build time.
 */
export function createSupabaseAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

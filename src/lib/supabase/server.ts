import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client for use in Server Components, Server
 * Actions, and Route Handlers. Reads/writes the auth cookie so the
 * logged-in users session (and therefore their RLS identity) carries
 * through to every query made with this client.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component (not a Server Action / Route
            // Handler) -- safe to ignore because middleware.ts refreshes
            // the session on every request anyway.
          }
        },
      },
    }
  );
}

/**
 * Admin client using the SERVICE ROLE key. This bypasses Row Level
 * Security entirely -- it must NEVER be imported into any file that
 * ships to the browser, and should only be used for trusted server-only
 * operations (e.g. creating a user during onboarding, the seed script).
 */
export function createAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. This is required for admin-only operations (see .env.example)."
    );
  }
  // Lazy import so the service-role key path is never bundled client-side.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient: createSupabaseClient } = require("@supabase/supabase-js");
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

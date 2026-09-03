import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Runs on every request before a route renders — this is where we gate
 * access to the dashboard for logged-out visitors and refresh the
 * Supabase session cookie. Named `proxy` (not `middleware`) per the
 * Next.js 16 file convention: https://nextjs.org/docs/messages/middleware-to-proxy
 * The old `middleware.ts` name is deprecated in 16 and may be ignored
 * entirely on newer patch versions, so this rename isn't cosmetic.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (static files)
     * - favicon.ico, images, fonts
     */
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

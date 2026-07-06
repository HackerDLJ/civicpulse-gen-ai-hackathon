// Optional Supabase auth middleware for server functions on public routes.
// If a valid bearer token is present, exposes { userId, isAuthenticated: true }.
// If no header or the token is malformed/invalid, exposes { userId: null, isAuthenticated: false }
// instead of throwing — so the same function works for anonymous callers.
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type OptionalAuthContext = {
  userId: string | null;
  isAuthenticated: boolean;
  claims: Record<string, unknown> | null;
};

export const optionalSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const empty: OptionalAuthContext = { userId: null, isAuthenticated: false, claims: null };
    try {
      const request = getRequest();
      const authHeader = request?.headers?.get("authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return next({ context: empty });
      }
      const token = authHeader.slice("Bearer ".length);
      if (!token || token.split(".").length !== 3) {
        return next({ context: empty });
      }
      const SUPABASE_URL = process.env.SUPABASE_URL;
      const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
      if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return next({ context: empty });

      const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await supabase.auth.getClaims(token);
      if (error || !data?.claims?.sub) return next({ context: empty });
      return next({
        context: {
          userId: data.claims.sub,
          isAuthenticated: true,
          claims: data.claims as Record<string, unknown>,
        } satisfies OptionalAuthContext,
      });
    } catch {
      return next({ context: empty });
    }
  },
);

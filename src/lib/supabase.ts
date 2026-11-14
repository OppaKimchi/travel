import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../config";

export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

export const supabase = createClient(
  SUPABASE_URL || "https://not-configured.supabase.co",
  SUPABASE_PUBLISHABLE_KEY || "not-configured",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Sign-in is email and password only, and the app uses the URL hash
      // for its own pages, so there are no tokens to pick up from links.
      detectSessionInUrl: false,
    },
  },
);

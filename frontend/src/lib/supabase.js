import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Loud warning in dev so setup mistakes are obvious.
  console.warn(
    "[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. " +
      "Sign-in will not work until you add them to frontend/.env"
  );
}

export const supabase = createClient(url || "http://placeholder", anonKey || "placeholder", {
  auth: { persistSession: true, autoRefreshToken: true },
});

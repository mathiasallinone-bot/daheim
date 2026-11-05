import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Öffentliche Werte aus Vercel (Environment Variables) bzw. .env.local.
// Der «anon»/«publishable» Schlüssel ist für den Browser gedacht; die Daten schützt RLS in der Datenbank.
const SUPABASE_URL = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
const SUPABASE_KEY = (import.meta.env["VITE_SUPABASE_ANON_KEY"] ?? import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]) as
  | string
  | undefined;

function createSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    const message = "VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY fehlen (siehe ANLEITUNG.md, Schritt Vercel).";
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }
  return createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

/** Lazy, damit Tests ohne Umgebungsvariablen laden können. */
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});

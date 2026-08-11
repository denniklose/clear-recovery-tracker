import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

function getSupabasePublicKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
    || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
    || "";
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && getSupabasePublicKey());
}

export function getSupabaseClient(): SupabaseClient | null {
  if (typeof window === "undefined" || !isSupabaseConfigured()) return null;
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = getSupabasePublicKey();
  if (!url || !anonKey) return null;

  browserClient = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  });

  return browserClient;
}

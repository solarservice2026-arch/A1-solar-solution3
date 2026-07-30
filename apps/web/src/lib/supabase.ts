import { createClient } from "@supabase/supabase-js";
const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const url = rawUrl && rawUrl.trim() !== "" ? rawUrl : undefined;
const key = rawKey && rawKey.trim() !== "" ? rawKey : undefined;

export const isSupabaseConfigured = Boolean(url && key);
export const supabase = createClient(
  url ?? "https://placeholder-project.supabase.co",
  key ?? "placeholder-key",
  {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  }
);


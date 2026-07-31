import { createClient } from "@supabase/supabase-js";

const DEFAULT_URL = "https://ugcearfqlcyzhmbfmcru.supabase.co";
const DEFAULT_KEY = "sb_publishable_ZN3-qlsbWTvy8YcXLQr3OQ_JvmoTGwD";

const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const url = rawUrl && rawUrl.trim() !== "" ? rawUrl : DEFAULT_URL;
const key = rawKey && rawKey.trim() !== "" ? rawKey : DEFAULT_KEY;

export const isSupabaseConfigured = true;
export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

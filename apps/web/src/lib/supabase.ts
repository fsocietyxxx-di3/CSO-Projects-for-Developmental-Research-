import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL ?? "https://placeholder.supabase.co";
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "public-anon-key-placeholder";

/** Client-side Supabase tenant — auth session + (later) storage. Data flows via our API. */
export const supabase = createClient(url, anonKey);

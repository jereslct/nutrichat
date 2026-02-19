import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// NOTE: This project sometimes boots before Vite env vars are injected.
// We provide safe fallbacks so the app never hard-crashes with:
// "supabaseUrl is required".
const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
const envPublishableKey = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const envAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined;
const envProjectId = (import.meta as any).env?.VITE_SUPABASE_PROJECT_ID as string | undefined;

const fallbackProjectId = "coghazfvffthyrjsifrm";
const fallbackUrl = `https://${fallbackProjectId}.supabase.co`;
const fallbackKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZ2hhemZ2ZmZ0aHlyanNpZnJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMTUxNjUsImV4cCI6MjA3OTY5MTE2NX0.57D-RGX3y4QE70f4e0hLLUuqoiTjAI9TBDseycB1Ab8";

const derivedUrl = envProjectId ? `https://${envProjectId}.supabase.co` : undefined;

const SUPABASE_URL = envUrl || derivedUrl || fallbackUrl;
const SUPABASE_PUBLISHABLE_KEY = envPublishableKey || envAnonKey || fallbackKey;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});

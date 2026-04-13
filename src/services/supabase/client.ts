"use client";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Next.js only injects env from `.env`, `.env.local`, `.env.production`, etc.
 * It does **not** read `.env.example` — that file is documentation only.
 */
export const supabaseMissingEnvMessage =
  "Supabase is not configured. Copy `.env.example` to `.env.local` in the project root, set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from Supabase (Project Settings → API), then stop and run `npm run dev` again.";

export const supabase = createClient(
  supabaseUrl ?? "https://example.supabase.co",
  supabaseAnonKey ?? "missing-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);

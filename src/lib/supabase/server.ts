import { auth } from "@clerk/nextjs/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

function pickSupabaseUrl(): string | undefined {
  const v = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const t = v?.trim();
  return t || undefined;
}

/** Anon / publishable key — same value Supabase shows as "anon" or "publishable". */
function pickSupabaseAnonKey(): string | undefined {
  const v =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.SUPABASE_KEY;
  const t = v?.trim();
  return t || undefined;
}

export function getSupabaseAnonCredentials(): { url: string; key: string } | null {
  const url = pickSupabaseUrl();
  const key = pickSupabaseAnonKey();
  if (!url || !key) return null;
  return { url, key };
}

/** True when URL + anon key exist (supports Clerk/doc aliases). */
export function isSupabaseAnonConfigured(): boolean {
  return getSupabaseAnonCredentials() !== null;
}

/**
 * Supabase client for the signed-in user. Sends the Clerk **session** JWT so RLS
 * (tenant = auth.jwt()->>'sub') applies. Use Clerk’s native Supabase integration
 * (Clerk Dashboard → activate Supabase; Supabase → Auth → add Clerk provider)
 * so session tokens include the `role: authenticated` claim Supabase expects.
 * The old Clerk "supabase" JWT template path is deprecated.
 */
export async function createServerSupabaseClient(): Promise<SupabaseClient> {
  const { userId, getToken } = await auth();
  if (!userId) {
    throw new Error("Not signed in");
  }
  const token = await getToken();
  if (!token) {
    throw new Error(
      "Missing Clerk session token for Supabase. Sign in, and ensure Clerk ↔ Supabase integration is enabled in Clerk plus Clerk is added as an auth provider in Supabase (see https://clerk.com/docs/integrations/databases/supabase).",
    );
  }

  const creds = getSupabaseAnonCredentials();
  if (!creds) {
    throw new Error(
      "Missing Supabase URL or anon key. Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_KEY, or SUPABASE_ANON_KEY.",
    );
  }
  const { url, key } = creds;

  return createClient(url, key, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });
}

/** Bypasses RLS. Use only for privileged server jobs — not normal request handling. */
export function createServiceRoleClient(): SupabaseClient {
  const url = pickSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("Missing Supabase URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key);
}

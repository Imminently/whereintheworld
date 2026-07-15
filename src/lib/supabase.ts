import { createClient, type User } from "@supabase/supabase-js";
import { clientConfig, isSupabaseConfigured } from "./config";
import type { Database } from "./database.types";

type AppSupabaseClient = ReturnType<typeof createClient<Database>>;

let cachedClient: AppSupabaseClient | null = null;

/** Returns the configured Supabase client, or null when environment variables are missing. */
export function getSupabaseClient(): AppSupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (cachedClient !== null) {
    return cachedClient;
  }

  const { supabaseUrl, supabasePublishableKey } = clientConfig;
  if (supabaseUrl === undefined || supabasePublishableKey === undefined) {
    return null;
  }

  cachedClient = createClient<Database>(
    supabaseUrl,
    supabasePublishableKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 20,
        },
      },
    },
  );

  return cachedClient;
}

/** Returns the current Supabase user without creating an anonymous account. */
export async function getCurrentUser(): Promise<User | null> {
  const client = getSupabaseClient();
  if (client === null) {
    throw new Error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");
  }

  const result = await client.auth.getUser();
  if (result.error !== null) {
    return null;
  }

  return result.data.user;
}

/** Signs a host in with an existing Supabase email/password account. */
export async function signInHost(email: string, password: string): Promise<User> {
  const client = getSupabaseClient();
  if (client === null) {
    throw new Error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");
  }

  const result = await client.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (result.error !== null) {
    throw result.error;
  }

  if (result.data.user === null) {
    throw new Error("Supabase did not return a signed-in host.");
  }

  if (result.data.user.is_anonymous === true) {
    throw new Error("Host access requires a permanent Supabase user.");
  }

  return result.data.user;
}

/** Signs out the current host or player session from this browser. */
export async function signOutCurrentUser(): Promise<void> {
  const client = getSupabaseClient();
  if (client === null) {
    throw new Error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");
  }

  const result = await client.auth.signOut();
  if (result.error !== null) {
    throw result.error;
  }
}

/** Returns true when the user is a permanent account suitable for host access. */
export function isHostUser(user: User | null): user is User {
  return user !== null && user.is_anonymous !== true;
}

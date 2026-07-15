import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

export function createAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");

  if (supabaseUrl === undefined || serviceRoleKey === undefined) {
    throw new Error("Supabase Edge Function environment is missing service credentials.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function getAuthenticatedUserId(request: Request, adminClient: ReturnType<typeof createAdminClient>): Promise<string> {
  const authorization = request.headers.get("Authorization");
  const token = authorization?.replace("Bearer ", "");

  if (token === undefined || token.length === 0) {
    throw new Error("Missing authorization token.");
  }

  const { data, error } = await adminClient.auth.getUser(token);
  if (error !== null || data.user === null) {
    throw new Error("Invalid authorization token.");
  }

  return data.user.id;
}

export async function getOptionalAuthenticatedUserId(
  request: Request,
  adminClient: ReturnType<typeof createAdminClient>,
): Promise<string | null> {
  const authorization = request.headers.get("Authorization");
  const token = authorization?.replace("Bearer ", "");

  if (token === undefined || token.length === 0) {
    return null;
  }

  const { data, error } = await adminClient.auth.getUser(token);
  if (error !== null || data.user === null) {
    return null;
  }

  return data.user.id;
}

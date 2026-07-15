import { hashPlayerSessionToken } from "./crypto.ts";
import { createAdminClient } from "./supabase.ts";

export async function getParticipantBySession(
  adminClient: ReturnType<typeof createAdminClient>,
  gameId: string,
  playerSessionToken: string,
) {
  const sessionTokenHash = await hashPlayerSessionToken(playerSessionToken);
  const { data, error } = await adminClient
    .from("participants")
    .select("*")
    .eq("game_id", gameId)
    .eq("session_token_hash", sessionTokenHash)
    .single();

  if (error !== null || data === null) {
    throw new Error("Join this game before continuing.");
  }

  return data;
}

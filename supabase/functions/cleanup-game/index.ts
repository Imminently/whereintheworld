import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { readJsonObject, requireString } from "../_shared/http.ts";
import { createAdminClient, getAuthenticatedUserId } from "../_shared/supabase.ts";

serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse !== null) {
    return optionsResponse;
  }

  try {
    const adminClient = createAdminClient();
    const userId = await getAuthenticatedUserId(request, adminClient);
    const body = await readJsonObject(request);
    const gameId = requireString(body, "gameId");

    const { data: game, error: gameError } = await adminClient
      .from("games")
      .select("id,host_user_id")
      .eq("id", gameId)
      .single();

    if (gameError !== null || game.host_user_id !== userId) {
      throw new Error("Only the host can delete this game.");
    }

    const { data: rounds, error: roundsError } = await adminClient
      .from("rounds")
      .select("photo_object_key")
      .eq("game_id", gameId);

    if (roundsError !== null) {
      throw roundsError;
    }

    const objectKeys = (rounds ?? [])
      .map((round: { photo_object_key: string | null }) => round.photo_object_key)
      .filter((objectKey: string | null): objectKey is string => objectKey !== null);

    if (objectKeys.length > 0) {
      await adminClient.storage.from("game-photos").remove(objectKeys);
    }

    const { error: deleteError } = await adminClient
      .from("games")
      .delete()
      .eq("id", gameId);

    if (deleteError !== null) {
      throw deleteError;
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
});

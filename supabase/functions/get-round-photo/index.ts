import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { optionalString, readJsonObject, requireString } from "../_shared/http.ts";
import { getParticipantBySession } from "../_shared/player-session.ts";
import {
  createAdminClient,
  getOptionalAuthenticatedUserId,
} from "../_shared/supabase.ts";

const PHOTO_URL_EXPIRY_SECONDS = 15 * 60;

serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse !== null) {
    return optionsResponse;
  }

  try {
    const adminClient = createAdminClient();
    const userId = await getOptionalAuthenticatedUserId(request, adminClient);
    const body = await readJsonObject(request);
    const gameId = requireString(body, "gameId");
    const roundId = requireString(body, "roundId");
    const playerSessionToken = optionalString(body, "playerSessionToken");

    const [gameResult, roundResult, revealResult] = await Promise.all([
      adminClient
        .from("games")
        .select("id,host_user_id,phase,current_round_id")
        .eq("id", gameId)
        .single(),
      adminClient
        .from("rounds")
        .select("id,photo_object_key")
        .eq("id", roundId)
        .eq("game_id", gameId)
        .single(),
      adminClient
        .from("round_reveals")
        .select("round_id")
        .eq("game_id", gameId)
        .eq("round_id", roundId)
        .maybeSingle(),
    ]);

    if (gameResult.error !== null || roundResult.error !== null) {
      throw new Error("Round photo is not available.");
    }
    if (revealResult.error !== null) {
      throw revealResult.error;
    }

    const isHost = userId !== null && gameResult.data.host_user_id === userId;
    const participant =
      playerSessionToken === undefined
        ? null
        : await getParticipantBySession(adminClient, gameId, playerSessionToken);
    const isParticipant = participant !== null;
    const isCurrentVisibleRound =
      gameResult.data.current_round_id === roundId &&
      (gameResult.data.phase === "guessing" || gameResult.data.phase === "revealed");
    const isRevealed = revealResult.data !== null;

    if (!isHost && (!isParticipant || (!isCurrentVisibleRound && !isRevealed))) {
      throw new Error("This photo is not visible yet.");
    }

    if (roundResult.data.photo_object_key === null) {
      throw new Error("This round does not have a photo.");
    }

    const { data, error } = await adminClient.storage
      .from("game-photos")
      .createSignedUrl(roundResult.data.photo_object_key, PHOTO_URL_EXPIRY_SECONDS);

    if (error !== null) {
      throw error;
    }

    return jsonResponse({
      signedUrl: data.signedUrl,
      expiresInSeconds: PHOTO_URL_EXPIRY_SECONDS,
    });
  } catch (error) {
    return errorResponse(error);
  }
});

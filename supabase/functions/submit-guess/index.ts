import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { assertValidCoordinates } from "../_shared/game.ts";
import { readJsonObject, requireNumber, requireString } from "../_shared/http.ts";
import { getParticipantBySession } from "../_shared/player-session.ts";
import { createAdminClient } from "../_shared/supabase.ts";

serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse !== null) {
    return optionsResponse;
  }

  try {
    const adminClient = createAdminClient();
    const body = await readJsonObject(request);
    const gameId = requireString(body, "gameId");
    const roundId = requireString(body, "roundId");
    const playerSessionToken = requireString(body, "playerSessionToken");
    const latitude = requireNumber(body, "latitude");
    const longitude = requireNumber(body, "longitude");
    assertValidCoordinates(latitude, longitude);

    const participant = await getParticipantBySession(
      adminClient,
      gameId,
      playerSessionToken,
    );

    const [gameResult, roundResult, revealResult] = await Promise.all([
      adminClient
        .from("games")
        .select("phase,current_round_id")
        .eq("id", gameId)
        .single(),
      adminClient
        .from("rounds")
        .select("id,game_id,subject_member_id")
        .eq("id", roundId)
        .eq("game_id", gameId)
        .single(),
      adminClient
        .from("round_reveals")
        .select("round_id")
        .eq("round_id", roundId)
        .maybeSingle(),
    ]);

    if (gameResult.error !== null || roundResult.error !== null) {
      throw new Error("The current round is not available.");
    }
    if (revealResult.error !== null) {
      throw revealResult.error;
    }
    if (gameResult.data.phase !== "guessing" || gameResult.data.current_round_id !== roundId) {
      throw new Error("The host is not accepting guesses for this round.");
    }
    if (roundResult.data.subject_member_id === participant.team_member_id) {
      throw new Error("Your own round is skipped for scoring.");
    }
    if (revealResult.data !== null) {
      throw new Error("This round has already been revealed.");
    }

    const { error: guessError } = await adminClient
      .from("guesses")
      .upsert(
        {
          game_id: gameId,
          round_id: roundId,
          participant_id: participant.id,
          latitude,
          longitude,
          submitted_at: new Date().toISOString(),
        },
        { onConflict: "game_id,round_id,participant_id" },
      );

    if (guessError !== null) {
      throw guessError;
    }

    await adminClient.rpc("broadcast_game_event", {
      p_game_id: gameId,
      p_event: "guess_submitted",
      p_payload: { roundId, participantId: participant.id },
    });

    return jsonResponse({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
});

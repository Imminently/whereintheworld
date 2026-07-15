import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { calculateDistanceKm, toGameSummary } from "../_shared/game.ts";
import { optionalString, readJsonObject, requireString } from "../_shared/http.ts";
import { createResetGameError } from "../_shared/supabase-error.ts";
import { createAdminClient, getAuthenticatedUserId } from "../_shared/supabase.ts";

type HostCommand =
  | "start_lobby"
  | "start_round"
  | "reveal_round"
  | "finish_game"
  | "reset_setup"
  | "reset_game";

const hostCommands = new Set<HostCommand>([
  "start_lobby",
  "start_round",
  "reveal_round",
  "finish_game",
  "reset_setup",
  "reset_game",
]);

function parseCommand(value: string): HostCommand {
  if (!hostCommands.has(value as HostCommand)) {
    throw new Error("Unsupported host command.");
  }

  return value as HostCommand;
}

async function assertHost(adminClient: ReturnType<typeof createAdminClient>, gameId: string, userId: string): Promise<void> {
  const { data, error } = await adminClient
    .from("games")
    .select("id")
    .eq("id", gameId)
    .eq("host_user_id", userId)
    .single();

  if (error !== null || data === null) {
    throw new Error("Only the host can control this game.");
  }
}

async function fetchGameSummary(adminClient: ReturnType<typeof createAdminClient>, gameId: string) {
  const { data, error } = await adminClient
    .from("games")
    .select("id,title,phase,current_round_id,created_at")
    .eq("id", gameId)
    .single();

  if (error !== null) {
    throw error;
  }

  return toGameSummary(data);
}

async function pickNextRound(adminClient: ReturnType<typeof createAdminClient>, gameId: string, roundId?: string): Promise<string> {
  if (roundId !== undefined) {
    return roundId;
  }

  const { data: rounds, error: roundsError } = await adminClient
    .from("rounds")
    .select("id")
    .eq("game_id", gameId)
    .order("display_order", { ascending: true });

  if (roundsError !== null) {
    throw roundsError;
  }

  const { data: reveals, error: revealsError } = await adminClient
    .from("round_reveals")
    .select("round_id")
    .eq("game_id", gameId);

  if (revealsError !== null) {
    throw revealsError;
  }

  const revealedIds = new Set((reveals ?? []).map((reveal: { round_id: string }) => reveal.round_id));
  const nextRound = (rounds ?? []).find((round: { id: string }) => !revealedIds.has(round.id));

  if (nextRound === undefined) {
    throw new Error("No unrevealed rounds are left.");
  }

  return nextRound.id;
}

async function revealRound(adminClient: ReturnType<typeof createAdminClient>, gameId: string, roundId: string): Promise<void> {
  const [roundResult, answerResult, participantsResult, guessesResult] = await Promise.all([
    adminClient
      .from("rounds")
      .select("id,game_id,subject_member_id")
      .eq("id", roundId)
      .eq("game_id", gameId)
      .single(),
    adminClient
      .from("round_answers")
      .select("*")
      .eq("round_id", roundId)
      .single(),
    adminClient.from("participants").select("*").eq("game_id", gameId),
    adminClient.from("guesses").select("*").eq("game_id", gameId).eq("round_id", roundId),
  ]);

  if (roundResult.error !== null || answerResult.error !== null) {
    throw new Error("Cannot reveal a round without a saved answer.");
  }
  if (participantsResult.error !== null) {
    throw participantsResult.error;
  }
  if (guessesResult.error !== null) {
    throw guessesResult.error;
  }

  const answer = answerResult.data;
  await adminClient.from("round_reveals").upsert({
    game_id: gameId,
    round_id: roundId,
    latitude: answer.latitude,
    longitude: answer.longitude,
    location_label: answer.location_label,
    revealed_at: new Date().toISOString(),
  });

  const scoreRows = (participantsResult.data ?? [])
    .filter(
      (participant: { team_member_id: string }) =>
        participant.team_member_id !== roundResult.data.subject_member_id,
    )
    .map((participant: { id: string }) => {
      const guess = (guessesResult.data ?? []).find(
        (candidateGuess: { participant_id: string }) =>
          candidateGuess.participant_id === participant.id,
      );

      if (guess === undefined) {
        return {
          game_id: gameId,
          round_id: roundId,
          participant_id: participant.id,
          distance_km: null,
          scored: false,
        };
      }

      return {
        game_id: gameId,
        round_id: roundId,
        participant_id: participant.id,
        distance_km: calculateDistanceKm(
          guess.latitude,
          guess.longitude,
          answer.latitude,
          answer.longitude,
        ),
        scored: true,
      };
    });

  if (scoreRows.length > 0) {
    const { error: scoreError } = await adminClient
      .from("round_scores")
      .upsert(scoreRows, { onConflict: "round_id,participant_id" });

    if (scoreError !== null) {
      throw scoreError;
    }
  }

  const { error: updateError } = await adminClient
    .from("games")
    .update({ phase: "revealed", current_round_id: roundId })
    .eq("id", gameId);

  if (updateError !== null) {
    throw updateError;
  }
}

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
    const command = parseCommand(requireString(body, "command"));
    const requestedRoundId = optionalString(body, "roundId");
    await assertHost(adminClient, gameId, userId);

    let eventName = "game_updated";
    if (command === "start_lobby") {
      const { error } = await adminClient
        .from("games")
        .update({ phase: "lobby", current_round_id: null })
        .eq("id", gameId);
      if (error !== null) {
        throw error;
      }
      eventName = "lobby_started";
    }

    if (command === "start_round") {
      const roundId = await pickNextRound(adminClient, gameId, requestedRoundId);
      const { error } = await adminClient
        .from("games")
        .update({ phase: "guessing", current_round_id: roundId })
        .eq("id", gameId);
      if (error !== null) {
        throw error;
      }
      eventName = "round_started";
    }

    if (command === "reveal_round") {
      const roundId = requestedRoundId ?? (await fetchGameSummary(adminClient, gameId)).currentRoundId;
      if (roundId === null) {
        throw new Error("No active round is ready to reveal.");
      }
      await revealRound(adminClient, gameId, roundId);
      eventName = "round_revealed";
    }

    if (command === "finish_game") {
      const { error } = await adminClient
        .from("games")
        .update({ phase: "finished", current_round_id: null })
        .eq("id", gameId);
      if (error !== null) {
        throw error;
      }
      eventName = "game_finished";
    }

    if (command === "reset_setup") {
      const { error } = await adminClient
        .from("games")
        .update({ phase: "setup", current_round_id: null })
        .eq("id", gameId);
      if (error !== null) {
        throw error;
      }
      eventName = "game_reset";
    }

    if (command === "reset_game") {
      const { error } = await adminClient.rpc("reset_game_for_replay", {
        p_game_id: gameId,
      });
      if (error !== null) {
        console.error("reset_game RPC failed", error);
        throw createResetGameError(error);
      }
      eventName = "game_replayed";
    }

    await adminClient.rpc("broadcast_game_event", {
      p_game_id: gameId,
      p_event: eventName,
      p_payload: { command },
    });

    return jsonResponse({ game: await fetchGameSummary(adminClient, gameId) });
  } catch (error) {
    return errorResponse(error);
  }
});

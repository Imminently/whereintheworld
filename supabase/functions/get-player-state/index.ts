import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { toGameSummary, toParticipant, toTeamMember } from "../_shared/game.ts";
import { readJsonObject, requireString } from "../_shared/http.ts";
import { getParticipantBySession } from "../_shared/player-session.ts";
import { createAdminClient } from "../_shared/supabase.ts";

function toRound(row: {
  id: string;
  game_id: string;
  subject_member_id: string;
  photo_object_key: string | null;
  display_order: number;
}) {
  return {
    id: row.id,
    gameId: row.game_id,
    subjectMemberId: row.subject_member_id,
    photoObjectKey: row.photo_object_key,
    displayOrder: row.display_order,
  };
}

function toGuess(row: {
  id: string;
  game_id: string;
  round_id: string;
  participant_id: string;
  latitude: number;
  longitude: number;
  submitted_at: string;
}) {
  return {
    id: row.id,
    gameId: row.game_id,
    roundId: row.round_id,
    participantId: row.participant_id,
    latitude: row.latitude,
    longitude: row.longitude,
    submittedAt: row.submitted_at,
  };
}

function toReveal(row: {
  game_id: string;
  round_id: string;
  latitude: number;
  longitude: number;
  location_label: string;
  revealed_at: string;
}) {
  return {
    gameId: row.game_id,
    roundId: row.round_id,
    latitude: row.latitude,
    longitude: row.longitude,
    locationLabel: row.location_label,
    revealedAt: row.revealed_at,
  };
}

function toScore(row: {
  game_id: string;
  round_id: string;
  participant_id: string;
  distance_km: number | null;
  scored: boolean;
}) {
  return {
    gameId: row.game_id,
    roundId: row.round_id,
    participantId: row.participant_id,
    distanceKm: row.distance_km,
    scored: row.scored,
  };
}

serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse !== null) {
    return optionsResponse;
  }

  try {
    const adminClient = createAdminClient();
    const body = await readJsonObject(request);
    const gameId = requireString(body, "gameId");
    const playerSessionToken = requireString(body, "playerSessionToken");
    const participant = await getParticipantBySession(
      adminClient,
      gameId,
      playerSessionToken,
    );

    const [gameResult, membersResult, roundsResult, guessesResult, revealsResult, scoresResult, participantsResult] =
      await Promise.all([
        adminClient
          .from("games")
          .select("id,title,phase,current_round_id,created_at")
          .eq("id", gameId)
          .single(),
        adminClient
          .from("team_members")
          .select("id,game_id,display_name,sort_order")
          .eq("game_id", gameId)
          .order("sort_order", { ascending: true }),
        adminClient
          .from("rounds")
          .select("id,game_id,subject_member_id,photo_object_key,display_order")
          .eq("game_id", gameId)
          .order("display_order", { ascending: true }),
        adminClient
          .from("guesses")
          .select("*")
          .eq("game_id", gameId)
          .eq("participant_id", participant.id),
        adminClient.from("round_reveals").select("*").eq("game_id", gameId),
        adminClient.from("round_scores").select("*").eq("game_id", gameId),
        adminClient.from("participants").select("*").eq("game_id", gameId),
      ]);

    if (gameResult.error !== null) {
      throw gameResult.error;
    }
    if (membersResult.error !== null) {
      throw membersResult.error;
    }
    if (roundsResult.error !== null) {
      throw roundsResult.error;
    }
    if (guessesResult.error !== null) {
      throw guessesResult.error;
    }
    if (revealsResult.error !== null) {
      throw revealsResult.error;
    }
    if (scoresResult.error !== null) {
      throw scoresResult.error;
    }
    if (participantsResult.error !== null) {
      throw participantsResult.error;
    }

    return jsonResponse({
      game: toGameSummary(gameResult.data),
      members: (membersResult.data ?? []).map(toTeamMember),
      rounds: (roundsResult.data ?? []).map(toRound),
      participant: toParticipant(participant),
      ownGuesses: (guessesResult.data ?? []).map(toGuess),
      reveals: (revealsResult.data ?? []).map(toReveal),
      scores: (scoresResult.data ?? []).map(toScore),
      participants: (participantsResult.data ?? []).map(toParticipant),
    });
  } catch (error) {
    return errorResponse(error);
  }
});

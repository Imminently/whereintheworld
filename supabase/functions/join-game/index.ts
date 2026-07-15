import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts";
import {
  createPlayerSessionToken,
  hashGameCode,
  hashPlayerSessionToken,
} from "../_shared/crypto.ts";
import { assertValidCode, toGameSummary, toParticipant } from "../_shared/game.ts";
import { readJsonObject, requireString } from "../_shared/http.ts";
import { enforceRateLimit } from "../_shared/rate-limit.ts";
import { createAdminClient } from "../_shared/supabase.ts";

serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse !== null) {
    return optionsResponse;
  }

  try {
    const adminClient = createAdminClient();
    await enforceRateLimit(adminClient, request, "join-game", 15, 60);
    const body = await readJsonObject(request);
    const code = requireString(body, "code");
    const memberId = requireString(body, "memberId");
    assertValidCode(code);

    const { data: candidateGames, error: gamesError } = await adminClient
      .from("games")
      .select("id,title,phase,current_round_id,code_hash,code_salt,created_at")
      .eq("phase", "lobby")
      .order("created_at", { ascending: false })
      .limit(50);

    if (gamesError !== null) {
      throw gamesError;
    }

    let matchedGame: {
      id: string;
      title: string;
      phase: string;
      current_round_id: string | null;
      created_at: string;
      code_hash: string;
      code_salt: string;
    } | null = null;

    for (const game of candidateGames ?? []) {
      const candidateHash = await hashGameCode(code, game.code_salt);
      if (candidateHash === game.code_hash) {
        matchedGame = game;
        break;
      }
    }

    if (matchedGame === null) {
      throw new Error("No open lobby matches that code.");
    }

    const { data: member, error: memberError } = await adminClient
      .from("team_members")
      .select("id,game_id,display_name")
      .eq("id", memberId)
      .eq("game_id", matchedGame.id)
      .single();

    if (memberError !== null) {
      throw new Error("That team member is not part of this game.");
    }

    const { data: existingClaim, error: existingClaimError } = await adminClient
      .from("participants")
      .select("id")
      .eq("game_id", matchedGame.id)
      .eq("team_member_id", member.id)
      .maybeSingle();

    if (existingClaimError !== null) {
      throw existingClaimError;
    }

    if (existingClaim !== null) {
      throw new Error("That name has already been claimed.");
    }

    const playerSessionToken = createPlayerSessionToken();
    const sessionTokenHash = await hashPlayerSessionToken(playerSessionToken);
    const { data: participant, error: participantError } = await adminClient
      .from("participants")
      .insert({
        game_id: matchedGame.id,
        user_id: null,
        team_member_id: member.id,
        display_name: member.display_name,
        session_token_hash: sessionTokenHash,
      })
      .select("*")
      .single();

    if (participantError !== null) {
      throw new Error("That name has already been claimed.");
    }

    await adminClient.rpc("broadcast_game_event", {
      p_game_id: matchedGame.id,
      p_event: "player_joined",
      p_payload: { participantId: participant.id },
    });

    return jsonResponse({
      game: toGameSummary(matchedGame),
      participant: toParticipant(participant),
      playerSessionToken,
    });
  } catch (error) {
    return errorResponse(error);
  }
});

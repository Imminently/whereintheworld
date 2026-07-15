import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { hashGameCode } from "../_shared/crypto.ts";
import { assertValidCode, toTeamMember } from "../_shared/game.ts";
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
    await enforceRateLimit(adminClient, request, "lookup-game", 20, 60);
    const body = await readJsonObject(request);
    const code = requireString(body, "code");
    assertValidCode(code);

    const { data: candidateGames, error: gamesError } = await adminClient
      .from("games")
      .select("id,title,phase,code_hash,code_salt,created_at")
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

    const [membersResult, participantsResult] = await Promise.all([
      adminClient
        .from("team_members")
        .select("id,game_id,display_name,sort_order")
        .eq("game_id", matchedGame.id)
        .order("sort_order", { ascending: true }),
      adminClient
        .from("participants")
        .select("team_member_id")
        .eq("game_id", matchedGame.id),
    ]);

    if (membersResult.error !== null) {
      throw membersResult.error;
    }
    if (participantsResult.error !== null) {
      throw participantsResult.error;
    }

    return jsonResponse({
      gameId: matchedGame.id,
      title: matchedGame.title,
      phase: matchedGame.phase,
      members: (membersResult.data ?? []).map(toTeamMember),
      claimedMemberIds: (participantsResult.data ?? []).map(
        (participant: { team_member_id: string }) => participant.team_member_id,
      ),
    });
  } catch (error) {
    return errorResponse(error);
  }
});

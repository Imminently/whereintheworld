import { z } from "zod";
import {
  createCodeSalt,
  hashGameCode,
  recoverGameCode,
} from "./gameLogic";
import { assertLiveGameCode } from "./gameCode";
import { isValidGuess } from "./mapLogic";
import {
  getCurrentUser,
  getSupabaseClient,
  isHostUser,
} from "./supabase";
import type { Database } from "./database.types";
import type {
  Coordinates,
  GameSummary,
  Guess,
  HostCommandResult,
  HostGameState,
  JoinedGameResult,
  LookupGameResult,
  Participant,
  PhotoUrlResult,
  PlayerGameState,
  Round,
  RoundAnswer,
  RoundReveal,
  RoundScore,
  TeamMember,
} from "../types";

type GameRow = Database["public"]["Tables"]["games"]["Row"];
type TeamMemberRow = Database["public"]["Tables"]["team_members"]["Row"];
type RoundRow = Database["public"]["Tables"]["rounds"]["Row"];
type RoundAnswerRow = Database["public"]["Tables"]["round_answers"]["Row"];
type ParticipantRow = Database["public"]["Tables"]["participants"]["Row"];
type GuessRow = Database["public"]["Tables"]["guesses"]["Row"];
type RoundRevealRow = Database["public"]["Tables"]["round_reveals"]["Row"];
type RoundScoreRow = Database["public"]["Tables"]["round_scores"]["Row"];

const gamePhaseSchema = z.union([
  z.literal("setup"),
  z.literal("lobby"),
  z.literal("guessing"),
  z.literal("revealed"),
  z.literal("finished"),
]);

const teamMemberSchema = z.object({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
  displayName: z.string(),
  sortOrder: z.number(),
});

const gameSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  phase: gamePhaseSchema,
  currentRoundId: z.string().uuid().nullable(),
  createdAt: z.string(),
});

const participantSchema = z.object({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  teamMemberId: z.string().uuid(),
  displayName: z.string(),
  joinedAt: z.string(),
});

const lookupGameSchema = z.object({
  gameId: z.string().uuid(),
  title: z.string(),
  phase: gamePhaseSchema,
  members: z.array(teamMemberSchema),
  claimedMemberIds: z.array(z.string().uuid()),
});

const joinedGameSchema = z.object({
  game: gameSummarySchema,
  participant: participantSchema,
  playerSessionToken: z.string().min(32),
});

const hostCommandSchema = z.object({
  game: gameSummarySchema,
});

const photoUrlSchema = z.object({
  signedUrl: z.string().url(),
  expiresInSeconds: z.number().int().positive(),
});

const roundSchema = z.object({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
  subjectMemberId: z.string().uuid(),
  photoObjectKey: z.string().nullable(),
  displayOrder: z.number(),
});

const guessSchema = z.object({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
  roundId: z.string().uuid(),
  participantId: z.string().uuid(),
  latitude: z.number(),
  longitude: z.number(),
  submittedAt: z.string(),
});

const revealSchema = z.object({
  gameId: z.string().uuid(),
  roundId: z.string().uuid(),
  latitude: z.number(),
  longitude: z.number(),
  locationLabel: z.string(),
  revealedAt: z.string(),
});

const scoreSchema = z.object({
  gameId: z.string().uuid(),
  roundId: z.string().uuid(),
  participantId: z.string().uuid(),
  distanceKm: z.number().nullable(),
  scored: z.boolean(),
});

const playerGameStateSchema = z.object({
  game: gameSummarySchema,
  members: z.array(teamMemberSchema),
  rounds: z.array(roundSchema),
  participant: participantSchema,
  ownGuesses: z.array(guessSchema),
  reveals: z.array(revealSchema),
  scores: z.array(scoreSchema),
  participants: z.array(participantSchema),
});

export type HostCommand =
  | "start_lobby"
  | "start_round"
  | "reveal_round"
  | "finish_game"
  | "reset_setup"
  | "reset_game";

export interface NewGameInput {
  title: string;
  code: string;
}

export interface NewRoundInput {
  gameId: string;
  displayName: string;
  locationLabel: string;
  answer: Coordinates;
  photo: File;
}

function requireSupabaseClient(): NonNullable<ReturnType<typeof getSupabaseClient>> {
  const client = getSupabaseClient();
  if (client === null) {
    throw new Error("Supabase is not configured. Add values from .env.example.");
  }

  return client;
}

async function requireHostUser(): Promise<string> {
  const user = await getCurrentUser();
  if (!isHostUser(user)) {
    throw new Error("Sign in with a host account before managing games.");
  }

  return user.id;
}

function mapGameSummary(row: Pick<GameRow, "id" | "title" | "phase" | "current_round_id" | "created_at">): GameSummary {
  return {
    id: row.id,
    title: row.title,
    phase: row.phase,
    currentRoundId: row.current_round_id,
    createdAt: row.created_at,
  };
}

function mapTeamMember(row: TeamMemberRow): TeamMember {
  return {
    id: row.id,
    gameId: row.game_id,
    displayName: row.display_name,
    sortOrder: row.sort_order,
  };
}

function mapRound(row: RoundRow): Round {
  return {
    id: row.id,
    gameId: row.game_id,
    subjectMemberId: row.subject_member_id,
    photoObjectKey: row.photo_object_key,
    displayOrder: row.display_order,
  };
}

function mapRoundAnswer(row: RoundAnswerRow): RoundAnswer {
  return {
    roundId: row.round_id,
    latitude: row.latitude,
    longitude: row.longitude,
    locationLabel: row.location_label,
  };
}

function mapParticipant(row: ParticipantRow): Participant {
  return {
    id: row.id,
    gameId: row.game_id,
    userId: row.user_id,
    teamMemberId: row.team_member_id,
    displayName: row.display_name,
    joinedAt: row.joined_at,
  };
}

function mapGuess(row: GuessRow): Guess {
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

function mapReveal(row: RoundRevealRow): RoundReveal {
  return {
    gameId: row.game_id,
    roundId: row.round_id,
    latitude: row.latitude,
    longitude: row.longitude,
    locationLabel: row.location_label,
    revealedAt: row.revealed_at,
  };
}

function mapRoundScore(row: RoundScoreRow): RoundScore {
  return {
    gameId: row.game_id,
    roundId: row.round_id,
    participantId: row.participant_id,
    distanceKm: row.distance_km,
    scored: row.scored,
  };
}

async function invokeEdgeFunction<T>(
  functionName: string,
  body: Record<string, unknown>,
  schema: z.ZodType<T>,
): Promise<T> {
  const client = requireSupabaseClient();
  const result = await client.functions.invoke<unknown>(functionName, { body });

  if (result.error !== null) {
    throw result.error;
  }

  return schema.parse(result.data);
}

/** Creates a game owned by the signed-in host account. */
export async function createGame(input: NewGameInput): Promise<GameSummary> {
  const code = input.code.trim();
  assertLiveGameCode(code);
  const client = requireSupabaseClient();
  const hostUserId = await requireHostUser();

  const codeSalt = createCodeSalt();
  const codeHash = await hashGameCode(code, codeSalt);
  const insertResult = await client
    .from("games")
    .insert({
      title: input.title.trim(),
      code_hash: codeHash,
      code_salt: codeSalt,
      host_user_id: hostUserId,
      phase: "setup",
    })
    .select("id,title,phase,current_round_id,created_at")
    .single();

  if (insertResult.error !== null) {
    throw insertResult.error;
  }

  return mapGameSummary(insertResult.data);
}

/** Fetches games owned by the current signed-in host user. */
export async function fetchHostGames(): Promise<GameSummary[]> {
  const client = requireSupabaseClient();
  const hostUserId = await requireHostUser();
  const result = await client
    .from("games")
    .select("id,title,phase,current_round_id,created_at")
    .eq("host_user_id", hostUserId)
    .order("created_at", { ascending: false });

  if (result.error !== null) {
    throw result.error;
  }

  return result.data.map(mapGameSummary);
}

/** Recovers the selected game's join code for its authenticated host owner. */
export async function fetchHostGameCode(gameId: string): Promise<string> {
  const client = requireSupabaseClient();
  const hostUserId = await requireHostUser();
  const result = await client
    .from("games")
    .select("code_hash,code_salt")
    .eq("id", gameId)
    .eq("host_user_id", hostUserId)
    .single();

  if (result.error !== null) {
    throw result.error;
  }

  const recoveredCode = await recoverGameCode(result.data.code_hash, result.data.code_salt);
  if (recoveredCode === null) {
    throw new Error("The current game code could not be recovered.");
  }

  return recoveredCode;
}

/** Fetches all host-readable state for the selected game. */
export async function fetchHostGameState(gameId: string): Promise<HostGameState> {
  const client = requireSupabaseClient();
  await requireHostUser();

  const [gameResult, membersResult, roundsResult, participantsResult, guessesResult, revealsResult, scoresResult] =
    await Promise.all([
      client
        .from("games")
        .select("id,title,phase,current_round_id,created_at")
        .eq("id", gameId)
        .single(),
      client
        .from("team_members")
        .select("*")
        .eq("game_id", gameId)
        .order("sort_order", { ascending: true }),
      client
        .from("rounds")
        .select("*")
        .eq("game_id", gameId)
        .order("display_order", { ascending: true }),
      client
        .from("participants")
        .select("*")
        .eq("game_id", gameId)
        .order("joined_at", { ascending: true }),
      client.from("guesses").select("*").eq("game_id", gameId),
      client.from("round_reveals").select("*").eq("game_id", gameId),
      client.from("round_scores").select("*").eq("game_id", gameId),
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
  if (participantsResult.error !== null) {
    throw participantsResult.error;
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

  return {
    game: mapGameSummary(gameResult.data),
    members: membersResult.data.map(mapTeamMember),
    rounds: roundsResult.data.map(mapRound),
    participants: participantsResult.data.map(mapParticipant),
    guesses: guessesResult.data.map(mapGuess),
    reveals: revealsResult.data.map(mapReveal),
    scores: scoresResult.data.map(mapRoundScore),
  };
}

/** Adds a team member round, private photo object, and private answer record. */
export async function addRoundWithPhoto(input: NewRoundInput): Promise<Round> {
  if (!isValidGuess(input.answer)) {
    throw new Error("The selected answer coordinates are outside valid bounds.");
  }

  const client = requireSupabaseClient();
  await requireHostUser();

  const existingRounds = await client
    .from("rounds")
    .select("id")
    .eq("game_id", input.gameId);

  if (existingRounds.error !== null) {
    throw existingRounds.error;
  }

  const displayOrder = existingRounds.data.length + 1;
  const memberResult = await client
    .from("team_members")
    .insert({
      game_id: input.gameId,
      display_name: input.displayName.trim(),
      sort_order: displayOrder,
    })
    .select("*")
    .single();

  if (memberResult.error !== null) {
    throw memberResult.error;
  }

  const roundResult = await client
    .from("rounds")
    .insert({
      game_id: input.gameId,
      subject_member_id: memberResult.data.id,
      display_order: displayOrder,
      photo_object_key: null,
    })
    .select("*")
    .single();

  if (roundResult.error !== null) {
    throw roundResult.error;
  }

  const extension = input.photo.name.split(".").at(-1)?.toLowerCase() ?? "jpg";
  const objectKey = `games/${input.gameId}/rounds/${roundResult.data.id}/${crypto.randomUUID()}.${extension}`;
  const uploadResult = await client.storage
    .from("game-photos")
    .upload(objectKey, input.photo, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadResult.error !== null) {
    throw uploadResult.error;
  }

  const [updateRoundResult, answerResult] = await Promise.all([
    client
      .from("rounds")
      .update({ photo_object_key: objectKey })
      .eq("id", roundResult.data.id)
      .select("*")
      .single(),
    client.from("round_answers").insert({
      round_id: roundResult.data.id,
      latitude: input.answer.latitude,
      longitude: input.answer.longitude,
      location_label: input.locationLabel.trim(),
    }),
  ]);

  if (updateRoundResult.error !== null) {
    throw updateRoundResult.error;
  }
  if (answerResult.error !== null) {
    throw answerResult.error;
  }

  return mapRound(updateRoundResult.data);
}

/** Fetches host-readable answers for setup review without exposing them to players. */
export async function fetchHostAnswers(gameId: string): Promise<RoundAnswer[]> {
  const client = requireSupabaseClient();
  await requireHostUser();
  const roundsResult = await client
    .from("rounds")
    .select("id")
    .eq("game_id", gameId);

  if (roundsResult.error !== null) {
    throw roundsResult.error;
  }

  const roundIds = roundsResult.data.map((round) => round.id);
  if (roundIds.length === 0) {
    return [];
  }

  const answersResult = await client
    .from("round_answers")
    .select("*")
    .in("round_id", roundIds);

  if (answersResult.error !== null) {
    throw answersResult.error;
  }

  return answersResult.data.map(mapRoundAnswer);
}

/** Looks up a game and roster after a player supplies the four-digit code. */
export async function lookupGame(code: string): Promise<LookupGameResult> {
  return invokeEdgeFunction("lookup-game", { code }, lookupGameSchema);
}

/** Claims a team member name and returns an opaque player session token. */
export async function joinGame(
  code: string,
  memberId: string,
): Promise<JoinedGameResult> {
  return invokeEdgeFunction("join-game", { code, memberId }, joinedGameSchema);
}

/** Fetches the current player's readable game state. */
export async function fetchPlayerGameState(
  gameId: string,
  playerSessionToken: string,
): Promise<PlayerGameState> {
  return invokeEdgeFunction(
    "get-player-state",
    { gameId, playerSessionToken },
    playerGameStateSchema,
  );
}

/** Submits or replaces a player's current-round guess through server-side validation. */
export async function submitGuess(
  gameId: string,
  roundId: string,
  playerSessionToken: string,
  coordinates: Coordinates,
): Promise<void> {
  if (!isValidGuess(coordinates)) {
    throw new Error("Select a valid point on the world map before submitting.");
  }

  await invokeEdgeFunction(
    "submit-guess",
    {
      gameId,
      roundId,
      playerSessionToken,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    },
    z.object({ ok: z.literal(true) }),
  );
}

/** Runs a host command such as start, reveal, next round, finish, or reset. */
export async function runHostCommand(
  gameId: string,
  command: HostCommand,
  roundId?: string,
): Promise<HostCommandResult> {
  const hostUserId = await requireHostUser();
  const client = requireSupabaseClient();

  if (command === "start_lobby") {
    const result = await client
      .from("games")
      .update({ phase: "lobby", current_round_id: null })
      .eq("id", gameId)
      .eq("host_user_id", hostUserId)
      .select("id,title,phase,current_round_id,created_at")
      .single();

    if (result.error !== null) {
      throw result.error;
    }

    await client.rpc("broadcast_game_event", {
      p_game_id: gameId,
      p_event: "lobby_started",
      p_payload: { command },
    });

    return {
      game: mapGameSummary(result.data),
    };
  }

  return invokeEdgeFunction(
    "host-command",
    { gameId, command, roundId },
    hostCommandSchema,
  );
}

/** Requests a short-lived signed URL for the current or revealed round photo. */
export async function getRoundPhotoUrl(
  gameId: string,
  roundId: string,
  playerSessionToken?: string,
): Promise<PhotoUrlResult> {
  return invokeEdgeFunction(
    "get-round-photo",
    { gameId, roundId, playerSessionToken },
    photoUrlSchema,
  );
}

/** Deletes a host-owned game and associated private photo objects. */
export async function cleanupGame(gameId: string): Promise<void> {
  await requireHostUser();
  await invokeEdgeFunction(
    "cleanup-game",
    { gameId },
    z.object({ ok: z.literal(true) }),
  );
}

import { haversineDistanceKm } from "./gameLogic";
import type {
  Coordinates,
  Guess,
  JoinedGameResult,
  LookupGameResult,
  Participant,
  PlayerGameState,
  Round,
  RoundAnswer,
  RoundScore,
  TeamMember,
} from "../types";

const MOCK_GAME_ID = "00000000-0000-4000-8000-000000005635";
const MOCK_CREATED_AT = "2026-07-14T00:00:00.000Z";
const MOCK_SESSION_TOKEN = "local-mock-session-token-never-sent-to-server";

const MOCK_MEMBERS: TeamMember[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    gameId: MOCK_GAME_ID,
    displayName: "Jordan Kim",
    sortOrder: 0,
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    gameId: MOCK_GAME_ID,
    displayName: "Mei Lin",
    sortOrder: 1,
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    gameId: MOCK_GAME_ID,
    displayName: "Marcus Reed",
    sortOrder: 2,
  },
  {
    id: "00000000-0000-4000-8000-000000000004",
    gameId: MOCK_GAME_ID,
    displayName: "Sophie de Vries",
    sortOrder: 3,
  },
];

const MOCK_ROUNDS: Round[] = [
  {
    id: "00000000-0000-4000-8000-000000000011",
    gameId: MOCK_GAME_ID,
    subjectMemberId: MOCK_MEMBERS[1].id,
    photoObjectKey: "mock/mei-taipei.webp",
    displayOrder: 0,
  },
  {
    id: "00000000-0000-4000-8000-000000000012",
    gameId: MOCK_GAME_ID,
    subjectMemberId: MOCK_MEMBERS[2].id,
    photoObjectKey: "mock/marcus-valparaiso.webp",
    displayOrder: 1,
  },
  {
    id: "00000000-0000-4000-8000-000000000013",
    gameId: MOCK_GAME_ID,
    subjectMemberId: MOCK_MEMBERS[3].id,
    photoObjectKey: "mock/sophie-amsterdam.webp",
    displayOrder: 2,
  },
];

const MOCK_ANSWERS: Record<string, RoundAnswer> = {
  [MOCK_ROUNDS[0].id]: {
    roundId: MOCK_ROUNDS[0].id,
    latitude: 25.033,
    longitude: 121.5654,
    locationLabel: "Taipei, Taiwan",
  },
  [MOCK_ROUNDS[1].id]: {
    roundId: MOCK_ROUNDS[1].id,
    latitude: -33.0472,
    longitude: -71.6127,
    locationLabel: "Valparaíso, Chile",
  },
  [MOCK_ROUNDS[2].id]: {
    roundId: MOCK_ROUNDS[2].id,
    latitude: 52.3676,
    longitude: 4.9041,
    locationLabel: "Amsterdam, Netherlands",
  },
};

const MOCK_PHOTO_URLS: Record<string, string> = {
  [MOCK_ROUNDS[0].id]: "/mock/mei-taipei.webp",
  [MOCK_ROUNDS[1].id]: "/mock/marcus-valparaiso.webp",
  [MOCK_ROUNDS[2].id]: "/mock/sophie-amsterdam.webp",
};

const SIMULATED_DISTANCES_KM = [
  [640, 185, 920, 430],
  [1110, 760, 240, 530],
  [390, 820, 610, 170],
] as const;

function createMockParticipants(): Participant[] {
  return MOCK_MEMBERS.map((member, index) => ({
    id: `00000000-0000-4000-8000-00000000002${index + 1}`,
    gameId: MOCK_GAME_ID,
    userId: null,
    teamMemberId: member.id,
    displayName: member.displayName,
    joinedAt: MOCK_CREATED_AT,
  }));
}

function getRoundIndex(roundId: string | null): number {
  return MOCK_ROUNDS.findIndex((round) => round.id === roundId);
}

function buildMockScore(
  state: PlayerGameState,
  round: Round,
  participant: Participant,
  roundIndex: number,
): RoundScore {
  const isRoundSubject = participant.teamMemberId === round.subjectMemberId;
  if (isRoundSubject) {
    return {
      gameId: MOCK_GAME_ID,
      roundId: round.id,
      participantId: participant.id,
      distanceKm: null,
      scored: false,
    };
  }

  if (participant.id === state.participant.id) {
    const guess = state.ownGuesses.find((candidate) => candidate.roundId === round.id);
    const answer = MOCK_ANSWERS[round.id];
    return {
      gameId: MOCK_GAME_ID,
      roundId: round.id,
      participantId: participant.id,
      distanceKm:
        guess === undefined || answer === undefined
          ? null
          : haversineDistanceKm(guess, answer),
      scored: guess !== undefined && answer !== undefined,
    };
  }

  const participantIndex = MOCK_MEMBERS.findIndex(
    (member) => member.id === participant.teamMemberId,
  );
  const simulatedDistance =
    SIMULATED_DISTANCES_KM[roundIndex]?.[participantIndex] ?? 1000;

  return {
    gameId: MOCK_GAME_ID,
    roundId: round.id,
    participantId: participant.id,
    distanceKm: simulatedDistance,
    scored: true,
  };
}

/** Returns the roster preview used when the reserved demo code is entered. */
export function createMockLookupResult(): LookupGameResult {
  return {
    gameId: MOCK_GAME_ID,
    title: "Imminently World Tour",
    phase: "lobby",
    members: MOCK_MEMBERS,
    claimedMemberIds: [],
  };
}

/** Creates a deterministic local player session for the selected fictional teammate. */
export function createMockPlayerSession(memberId: string): {
  joinedGame: JoinedGameResult;
  state: PlayerGameState;
} {
  const participants = createMockParticipants();
  const participant = participants.find((candidate) => candidate.teamMemberId === memberId);
  if (participant === undefined) {
    throw new Error("Select a demo teammate before joining.");
  }

  const game = {
    id: MOCK_GAME_ID,
    title: "Imminently World Tour",
    phase: "lobby" as const,
    currentRoundId: null,
    createdAt: MOCK_CREATED_AT,
  };

  return {
    joinedGame: {
      game,
      participant,
      playerSessionToken: MOCK_SESSION_TOKEN,
    },
    state: {
      game,
      members: MOCK_MEMBERS,
      rounds: MOCK_ROUNDS,
      participant,
      ownGuesses: [],
      reveals: [],
      scores: [],
      participants,
    },
  };
}

/** Returns the project-local fictional photo for a demo round. */
export function getMockPhotoUrl(roundId: string): string | null {
  return MOCK_PHOTO_URLS[roundId] ?? null;
}

/** Starts the first/next round, finishes the demo, or resets it based on phase. */
export function advanceMockGame(state: PlayerGameState): PlayerGameState {
  if (state.game.phase === "finished") {
    return createMockPlayerSession(state.participant.teamMemberId).state;
  }

  if (state.game.phase !== "lobby" && state.game.phase !== "revealed") {
    return state;
  }

  const currentRoundIndex = getRoundIndex(state.game.currentRoundId);
  const nextRound = MOCK_ROUNDS[currentRoundIndex + 1];
  if (nextRound === undefined) {
    return {
      ...state,
      game: { ...state.game, phase: "finished" },
    };
  }

  return {
    ...state,
    game: {
      ...state.game,
      phase: "guessing",
      currentRoundId: nextRound.id,
    },
  };
}

/** Stores or replaces the current player's guess entirely in browser memory. */
export function submitMockGuess(
  state: PlayerGameState,
  roundId: string,
  coordinates: Coordinates,
): PlayerGameState {
  const guess: Guess = {
    id: `mock-guess-${roundId}`,
    gameId: MOCK_GAME_ID,
    roundId,
    participantId: state.participant.id,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    submittedAt: MOCK_CREATED_AT,
  };

  return {
    ...state,
    ownGuesses: [
      ...state.ownGuesses.filter((candidate) => candidate.roundId !== roundId),
      guess,
    ],
  };
}

/** Reveals the active demo answer and creates deterministic player/competitor scores. */
export function revealMockRound(state: PlayerGameState): PlayerGameState {
  if (state.game.phase !== "guessing" || state.game.currentRoundId === null) {
    return state;
  }

  const roundIndex = getRoundIndex(state.game.currentRoundId);
  const round = MOCK_ROUNDS[roundIndex];
  const answer = MOCK_ANSWERS[state.game.currentRoundId];
  if (round === undefined || answer === undefined) {
    return state;
  }

  const scores = state.participants.map((participant) =>
    buildMockScore(state, round, participant, roundIndex),
  );

  return {
    ...state,
    game: { ...state.game, phase: "revealed" },
    reveals: [
      ...state.reveals.filter((reveal) => reveal.roundId !== round.id),
      {
        gameId: MOCK_GAME_ID,
        roundId: round.id,
        latitude: answer.latitude,
        longitude: answer.longitude,
        locationLabel: answer.locationLabel,
        revealedAt: MOCK_CREATED_AT,
      },
    ],
    scores: [
      ...state.scores.filter((score) => score.roundId !== round.id),
      ...scores,
    ],
  };
}

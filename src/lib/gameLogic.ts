import type {
  Coordinates,
  GamePhase,
  GameSummary,
  Guess,
  LeaderboardEntry,
  Participant,
  Round,
  RoundScore,
} from "../types";

const EARTH_RADIUS_KM = 6371.0088;
const DEGREES_TO_RADIANS = Math.PI / 180;
const CODE_HASH_SEPARATOR = ":";
const GAME_CODE_SPACE_SIZE = 10_000;
const GAME_CODE_HASH_BATCH_SIZE = 250;
const GAME_CODE_LENGTH = 4;

export interface CalculatedRoundScore {
  participantId: string;
  distanceKm: number | null;
  scored: boolean;
}

/** Computes the great-circle distance between two coordinates in kilometers. */
export function haversineDistanceKm(
  firstCoordinate: Coordinates,
  secondCoordinate: Coordinates,
): number {
  const latitudeDelta =
    (secondCoordinate.latitude - firstCoordinate.latitude) * DEGREES_TO_RADIANS;
  const longitudeDelta =
    (secondCoordinate.longitude - firstCoordinate.longitude) * DEGREES_TO_RADIANS;
  const firstLatitudeRadians = firstCoordinate.latitude * DEGREES_TO_RADIANS;
  const secondLatitudeRadians = secondCoordinate.latitude * DEGREES_TO_RADIANS;

  const halfChordLength =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitudeRadians) *
      Math.cos(secondLatitudeRadians) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    2 *
    EARTH_RADIUS_KM *
    Math.atan2(Math.sqrt(halfChordLength), Math.sqrt(1 - halfChordLength))
  );
}

/** Calculates scores for every eligible participant in a revealed round. */
export function calculateRoundScores(
  participants: Participant[],
  guesses: Guess[],
  answer: Coordinates,
  subjectMemberId: string,
): CalculatedRoundScore[] {
  return participants
    .filter((participant) => participant.teamMemberId !== subjectMemberId)
    .map((participant) => {
      const guess = guesses.find(
        (candidateGuess) => candidateGuess.participantId === participant.id,
      );

      if (guess === undefined) {
        return {
          participantId: participant.id,
          distanceKm: null,
          scored: false,
        };
      }

      return {
        participantId: participant.id,
        distanceKm: haversineDistanceKm(guess, answer),
        scored: true,
      };
    });
}

/** Builds a ranked cumulative leaderboard from participants and round scores. */
export function buildLeaderboard(
  participants: Participant[],
  scores: RoundScore[],
): LeaderboardEntry[] {
  const entries = participants.map((participant) => {
    const participantScores = scores.filter(
      (score) => score.participantId === participant.id && score.scored,
    );
    const totalDistanceKm = participantScores.reduce(
      (total, score) => total + (score.distanceKm ?? 0),
      0,
    );

    return {
      participantId: participant.id,
      displayName: participant.displayName,
      totalDistanceKm,
      roundsScored: participantScores.length,
      rank: 1,
    };
  });

  const sortedEntries = entries.sort((firstEntry, secondEntry) => {
    if (firstEntry.roundsScored !== secondEntry.roundsScored) {
      return secondEntry.roundsScored - firstEntry.roundsScored;
    }

    return firstEntry.totalDistanceKm - secondEntry.totalDistanceKm;
  });

  let previousDistance: number | null = null;
  let previousRounds: number | null = null;
  let currentRank = 0;

  return sortedEntries.map((entry, index) => {
    const isTie =
      previousDistance === entry.totalDistanceKm &&
      previousRounds === entry.roundsScored;
    currentRank = isTie ? currentRank : index + 1;
    previousDistance = entry.totalDistanceKm;
    previousRounds = entry.roundsScored;

    return {
      ...entry,
      rank: currentRank,
    };
  });
}

/** Returns the winning participants once the game is finished. */
export function determineWinners(
  leaderboardEntries: LeaderboardEntry[],
): LeaderboardEntry[] {
  const eligibleEntries = leaderboardEntries.filter(
    (entry) => entry.roundsScored > 0,
  );
  const winningDistance = eligibleEntries.at(0)?.totalDistanceKm;

  if (winningDistance === undefined) {
    return [];
  }

  return eligibleEntries.filter(
    (entry) => entry.totalDistanceKm === winningDistance,
  );
}

/** Returns true when a participant may submit a guess for the current round. */
export function canParticipantGuess(
  game: GameSummary,
  round: Round | undefined,
  participant: Participant,
): boolean {
  return (
    game.phase === "guessing" &&
    round !== undefined &&
    game.currentRoundId === round.id &&
    round.subjectMemberId !== participant.teamMemberId
  );
}

/** Returns the next phase for host commands that progress the game linearly. */
export function getNextRoundPhase(currentPhase: GamePhase): GamePhase {
  if (currentPhase === "setup") {
    return "lobby";
  }

  if (currentPhase === "lobby" || currentPhase === "revealed") {
    return "guessing";
  }

  if (currentPhase === "guessing") {
    return "revealed";
  }

  return "finished";
}

/** Creates a random salt suitable for hashing a casual four-digit game code. */
export function createCodeSalt(): string {
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

/** Hashes the game code before storage so the four-digit value is not persisted directly. */
export async function hashGameCode(code: string, salt: string): Promise<string> {
  const normalizedCode = code.trim();
  const encodedCode = new TextEncoder().encode(
    `${salt}${CODE_HASH_SEPARATOR}${normalizedCode}`,
  );
  const digest = await crypto.subtle.digest("SHA-256", encodedCode);

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/** Recovers a host-owned four-digit code from its salted hash without persisting plaintext. */
export async function recoverGameCode(
  codeHash: string,
  salt: string,
): Promise<string | null> {
  for (
    let batchStart = 0;
    batchStart < GAME_CODE_SPACE_SIZE;
    batchStart += GAME_CODE_HASH_BATCH_SIZE
  ) {
    const batchEnd = Math.min(
      batchStart + GAME_CODE_HASH_BATCH_SIZE,
      GAME_CODE_SPACE_SIZE,
    );
    const candidates = Array.from(
      { length: batchEnd - batchStart },
      (_, index) => String(batchStart + index).padStart(GAME_CODE_LENGTH, "0"),
    );
    const hashes = await Promise.all(
      candidates.map((candidate) => hashGameCode(candidate, salt)),
    );
    const matchingIndex = hashes.findIndex((candidateHash) => candidateHash === codeHash);

    if (matchingIndex >= 0) {
      return candidates[matchingIndex] ?? null;
    }
  }

  return null;
}

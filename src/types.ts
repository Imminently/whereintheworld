export const GAME_PHASES = [
  "setup",
  "lobby",
  "guessing",
  "revealed",
  "finished",
] as const;

export type GamePhase = (typeof GAME_PHASES)[number];

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GameSummary {
  id: string;
  title: string;
  phase: GamePhase;
  currentRoundId: string | null;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  gameId: string;
  displayName: string;
  sortOrder: number;
}

export interface Round {
  id: string;
  gameId: string;
  subjectMemberId: string;
  photoObjectKey: string | null;
  displayOrder: number;
}

export interface RoundAnswer extends Coordinates {
  roundId: string;
  locationLabel: string;
}

export interface Participant {
  id: string;
  gameId: string;
  userId: string | null;
  teamMemberId: string;
  displayName: string;
  joinedAt: string;
}

export interface Guess extends Coordinates {
  id: string;
  gameId: string;
  roundId: string;
  participantId: string;
  submittedAt: string;
}

export interface RoundReveal extends Coordinates {
  gameId: string;
  roundId: string;
  locationLabel: string;
  revealedAt: string;
}

export interface RoundScore {
  gameId: string;
  roundId: string;
  participantId: string;
  distanceKm: number | null;
  scored: boolean;
}

export interface LeaderboardEntry {
  participantId: string;
  displayName: string;
  totalDistanceKm: number;
  roundsScored: number;
  rank: number;
}

export interface HostGameState {
  game: GameSummary;
  members: TeamMember[];
  rounds: Round[];
  participants: Participant[];
  guesses: Guess[];
  reveals: RoundReveal[];
  scores: RoundScore[];
}

export interface PlayerGameState {
  game: GameSummary;
  members: TeamMember[];
  rounds: Round[];
  participant: Participant;
  ownGuesses: Guess[];
  reveals: RoundReveal[];
  scores: RoundScore[];
  participants: Participant[];
}

export interface LookupGameResult {
  gameId: string;
  title: string;
  phase: GamePhase;
  members: TeamMember[];
  claimedMemberIds: string[];
}

export interface JoinedGameResult {
  game: GameSummary;
  participant: Participant;
  playerSessionToken: string;
}

export interface HostCommandResult {
  game: GameSummary;
}

export interface PhotoUrlResult {
  signedUrl: string;
  expiresInSeconds: number;
}

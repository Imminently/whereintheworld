import { describe, expect, it } from "vitest";
import {
  buildLeaderboard,
  calculateRoundScores,
  canParticipantGuess,
  determineWinners,
  getNextRoundPhase,
  hashGameCode,
  haversineDistanceKm,
  recoverGameCode,
} from "./gameLogic";
import type { GameSummary, Guess, Participant, Round, RoundScore } from "../types";

const london = { latitude: 51.5074, longitude: -0.1278 };
const newYork = { latitude: 40.7128, longitude: -74.006 };

function participant(
  id: string,
  teamMemberId: string,
  displayName: string,
): Participant {
  return {
    id,
    gameId: "game-1",
    userId: `00000000-0000-4000-8000-00000000000${id.at(-1) ?? "0"}`,
    teamMemberId,
    displayName,
    joinedAt: "2026-06-29T00:00:00.000Z",
  };
}

function score(
  participantId: string,
  distanceKm: number | null,
  scored: boolean,
): RoundScore {
  return {
    gameId: "game-1",
    roundId: "round-1",
    participantId,
    distanceKm,
    scored,
  };
}

describe("haversineDistanceKm", () => {
  it("calculates the approximate distance between London and New York", () => {
    expect(haversineDistanceKm(london, newYork)).toBeCloseTo(5570, -1);
  });
});

describe("calculateRoundScores", () => {
  it("skips the teammate who is the subject of the round", () => {
    const participants = [
      participant("participant-1", "member-1", "Alex"),
      participant("participant-2", "member-2", "Blair"),
    ];
    const guesses: Guess[] = [
      {
        id: "guess-1",
        gameId: "game-1",
        roundId: "round-1",
        participantId: "participant-2",
        latitude: london.latitude,
        longitude: london.longitude,
        submittedAt: "2026-06-29T00:00:00.000Z",
      },
    ];

    const scores = calculateRoundScores(participants, guesses, london, "member-1");

    expect(scores).toEqual([
      {
        participantId: "participant-2",
        distanceKm: 0,
        scored: true,
      },
    ]);
  });

  it("records an unscored row when an eligible participant misses a round", () => {
    const participants = [participant("participant-2", "member-2", "Blair")];

    expect(calculateRoundScores(participants, [], london, "member-1")).toEqual([
      {
        participantId: "participant-2",
        distanceKm: null,
        scored: false,
      },
    ]);
  });
});

describe("buildLeaderboard", () => {
  it("ranks by scored rounds first and cumulative distance second", () => {
    const participants = [
      participant("participant-1", "member-1", "Alex"),
      participant("participant-2", "member-2", "Blair"),
      participant("participant-3", "member-3", "Casey"),
    ];
    const entries = buildLeaderboard(participants, [
      score("participant-1", 20, true),
      score("participant-2", 10, true),
      score("participant-3", null, false),
    ]);

    expect(entries.map((entry) => entry.displayName)).toEqual(["Blair", "Alex", "Casey"]);
    expect(entries.map((entry) => entry.rank)).toEqual([1, 2, 3]);
  });

  it("returns co-winners for equal final distances", () => {
    const participants = [
      participant("participant-1", "member-1", "Alex"),
      participant("participant-2", "member-2", "Blair"),
    ];
    const entries = buildLeaderboard(participants, [
      score("participant-1", 10, true),
      score("participant-2", 10, true),
    ]);

    expect(determineWinners(entries).map((entry) => entry.displayName)).toEqual([
      "Alex",
      "Blair",
    ]);
  });
});

describe("canParticipantGuess", () => {
  it("allows eligible players only during the active guessing round", () => {
    const game: GameSummary = {
      id: "game-1",
      title: "Game",
      phase: "guessing",
      currentRoundId: "round-1",
      createdAt: "2026-06-29T00:00:00.000Z",
    };
    const round: Round = {
      id: "round-1",
      gameId: "game-1",
      subjectMemberId: "member-1",
      photoObjectKey: null,
      displayOrder: 1,
    };

    expect(canParticipantGuess(game, round, participant("participant-2", "member-2", "Blair"))).toBe(true);
    expect(canParticipantGuess(game, round, participant("participant-1", "member-1", "Alex"))).toBe(false);
  });
});

describe("getNextRoundPhase", () => {
  it("progresses through the host-controlled phases", () => {
    expect(getNextRoundPhase("setup")).toBe("lobby");
    expect(getNextRoundPhase("lobby")).toBe("guessing");
    expect(getNextRoundPhase("guessing")).toBe("revealed");
    expect(getNextRoundPhase("revealed")).toBe("guessing");
    expect(getNextRoundPhase("finished")).toBe("finished");
  });
});

describe("hashGameCode", () => {
  it("is deterministic for the same code and salt", async () => {
    await expect(hashGameCode("1234", "salt")).resolves.toBe(
      await hashGameCode("1234", "salt"),
    );
  });

  it("changes when the salt changes", async () => {
    await expect(hashGameCode("1234", "salt-a")).resolves.not.toBe(
      await hashGameCode("1234", "salt-b"),
    );
  });
});

describe("recoverGameCode", () => {
  it("recovers a four-digit host code and preserves leading zeroes", async () => {
    const salt = "test-salt";
    const codeHash = await hashGameCode("0427", salt);

    await expect(recoverGameCode(codeHash, salt)).resolves.toBe("0427");
  });
});

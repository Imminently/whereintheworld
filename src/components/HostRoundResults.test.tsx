import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type {
  Guess,
  Participant,
  Round,
  RoundAnswer,
  RoundScore,
} from "../types";
import { HostRoundResults } from "./HostRoundResults";

const round: Round = {
  id: "round-current",
  gameId: "game-1",
  subjectMemberId: "member-subject",
  photoObjectKey: "games/game-1/round-current.jpg",
  displayOrder: 2,
};

const answer: RoundAnswer = {
  roundId: round.id,
  latitude: 51.5074,
  longitude: -0.1278,
  locationLabel: "London, UK",
};

function participant(id: string, teamMemberId: string, displayName: string): Participant {
  return {
    id,
    gameId: "game-1",
    userId: null,
    teamMemberId,
    displayName,
    joinedAt: "2026-07-14T00:00:00.000Z",
  };
}

function guess(id: string, participantId: string, latitude: number): Guess {
  return {
    id,
    gameId: "game-1",
    roundId: round.id,
    participantId,
    latitude,
    longitude: -0.2,
    submittedAt: "2026-07-14T00:01:00.000Z",
  };
}

function score(participantId: string, distanceKm: number | null, scored: boolean): RoundScore {
  return {
    gameId: "game-1",
    roundId: round.id,
    participantId,
    distanceKm,
    scored,
  };
}

const participants = [
  participant("participant-subject", "member-subject", "Avery"),
  participant("participant-far", "member-far", "Blair"),
  participant("participant-close", "member-close", "Casey"),
  participant("participant-missing", "member-missing", "Devon"),
];

describe("HostRoundResults", () => {
  it("ranks current-round answers by distance and explains every player state", () => {
    render(
      <HostRoundResults
        round={round}
        answer={answer}
        participants={participants}
        guesses={[
          guess("guess-far", "participant-far", 50),
          guess("guess-close", "participant-close", 51.5),
        ]}
        scores={[
          score("participant-far", 125, true),
          score("participant-close", 4.5, true),
          score("participant-missing", null, false),
        ]}
      />,
    );

    expect(screen.getByText("Closest to London, UK")).toBeInTheDocument();
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(4);
    expect(within(rows[0]).getByText("Casey")).toBeInTheDocument();
    expect(within(rows[0]).getByText("4.50 km")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Closest")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Guess: 51.5000, -0.2000")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Blair")).toBeInTheDocument();
    expect(within(rows[1]).getByText("125 km")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Devon")).toBeInTheDocument();
    expect(within(rows[2]).getByText("No answer")).toBeInTheDocument();
    expect(within(rows[3]).getByText("Avery")).toBeInTheDocument();
    expect(within(rows[3]).getByText("Round subject")).toBeInTheDocument();
  });

  it("shares ranks when two guesses have the same distance", () => {
    render(
      <HostRoundResults
        round={round}
        answer={answer}
        participants={participants.slice(1, 3)}
        guesses={[
          guess("guess-far", "participant-far", 50),
          guess("guess-close", "participant-close", 51.5),
        ]}
        scores={[
          score("participant-far", 12, true),
          score("participant-close", 12, true),
        ]}
      />,
    );

    const ranks = screen.getAllByText("1");
    expect(ranks).toHaveLength(2);
  });
});

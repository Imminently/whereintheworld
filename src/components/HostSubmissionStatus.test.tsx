import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Guess, Participant, Round } from "../types";
import { HostSubmissionStatus } from "./HostSubmissionStatus";

const round: Round = {
  id: "round-current",
  gameId: "game-1",
  subjectMemberId: "member-subject",
  photoObjectKey: "games/game-1/round-current.jpg",
  displayOrder: 1,
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

function guess(id: string, roundId: string, participantId: string): Guess {
  return {
    id,
    gameId: "game-1",
    roundId,
    participantId,
    latitude: 25,
    longitude: 121,
    submittedAt: "2026-07-14T00:01:00.000Z",
  };
}

const participants = [
  participant("participant-subject", "member-subject", "Avery"),
  participant("participant-2", "member-2", "Blair"),
  participant("participant-3", "member-3", "Casey"),
];

describe("HostSubmissionStatus", () => {
  it("counts only eligible submissions from the active round", () => {
    render(
      <HostSubmissionStatus
        round={round}
        participants={participants}
        guesses={[
          guess("guess-current", round.id, "participant-2"),
          guess("guess-old", "round-previous", "participant-3"),
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "1 of 2" })).toBeInTheDocument();
    expect(screen.getByText("1 waiting")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");

    const averyRow = screen.getByText("Avery").closest("li");
    const blairRow = screen.getByText("Blair").closest("li");
    const caseyRow = screen.getByText("Casey").closest("li");
    expect(averyRow).not.toBeNull();
    expect(blairRow).not.toBeNull();
    expect(caseyRow).not.toBeNull();
    expect(within(averyRow as HTMLElement).getByText("Round subject")).toBeInTheDocument();
    expect(within(blairRow as HTMLElement).getByText("Locked in")).toBeInTheDocument();
    expect(within(caseyRow as HTMLElement).getByText("Waiting")).toBeInTheDocument();
  });

  it("tells the host when every eligible player is ready", () => {
    render(
      <HostSubmissionStatus
        round={round}
        participants={participants}
        guesses={[
          guess("guess-2", round.id, "participant-2"),
          guess("guess-3", round.id, "participant-3"),
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "2 of 2" })).toBeInTheDocument();
    expect(screen.getByText("Ready to reveal")).toBeInTheDocument();
  });
});

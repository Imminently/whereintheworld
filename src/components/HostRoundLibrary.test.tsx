import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HostRoundLibrary } from "./HostRoundLibrary";
import type {
  Guess,
  Round,
  RoundAnswer,
  RoundScore,
  TeamMember,
} from "../types";

const round: Round = {
  id: "round-1",
  gameId: "game-1",
  subjectMemberId: "member-1",
  photoObjectKey: "games/game-1/rounds/round-1/photo.webp",
  displayOrder: 1,
};

const member: TeamMember = {
  id: "member-1",
  gameId: "game-1",
  displayName: "Alex Morgan",
  sortOrder: 1,
};

const answer: RoundAnswer = {
  roundId: "round-1",
  latitude: 51.5074,
  longitude: -0.1278,
  locationLabel: "London, UK",
};

const guess: Guess = {
  id: "guess-1",
  gameId: "game-1",
  roundId: "round-1",
  participantId: "participant-1",
  latitude: 50,
  longitude: 0,
  submittedAt: "2026-07-14T00:00:00.000Z",
};

const score: RoundScore = {
  gameId: "game-1",
  roundId: "round-1",
  participantId: "participant-1",
  distanceKm: 12,
  scored: true,
};

describe("HostRoundLibrary", () => {
  it("shows the uploaded image and complete saved location details", () => {
    render(
      <HostRoundLibrary
        rounds={[round]}
        members={[member]}
        answers={[answer]}
        guesses={[guess]}
        scores={[score]}
        photoUrls={{ "round-1": "/photo.webp" }}
        isLoadingPhotos={false}
      />,
    );

    expect(screen.getByRole("img", { name: "Alex Morgan in London, UK" })).toHaveAttribute(
      "src",
      "/photo.webp",
    );
    expect(screen.getByText("London, UK")).toBeInTheDocument();
    expect(screen.getByText("51.5074, -0.1278")).toBeInTheDocument();
    expect(screen.getByText("1 guesses")).toBeInTheDocument();
    expect(screen.getByText("1 scored")).toBeInTheDocument();
  });

  it("distinguishes an unavailable preview from a missing upload", () => {
    render(
      <HostRoundLibrary
        rounds={[round, { ...round, id: "round-2", photoObjectKey: null }]}
        members={[member]}
        answers={[answer]}
        guesses={[]}
        scores={[]}
        photoUrls={{}}
        isLoadingPhotos={false}
      />,
    );

    expect(screen.getByText("Photo preview unavailable")).toBeInTheDocument();
    expect(screen.getByText("No photo uploaded")).toBeInTheDocument();
  });
});

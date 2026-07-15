import { describe, expect, it } from "vitest";
import {
  advanceMockGame,
  createMockLookupResult,
  createMockPlayerSession,
  getMockPhotoUrl,
  revealMockRound,
  submitMockGuess,
} from "./mockGame";

describe("mock game", () => {
  it("provides a complete fictional lobby without a backend", () => {
    const lookup = createMockLookupResult();

    expect(lookup.phase).toBe("lobby");
    expect(lookup.members.map((member) => member.displayName)).toEqual([
      "Jordan Kim",
      "Mei Lin",
      "Marcus Reed",
      "Sophie de Vries",
    ]);
  });

  it("progresses through guessing, reveal, later rounds, and finish", () => {
    const lookup = createMockLookupResult();
    let state = createMockPlayerSession(lookup.members[0].id).state;

    state = advanceMockGame(state);
    expect(state.game.phase).toBe("guessing");
    expect(state.game.currentRoundId).toBe(state.rounds[0].id);
    expect(getMockPhotoUrl(state.rounds[0].id)).toBe("/mock/mei-taipei.webp");

    state = submitMockGuess(state, state.rounds[0].id, {
      latitude: 25,
      longitude: 121.5,
    });
    expect(state.ownGuesses).toHaveLength(1);

    state = revealMockRound(state);
    expect(state.game.phase).toBe("revealed");
    expect(state.reveals[0].locationLabel).toBe("Taipei, Taiwan");
    expect(
      state.scores.find(
        (score) => score.participantId === state.participant.id,
      )?.scored,
    ).toBe(true);

    state = advanceMockGame(state);
    expect(state.game.currentRoundId).toBe(state.rounds[1].id);

    state = revealMockRound(state);
    state = advanceMockGame(state);
    state = revealMockRound(state);
    state = advanceMockGame(state);
    expect(state.game.phase).toBe("finished");
    expect(state.scores).toHaveLength(12);
  });

  it("skips scoring when the selected player is the round subject", () => {
    const lookup = createMockLookupResult();
    let state = createMockPlayerSession(lookup.members[1].id).state;

    state = advanceMockGame(state);
    state = revealMockRound(state);

    expect(
      state.scores.find(
        (score) => score.participantId === state.participant.id,
      ),
    ).toMatchObject({ scored: false, distanceKm: null });
  });

  it("resets a finished demo to a clean lobby", () => {
    const lookup = createMockLookupResult();
    let state = createMockPlayerSession(lookup.members[0].id).state;

    state = advanceMockGame(state);
    state = revealMockRound(state);
    state = advanceMockGame(state);
    state = revealMockRound(state);
    state = advanceMockGame(state);
    state = revealMockRound(state);
    state = advanceMockGame(state);
    state = advanceMockGame(state);

    expect(state.game.phase).toBe("lobby");
    expect(state.scores).toEqual([]);
    expect(state.reveals).toEqual([]);
  });
});

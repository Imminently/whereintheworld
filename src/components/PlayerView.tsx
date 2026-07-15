import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import {
  getRoundPhotoUrl,
  joinGame,
  lookupGame,
  fetchPlayerGameState,
  submitGuess,
} from "../lib/api";
import { getErrorMessage } from "../lib/errors";
import { isMockGameCode } from "../lib/gameCode";
import { canParticipantGuess } from "../lib/gameLogic";
import { formatDistanceKm } from "../lib/format";
import { formatCoordinates } from "../lib/mapLogic";
import {
  advanceMockGame,
  createMockLookupResult,
  createMockPlayerSession,
  getMockPhotoUrl,
  revealMockRound,
  submitMockGuess,
} from "../lib/mockGame";
import { getSupabaseClient } from "../lib/supabase";
import type {
  Coordinates,
  JoinedGameResult,
  LookupGameResult,
  PhotoUrlResult,
  PlayerGameState,
  RoundReveal,
} from "../types";
import { GameMap } from "./GameMap";
import { Leaderboard } from "./Leaderboard";
import { StatusBanner } from "./StatusBanner";

const JOIN_STORAGE_KEY = "whereintheworld.joinedGameId";
const PLAYER_SESSION_STORAGE_KEY = "whereintheworld.playerSessionToken";

/** Player interface for joining, guessing, reveal review, and leaderboard tracking. */
export function PlayerView(): ReactElement {
  const [code, setCode] = useState("");
  const [lookupResult, setLookupResult] = useState<LookupGameResult | null>(null);
  const [joinedGame, setJoinedGame] = useState<JoinedGameResult | null>(null);
  const [state, setState] = useState<PlayerGameState | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [selectedGuess, setSelectedGuess] = useState<Coordinates | null>(null);
  const [photoUrl, setPhotoUrl] = useState<PhotoUrlResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isMockMode, setIsMockMode] = useState(false);

  const activeRound = useMemo(
    () => state?.rounds.find((round) => round.id === state.game.currentRoundId),
    [state],
  );
  const activeSubject = useMemo(
    () => state?.members.find((member) => member.id === activeRound?.subjectMemberId),
    [activeRound, state?.members],
  );
  const activeReveal: RoundReveal | null = useMemo(
    () => state?.reveals.find((reveal) => reveal.roundId === activeRound?.id) ?? null,
    [activeRound, state?.reveals],
  );
  const ownCurrentGuess = useMemo(
    () => state?.ownGuesses.find((guess) => guess.roundId === activeRound?.id) ?? null,
    [activeRound, state?.ownGuesses],
  );
  const ownCurrentScore = useMemo(
    () => state?.scores.find(
      (score) =>
        score.participantId === state.participant.id &&
        score.roundId === activeRound?.id,
    ) ?? null,
    [activeRound, state],
  );
  const mayGuess =
    state !== null && canParticipantGuess(state.game, activeRound, state.participant);
  const isSubjectRound =
    state !== null &&
    activeRound !== undefined &&
    activeRound.subjectMemberId === state.participant.teamMemberId;
  const activeRoundIndex =
    state === null || activeRound === undefined
      ? -1
      : state.rounds.findIndex((round) => round.id === activeRound.id);
  const isLastRound =
    state !== null && activeRoundIndex === state.rounds.length - 1;
  const ownScoredRounds =
    state?.scores.filter(
      (score) =>
        score.participantId === state.participant.id &&
        score.scored &&
        score.distanceKm !== null,
    ) ?? [];
  const currentScoreKm = ownScoredRounds.reduce(
    (total, score) => total + (score.distanceKm ?? 0),
    0,
  );
  const hasChangedSubmittedGuess =
    ownCurrentGuess !== null &&
    selectedGuess !== null &&
    (ownCurrentGuess.latitude !== selectedGuess.latitude ||
      ownCurrentGuess.longitude !== selectedGuess.longitude);
  const showRoundStage =
    state !== null &&
    activeRound !== undefined &&
    (state.game.phase === "guessing" || state.game.phase === "revealed");
  const showLeaderboard = state !== null && state.game.phase !== "guessing";

  const clearPlayerGame = useCallback((message: string | null): void => {
    window.localStorage.removeItem(JOIN_STORAGE_KEY);
    window.localStorage.removeItem(PLAYER_SESSION_STORAGE_KEY);
    setJoinedGame(null);
    setState(null);
    setLookupResult(null);
    setSelectedMemberId("");
    setPhotoUrl(null);
    setIsMockMode(false);
    setStatusMessage(message);
    setErrorMessage(null);
  }, []);

  const refreshState = useCallback(async (): Promise<void> => {
    if (isMockMode) {
      return;
    }

    const gameId = joinedGame?.game.id ?? window.localStorage.getItem(JOIN_STORAGE_KEY);
    const playerSessionToken =
      joinedGame?.playerSessionToken ??
      window.localStorage.getItem(PLAYER_SESSION_STORAGE_KEY);
    if (gameId === null || playerSessionToken === null) {
      return;
    }

    const nextState = await fetchPlayerGameState(gameId, playerSessionToken);
    setState(nextState);
  }, [isMockMode, joinedGame?.game.id, joinedGame?.playerSessionToken]);

  useEffect(() => {
    refreshState().catch(() => {
      window.localStorage.removeItem(JOIN_STORAGE_KEY);
      window.localStorage.removeItem(PLAYER_SESSION_STORAGE_KEY);
    });
  }, [refreshState]);

  useEffect(() => {
    if (isMockMode) {
      return;
    }

    const client = getSupabaseClient();
    const gameId = state?.game.id;
    if (client === null || gameId === undefined) {
      return;
    }

    const channel = client
      .channel(`game:${gameId}`)
      .on("broadcast", { event: "*" }, (message) => {
        if (message.event === "game_replayed") {
          clearPlayerGame("The host reset the game. Enter the new code to join again.");
          return;
        }

        refreshState().catch((error: unknown) => {
          setErrorMessage(getErrorMessage(error, "Realtime refresh failed."));
        });
      })
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [clearPlayerGame, isMockMode, refreshState, state?.game.id]);

  useEffect(() => {
    if (state?.game.id === undefined || activeRound === undefined) {
      setPhotoUrl(null);
      return;
    }

    if (state.game.phase !== "guessing" && state.game.phase !== "revealed") {
      setPhotoUrl(null);
      return;
    }

    if (isMockMode) {
      const mockPhotoUrl = getMockPhotoUrl(activeRound.id);
      setPhotoUrl(
        mockPhotoUrl === null
          ? null
          : { signedUrl: mockPhotoUrl, expiresInSeconds: Number.MAX_SAFE_INTEGER },
      );
      return;
    }

    const playerSessionToken =
      joinedGame?.playerSessionToken ??
      window.localStorage.getItem(PLAYER_SESSION_STORAGE_KEY);

    if (playerSessionToken === null) {
      setPhotoUrl(null);
      return;
    }

    getRoundPhotoUrl(state.game.id, activeRound.id, playerSessionToken)
      .then(setPhotoUrl)
      .catch(() => setPhotoUrl(null));
  }, [activeRound, isMockMode, joinedGame?.playerSessionToken, state?.game.id, state?.game.phase]);

  useEffect(() => {
    if (ownCurrentGuess !== null) {
      setSelectedGuess({
        latitude: ownCurrentGuess.latitude,
        longitude: ownCurrentGuess.longitude,
      });
    } else {
      setSelectedGuess(null);
    }
  }, [ownCurrentGuess]);

  const runAction = async (action: () => Promise<void>, successMessage: string): Promise<void> => {
    setIsBusy(true);
    setErrorMessage(null);
    try {
      await action();
      setStatusMessage(successMessage);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Action failed."));
    } finally {
      setIsBusy(false);
    }
  };

  const handleLookup = async (): Promise<void> => {
    await runAction(async () => {
      const useMockMode = isMockGameCode(code);
      const result = useMockMode ? createMockLookupResult() : await lookupGame(code);
      setIsMockMode(useMockMode);
      setLookupResult(result);
      const firstAvailableMember = result.members.find(
        (member) => !result.claimedMemberIds.includes(member.id),
      );
      setSelectedMemberId(firstAvailableMember?.id ?? "");
    }, "Game found.");
  };

  const handleJoin = async (): Promise<void> => {
    await runAction(async () => {
      if (isMockMode) {
        const mockSession = createMockPlayerSession(selectedMemberId);
        setJoinedGame(mockSession.joinedGame);
        setState(mockSession.state);
        return;
      }

      const result = await joinGame(code, selectedMemberId);
      setJoinedGame(result);
      window.localStorage.setItem(JOIN_STORAGE_KEY, result.game.id);
      window.localStorage.setItem(
        PLAYER_SESSION_STORAGE_KEY,
        result.playerSessionToken,
      );
      const nextState = await fetchPlayerGameState(
        result.game.id,
        result.playerSessionToken,
      );
      setState(nextState);
    }, "Joined game.");
  };

  const handleSubmitGuess = async (): Promise<void> => {
    if (state === null || activeRound === undefined || selectedGuess === null) {
      setErrorMessage("Select a map location before submitting.");
      return;
    }

    const playerSessionToken =
      joinedGame?.playerSessionToken ??
      window.localStorage.getItem(PLAYER_SESSION_STORAGE_KEY);
    if (playerSessionToken === null) {
      setErrorMessage("Join the game again before submitting a guess.");
      return;
    }

    await runAction(async () => {
      if (isMockMode) {
        setState((currentState) =>
          currentState === null
            ? currentState
            : submitMockGuess(currentState, activeRound.id, selectedGuess),
        );
        return;
      }

      await submitGuess(
        state.game.id,
        activeRound.id,
        playerSessionToken,
        selectedGuess,
      );
      await refreshState();
    }, "Guess submitted.");
  };

  const handleMockControl = (): void => {
    if (!isMockMode || state === null) {
      return;
    }

    if (state.game.phase === "guessing") {
      setState(revealMockRound(state));
      setStatusMessage("Answer revealed. Check the map and leaderboard.");
      return;
    }

    setState(advanceMockGame(state));
    setStatusMessage(
      state.game.phase === "finished"
        ? "Demo reset. Ready for another run."
        : isLastRound && state.game.phase === "revealed"
          ? "Demo complete. Final leaderboard ready."
          : "Demo advanced.",
    );
  };

  const handleLeave = (): void => {
    clearPlayerGame(null);
  };

  if (state === null) {
    return (
      <main className="workspace player-workspace player-entry-workspace">
        <section className="entry-hero" aria-labelledby="entry-hero-title">
          <div className="entry-hero-content">
            <p className="eyebrow">The global team challenge</p>
            <h1 id="entry-hero-title">
              How well do you know <em>your team?</em>
            </h1>
            <p className="hero-copy">
              Meet your team around the world. Study the photo, drop your pin, and see who gets closest.
            </p>
            <div className="game-steps" aria-label="How to play">
              <span><strong>01</strong> Join</span>
              <span><strong>02</strong> Explore</span>
              <span><strong>03</strong> Guess</span>
            </div>
          </div>
          <div className="globe-visual" aria-hidden="true">
            <span className="globe-orbit globe-orbit-one" />
            <span className="globe-orbit globe-orbit-two" />
            <span className="globe-core" />
            <span className="globe-pin globe-pin-one" />
            <span className="globe-pin globe-pin-two" />
            <span className="globe-pin globe-pin-three" />
          </div>
        </section>

        <section className="panel join-panel" aria-labelledby="player-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Player</p>
              <h1 id="player-title">Join the game</h1>
            </div>
            <span className="phase-chip">{lookupResult?.phase ?? "code"}</span>
          </div>
          <StatusBanner message={statusMessage} tone="success" />
          <StatusBanner message={errorMessage} tone="error" />
          <div className="join-row">
            <label>
              Four-digit code
              <input
                value={code}
                maxLength={4}
                inputMode="numeric"
                placeholder="0000"
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              />
            </label>
            <button className="primary-button" disabled={isBusy || code.length !== 4} onClick={() => { void handleLookup(); }}>
              Find game <span aria-hidden="true">→</span>
            </button>
          </div>
          {lookupResult !== null ? (
            <div className="claim-box">
              <h2>{lookupResult.title}</h2>
              <label>
                Your name
                <select
                  value={selectedMemberId}
                  onChange={(event) => setSelectedMemberId(event.target.value)}
                >
                  {lookupResult.members.map((member) => (
                    <option
                      key={member.id}
                      value={member.id}
                      disabled={lookupResult.claimedMemberIds.includes(member.id)}
                    >
                      {member.displayName}
                      {lookupResult.claimedMemberIds.includes(member.id) ? " (claimed)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <button className="primary-button" disabled={isBusy || selectedMemberId.length === 0} onClick={() => { void handleJoin(); }}>
                Claim name
              </button>
            </div>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <main className="workspace player-game-workspace">
      <section className="player-game-bar" aria-label="Current game status">
        <div className="player-game-identity">
          <span className="phase-chip">{state.game.phase}</span>
          <div>
            <h1>{state.game.title}</h1>
            <p>Playing as {state.participant.displayName}</p>
          </div>
        </div>
        <div className="player-game-actions">
          <div className="player-score" aria-label="Your current score">
            <span>Current score</span>
            <strong>{formatDistanceKm(currentScoreKm)}</strong>
            <small>
              {ownScoredRounds.length} {ownScoredRounds.length === 1 ? "round" : "rounds"} scored
            </small>
          </div>
          <button className="leave-game-button" onClick={handleLeave}>Leave game</button>
        </div>
      </section>

      {statusMessage !== null || errorMessage !== null ? (
        <div className="player-status-strip">
          <StatusBanner message={statusMessage} tone="success" />
          <StatusBanner message={errorMessage} tone="error" />
        </div>
      ) : null}

      {isMockMode ? (
        <div className="mock-controls mock-controls-wide" role="region" aria-label="Demo controls">
          <div>
            <span className="demo-chip">Demo mode</span>
            <p>You are the host too—advance the game whenever you are ready.</p>
          </div>
          <button
            className="mock-control-button"
            disabled={
              state.game.phase === "guessing" &&
              !isSubjectRound &&
              ownCurrentGuess === null
            }
            onClick={handleMockControl}
          >
            {state.game.phase === "lobby"
              ? "Start round 1"
              : state.game.phase === "guessing"
                ? "Reveal answer"
                : state.game.phase === "revealed" && !isLastRound
                  ? "Next round"
                  : state.game.phase === "revealed"
                    ? "Finish demo"
                    : "Play again"}
          </button>
        </div>
      ) : null}

      {state.game.phase === "lobby" || state.game.phase === "setup" ? (
        <section className="panel player-waiting-panel" aria-labelledby="waiting-title">
          <p className="eyebrow">Ready to explore</p>
          <h2 id="waiting-title">Waiting for the first round</h2>
          <p className="muted">
            {isMockMode
              ? "The demo lobby is ready. Start the first round when you are."
              : "The host will start the next round manually."}
          </p>
        </section>
      ) : null}

      {showRoundStage ? (
        <section className="player-round-stage" aria-labelledby="round-play-title">
          <article className="round-photo-pane">
            <div className="round-pane-heading">
              <div>
                <p className="eyebrow">Current teammate</p>
                <h2 id="round-play-title">{activeSubject?.displayName ?? "Mystery teammate"}</h2>
              </div>
              <span className="round-number">Round {activeRoundIndex + 1} of {state.rounds.length}</span>
            </div>
            {photoUrl !== null ? (
              <img className="round-photo" src={photoUrl.signedUrl} alt="Round teammate" />
            ) : (
              <div className="round-photo-placeholder">Photo loading…</div>
            )}
          </article>

          <article className="round-map-pane">
            <div className="round-pane-heading">
              <div>
                <p className="eyebrow">Your guess</p>
                <h2>{activeReveal === null ? "Place your pin" : activeReveal.locationLabel}</h2>
              </div>
              {ownCurrentGuess !== null ? <span className="submitted-chip">Submitted</span> : null}
            </div>

            {isSubjectRound ? (
              <div className="notice">
                This is your photo. You can watch this round, but it is skipped for your score.
              </div>
            ) : null}

            {ownCurrentGuess !== null && activeReveal === null ? (
              <div
                className={`guess-submitted-confirmation ${hasChangedSubmittedGuess ? "pending-change" : ""}`}
                role="status"
              >
                <span className="guess-confirmation-icon" aria-hidden="true">
                  {hasChangedSubmittedGuess ? "↗" : "✓"}
                </span>
                <div>
                  <strong>
                    {hasChangedSubmittedGuess ? "New pin selected" : "Guess submitted"}
                  </strong>
                  <p>
                    {hasChangedSubmittedGuess
                      ? "Select Change Guess to replace your submitted answer."
                      : "Move your pin and select Change Guess to update it, or wait for the host to move to the next question."}
                  </p>
                </div>
              </div>
            ) : null}

            {activeReveal !== null ? (
              <div className="reveal-box reveal-box-compact">
                <p>{formatCoordinates(activeReveal)}</p>
                <p className="score-line">
                  Your distance: {formatDistanceKm(ownCurrentScore?.distanceKm ?? null)}
                </p>
              </div>
            ) : null}

            <GameMap
              label="Select your guess on the world map"
              selectedCoordinates={selectedGuess}
              revealedCoordinates={activeReveal}
              disabled={!mayGuess}
              onSelect={setSelectedGuess}
            />

            {state.game.phase === "guessing" ? (
              <button
                className="primary-button submit-guess-button"
                disabled={isBusy || !mayGuess || selectedGuess === null}
                onClick={() => { void handleSubmitGuess(); }}
              >
                {ownCurrentGuess === null ? "Submit guess" : "Change Guess"}
              </button>
            ) : null}
          </article>
        </section>
      ) : null}

      {showLeaderboard ? (
        <div className="between-round-leaderboard">
          <Leaderboard
            participants={state.participants}
            scores={state.scores}
            phase={state.game.phase}
          />
        </div>
      ) : null}
    </main>
  );
}

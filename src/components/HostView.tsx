import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import type { User } from "@supabase/supabase-js";
import {
  addRoundWithPhoto,
  cleanupGame,
  createGame,
  fetchHostAnswers,
  fetchHostGameCode,
  fetchHostGames,
  fetchHostGameState,
  getRoundPhotoUrl,
  runHostCommand,
  type HostCommand,
} from "../lib/api";
import { getErrorMessage } from "../lib/errors";
import { isMockGameCode } from "../lib/gameCode";
import { formatCoordinates, isValidGuess } from "../lib/mapLogic";
import {
  getCurrentUser,
  getSupabaseClient,
  isHostUser,
  signInHost,
  signOutCurrentUser,
} from "../lib/supabase";
import type {
  Coordinates,
  GameSummary,
  HostGameState,
  PhotoUrlResult,
  RoundAnswer,
} from "../types";
import { GameMap } from "./GameMap";
import { HostReplayControls } from "./HostReplayControls";
import { HostRoundResults } from "./HostRoundResults";
import { HostRoundLibrary } from "./HostRoundLibrary";
import { HostSubmissionStatus } from "./HostSubmissionStatus";
import { Leaderboard } from "./Leaderboard";
import { StatusBanner } from "./StatusBanner";

interface RoundFormState {
  displayName: string;
  locationLabel: string;
  answer: Coordinates | null;
  photo: File | null;
}

const emptyRoundForm: RoundFormState = {
  displayName: "",
  locationLabel: "",
  answer: null,
  photo: null,
};

/** Host console for setup, live round control, reveal, finish, and cleanup. */
export function HostView(): ReactElement {
  const [hostUser, setHostUser] = useState<User | null>(null);
  const [isCheckingHostSession, setIsCheckingHostSession] = useState(true);
  const [hostEmail, setHostEmail] = useState("");
  const [hostPassword, setHostPassword] = useState("");
  const [title, setTitle] = useState("Where in the World");
  const [code, setCode] = useState("");
  const [games, setGames] = useState<GameSummary[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [hostGameCodes, setHostGameCodes] = useState<Record<string, string>>({});
  const [loadingGameCodeId, setLoadingGameCodeId] = useState<string | null>(null);
  const [state, setState] = useState<HostGameState | null>(null);
  const [answers, setAnswers] = useState<RoundAnswer[]>([]);
  const [roundForm, setRoundForm] = useState<RoundFormState>(emptyRoundForm);
  const [photoUrl, setPhotoUrl] = useState<PhotoUrlResult | null>(null);
  const [roundPhotoUrls, setRoundPhotoUrls] = useState<Record<string, string>>({});
  const [isLoadingRoundPhotos, setIsLoadingRoundPhotos] = useState(false);
  const [isConfirmingReplay, setIsConfirmingReplay] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const activeRound = useMemo(
    () => state?.rounds.find((round) => round.id === state.game.currentRoundId),
    [state],
  );
  const activeAnswer = useMemo(
    () => answers.find((answer) => answer.roundId === activeRound?.id) ?? null,
    [activeRound, answers],
  );
  const currentGameCode =
    selectedGameId === null ? null : hostGameCodes[selectedGameId] ?? null;
  const reviewPhotoRoundIdsKey = useMemo(
    () =>
      state?.rounds
        .filter((round) => round.photoObjectKey !== null)
        .map((round) => round.id)
        .join("|") ?? "",
    [state?.rounds],
  );

  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        setHostUser(isHostUser(user) ? user : null);
      })
      .catch((error: unknown) => {
        setErrorMessage(getErrorMessage(error, "Could not check host session."));
      })
      .finally(() => {
        setIsCheckingHostSession(false);
      });
  }, []);

  const refreshGames = useCallback(async (): Promise<void> => {
    if (!isHostUser(hostUser)) {
      setGames([]);
      return;
    }

    const fetchedGames = await fetchHostGames();
    setGames(fetchedGames);
    if (selectedGameId === null && fetchedGames.length > 0) {
      setSelectedGameId(fetchedGames[0].id);
    }
  }, [hostUser, selectedGameId]);

  const refreshSelectedGame = useCallback(async (): Promise<void> => {
    if (!isHostUser(hostUser)) {
      setState(null);
      setAnswers([]);
      return;
    }

    if (selectedGameId === null) {
      setState(null);
      setAnswers([]);
      return;
    }

    const [nextState, nextAnswers] = await Promise.all([
      fetchHostGameState(selectedGameId),
      fetchHostAnswers(selectedGameId),
    ]);
    setState(nextState);
    setAnswers(nextAnswers);
  }, [hostUser, selectedGameId]);

  useEffect(() => {
    refreshGames().catch((error: unknown) => {
      setErrorMessage(getErrorMessage(error, "Could not load host games."));
    });
  }, [refreshGames]);

  useEffect(() => {
    refreshSelectedGame().catch((error: unknown) => {
      setErrorMessage(getErrorMessage(error, "Could not load game state."));
    });
  }, [refreshSelectedGame]);

  useEffect(() => {
    if (!isHostUser(hostUser) || selectedGameId === null) {
      setLoadingGameCodeId(null);
      return;
    }

    if (hostGameCodes[selectedGameId] !== undefined) {
      setLoadingGameCodeId(null);
      return;
    }

    let isCurrentRequest = true;
    const gameId = selectedGameId;
    setLoadingGameCodeId(gameId);

    void fetchHostGameCode(gameId)
      .then((recoveredCode) => {
        if (isCurrentRequest) {
          setHostGameCodes((current) => ({
            ...current,
            [gameId]: recoveredCode,
          }));
        }
      })
      .catch((error: unknown) => {
        if (isCurrentRequest) {
          setErrorMessage(
            getErrorMessage(error, "Could not load the current game code."),
          );
        }
      })
      .finally(() => {
        if (isCurrentRequest) {
          setLoadingGameCodeId(null);
        }
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [hostGameCodes, hostUser, selectedGameId]);

  useEffect(() => {
    const client = getSupabaseClient();
    if (client === null || selectedGameId === null) {
      return;
    }

    const channel = client
      .channel(`game:${selectedGameId}`)
      .on("broadcast", { event: "*" }, () => {
        refreshSelectedGame().catch((error: unknown) => {
          setErrorMessage(getErrorMessage(error, "Realtime refresh failed."));
        });
      })
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [refreshSelectedGame, selectedGameId]);

  useEffect(() => {
    if (state?.game.currentRoundId === null || state?.game.currentRoundId === undefined) {
      setPhotoUrl(null);
      return;
    }

    getRoundPhotoUrl(state.game.id, state.game.currentRoundId)
      .then(setPhotoUrl)
      .catch(() => setPhotoUrl(null));
  }, [state?.game.currentRoundId, state?.game.id, state?.game.phase]);

  useEffect(() => {
    const gameId = state?.game.id;
    if (gameId === undefined || reviewPhotoRoundIdsKey.length === 0) {
      setRoundPhotoUrls({});
      setIsLoadingRoundPhotos(false);
      return;
    }

    let isCurrentRequest = true;
    const roundIds = reviewPhotoRoundIdsKey.split("|");
    setRoundPhotoUrls({});
    setIsLoadingRoundPhotos(true);

    void Promise.all(
      roundIds.map(async (roundId): Promise<readonly [string, string] | null> => {
        try {
          const result = await getRoundPhotoUrl(gameId, roundId);
          return [roundId, result.signedUrl] as const;
        } catch {
          return null;
        }
      }),
    )
      .then((entries) => {
        if (!isCurrentRequest) {
          return;
        }

        const availableEntries = entries.filter(
          (entry): entry is readonly [string, string] => entry !== null,
        );
        setRoundPhotoUrls(Object.fromEntries(availableEntries));
      })
      .finally(() => {
        if (isCurrentRequest) {
          setIsLoadingRoundPhotos(false);
        }
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [reviewPhotoRoundIdsKey, state?.game.id]);

  useEffect(() => {
    setIsConfirmingReplay(false);
  }, [selectedGameId]);

  const runAction = async (
    action: () => Promise<void>,
    successMessage: string,
    refreshSelectedAfterAction = true,
  ): Promise<void> => {
    setIsBusy(true);
    setErrorMessage(null);
    try {
      await action();
      setStatusMessage(successMessage);
      await refreshGames();
      if (refreshSelectedAfterAction) {
        await refreshSelectedGame();
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Action failed."));
    } finally {
      setIsBusy(false);
    }
  };

  const handleHostSignIn = async (): Promise<void> => {
    setIsBusy(true);
    setErrorMessage(null);
    try {
      const user = await signInHost(hostEmail, hostPassword);
      setHostUser(user);
      setHostPassword("");
      setStatusMessage("Signed in as host.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Host sign-in failed."));
    } finally {
      setIsBusy(false);
    }
  };

  const handleHostSignOut = async (): Promise<void> => {
    setIsBusy(true);
    setErrorMessage(null);
    try {
      await signOutCurrentUser();
      setHostUser(null);
      setGames([]);
      setSelectedGameId(null);
      setHostGameCodes({});
      setLoadingGameCodeId(null);
      setState(null);
      setAnswers([]);
      setStatusMessage("Signed out.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Sign-out failed."));
    } finally {
      setIsBusy(false);
    }
  };

  const handleCreateGame = async (): Promise<void> => {
    const createdCode = code.trim();
    await runAction(async () => {
      const game = await createGame({ title, code: createdCode });
      setHostGameCodes((current) => ({
        ...current,
        [game.id]: createdCode,
      }));
      setSelectedGameId(game.id);
      setCode("");
    }, "Game created.");
  };

  const handleAddRound = async (): Promise<void> => {
    if (selectedGameId === null) {
      setErrorMessage("Create or select a game first.");
      return;
    }

    const photo = roundForm.photo;
    const answer = roundForm.answer;

    if (photo === null || answer === null) {
      setErrorMessage("Add a photo and select the correct map location.");
      return;
    }

    if (!isValidGuess(answer)) {
      setErrorMessage("Select a valid location on the map.");
      return;
    }

    await runAction(async () => {
      await addRoundWithPhoto({
        gameId: selectedGameId,
        displayName: roundForm.displayName,
        locationLabel: roundForm.locationLabel,
        answer,
        photo,
      });
      setRoundForm(emptyRoundForm);
    }, "Round added.");
  };

  const handleHostCommand = async (command: HostCommand, roundId?: string): Promise<void> => {
    if (selectedGameId === null) {
      setErrorMessage("Select a game first.");
      return;
    }

    await runAction(async () => {
      const result = await runHostCommand(selectedGameId, command, roundId);
      setState((currentState) =>
        currentState === null
          ? currentState
          : {
              ...currentState,
              game: result.game,
            },
      );
    }, command === "start_lobby" ? "Lobby is open." : "Game updated.");
  };

  const handleReplay = async (): Promise<void> => {
    if (selectedGameId === null) {
      setErrorMessage("Select a game first.");
      return;
    }

    await runAction(async () => {
      const result = await runHostCommand(selectedGameId, "reset_game");
      setState((currentState) =>
        currentState === null
          ? currentState
          : {
              ...currentState,
              game: result.game,
              guesses: [],
              reveals: [],
              scores: [],
              participants: [],
            },
      );
      setHostGameCodes((current) => {
        const next = { ...current };
        delete next[selectedGameId];
        return next;
      });
      setIsConfirmingReplay(false);
    }, "Game reset. A new join code is ready, and everyone can join again.");
  };

  const handleCleanup = async (): Promise<void> => {
    if (selectedGameId === null) {
      return;
    }

    await runAction(async () => {
      await cleanupGame(selectedGameId);
      setSelectedGameId(null);
      setHostGameCodes({});
      setLoadingGameCodeId(null);
      setState(null);
      setAnswers([]);
    }, "Game content deleted.", false);
  };

  const currentRoundNumber =
    activeRound === undefined ? null : state?.rounds.findIndex((round) => round.id === activeRound.id) ?? null;

  if (isCheckingHostSession) {
    return (
      <main className="workspace">
        <section className="panel setup-panel" aria-labelledby="host-loading-title">
          <p className="eyebrow">Host</p>
          <h1 id="host-loading-title">Checking session</h1>
          <StatusBanner message={errorMessage} tone="error" />
        </section>
      </main>
    );
  }

  if (!isHostUser(hostUser)) {
    return (
      <main className="workspace">
        <section className="panel setup-panel" aria-labelledby="host-signin-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Host</p>
              <h1 id="host-signin-title">Sign in</h1>
            </div>
          </div>
          <StatusBanner message={statusMessage} tone="success" />
          <StatusBanner message={errorMessage} tone="error" />
          <div className="form-grid">
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                value={hostEmail}
                onChange={(event) => setHostEmail(event.target.value)}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                value={hostPassword}
                onChange={(event) => setHostPassword(event.target.value)}
              />
            </label>
          </div>
          <button
            className="primary-button"
            disabled={isBusy || hostEmail.trim().length === 0 || hostPassword.length === 0}
            onClick={() => { void handleHostSignIn(); }}
          >
            Sign in as host
          </button>
          <p className="muted">
            Create the host user in the Supabase Dashboard. Public signups can stay disabled.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="workspace host-workspace">
      <div className="host-dashboard-grid">
      <section
        className="panel setup-panel host-dashboard-setup"
        aria-labelledby="host-title"
      >
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Host</p>
            <h1 id="host-title">Game console</h1>
          </div>
          <div className="host-session-actions">
            {selectedGameId !== null ? (
              <div className="host-game-code" aria-label="Current game join code">
                <span>Join code</span>
                <strong>
                  {loadingGameCodeId === selectedGameId
                    ? "••••"
                    : currentGameCode ?? "Unavailable"}
                </strong>
              </div>
            ) : null}
            <span className="phase-chip">{state?.game.phase ?? "setup"}</span>
            <button disabled={isBusy} onClick={() => { void handleHostSignOut(); }}>
              Sign out
            </button>
          </div>
        </div>

        <StatusBanner message={statusMessage} tone="success" />
        <StatusBanner message={errorMessage} tone="error" />

        <div className="form-grid two-columns">
          <label>
            Game title
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label>
            Four-digit code
            <input
              value={code}
              maxLength={4}
              inputMode="numeric"
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            />
            {isMockGameCode(code) ? (
              <span className="field-hint error">This code is unavailable.</span>
            ) : null}
          </label>
        </div>
        <button className="primary-button" disabled={isBusy || code.length !== 4 || isMockGameCode(code)} onClick={() => { void handleCreateGame(); }}>
          Create game
        </button>

        {games.length > 0 ? (
          <label className="select-label">
            Active game
            <select
              value={selectedGameId ?? ""}
              onChange={(event) => setSelectedGameId(event.target.value)}
            >
              {games.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.title}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </section>

      <section
        className="panel host-round-setup-panel"
        aria-labelledby="round-setup-title"
      >
        <div className="panel-heading">
          <h2 id="round-setup-title">Rounds</h2>
          <span className="muted">{state?.rounds.length ?? 0} loaded</span>
        </div>
        <div className="form-grid two-columns">
          <label>
            Teammate name
            <input
              value={roundForm.displayName}
              onChange={(event) =>
                setRoundForm((current) => ({
                  ...current,
                  displayName: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Location label
            <input
              value={roundForm.locationLabel}
              onChange={(event) =>
                setRoundForm((current) => ({
                  ...current,
                  locationLabel: event.target.value,
                }))
              }
            />
          </label>
        </div>
        <label className="file-input">
          Photo
          <input
            type="file"
            accept="image/*"
            onChange={(event) =>
              setRoundForm((current) => ({
                ...current,
                photo: event.target.files?.item(0) ?? null,
              }))
            }
          />
        </label>
        <GameMap
          label="Select the correct location for the round"
          selectedCoordinates={roundForm.answer}
          onSelect={(answer) => setRoundForm((current) => ({ ...current, answer }))}
        />
        <button
          className="primary-button"
          disabled={
            isBusy ||
            selectedGameId === null ||
            roundForm.displayName.trim().length === 0 ||
            roundForm.locationLabel.trim().length === 0 ||
            roundForm.photo === null ||
            roundForm.answer === null
          }
          onClick={() => { void handleAddRound(); }}
        >
          Add round
        </button>
      </section>

      <section
        className="panel host-live-controls"
        aria-labelledby="host-controls-title"
      >
        <div className="panel-heading">
          <h2 id="host-controls-title">Live controls</h2>
          {state !== null ? <span className="muted">{state.participants.length} players</span> : null}
        </div>
        <div className={`live-state live-state-${state?.game.phase ?? "setup"}`}>
          <h3>
            {state?.game.phase === "finished"
              ? "Game complete"
              : state?.game.phase === "lobby"
                ? "Lobby is open"
                : state?.game.phase === "guessing"
                  ? "Round in progress"
                  : state?.game.phase === "revealed"
                    ? "Answer revealed"
                    : "Lobby is closed"}
          </h3>
          <p>
            {state?.game.phase === "finished"
              ? "Scores are final. Play again to keep this setup and clear the completed run."
              : state?.game.phase === "lobby"
                ? "Players can enter the four-digit code and claim their names."
                : state?.game.phase === "guessing"
                  ? "Watch answers arrive below, then reveal when the group is ready."
                  : state?.game.phase === "revealed"
                    ? "Review the result, then start the next round when everyone is ready."
                    : "Open the lobby when you are ready for players to join."}
          </p>
        </div>
        {state?.game.phase === "guessing" && activeRound !== undefined ? (
          <HostSubmissionStatus
            round={activeRound}
            participants={state.participants}
            guesses={state.guesses}
          />
        ) : null}
        {state?.game.phase === "revealed" && activeRound !== undefined ? (
          <HostRoundResults
            round={activeRound}
            answer={activeAnswer}
            participants={state.participants}
            guesses={state.guesses}
            scores={state.scores}
          />
        ) : null}
        {state?.game.phase !== "finished" ? (
        <div className="button-row">
          <button
            disabled={
              isBusy ||
              state === null ||
              state.game.phase === "lobby"
            }
            onClick={() => { void handleHostCommand("start_lobby"); }}
          >
            Open lobby
          </button>
          <button
            disabled={
              isBusy ||
              state === null ||
              (state.game.phase !== "lobby" && state.game.phase !== "revealed")
            }
            onClick={() => { void handleHostCommand("start_round"); }}
          >
            Start next round
          </button>
          <button
            disabled={isBusy || state?.game.phase !== "guessing" || activeRound === undefined}
            onClick={() => { void handleHostCommand("reveal_round"); }}
          >
            Reveal answer
          </button>
          <button
            disabled={isBusy || state === null}
            onClick={() => { void handleHostCommand("finish_game"); }}
          >
            Finish game
          </button>
        </div>
        ) : null}
        {state?.game.phase === "finished" ? (
          <HostReplayControls
            roundCount={state.rounds.length}
            participantCount={state.participants.length}
            isBusy={isBusy}
            isConfirming={isConfirmingReplay}
            onRequestReplay={() => setIsConfirmingReplay(true)}
            onConfirmReplay={() => { void handleReplay(); }}
            onCancelReplay={() => setIsConfirmingReplay(false)}
          />
        ) : null}
        {activeRound !== undefined ? (
          <div className="live-round">
            <div>
              <p className="eyebrow">Current round</p>
              <h3>
                {currentRoundNumber === null ? "Round" : `Round ${currentRoundNumber + 1}`}
              </h3>
              <p className="muted">
                Answer {activeAnswer === null ? "hidden" : `${activeAnswer.locationLabel} (${formatCoordinates(activeAnswer)})`}
              </p>
            </div>
            {photoUrl !== null ? <img src={photoUrl.signedUrl} alt="Current round" /> : null}
          </div>
        ) : state?.game.phase !== "finished" ? (
          <p className="muted">Start the lobby, then begin the first round when everyone is ready.</p>
        ) : null}
        <button className="danger-button" disabled={isBusy || selectedGameId === null} onClick={() => { void handleCleanup(); }}>
          Delete game content
        </button>
      </section>
      </div>

      {state !== null ? (
        <HostRoundLibrary
          rounds={state.rounds}
          members={state.members}
          answers={answers}
          guesses={state.guesses}
          scores={state.scores}
          photoUrls={roundPhotoUrls}
          isLoadingPhotos={isLoadingRoundPhotos}
        />
      ) : null}

      {state !== null ? (
        <Leaderboard participants={state.participants} scores={state.scores} phase={state.game.phase} />
      ) : null}
    </main>
  );
}

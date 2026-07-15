import type { ReactElement } from "react";
import { formatCoordinates } from "../lib/mapLogic";
import type {
  Guess,
  Round,
  RoundAnswer,
  RoundScore,
  TeamMember,
} from "../types";

interface HostRoundLibraryProps {
  rounds: Round[];
  members: TeamMember[];
  answers: RoundAnswer[];
  guesses: Guess[];
  scores: RoundScore[];
  photoUrls: Record<string, string>;
  isLoadingPhotos: boolean;
}

/** Shows hosts the uploaded image, saved location, and play activity for every round. */
export function HostRoundLibrary({
  rounds,
  members,
  answers,
  guesses,
  scores,
  photoUrls,
  isLoadingPhotos,
}: HostRoundLibraryProps): ReactElement {
  return (
    <section className="panel host-content-library" aria-labelledby="round-list-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Game library</p>
          <h2 id="round-list-title">Loaded content</h2>
        </div>
        <span className="muted">
          {rounds.length} {rounds.length === 1 ? "round" : "rounds"}
        </span>
      </div>

      {rounds.length === 0 ? (
        <p className="muted">No rounds yet.</p>
      ) : (
        <div className="host-round-grid">
          {rounds.map((round, index) => {
            const member = members.find(
              (candidate) => candidate.id === round.subjectMemberId,
            );
            const answer = answers.find((candidate) => candidate.roundId === round.id);
            const roundGuesses = guesses.filter((guess) => guess.roundId === round.id);
            const roundScores = scores.filter((score) => score.roundId === round.id);
            const photoUrl = photoUrls[round.id];
            const teammateName = member?.displayName ?? "Unknown teammate";
            const locationLabel = answer?.locationLabel ?? "Answer not loaded";

            return (
              <article key={round.id} className="host-round-card">
                <div className="host-round-media">
                  {photoUrl !== undefined ? (
                    <img
                      src={photoUrl}
                      alt={`${teammateName} in ${locationLabel}`}
                    />
                  ) : (
                    <div className="host-round-photo-placeholder">
                      {round.photoObjectKey === null
                        ? "No photo uploaded"
                        : isLoadingPhotos
                          ? "Loading photo…"
                          : "Photo preview unavailable"}
                    </div>
                  )}
                  <span className="host-round-number">Round {index + 1}</span>
                </div>

                <div className="host-round-details">
                  <div>
                    <p className="eyebrow">Teammate</p>
                    <h3>{teammateName}</h3>
                  </div>

                  <dl className="host-round-facts">
                    <div>
                      <dt>Location</dt>
                      <dd>{locationLabel}</dd>
                    </div>
                    <div>
                      <dt>Coordinates</dt>
                      <dd>{answer === undefined ? "Not loaded" : formatCoordinates(answer)}</dd>
                    </div>
                  </dl>

                  <div className="host-round-activity" aria-label={`Round ${index + 1} activity`}>
                    <span>{roundGuesses.length} guesses</span>
                    <span>
                      {roundScores.length === 0
                        ? "Not scored"
                        : `${roundScores.filter((score) => score.scored).length} scored`}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

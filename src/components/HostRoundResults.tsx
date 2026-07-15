import type { ReactElement } from "react";
import { formatDistanceKm } from "../lib/format";
import { formatCoordinates } from "../lib/mapLogic";
import type {
  Guess,
  Participant,
  Round,
  RoundAnswer,
  RoundScore,
} from "../types";

interface HostRoundResultsProps {
  round: Round;
  answer: RoundAnswer | null;
  participants: Participant[];
  guesses: Guess[];
  scores: RoundScore[];
}

interface RoundResultEntry {
  participant: Participant;
  guess: Guess | null;
  distanceKm: number | null;
  isRoundSubject: boolean;
}

interface RankedRoundResultEntry extends RoundResultEntry {
  rank: number | null;
}

function unscoredSortOrder(entry: RoundResultEntry): number {
  return entry.isRoundSubject ? 2 : 1;
}

/** Shows the host every revealed-round guess ranked independently by distance. */
export function HostRoundResults({
  round,
  answer,
  participants,
  guesses,
  scores,
}: HostRoundResultsProps): ReactElement {
  const roundGuesses = guesses.filter((guess) => guess.roundId === round.id);
  const roundScores = scores.filter((score) => score.roundId === round.id);
  const resultEntries: RoundResultEntry[] = participants
    .map((participant) => {
      const guess =
        roundGuesses.find((candidate) => candidate.participantId === participant.id) ??
        null;
      const score = roundScores.find(
        (candidate) => candidate.participantId === participant.id,
      );

      return {
        participant,
        guess,
        distanceKm: score?.scored === true ? score.distanceKm : null,
        isRoundSubject: participant.teamMemberId === round.subjectMemberId,
      };
    })
    .sort((first, second) => {
      if (first.distanceKm !== null && second.distanceKm !== null) {
        return first.distanceKm - second.distanceKm;
      }
      if (first.distanceKm !== null) {
        return -1;
      }
      if (second.distanceKm !== null) {
        return 1;
      }

      return unscoredSortOrder(first) - unscoredSortOrder(second);
    });

  let scoredPosition = 0;
  let previousDistance: number | null = null;
  let previousRank = 0;
  const rankedEntries: RankedRoundResultEntry[] = resultEntries.map((entry) => {
    if (entry.distanceKm === null) {
      return { ...entry, rank: null };
    }

    scoredPosition += 1;
    if (previousDistance === null || entry.distanceKm !== previousDistance) {
      previousRank = scoredPosition;
    }
    previousDistance = entry.distanceKm;
    return { ...entry, rank: previousRank };
  });
  const closestDistance = rankedEntries.find(
    (entry) => entry.distanceKm !== null,
  )?.distanceKm;

  return (
    <section className="host-round-results" aria-labelledby="host-round-results-title">
      <div className="host-round-results-heading">
        <div>
          <p className="eyebrow">This round</p>
          <h3 id="host-round-results-title">Round results</h3>
        </div>
        <span>
          {answer === null ? "Answer revealed" : `Closest to ${answer.locationLabel}`}
        </span>
      </div>

      {rankedEntries.length === 0 ? (
        <p className="muted">No players joined this round.</p>
      ) : (
        <ol className="host-round-result-list">
          {rankedEntries.map((entry) => {
            const isClosest =
              entry.distanceKm !== null && entry.distanceKm === closestDistance;
            const resultLabel = entry.isRoundSubject
              ? "Round subject"
              : entry.guess === null
                ? "No answer"
                : formatDistanceKm(entry.distanceKm);

            return (
              <li
                key={entry.participant.id}
                className={isClosest ? "closest" : entry.distanceKm === null ? "unscored" : ""}
              >
                <span className="host-round-result-rank">
                  {entry.rank === null ? "—" : entry.rank}
                </span>
                <div className="host-round-result-player">
                  <strong>{entry.participant.displayName}</strong>
                  <span>
                    {entry.isRoundSubject
                      ? "Not required to guess"
                      : entry.guess === null
                        ? "No guess submitted"
                        : `Guess: ${formatCoordinates(entry.guess)}`}
                  </span>
                </div>
                {isClosest ? <span className="closest-chip">Closest</span> : null}
                <strong className="host-round-result-distance">{resultLabel}</strong>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

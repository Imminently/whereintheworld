import type { ReactElement } from "react";
import { buildLeaderboard, determineWinners } from "../lib/gameLogic";
import { formatDistanceKm } from "../lib/format";
import type { GamePhase, Participant, RoundScore } from "../types";

interface LeaderboardProps {
  participants: Participant[];
  scores: RoundScore[];
  phase: GamePhase;
}

/** Shows ranked cumulative distance, with ties sharing the same rank. */
export function Leaderboard({
  participants,
  scores,
  phase,
}: LeaderboardProps): ReactElement {
  const leaderboardEntries = buildLeaderboard(participants, scores);
  const winners = phase === "finished" ? determineWinners(leaderboardEntries) : [];
  const winnerNames = winners.map((winner) => winner.displayName).join(", ");

  return (
    <section className="panel leaderboard-panel" aria-labelledby="leaderboard-title">
      <div className="panel-heading">
        <h2 id="leaderboard-title">Leaderboard</h2>
        {winnerNames.length > 0 ? <span className="winner-chip">{winnerNames}</span> : null}
      </div>
      {leaderboardEntries.length === 0 ? (
        <p className="muted">Players will appear after they join.</p>
      ) : (
        <ol className="leaderboard-list">
          {leaderboardEntries.map((entry) => (
            <li key={entry.participantId} className="leaderboard-row">
              <span className="rank">{entry.rank}</span>
              <span className="leaderboard-name">{entry.displayName}</span>
              <span className="distance">{formatDistanceKm(entry.totalDistanceKm)}</span>
              <span className="round-count">{entry.roundsScored} scored</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

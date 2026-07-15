import type { ReactElement } from "react";
import type { Guess, Participant, Round } from "../types";

interface HostSubmissionStatusProps {
  round: Round;
  participants: Participant[];
  guesses: Guess[];
}

/** Shows the host which eligible players have submitted during the active round. */
export function HostSubmissionStatus({
  round,
  participants,
  guesses,
}: HostSubmissionStatusProps): ReactElement {
  const activeGuessParticipantIds = new Set(
    guesses
      .filter((guess) => guess.roundId === round.id)
      .map((guess) => guess.participantId),
  );
  const eligibleParticipants = participants.filter(
    (participant) => participant.teamMemberId !== round.subjectMemberId,
  );
  const submittedCount = eligibleParticipants.filter((participant) =>
    activeGuessParticipantIds.has(participant.id),
  ).length;
  const waitingCount = eligibleParticipants.length - submittedCount;
  const allEligiblePlayersSubmitted =
    eligibleParticipants.length > 0 && waitingCount === 0;

  return (
    <section
      className={`host-submission-status ${allEligiblePlayersSubmitted ? "all-submitted" : ""}`}
      aria-labelledby="host-submission-title"
      aria-live="polite"
    >
      <div className="host-submission-heading">
        <div>
          <p className="eyebrow">Answers locked in</p>
          <h3 id="host-submission-title">
            {submittedCount} of {eligibleParticipants.length}
          </h3>
        </div>
        <span className="host-submission-summary">
          {eligibleParticipants.length === 0
            ? "No answers required"
            : allEligiblePlayersSubmitted
              ? "Ready to reveal"
              : `${waitingCount} waiting`}
        </span>
      </div>

      {eligibleParticipants.length > 0 ? (
        <div
          className="host-submission-progress"
          role="progressbar"
          aria-label="Eligible answers locked in"
          aria-valuemin={0}
          aria-valuemax={eligibleParticipants.length}
          aria-valuenow={submittedCount}
        >
          <span
            style={{ width: `${(submittedCount / eligibleParticipants.length) * 100}%` }}
          />
        </div>
      ) : null}

      <ul className="host-submission-players">
        {participants.map((participant) => {
          const isRoundSubject = participant.teamMemberId === round.subjectMemberId;
          const hasSubmitted = activeGuessParticipantIds.has(participant.id);
          const status = isRoundSubject
            ? "Round subject"
            : hasSubmitted
              ? "Locked in"
              : "Waiting";

          return (
            <li
              key={participant.id}
              className={
                isRoundSubject
                  ? "round-subject"
                  : hasSubmitted
                    ? "submitted"
                    : "waiting"
              }
            >
              <span className="host-submission-icon" aria-hidden="true">
                {isRoundSubject ? "—" : hasSubmitted ? "✓" : "·"}
              </span>
              <strong>{participant.displayName}</strong>
              <span>{status}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

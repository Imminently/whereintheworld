import type { ReactElement } from "react";

interface HostReplayControlsProps {
  roundCount: number;
  participantCount: number;
  isBusy: boolean;
  isConfirming: boolean;
  onRequestReplay: () => void;
  onConfirmReplay: () => void;
  onCancelReplay: () => void;
}

/** Provides a guarded host action for replaying with retained content and fresh players. */
export function HostReplayControls({
  roundCount,
  participantCount,
  isBusy,
  isConfirming,
  onRequestReplay,
  onConfirmReplay,
  onCancelReplay,
}: HostReplayControlsProps): ReactElement {
  if (isConfirming) {
    return (
      <div className="replay-confirmation" role="alert">
        <div>
          <p className="eyebrow">Confirm replay</p>
          <h3>Clear this run and return to the lobby?</h3>
          <p>
            This signs out {participantCount} current{" "}
            {participantCount === 1 ? "player" : "players"} and removes every guess,
            reveal, and score. The {roundCount} loaded rounds, images, and locations stay
            in place. A new join code will be created.
          </p>
        </div>
        <div className="button-row">
          <button
            className="primary-button"
            disabled={isBusy}
            onClick={onConfirmReplay}
          >
            Confirm play again
          </button>
          <button disabled={isBusy} onClick={onCancelReplay}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="replay-callout">
      <div>
        <p className="eyebrow">Ready for another game?</p>
        <h3>Replay with the same team and content</h3>
        <p>Players rejoin with a new code. Your rounds, images, and locations stay in place.</p>
      </div>
      <button
        className="primary-button"
        disabled={isBusy}
        onClick={onRequestReplay}
      >
        Play again
      </button>
    </div>
  );
}

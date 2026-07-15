import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HostReplayControls } from "./HostReplayControls";

describe("HostReplayControls", () => {
  it("starts with a guarded play-again action", () => {
    const onRequestReplay = vi.fn();
    render(
      <HostReplayControls
        roundCount={4}
        participantCount={4}
        isBusy={false}
        isConfirming={false}
        onRequestReplay={onRequestReplay}
        onConfirmReplay={vi.fn()}
        onCancelReplay={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Play again" }));

    expect(onRequestReplay).toHaveBeenCalledOnce();
    expect(
      screen.getByText(
        "Players rejoin with a new code. Your rounds, images, and locations stay in place.",
      ),
    ).toBeInTheDocument();
  });

  it("explains retained and cleared data before confirmation", () => {
    const onConfirmReplay = vi.fn();
    const onCancelReplay = vi.fn();
    render(
      <HostReplayControls
        roundCount={3}
        participantCount={5}
        isBusy={false}
        isConfirming
        onRequestReplay={vi.fn()}
        onConfirmReplay={onConfirmReplay}
        onCancelReplay={onCancelReplay}
      />,
    );

    expect(
      screen.getByText(
        "This signs out 5 current players and removes every guess, reveal, and score. The 3 loaded rounds, images, and locations stay in place. A new join code will be created.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirm play again" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onConfirmReplay).toHaveBeenCalledOnce();
    expect(onCancelReplay).toHaveBeenCalledOnce();
  });
});

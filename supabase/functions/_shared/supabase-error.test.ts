import { describe, expect, it } from "vitest";
import { createResetGameError } from "./supabase-error";

describe("createResetGameError", () => {
  it("identifies a missing reset migration from a PostgREST error object", () => {
    const error = createResetGameError({
      code: "PGRST202",
      message: "Could not find the function public.reset_game_for_replay in the schema cache",
    });

    expect(error.message).toBe(
      "Game reset is not installed in this Supabase project. Apply migration 20260714000000_reset_game_for_replay.sql.",
    );
  });

  it("identifies missing execute permission", () => {
    const error = createResetGameError({
      code: "42501",
      message: "permission denied for function reset_game_for_replay",
    });

    expect(error.message).toBe(
      "Game reset is installed, but its database permission is missing. Reapply the reset migration.",
    );
  });

  it("does not expose unexpected database errors to the client", () => {
    const error = createResetGameError({
      code: "XX000",
      message: "internal detail that should remain in server logs",
    });

    expect(error.message).toBe(
      "Could not reset the game. Check the host-command logs for details.",
    );
  });
});

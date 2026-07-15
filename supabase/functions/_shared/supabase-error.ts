interface SupabaseErrorShape {
  code?: unknown;
  message?: unknown;
}

function readSupabaseError(error: unknown): SupabaseErrorShape {
  return typeof error === "object" && error !== null ? error : {};
}

/** Converts reset RPC failures into safe, actionable messages for authenticated hosts. */
export function createResetGameError(error: unknown): Error {
  const errorShape = readSupabaseError(error);
  const code = typeof errorShape.code === "string" ? errorShape.code : null;
  const message = typeof errorShape.message === "string" ? errorShape.message : "";

  if (code === "42501") {
    return new Error(
      "Game reset is installed, but its database permission is missing. Reapply the reset migration.",
    );
  }

  if (code === "PGRST202" || message.includes("reset_game_for_replay")) {
    return new Error(
      "Game reset is not installed in this Supabase project. Apply migration 20260714000000_reset_game_for_replay.sql.",
    );
  }

  return new Error("Could not reset the game. Check the host-command logs for details.");
}

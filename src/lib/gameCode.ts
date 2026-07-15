export const MOCK_GAME_CODE = "5635";

/** Returns whether a player-entered code selects the local demo experience. */
export function isMockGameCode(code: string): boolean {
  return code.trim() === MOCK_GAME_CODE;
}

/** Validates codes intended for live games and rejects the reserved demo code. */
export function assertLiveGameCode(code: string): void {
  const normalizedCode = code.trim();

  if (!/^\d{4}$/.test(normalizedCode)) {
    throw new Error("Game code must be exactly four digits.");
  }

  if (isMockGameCode(normalizedCode)) {
    throw new Error("This game code is unavailable.");
  }
}

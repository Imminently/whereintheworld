import { describe, expect, it } from "vitest";
import {
  assertLiveGameCode,
  isMockGameCode,
  MOCK_GAME_CODE,
} from "./gameCode";

describe("game code reservation", () => {
  it("recognises the reserved demo code after trimming", () => {
    expect(isMockGameCode(` ${MOCK_GAME_CODE} `)).toBe(true);
    expect(isMockGameCode("5634")).toBe(false);
  });

  it("rejects the demo code for live game creation", () => {
    expect(() => assertLiveGameCode(MOCK_GAME_CODE)).toThrow(
      "This game code is unavailable.",
    );
  });

  it("still validates normal four-digit live codes", () => {
    expect(() => assertLiveGameCode("2841")).not.toThrow();
    expect(() => assertLiveGameCode("123")).toThrow(
      "exactly four digits",
    );
  });
});

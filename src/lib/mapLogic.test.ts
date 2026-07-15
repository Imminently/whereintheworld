import { describe, expect, it } from "vitest";
import {
  formatCoordinates,
  getShortestMapLineCoordinates,
  isValidGuess,
  mapClickToCoordinates,
  normalizeLongitude,
} from "./mapLogic";

describe("normalizeLongitude", () => {
  it("wraps longitudes into the persisted range", () => {
    expect(normalizeLongitude(181)).toBe(-179);
    expect(normalizeLongitude(-181)).toBe(179);
    expect(normalizeLongitude(360)).toBe(0);
  });
});

describe("mapClickToCoordinates", () => {
  it("converts a MapLibre-like click into latitude and longitude", () => {
    expect(mapClickToCoordinates({ lngLat: { lat: 12.5, lng: 181 } })).toEqual({
      latitude: 12.5,
      longitude: -179,
    });
  });
});

describe("isValidGuess", () => {
  it("accepts valid world coordinates", () => {
    expect(isValidGuess({ latitude: 90, longitude: -180 })).toBe(true);
  });

  it("rejects invalid world coordinates", () => {
    expect(isValidGuess({ latitude: 91, longitude: 0 })).toBe(false);
    expect(isValidGuess({ latitude: 0, longitude: 181 })).toBe(false);
  });
});

describe("formatCoordinates", () => {
  it("formats coordinates consistently for UI display", () => {
    expect(formatCoordinates({ latitude: 1.23456, longitude: -2.34567 })).toBe(
      "1.2346, -2.3457",
    );
  });
});

describe("getShortestMapLineCoordinates", () => {
  it("keeps ordinary reveal lines in the same world copy", () => {
    expect(
      getShortestMapLineCoordinates(
        { latitude: 10, longitude: -20 },
        { latitude: 30, longitude: 40 },
      ),
    ).toEqual([
      [-20, 10],
      [40, 30],
    ]);
  });

  it("uses the short route when crossing the antimeridian eastward", () => {
    expect(
      getShortestMapLineCoordinates(
        { latitude: 10, longitude: 170 },
        { latitude: 20, longitude: -170 },
      ),
    ).toEqual([
      [170, 10],
      [190, 20],
    ]);
  });

  it("uses the short route when crossing the antimeridian westward", () => {
    expect(
      getShortestMapLineCoordinates(
        { latitude: 10, longitude: -170 },
        { latitude: 20, longitude: 170 },
      ),
    ).toEqual([
      [-170, 10],
      [-190, 20],
    ]);
  });
});

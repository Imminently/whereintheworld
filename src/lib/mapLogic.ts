import type { Coordinates } from "../types";

export interface MapLngLatLike {
  lat: number;
  lng: number;
}

export interface MapClickLike {
  lngLat: MapLngLatLike;
}

/** Normalizes longitude to the -180 through 180 range used by persisted guesses. */
export function normalizeLongitude(longitude: number): number {
  if (!Number.isFinite(longitude)) {
    return longitude;
  }

  const normalized = ((((longitude + 180) % 360) + 360) % 360) - 180;
  return Object.is(normalized, -0) ? 0 : normalized;
}

/** Converts a MapLibre click event shape into the app's coordinate shape. */
export function mapClickToCoordinates(event: MapClickLike): Coordinates {
  return {
    latitude: event.lngLat.lat,
    longitude: normalizeLongitude(event.lngLat.lng),
  };
}

/** Returns true when coordinates are within valid latitude and longitude bounds. */
export function isValidGuess(coordinates: Coordinates): boolean {
  return (
    Number.isFinite(coordinates.latitude) &&
    Number.isFinite(coordinates.longitude) &&
    coordinates.latitude >= -90 &&
    coordinates.latitude <= 90 &&
    coordinates.longitude >= -180 &&
    coordinates.longitude <= 180
  );
}

/** Formats coordinates for compact host/player display. */
export function formatCoordinates(coordinates: Coordinates): string {
  return `${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)}`;
}

/** Returns map line endpoints adjusted to take the shortest path across world copies. */
export function getShortestMapLineCoordinates(
  start: Coordinates,
  end: Coordinates,
): [[number, number], [number, number]] {
  const startLongitude = start.longitude;
  let endLongitude = end.longitude;
  const longitudeDifference = endLongitude - startLongitude;

  if (longitudeDifference > 180) {
    endLongitude -= 360;
  } else if (longitudeDifference < -180) {
    endLongitude += 360;
  }

  return [
    [startLongitude, start.latitude],
    [endLongitude, end.latitude],
  ];
}

/** Formats kilometers with a stable precision for gameplay displays. */
export function formatDistanceKm(distanceKm: number | null): string {
  if (distanceKm === null) {
    return "No guess";
  }

  if (distanceKm < 10) {
    return `${distanceKm.toFixed(2)} km`;
  }

  return `${Math.round(distanceKm).toLocaleString()} km`;
}

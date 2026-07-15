export interface GameSummaryResponse {
  id: string;
  title: string;
  phase: string;
  currentRoundId: string | null;
  createdAt: string;
}

export function toGameSummary(row: {
  id: string;
  title: string;
  phase: string;
  current_round_id: string | null;
  created_at: string;
}): GameSummaryResponse {
  return {
    id: row.id,
    title: row.title,
    phase: row.phase,
    currentRoundId: row.current_round_id,
    createdAt: row.created_at,
  };
}

export function toTeamMember(row: {
  id: string;
  game_id: string;
  display_name: string;
  sort_order: number;
}) {
  return {
    id: row.id,
    gameId: row.game_id,
    displayName: row.display_name,
    sortOrder: row.sort_order,
  };
}

export function toParticipant(row: {
  id: string;
  game_id: string;
  user_id: string | null;
  team_member_id: string;
  display_name: string;
  joined_at: string;
}) {
  return {
    id: row.id,
    gameId: row.game_id,
    userId: row.user_id,
    teamMemberId: row.team_member_id,
    displayName: row.display_name,
    joinedAt: row.joined_at,
  };
}

export function calculateDistanceKm(
  firstLatitude: number,
  firstLongitude: number,
  secondLatitude: number,
  secondLongitude: number,
): number {
  const earthRadiusKm = 6371.0088;
  const degreesToRadians = Math.PI / 180;
  const latitudeDelta = (secondLatitude - firstLatitude) * degreesToRadians;
  const longitudeDelta = (secondLongitude - firstLongitude) * degreesToRadians;
  const firstLatitudeRadians = firstLatitude * degreesToRadians;
  const secondLatitudeRadians = secondLatitude * degreesToRadians;

  const halfChordLength =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitudeRadians) *
      Math.cos(secondLatitudeRadians) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    2 *
    earthRadiusKm *
    Math.atan2(Math.sqrt(halfChordLength), Math.sqrt(1 - halfChordLength))
  );
}

export function assertValidCode(code: string): void {
  if (!/^\d{4}$/.test(code)) {
    throw new Error("Game code must be exactly four digits.");
  }
}

export function assertValidCoordinates(latitude: number, longitude: number): void {
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error("Coordinates are outside valid bounds.");
  }
}

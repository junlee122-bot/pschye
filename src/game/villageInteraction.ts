export interface VillagePoint {
  x: number;
  y: number;
}

export interface VillageReadiness {
  sceneId: string;
  nearTarget: boolean;
}

export const villageInteractionRadius = 94;

// Position saves can rebuild the React model without changing the interaction.
// Retain the snapshot until either its story scene or proximity changes.
export function updateVillageReadiness(
  previous: VillageReadiness | undefined,
  sceneId: string,
  player: VillagePoint,
  target: VillagePoint,
): VillageReadiness {
  const nearTarget = Math.hypot(player.x - target.x, player.y - target.y) < villageInteractionRadius;
  if (previous?.sceneId === sceneId && previous.nearTarget === nearTarget) return previous;
  return { sceneId, nearTarget };
}

export function isVillageTargetReady(sceneId: string, readiness: VillageReadiness | undefined) {
  return readiness?.sceneId === sceneId && readiness.nearTarget;
}

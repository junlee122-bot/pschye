import { describe, expect, it } from 'vitest';
import { isVillageTargetReady, updateVillageReadiness, villageInteractionRadius } from './villageInteraction';

const sceneId = 'village-dawn';
const target = { x: 676, y: 358 };

describe('village interaction readiness', () => {
  it('keeps the interaction available after movement, a position save, and an unchanged model synchronization', () => {
    const outside = updateVillageReadiness(undefined, sceneId, { x: 500, y: 358 }, target);
    const entered = updateVillageReadiness(outside, sceneId, { x: 600, y: 358 }, target);
    expect(isVillageTargetReady(sceneId, outside)).toBe(false);
    expect(isVillageTargetReady(sceneId, entered)).toBe(true);

    // The saved position and the reconstructed model are new objects, while
    // the live player remains inside the same interaction radius after stopping.
    const savedPosition = { x: 628, y: 358 };
    const afterSave = updateVillageReadiness(entered, sceneId, savedPosition, { ...target });
    const stopped = updateVillageReadiness(afterSave, sceneId, { ...savedPosition }, { ...target });
    expect(afterSave).toBe(entered);
    expect(stopped).toBe(entered);
    expect(isVillageTargetReady(sceneId, stopped)).toBe(true);
  });

  it('does not use a previous scene’s proximity while a new story target is being synchronized', () => {
    const player = { x: 628, y: 358 };
    const previous = updateVillageReadiness(undefined, sceneId, player, target);
    expect(isVillageTargetReady('kazrin-at-the-well', previous)).toBe(false);

    const current = updateVillageReadiness(previous, 'kazrin-at-the-well', player, target);
    expect(current).not.toBe(previous);
    expect(isVillageTargetReady('kazrin-at-the-well', current)).toBe(true);
    expect(isVillageTargetReady(sceneId, current)).toBe(false);
  });

  it('re-evaluates a relocated target even when the player has stopped moving', () => {
    const player = { x: 628, y: 358 };
    const near = updateVillageReadiness(undefined, sceneId, player, target);
    const distant = updateVillageReadiness(near, sceneId, player, { x: 1000, y: 358 });
    expect(isVillageTargetReady(sceneId, distant)).toBe(false);
    const returned = updateVillageReadiness(distant, sceneId, player, target);
    expect(isVillageTargetReady(sceneId, returned)).toBe(true);
  });

  it('creates a fresh initial snapshot after a scene restart, including a spawn already near the target', () => {
    const player = { x: 628, y: 358 };
    const beforeRestart = updateVillageReadiness(undefined, sceneId, player, target);
    const restarted = updateVillageReadiness(undefined, sceneId, player, target);
    expect(restarted).not.toBe(beforeRestart);
    expect(isVillageTargetReady(sceneId, restarted)).toBe(true);
    expect(isVillageTargetReady(sceneId, undefined)).toBe(false);
  });

  it('disables the interaction upon leaving the radius and enables it on re-entry', () => {
    const entered = updateVillageReadiness(undefined, sceneId, { x: 628, y: 358 }, target);
    const left = updateVillageReadiness(entered, sceneId, { x: 550, y: 358 }, target);
    expect(left).not.toBe(entered);
    expect(isVillageTargetReady(sceneId, left)).toBe(false);
    const returned = updateVillageReadiness(left, sceneId, { x: 628, y: 358 }, target);
    expect(isVillageTargetReady(sceneId, returned)).toBe(true);
  });

  it('uses the existing circular, strictly less than 94 pixel interaction boundary', () => {
    expect(isVillageTargetReady(sceneId, updateVillageReadiness(undefined, sceneId, { x: target.x + villageInteractionRadius, y: target.y }, target))).toBe(false);
    expect(isVillageTargetReady(sceneId, updateVillageReadiness(undefined, sceneId, { x: target.x + villageInteractionRadius - 1, y: target.y }, target))).toBe(true);
    expect(isVillageTargetReady(sceneId, updateVillageReadiness(undefined, sceneId, { x: target.x + 70, y: target.y + 70 }, target))).toBe(false);
  });
});

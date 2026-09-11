import { describe, expect, it } from 'vitest';
import { heroDefinitions } from '../data/battle';
import { createWorldSimulationState, executeGameCommand } from './simulation';

describe('world simulation', () => {
  it('records landmarks once while preserving Raon position', () => {
    const initial = createWorldSimulationState();
    const first = executeGameCommand(initial, {
      type: 'move',
      x: 720,
      y: 310,
      landmark: 'village-square',
    });
    const repeated = executeGameCommand(first.state, {
      type: 'move',
      x: 740,
      y: 315,
      landmark: 'village-square',
    });

    expect(repeated.state.village.playerX).toBe(740);
    expect(repeated.state.village.visitedLandmarks).toEqual(['village-square']);
    expect(first.events.some((event) => event.type === 'landmark-discovered')).toBe(true);
    expect(repeated.events.some((event) => event.type === 'landmark-discovered')).toBe(false);
  });

  it('lets NPCs remember Raon choices across later conversations', () => {
    const initial = createWorldSimulationState();
    const met = executeGameCommand(initial, {
      type: 'interact',
      npcId: 'kazrin',
      fact: 'met-before-selection',
    });
    const decided = executeGameCommand(met.state, {
      type: 'choose-dialogue',
      npcId: 'kazrin',
      choiceId: 'stand-together',
      affinity: 7,
      fact: 'promised-to-return',
    });

    expect(decided.state.npcMemories.kazrin).toMatchObject({
      affinity: 7,
      lastChoice: 'stand-together',
      rememberedFacts: ['met-before-selection', 'promised-to-return'],
    });
  });

  it('advances day phases and preserves modular headquarters slots', () => {
    const initial = createWorldSimulationState();
    const dusk = executeGameCommand(initial, { type: 'advance-time', minutes: 690 });
    const night = executeGameCommand(dusk.state, { type: 'advance-time', minutes: 180 });
    const placed = executeGameCommand(night.state, {
      type: 'place-room',
      slot: 2,
      facilityId: 'violet',
    });

    expect(dusk.state.phase).toBe('dusk');
    expect(night.state.phase).toBe('night');
    expect(placed.state.headquartersLayout).toHaveLength(5);
    expect(placed.state.headquartersLayout.find((room) => room.slot === 2)?.facilityId).toBe('violet');
  });

  it('ships a dedicated optimized portrait for every seventh-generation captain', () => {
    expect(heroDefinitions).toHaveLength(6);
    expect(heroDefinitions.every((hero) => hero.art.startsWith('/art/portraits/'))).toBe(true);
    expect(heroDefinitions.every((hero) => hero.art.endsWith('.webp'))).toBe(true);
    expect(new Set(heroDefinitions.map((hero) => hero.art)).size).toBe(heroDefinitions.length);
  });
});

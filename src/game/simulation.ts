import type { FacilityId, NpcMemoryRecord, WorldSimulationState, WorldTimePhase } from '../types';

export type GameCommand =
  | { type: 'move'; x: number; y: number; landmark?: string }
  | { type: 'interact'; npcId: string; fact?: string }
  | { type: 'choose-dialogue'; npcId: string; choiceId: string; affinity: number; fact: string }
  | { type: 'advance-time'; minutes: number }
  | { type: 'change-region'; regionId: string }
  | { type: 'place-room'; slot: number; facilityId: FacilityId };

export type GameEvent =
  | { type: 'player-moved'; x: number; y: number }
  | { type: 'landmark-discovered'; landmark: string }
  | { type: 'npc-met'; npcId: string }
  | { type: 'npc-memory-changed'; npcId: string; memory: NpcMemoryRecord }
  | { type: 'time-advanced'; minutes: number; phase: WorldTimePhase }
  | { type: 'region-changed'; regionId: string }
  | { type: 'room-placed'; slot: number; facilityId: FacilityId };

function phaseFromMinutes(minutes: number): WorldTimePhase {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  if (normalized < 420) return 'dawn';
  if (normalized < 1020) return 'day';
  if (normalized < 1200) return 'dusk';
  return 'night';
}

function addJournal(state: WorldSimulationState, entry: string) {
  return [entry, ...state.eventJournal].slice(0, 40);
}

export function executeGameCommand(state: WorldSimulationState, command: GameCommand) {
  const events: GameEvent[] = [];
  let next = state;

  if (command.type === 'move') {
    const visitedLandmarks = command.landmark
      ? [...new Set([...state.village.visitedLandmarks, command.landmark])]
      : state.village.visitedLandmarks;
    next = {
      ...state,
      village: { ...state.village, playerX: command.x, playerY: command.y, visitedLandmarks },
    };
    events.push({ type: 'player-moved', x: command.x, y: command.y });
    if (command.landmark && !state.village.visitedLandmarks.includes(command.landmark)) {
      events.push({ type: 'landmark-discovered', landmark: command.landmark });
      next = { ...next, eventJournal: addJournal(next, `새 장소 발견 · ${command.landmark}`) };
    }
  }

  if (command.type === 'interact') {
    const previous = state.npcMemories[command.npcId];
    const memory: NpcMemoryRecord = previous ?? {
      affinity: 0,
      rememberedFacts: [],
      lastSeenDay: 1,
    };
    const rememberedFacts = command.fact
      ? [...new Set([...memory.rememberedFacts, command.fact])]
      : memory.rememberedFacts;
    next = {
      ...state,
      npcMemories: { ...state.npcMemories, [command.npcId]: { ...memory, rememberedFacts } },
      eventJournal: addJournal(state, `${command.npcId}와 대화했다.`),
    };
    events.push({ type: 'npc-met', npcId: command.npcId });
  }

  if (command.type === 'choose-dialogue') {
    const previous = state.npcMemories[command.npcId] ?? {
      affinity: 0,
      rememberedFacts: [],
      lastSeenDay: 1,
    };
    const memory: NpcMemoryRecord = {
      affinity: Math.max(-100, Math.min(100, previous.affinity + command.affinity)),
      lastChoice: command.choiceId,
      rememberedFacts: [...new Set([...previous.rememberedFacts, command.fact])],
      lastSeenDay: Math.max(1, Math.floor(state.minutes / 1440) + 1),
    };
    next = {
      ...state,
      npcMemories: { ...state.npcMemories, [command.npcId]: memory },
      eventJournal: addJournal(state, `${command.npcId}은(는) 라온의 선택을 기억한다.`),
    };
    events.push({ type: 'npc-memory-changed', npcId: command.npcId, memory });
  }

  if (command.type === 'advance-time') {
    const minutes = state.minutes + command.minutes;
    const phase = phaseFromMinutes(minutes);
    next = { ...state, minutes, phase };
    events.push({ type: 'time-advanced', minutes, phase });
  }

  if (command.type === 'change-region') {
    next = {
      ...state,
      currentRegion: command.regionId,
      discoveredLocations: [...new Set([...state.discoveredLocations, command.regionId])],
      eventJournal: addJournal(state, `새 지역 진입 · ${command.regionId}`),
    };
    events.push({ type: 'region-changed', regionId: command.regionId });
  }

  if (command.type === 'place-room') {
    const headquartersLayout = [
      ...state.headquartersLayout.filter((entry) => entry.slot !== command.slot),
      { slot: command.slot, facilityId: command.facilityId },
    ].sort((left, right) => left.slot - right.slot);
    next = {
      ...state,
      headquartersLayout,
      eventJournal: addJournal(state, `본부 ${command.slot + 1}구역에 ${command.facilityId} 배치.`),
    };
    events.push({ type: 'room-placed', slot: command.slot, facilityId: command.facilityId });
  }

  return { state: next, events };
}

export function createWorldSimulationState(): WorldSimulationState {
  return {
    minutes: 360,
    phase: 'dawn',
    weather: 'clear',
    currentRegion: 'frontier-village',
    discoveredLocations: ['frontier-village'],
    npcMemories: {},
    village: { playerX: 366, playerY: 606, visitedLandmarks: [], completedErrands: [] },
    headquartersLayout: [
      { slot: 0, facilityId: 'training' },
      { slot: 1, facilityId: 'archive' },
      { slot: 2, facilityId: 'infirmary' },
      { slot: 3, facilityId: 'forge' },
      { slot: 4, facilityId: 'violet' },
    ],
    eventJournal: ['A.S. 84 · 변방 마을의 새벽이 밝았다.'],
  };
}

import { facilities, missions } from '../data/campaign';
import { heroDefinitions } from '../data/battle';
import { canUnlockHeroGrowthNode, getHeroGrowthBonuses, getHeroGrowthNode } from '../data/heroGrowth';
import { getOriginStoryScene, originStoryStartId } from '../data/originStory';
import { getRaonStoryBeat, raonChoiceConsequences } from '../data/story';
import { craftRecipes, dailyActivities, dispatchOperations, getEquipment, strategicOrders } from '../data/systems';
import type {
  BattleState,
  CampaignProfile,
  CraftRecipe,
  DailyActivityDefinition,
  DailyActivityId,
  DispatchDefinition,
  EquipmentSlot,
  FacilityId,
  FactionId,
  HeroDefinition,
  HeroProgress,
  MissionDefinition,
  MissionDifficulty,
  RaonStoryChoiceId,
  StrategicOrderDefinition,
  StrategicOrderId,
  TrainingFocus,
} from '../types';
import { deleteMirroredCampaignSlot, isCampaignProfileCandidate, isSaveObject, mirrorCampaignSlot, nextCampaignSaveTimestamp, restoreMirroredCampaignSlot, type CampaignLoadResult, type CampaignSlotSummary } from './persistence';
import { createWorldSimulationState, executeGameCommand } from './simulation';

export const campaignStorageKey = 'raonjena-campaign-v10';
export const activeCampaignSlotKey = 'raonjena-active-slot';
const legacyStorageKeys = ['raonjena-campaign-v9', 'raonjena-campaign-v8', 'raonjena-campaign-v7', 'raonjena-campaign-v6', 'raonjena-campaign-v5', 'raonjena-campaign-v4', 'raonjena-campaign-v3', 'raonjena-campaign-v2'];

function storageKeyForSlot(slot: number) {
  return `${campaignStorageKey}-slot-${slot}`;
}

const starterWeapons: Record<string, string> = {
  hadori: 'breaker-gauntlet',
  raon: 'petal-training-blade',
  kazrin: 'silver-orbit-lance',
  kain: 'valder-heir-spear',
  leo: 'gate-wraps',
  chris: 'equilibrium-sabre',
};

const starterInventory = [...Object.values(starterWeapons), 'field-kit'];

function createHeroProgress(heroId: string, index: number): HeroProgress {
  return {
    level: index < 2 ? 3 : 2,
    xp: index * 8,
    bond: 12 + index * 3,
    skillPoints: 1,
    unlockedNodes: ['foundation'],
    equipment: [starterWeapons[heroId] ?? 'petal-training-blade', 'field-kit'],
  };
}

export function createNewCampaignProfile(): CampaignProfile {
  return {
    version: 10,
    commanderName: '라온',
    day: 1,
    commandLevel: 1,
    renown: 0,
    supplies: 320,
    intel: 40,
    relics: 0,
    commandActions: 3,
    activeSquad: heroDefinitions.map((hero) => hero.id),
    inventory: starterInventory,
    factions: { empire: 20, civilians: 10, cursed: 0, cheshi: -10 },
    completedDispatches: [],
    activityCounts: {},
    bondLevels: {},
    dailyCommandStats: { training: 0, bond: 0, field: 0 },
    dailyRewardClaimed: false,
    careerStats: { missions: 0, trainings: 0, bonds: 0, fieldActivities: 0, crafts: 0, dispatches: 0, perfectDays: 0 },
    claimedStrategicOrders: [],
    completedMissions: [],
    missionGrades: {},
    heroProgress: Object.fromEntries(
      heroDefinitions.map((hero, index) => [hero.id, createHeroProgress(hero.id, index)]),
    ),
    facilities: { training: 1, archive: 1, infirmary: 1, forge: 0, violet: 0 },
    unlockedRecords: ['official-salvation'],
    activityLog: ['A.S. 84 · 변방 마을에 프시케 선발관이 도착했다.'],
    raonPath: { compassion: 0, insight: 0, resolve: 0 },
    originStory: {
      currentSceneId: originStoryStartId,
      completed: false,
      completedSceneIds: [],
      choices: {},
      flags: [],
      selectionScore: 0,
    },
    storyChoices: {},
    narrativeChecks: {},
    relationshipMemories: {},
    world: createWorldSimulationState(),
  };
}

function normalizeHeroProgress(
  parsed: Partial<CampaignProfile>,
  defaults: CampaignProfile,
): Record<string, HeroProgress> {
  return Object.fromEntries(
    heroDefinitions.map((hero) => {
      const fallback = defaults.heroProgress[hero.id];
      const saved = parsed.heroProgress?.[hero.id];
      const equipment = saved?.equipment?.filter((id) => Boolean(getEquipment(id))) ?? [];
      return [
        hero.id,
        {
          ...fallback,
          ...saved,
          unlockedNodes: saved?.unlockedNodes ?? fallback.unlockedNodes,
          equipment: [
            equipment[0] ?? starterWeapons[hero.id] ?? 'petal-training-blade',
            equipment[1] ?? 'field-kit',
          ],
        },
      ];
    }),
  );
}

function migrateProfile(parsed: Partial<CampaignProfile>): CampaignProfile {
  const defaults = createNewCampaignProfile();
  const activeSquad = parsed.activeSquad?.filter((id) => heroDefinitions.some((hero) => hero.id === id));
  const inventory = parsed.inventory?.filter((id) => Boolean(getEquipment(id))) ?? [];
  return {
    ...defaults,
    ...parsed,
    version: 10,
    activeSquad: activeSquad && activeSquad.length >= 4 ? activeSquad : defaults.activeSquad,
    inventory: [...new Set([...starterInventory, ...inventory])],
    factions: { ...defaults.factions, ...parsed.factions },
    completedDispatches: parsed.completedDispatches ?? [],
    activityCounts: parsed.activityCounts ?? {},
    bondLevels: parsed.bondLevels ?? {},
    dailyCommandStats: { ...defaults.dailyCommandStats, ...parsed.dailyCommandStats },
    dailyRewardClaimed: parsed.dailyRewardClaimed ?? false,
    careerStats: { ...defaults.careerStats, ...parsed.careerStats },
    claimedStrategicOrders: parsed.claimedStrategicOrders ?? [],
    completedMissions: parsed.completedMissions ?? [],
    missionGrades: parsed.missionGrades ?? {},
    heroProgress: normalizeHeroProgress(parsed, defaults),
    facilities: { ...defaults.facilities, ...parsed.facilities },
    unlockedRecords: parsed.unlockedRecords ?? defaults.unlockedRecords,
    activityLog: parsed.activityLog ?? defaults.activityLog,
    raonPath: { ...defaults.raonPath, ...parsed.raonPath },
    originStory: {
      ...defaults.originStory,
      ...parsed.originStory,
      completedSceneIds: parsed.originStory?.completedSceneIds ?? defaults.originStory.completedSceneIds,
      choices: parsed.originStory?.choices ?? defaults.originStory.choices,
      flags: parsed.originStory?.flags ?? defaults.originStory.flags,
    },
    storyChoices: parsed.storyChoices ?? {},
    narrativeChecks: parsed.narrativeChecks ?? {},
    relationshipMemories: parsed.relationshipMemories ?? {},
    world: {
      ...defaults.world,
      ...parsed.world,
      npcMemories: parsed.world?.npcMemories ?? defaults.world.npcMemories,
      discoveredLocations: parsed.world?.discoveredLocations ?? defaults.world.discoveredLocations,
      headquartersLayout: parsed.world?.headquartersLayout ?? defaults.world.headquartersLayout,
      eventJournal: parsed.world?.eventJournal ?? defaults.world.eventJournal,
      village: {
        ...defaults.world.village,
        ...parsed.world?.village,
        visitedLandmarks: parsed.world?.village?.visitedLandmarks ?? defaults.world.village.visitedLandmarks,
        completedErrands: parsed.world?.village?.completedErrands ?? defaults.world.village.completedErrands,
      },
    },
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function deterministicRoll(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (Math.abs(hash) % 100) + 1;
}

export function getNarrativeCheckChance(
  profile: CampaignProfile,
  choiceId: RaonStoryChoiceId,
  companionId: string,
) {
  const pathMastery = profile.raonPath[choiceId] * 7;
  const pairBond = (profile.bondLevels[getBondKey('raon', companionId)] ?? 0) / 5;
  const companionTrust = (profile.heroProgress[companionId]?.bond ?? 0) / 10;
  return Math.round(clamp(48 + pathMastery + pairBond + companionTrust, 35, 92));
}

export function getWarPressure(profile: CampaignProfile) {
  if (!profile.originStory.completed) {
    return { value: 0, tier: 'calm' as const, label: '마을의 평온', effect: '라온은 아직 프시케의 전쟁에 들어가지 않았습니다.' };
  }
  const value = Math.round(clamp(18 + (profile.day - 1) * 5 - profile.completedMissions.length * 13, 0, 100));
  if (value >= 75) return { value, tier: 'collapse' as const, label: '붕괴 임박', effect: '적 증원과 민간 피해가 급증합니다.' };
  if (value >= 50) return { value, tier: 'critical' as const, label: '전선 위기', effect: '출전 사기가 크게 감소합니다.' };
  if (value >= 25) return { value, tier: 'strained' as const, label: '긴장 고조', effect: '시간을 쓸수록 전장이 불리해집니다.' };
  return { value, tier: 'calm' as const, label: '전선 안정', effect: '작전 준비에 여유가 있습니다.' };
}

export function chooseOriginStoryPath(
  profile: CampaignProfile,
  sceneId: string,
  choiceId: string,
) {
  if (profile.originStory.completed || profile.originStory.choices[sceneId]) return profile;
  const scene = getOriginStoryScene(sceneId);
  if (scene.id !== profile.originStory.currentSceneId) return profile;
  const choice = scene.choices.find((entry) => entry.id === choiceId);
  if (!choice) return profile;

  const pathLabels: Record<RaonStoryChoiceId, string> = { compassion: '연민', insight: '통찰', resolve: '결의' };
  const raonPath = { ...profile.raonPath, [choice.path]: profile.raonPath[choice.path] + 1 };
  const speakerIsCompanion = heroDefinitions.some((hero) => hero.id === scene.speakerId) && scene.speakerId !== 'raon';
  const bondKey = getBondKey('raon', scene.speakerId);

  const worldUpdate = executeGameCommand(profile.world, {
    type: 'choose-dialogue',
    npcId: scene.speakerId,
    choiceId,
    affinity: speakerIsCompanion ? 4 : 2,
    fact: choice.result,
  });

  return {
    ...profile,
    raonPath,
    originStory: {
      ...profile.originStory,
      choices: { ...profile.originStory.choices, [sceneId]: choiceId },
      flags: [...new Set([...profile.originStory.flags, choice.flag])],
      selectionScore: profile.originStory.selectionScore + choice.score,
    },
    bondLevels: speakerIsCompanion
      ? { ...profile.bondLevels, [bondKey]: Math.min(100, (profile.bondLevels[bondKey] ?? 0) + 4) }
      : profile.bondLevels,
    activityLog: [
      `${scene.title} · 라온은 ${pathLabels[choice.path]}의 선택을 남겼다.`,
      ...profile.activityLog,
    ].slice(0, 16),
    world: worldUpdate.state,
  };
}

export function advanceOriginStory(profile: CampaignProfile) {
  if (profile.originStory.completed) return profile;
  const scene = getOriginStoryScene(profile.originStory.currentSceneId);
  if (!profile.originStory.choices[scene.id]) return profile;
  const completedSceneIds = [...new Set([...profile.originStory.completedSceneIds, scene.id])];

  if (scene.nextSceneId) {
    return {
      ...profile,
      originStory: {
        ...profile.originStory,
        currentSceneId: scene.nextSceneId,
        completedSceneIds,
      },
    };
  }

  return {
    ...profile,
    originStory: {
      ...profile.originStory,
      completed: true,
      completedSceneIds,
    },
    unlockedRecords: [...new Set([...profile.unlockedRecords, 'psyche-generation-07', 'raon-origin'])],
    activityLog: [
      '프시케 제7기 입단 · 라온이 제2조장으로 첫 작전을 배정받았다.',
      ...profile.activityLog,
    ].slice(0, 16),
  };
}

export function chooseRaonStoryPath(
  profile: CampaignProfile,
  missionId: string,
  choiceId: RaonStoryChoiceId,
) {
  const previous = profile.storyChoices[missionId];
  if (previous === choiceId) return profile;
  const storyBeat = getRaonStoryBeat(missionId);
  const companionId = storyBeat?.companionId ?? 'hadori';
  const chance = getNarrativeCheckChance(profile, choiceId, companionId);
  const roll = deterministicRoll(`${profile.commanderName}:${missionId}:${choiceId}`);
  const outcome = roll <= chance ? 'clear' as const : 'costly' as const;
  const consequence = raonChoiceConsequences[choiceId];
  const companionName = heroDefinitions.find((hero) => hero.id === companionId)?.name ?? '동료';
  const firstDecision = !previous;
  const bondKey = getBondKey('raon', companionId);
  const bondGain = outcome === 'clear' ? 8 : 5;
  const raonPath = { ...profile.raonPath };
  if (previous) raonPath[previous] = Math.max(0, raonPath[previous] - 1);
  raonPath[choiceId] += 1;
  const labels: Record<RaonStoryChoiceId, string> = { compassion: '연민', insight: '통찰', resolve: '결의' };
  return {
    ...profile,
    raonPath,
    storyChoices: { ...profile.storyChoices, [missionId]: choiceId },
    narrativeChecks: {
      ...profile.narrativeChecks,
      [missionId]: { choiceId, chance, roll, outcome },
    },
    relationshipMemories: {
      ...profile.relationshipMemories,
      [missionId]: {
        missionId,
        companionId,
        choiceId,
        text: `${companionName}은(는) 라온이 ${consequence.memory}`,
        reaction: outcome === 'clear' ? consequence.clearReaction : consequence.costlyReaction,
        outcome,
      },
    },
    bondLevels: firstDecision
      ? { ...profile.bondLevels, [bondKey]: Math.min(100, (profile.bondLevels[bondKey] ?? 0) + bondGain) }
      : profile.bondLevels,
    activityLog: [
      `라온은 ${labels[choiceId]}의 답을 선택했다 · ${outcome === 'clear' ? '뜻을 온전히 전했다' : '대가를 치르고 뜻을 전했다'}.`,
      ...profile.activityLog,
    ].slice(0, 16),
  };
}

export function getActiveCampaignSlot() {
  try {
    const parsed = Number(window.localStorage.getItem(activeCampaignSlotKey));
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= 3 ? parsed : 1;
  } catch {
    return 1;
  }
}

export function setActiveCampaignSlot(slot: number) {
  try {
    window.localStorage.setItem(activeCampaignSlotKey, String(Math.max(1, Math.min(3, slot))));
  } catch {
    // The selected slot remains usable in memory when browser storage is denied.
  }
}

type LocalCampaignRead =
  | { status: 'found'; profile: CampaignProfile; updatedAt: number }
  | { status: 'missing' | 'invalid' | 'unavailable' };

function validateAndMigrateProfile(value: unknown): CampaignProfile | undefined {
  if (!isCampaignProfileCandidate(value)) return undefined;
  const sceneId = value.originStory?.currentSceneId;
  if (sceneId !== undefined && getOriginStoryScene(sceneId).id !== sceneId) return undefined;
  const payload: Partial<CampaignProfile> & { _savedAt?: unknown } = { ...value };
  delete payload._savedAt;
  return migrateProfile(payload);
}

function readLocalCampaign(key: string): LocalCampaignRead {
  let stored: string | null;
  try {
    stored = window.localStorage.getItem(key);
  } catch {
    return { status: 'unavailable' };
  }
  if (stored === null) return { status: 'missing' };
  try {
    const parsed: unknown = JSON.parse(stored);
    const profile = validateAndMigrateProfile(parsed);
    if (!profile) return { status: 'invalid' };
    let updatedAt = isSaveObject(parsed) && typeof parsed._savedAt === 'string' ? Date.parse(parsed._savedAt) || 0 : 0;
    if (!updatedAt) {
      try { updatedAt = Date.parse(window.localStorage.getItem(`${key}-updated`) ?? '') || 0; } catch { /* Timestamp is optional for legacy saves. */ }
    }
    return { status: 'found', profile, updatedAt };
  } catch {
    return { status: 'invalid' };
  }
}

export async function loadCampaignProfile(slot = getActiveCampaignSlot()): Promise<CampaignLoadResult> {
  const local = readLocalCampaign(storageKeyForSlot(slot));
  const backup = await restoreMirroredCampaignSlot(slot);
  if (backup.status === 'found') {
    const record = backup.record;
    const profile = isSaveObject(record) && record.slot === slot ? validateAndMigrateProfile(record.profile) : undefined;
    if (profile) {
      if (local.status === 'found') {
        const backupUpdatedAt = isSaveObject(record) && typeof record.updatedAt === 'string' ? Date.parse(record.updatedAt) || 0 : 0;
        if (local.updatedAt >= backupUpdatedAt) return { status: 'ready', profile: local.profile, source: 'local' };
      }
      return { status: 'ready', profile, source: 'backup' };
    }
    if (local.status === 'found') return { status: 'ready', profile: local.profile, source: 'local' };
    return { status: 'blocked', message: '이 슬롯의 저장 기록과 백업을 확인할 수 없습니다. 기존 기록을 보존했습니다.' };
  }
  if (local.status === 'found') return { status: 'ready', profile: local.profile, source: 'local' };
  if (backup.status === 'unavailable') {
    return { status: 'blocked', message: '저장 백업을 읽지 못했습니다. 다시 읽거나 다른 슬롯을 선택해 주세요. 기존 기록은 보존됩니다.' };
  }
  if (local.status !== 'missing') {
    return { status: 'blocked', message: '저장 기록을 읽지 못했고 복구할 백업이 없습니다. 기존 기록을 보존했습니다.' };
  }

  // Single-slot saves belong only to slot 1. Check the current backup before
  // migrating an older local key, which might otherwise replace a newer save.
  if (slot === 1) {
    let invalidLegacy = false;
    for (const key of [campaignStorageKey, ...legacyStorageKeys]) {
      const legacy = readLocalCampaign(key);
      if (legacy.status === 'found') return { status: 'ready', profile: legacy.profile, source: 'local' };
      if (legacy.status !== 'missing') invalidLegacy = true;
    }
    if (invalidLegacy) return { status: 'blocked', message: '이전 버전의 여정을 읽지 못했습니다. 기존 기록을 보존했습니다.' };
    try {
      if (window.localStorage.getItem('raonjena-grey-bridge-complete') === 'true') {
        return { status: 'ready', profile: completeMission(createNewCampaignProfile(), missions[0], undefined).profile, source: 'local' };
      }
    } catch {
      return { status: 'blocked', message: '이전 여정의 저장 여부를 확인할 수 없습니다. 다시 읽어 주세요.' };
    }
  }
  return { status: 'ready', profile: createNewCampaignProfile(), source: 'new' };
}

export async function saveCampaignProfile(profile: CampaignProfile, slot = getActiveCampaignSlot()): Promise<boolean> {
  if (!isCampaignProfileCandidate(profile)) return false;
  const previous = readLocalCampaign(storageKeyForSlot(slot));
  const previousTimestamp = previous.status === 'found' ? previous.updatedAt : 0;
  const updatedAt = nextCampaignSaveTimestamp(slot, previousTimestamp);
  let localSaved = false;
  try {
    window.localStorage.setItem(storageKeyForSlot(slot), JSON.stringify({ ...profile, _savedAt: updatedAt }));
    localSaved = true;
    window.localStorage.setItem(`${storageKeyForSlot(slot)}-updated`, updatedAt);
  } catch {
    // A hydrated profile can still be saved to IndexedDB if LocalStorage is full.
  }
  const backupSaved = await mirrorCampaignSlot(slot, profile, updatedAt);
  return localSaved || backupSaved;
}

export function deleteCampaignProfile(slot: number) {
  try {
    window.localStorage.removeItem(storageKeyForSlot(slot));
    window.localStorage.removeItem(`${storageKeyForSlot(slot)}-updated`);
  } catch {
    // IndexedDB removal remains independent of LocalStorage availability.
  }
  void deleteMirroredCampaignSlot(slot);
}

export function listCampaignSlots(): CampaignSlotSummary[] {
  return [1, 2, 3].map((slot) => {
    const saved = readLocalCampaign(storageKeyForSlot(slot));
    if (saved.status !== 'found') {
      return {
        slot, exists: saved.status !== 'missing', day: 1, originCompleted: false, missions: 0,
        sceneTitle: saved.status === 'missing' ? '새로운 여정' : '복구가 필요한 기록',
      };
    }
    const profile = saved.profile;
    return {
      slot, exists: true, day: profile.day, originCompleted: profile.originStory.completed,
      sceneTitle: profile.originStory.completed ? `작전 ${profile.completedMissions.length}건 완료` : getOriginStoryScene(profile.originStory.currentSceneId).title,
      missions: profile.completedMissions.length,
    };
  });
}

export function isMissionUnlocked(profile: CampaignProfile, mission: MissionDefinition) {
  return profile.originStory.completed && mission.prerequisites.every((id) => profile.completedMissions.includes(id));
}

export function placeHeadquartersRoom(profile: CampaignProfile, slot: number, facilityId: FacilityId) {
  if (slot < 0 || slot > 4) return profile;
  const result = executeGameCommand(profile.world, { type: 'place-room', slot, facilityId });
  return {
    ...profile,
    world: result.state,
    activityLog: [`본부 구역 재배치 · ${facilities.find((entry) => entry.id === facilityId)?.name ?? facilityId}`, ...profile.activityLog].slice(0, 16),
  };
}

export function getMissionStatus(profile: CampaignProfile, mission: MissionDefinition) {
  if (profile.completedMissions.includes(mission.id)) return 'complete' as const;
  if (isMissionUnlocked(profile, mission) && mission.enemies.length > 0) return 'available' as const;
  if (isMissionUnlocked(profile, mission)) return 'preview' as const;
  return 'locked' as const;
}

export function calculateMissionGrade(state?: BattleState): 'S' | 'A' | 'B' | 'C' {
  if (!state) return 'B';
  const heroLosses = state.heroes.filter((hero) => hero.hp <= 0).length;
  const objectiveRatio = state.carriageHp / Math.max(1, state.carriageHp + 40);
  const tacticalRound = Math.max(1, state.round - Math.min(2, state.breakCount ?? 0));
  if (heroLosses === 0 && tacticalRound <= Math.ceil(state.roundLimit * 0.55) && objectiveRatio > 0.65) return 'S';
  if (heroLosses === 0 && tacticalRound <= Math.ceil(state.roundLimit * 0.75)) return 'A';
  if (heroLosses <= 1) return 'B';
  return 'C';
}

export function getAdjustedMissionReward(
  mission: MissionDefinition,
  difficulty: MissionDifficulty = 'standard',
) {
  const multiplier = difficulty === 'veteran' ? 1.25 : 1;
  return {
    ...mission.reward,
    supplies: Math.round(mission.reward.supplies * multiplier),
    intel: Math.round(mission.reward.intel * multiplier),
    relics: mission.reward.relics + (difficulty === 'veteran' ? 1 : 0),
    renown: Math.round(mission.reward.renown * multiplier),
  };
}

function applyXp(progress: HeroProgress, amount: number) {
  let { level, xp, skillPoints } = progress;
  xp += amount;
  let threshold = 100 + (level - 1) * 35;
  while (xp >= threshold) {
    xp -= threshold;
    level += 1;
    skillPoints += 1;
    threshold = 100 + (level - 1) * 35;
  }
  return { ...progress, level, xp, skillPoints, bond: Math.min(100, progress.bond + 3) };
}

function applyFactionChanges(
  standings: CampaignProfile['factions'],
  changes?: Partial<Record<FactionId, number>>,
) {
  const next = { ...standings };
  if (!changes) return next;
  for (const factionId of Object.keys(changes) as FactionId[]) {
    next[factionId] = Math.max(-100, Math.min(100, next[factionId] + (changes[factionId] ?? 0)));
  }
  return next;
}

export function completeMission(profile: CampaignProfile, mission: MissionDefinition, state?: BattleState) {
  const witnessId = `witness-${mission.id}`;
  const newWitness = Boolean(mission.revelation)
    && state?.missionId === mission.id
    && state.outcome === 'victory'
    && state.revelationTriggered === true
    && !profile.unlockedRecords.includes(witnessId);
  const witnessLog = `현장 증언 확보 · 「${mission.title}」에서 직접 확인한 기록.`;
  if (profile.completedMissions.includes(mission.id)) {
    const grade = calculateMissionGrade(state);
    const previousGrade = profile.missionGrades[mission.id] ?? 'C';
    const gradeRank = { S: 4, A: 3, B: 2, C: 1 } as const;
    const improved = gradeRank[grade] > gradeRank[previousGrade];
    return {
      profile: improved || newWitness
        ? {
            ...profile,
            missionGrades: improved ? { ...profile.missionGrades, [mission.id]: grade } : profile.missionGrades,
            unlockedRecords: newWitness ? [...profile.unlockedRecords, witnessId] : profile.unlockedRecords,
            activityLog: [
              ...(improved ? [`${mission.operation} 재현 기록을 ${grade}등급으로 갱신했다.`] : []),
              ...(newWitness ? [witnessLog] : []),
              ...profile.activityLog,
            ].slice(0, 16),
          }
        : profile,
      grade: improved ? grade : previousGrade,
      firstClear: false,
    };
  }
  const grade = calculateMissionGrade(state);
  const reward = getAdjustedMissionReward(mission, state?.difficulty ?? 'standard');
  const completedMissions = [...profile.completedMissions, mission.id];
  const deployed = new Set(profile.activeSquad);
  const heroProgress = Object.fromEntries(
    Object.entries(profile.heroProgress).map(([id, progress]) => [
      id,
      deployed.has(id) ? applyXp(progress, mission.reward.xp) : progress,
    ]),
  );
  const commandLevel = Math.min(12, 1 + Math.floor(completedMissions.length / 2));
  const unlockedRecords = [
    ...profile.unlockedRecords,
    `mission-${mission.id}`,
    ...(newWitness ? [witnessId] : []),
  ];
  const inventory = mission.reward.equipmentId
    ? [...new Set([...profile.inventory, mission.reward.equipmentId])]
    : profile.inventory;
  return {
    grade,
    firstClear: true,
    profile: {
      ...profile,
      day: profile.day + 3,
      commandLevel,
      renown: profile.renown + reward.renown,
      supplies: profile.supplies + reward.supplies,
      intel: profile.intel + reward.intel,
      relics: profile.relics + reward.relics,
      inventory,
      factions: applyFactionChanges(profile.factions, mission.reward.factions),
      completedMissions,
      missionGrades: { ...profile.missionGrades, [mission.id]: grade },
      heroProgress,
      careerStats: { ...profile.careerStats, missions: profile.careerStats.missions + 1 },
      unlockedRecords: [...new Set(unlockedRecords)],
      activityLog: [
        `${mission.operation} 「${mission.title}」 ${grade}등급 완료.`,
        ...(newWitness ? [witnessLog] : []),
        ...(mission.reward.equipmentId ? [`장비 「${getEquipment(mission.reward.equipmentId)?.name}」 회수.`] : []),
        ...profile.activityLog,
      ].slice(0, 16),
    },
  };
}

export function upgradeFacility(profile: CampaignProfile, facilityId: FacilityId) {
  const facility = facilities.find((entry) => entry.id === facilityId);
  if (!facility) return profile;
  const current = profile.facilities[facilityId];
  const cost = facility.baseCost * (current + 1);
  if (current >= facility.maxLevel || profile.supplies < cost) return profile;
  return {
    ...profile,
    supplies: profile.supplies - cost,
    facilities: { ...profile.facilities, [facilityId]: current + 1 },
    activityLog: [`${facility.name}을(를) Lv.${current + 1}로 확장했다.`, ...profile.activityLog].slice(0, 16),
  };
}

export function unlockHeroNode(profile: CampaignProfile, heroId: string, nodeId: string) {
  const hero = profile.heroProgress[heroId];
  const definition = heroDefinitions.find((entry) => entry.id === heroId);
  const node = getHeroGrowthNode(nodeId);
  if (!hero || !definition || !node || !canUnlockHeroGrowthNode(hero, nodeId)) return profile;
  return {
    ...profile,
    heroProgress: {
      ...profile.heroProgress,
      [heroId]: {
        ...hero,
        skillPoints: hero.skillPoints - node.cost,
        unlockedNodes: [...hero.unlockedNodes, nodeId],
      },
    },
    activityLog: [
      `${definition.name}의 체능 「${node.name}」이 개방되었다.`,
      ...profile.activityLog,
    ].slice(0, 16),
  };
}

export function toggleSquadMember(profile: CampaignProfile, heroId: string) {
  if (!heroDefinitions.some((hero) => hero.id === heroId)) return profile;
  if (profile.activeSquad.includes(heroId)) {
    if (profile.activeSquad.length <= 4) return profile;
    return {
      ...profile,
      activeSquad: profile.activeSquad.filter((id) => id !== heroId),
      activityLog: [`${heroDefinitions.find((hero) => hero.id === heroId)?.name}을(를) 예비대로 전환했다.`, ...profile.activityLog].slice(0, 16),
    };
  }
  if (profile.activeSquad.length >= 6) return profile;
  return {
    ...profile,
    activeSquad: [...profile.activeSquad, heroId],
    activityLog: [`${heroDefinitions.find((hero) => hero.id === heroId)?.name}을(를) 출격조에 편성했다.`, ...profile.activityLog].slice(0, 16),
  };
}

export function equipHeroItem(profile: CampaignProfile, heroId: string, equipmentId: string) {
  const hero = profile.heroProgress[heroId];
  const equipment = getEquipment(equipmentId);
  if (!hero || !equipment || !profile.inventory.includes(equipmentId)) return profile;
  const slotIndex = equipment.slot === 'weapon' ? 0 : 1;
  const nextEquipment: [string, string] = [...hero.equipment];
  nextEquipment[slotIndex] = equipmentId;
  return {
    ...profile,
    heroProgress: {
      ...profile.heroProgress,
      [heroId]: { ...hero, equipment: nextEquipment },
    },
    activityLog: [
      `${heroDefinitions.find((entry) => entry.id === heroId)?.name ?? heroId}에게 「${equipment.name}」 장착.`,
      ...profile.activityLog,
    ].slice(0, 16),
  };
}

export function resolveDispatch(profile: CampaignProfile, dispatchId: string) {
  const dispatch = dispatchOperations.find((entry) => entry.id === dispatchId);
  if (!dispatch || profile.completedDispatches.includes(dispatchId)) return profile;
  if (dispatch.requiredMission && !profile.completedMissions.includes(dispatch.requiredMission)) return profile;
  if (profile.supplies < dispatch.cost) return profile;
  const inventory = dispatch.reward.equipmentId
    ? [...new Set([...profile.inventory, dispatch.reward.equipmentId])]
    : profile.inventory;
  return {
    ...profile,
    day: profile.day + dispatch.days,
    supplies: profile.supplies - dispatch.cost + dispatch.reward.supplies,
    intel: profile.intel + dispatch.reward.intel,
    relics: profile.relics + dispatch.reward.relics,
    inventory,
    factions: applyFactionChanges(profile.factions, dispatch.reward.faction),
    completedDispatches: [...profile.completedDispatches, dispatchId],
    careerStats: { ...profile.careerStats, dispatches: profile.careerStats.dispatches + 1 },
    activityLog: [`파견 「${dispatch.title}」 완료. 전원이 귀환했다.`, ...profile.activityLog].slice(0, 16),
  };
}

export function advanceDay(profile: CampaignProfile) {
  const actionsSpent = 3 - profile.commandActions;
  if (actionsSpent <= 0) return profile;
  const activityRatio = actionsSpent / 3;
  const passiveSupplies = Math.floor((18 + profile.facilities.infirmary * 4) * activityRatio);
  const passiveIntel = Math.floor((4 + profile.facilities.archive * 3) * activityRatio);
  return {
    ...profile,
    day: profile.day + 1,
    commandActions: 3,
    dailyCommandStats: { training: 0, bond: 0, field: 0 },
    dailyRewardClaimed: false,
    supplies: profile.supplies + passiveSupplies,
    intel: profile.intel + passiveIntel,
    activityLog: [
      `DAY ${profile.day + 1} 시작 · 보급 +${passiveSupplies}, 정보 +${passiveIntel}.`,
      ...profile.activityLog,
    ].slice(0, 16),
  };
}

export function performTraining(profile: CampaignProfile, heroId: string, focus: TrainingFocus) {
  const progress = profile.heroProgress[heroId];
  if (!progress || profile.commandActions < 1 || profile.supplies < 20) return profile;
  const values = {
    foundation: { xp: 38, bond: 2, renown: 2, label: '기초 교범 반복' },
    survival: { xp: 28, bond: 4, renown: 3, label: '대화기 생존 훈련' },
    command: { xp: 22, bond: 7, renown: 6, label: '조장 지휘 모의전' },
  }[focus];
  const trained = applyXp(progress, values.xp);
  return {
    ...profile,
    commandActions: profile.commandActions - 1,
    dailyCommandStats: { ...profile.dailyCommandStats, training: profile.dailyCommandStats.training + 1 },
    careerStats: { ...profile.careerStats, trainings: profile.careerStats.trainings + 1 },
    supplies: profile.supplies - 20,
    renown: profile.renown + values.renown,
    heroProgress: {
      ...profile.heroProgress,
      [heroId]: { ...trained, bond: Math.min(100, trained.bond + values.bond) },
    },
    activityLog: [
      `${heroDefinitions.find((hero) => hero.id === heroId)?.name} · ${values.label} 완료.`,
      ...profile.activityLog,
    ].slice(0, 16),
  };
}

export function getBondKey(firstHeroId: string, secondHeroId: string) {
  return [firstHeroId, secondHeroId].sort().join(':');
}

export function performBondActivity(profile: CampaignProfile, firstHeroId: string, secondHeroId: string) {
  if (firstHeroId === secondHeroId || profile.commandActions < 1 || profile.supplies < 15) return profile;
  const first = profile.heroProgress[firstHeroId];
  const second = profile.heroProgress[secondHeroId];
  if (!first || !second) return profile;
  const key = getBondKey(firstHeroId, secondHeroId);
  const bond = Math.min(100, (profile.bondLevels[key] ?? 0) + 12);
  const unlockedRecords = [...profile.unlockedRecords];
  if (bond >= 30) unlockedRecords.push(`bond-${key}-trust`);
  if (bond >= 60) unlockedRecords.push(`bond-${key}-oath`);
  return {
    ...profile,
    commandActions: profile.commandActions - 1,
    dailyCommandStats: { ...profile.dailyCommandStats, bond: profile.dailyCommandStats.bond + 1 },
    careerStats: { ...profile.careerStats, bonds: profile.careerStats.bonds + 1 },
    supplies: profile.supplies - 15,
    bondLevels: { ...profile.bondLevels, [key]: bond },
    heroProgress: {
      ...profile.heroProgress,
      [firstHeroId]: { ...first, bond: Math.min(100, first.bond + 6) },
      [secondHeroId]: { ...second, bond: Math.min(100, second.bond + 6) },
    },
    unlockedRecords: [...new Set(unlockedRecords)],
    activityLog: [
      `${heroDefinitions.find((hero) => hero.id === firstHeroId)?.name} × ${heroDefinitions.find((hero) => hero.id === secondHeroId)?.name} 연계 훈련 · 유대 ${bond}.`,
      ...profile.activityLog,
    ].slice(0, 16),
  };
}

export function canPerformDailyActivity(profile: CampaignProfile, activity: DailyActivityDefinition) {
  return profile.commandActions >= activity.actionCost
    && profile.supplies >= activity.suppliesCost
    && profile.intel >= activity.intelCost
    && (!activity.requiredMission || profile.completedMissions.includes(activity.requiredMission));
}

export function performDailyActivity(profile: CampaignProfile, activityId: DailyActivityId) {
  const activity = dailyActivities.find((entry) => entry.id === activityId);
  if (!activity || !canPerformDailyActivity(profile, activity)) return profile;
  const count = (profile.activityCounts[activity.id] ?? 0) + 1;
  const unlockedRecords = activity.id === 'archive-decoding'
    ? [...profile.unlockedRecords, `restored-fragment-${count}`]
    : profile.unlockedRecords;
  return {
    ...profile,
    commandActions: profile.commandActions - activity.actionCost,
    dailyCommandStats: { ...profile.dailyCommandStats, field: profile.dailyCommandStats.field + 1 },
    careerStats: { ...profile.careerStats, fieldActivities: profile.careerStats.fieldActivities + 1 },
    supplies: profile.supplies - activity.suppliesCost + activity.reward.supplies,
    intel: profile.intel - activity.intelCost + activity.reward.intel,
    relics: profile.relics + activity.reward.relics,
    renown: profile.renown + activity.reward.renown,
    factions: applyFactionChanges(profile.factions, activity.reward.faction),
    activityCounts: { ...profile.activityCounts, [activity.id]: count },
    unlockedRecords: [...new Set(unlockedRecords)],
    activityLog: [`활동 「${activity.title}」 ${count}회 완료.`, ...profile.activityLog].slice(0, 16),
  };
}

export function canClaimDailyOrders(profile: CampaignProfile) {
  return !profile.dailyRewardClaimed
    && profile.dailyCommandStats.training > 0
    && profile.dailyCommandStats.bond > 0
    && profile.dailyCommandStats.field > 0;
}

export function claimDailyOrders(profile: CampaignProfile) {
  if (!canClaimDailyOrders(profile)) return profile;
  return {
    ...profile,
    supplies: profile.supplies + 80,
    intel: profile.intel + 30,
    relics: profile.relics + 1,
    renown: profile.renown + 12,
    dailyRewardClaimed: true,
    careerStats: { ...profile.careerStats, perfectDays: profile.careerStats.perfectDays + 1 },
    activityLog: ['일일 지휘 목표 완수 · 전원 생환 교범 보상을 수령했다.', ...profile.activityLog].slice(0, 16),
  };
}

export function canAdvanceDay(profile: CampaignProfile) {
  return profile.commandActions < 3 && !canClaimDailyOrders(profile);
}

export function getStrategicOrderProgress(
  profile: CampaignProfile,
  order: StrategicOrderDefinition,
) {
  return Math.min(order.goal, profile.careerStats[order.stat]);
}

export function canClaimStrategicOrder(
  profile: CampaignProfile,
  order: StrategicOrderDefinition,
) {
  return !profile.claimedStrategicOrders.includes(order.id)
    && getStrategicOrderProgress(profile, order) >= order.goal;
}

export function claimStrategicOrder(profile: CampaignProfile, orderId: StrategicOrderId) {
  const order = strategicOrders.find((entry) => entry.id === orderId);
  if (!order || !canClaimStrategicOrder(profile, order)) return profile;
  return {
    ...profile,
    supplies: profile.supplies + order.reward.supplies,
    intel: profile.intel + order.reward.intel,
    relics: profile.relics + order.reward.relics,
    renown: profile.renown + order.reward.renown,
    claimedStrategicOrders: [...profile.claimedStrategicOrders, order.id],
    activityLog: [`전역 명령 「${order.title}」 완수 보상을 수령했다.`, ...profile.activityLog].slice(0, 16),
  };
}

export function canCraftRecipe(profile: CampaignProfile, recipe: CraftRecipe) {
  return !profile.inventory.includes(recipe.equipmentId)
    && profile.facilities.forge >= recipe.forgeLevel
    && profile.supplies >= recipe.supplies
    && profile.relics >= recipe.relics;
}

export function craftEquipment(profile: CampaignProfile, equipmentId: string) {
  const recipe = craftRecipes.find((entry) => entry.equipmentId === equipmentId);
  const equipment = getEquipment(equipmentId);
  if (!recipe || !equipment || !canCraftRecipe(profile, recipe)) return profile;
  return {
    ...profile,
    supplies: profile.supplies - recipe.supplies,
    relics: profile.relics - recipe.relics,
    inventory: [...profile.inventory, equipmentId],
    careerStats: { ...profile.careerStats, crafts: profile.careerStats.crafts + 1 },
    activityLog: [`공방 제작 · 「${equipment.name}」 완성.`, ...profile.activityLog].slice(0, 16),
  };
}

function equipmentBonus(progress: HeroProgress, key: 'hp' | 'armor' | 'power') {
  return progress.equipment.reduce((total, id) => total + (getEquipment(id)?.[key] ?? 0), 0);
}

export function buildProgressedHeroes(profile: CampaignProfile): HeroDefinition[] {
  const trainingLevel = profile.facilities.training;
  const infirmaryLevel = profile.facilities.infirmary;
  const forgeLevel = profile.facilities.forge;
  return heroDefinitions.map((hero) => {
    const progress = profile.heroProgress[hero.id];
    const level = progress?.level ?? 1;
    const hpBonus = progress ? equipmentBonus(progress, 'hp') : 0;
    const armorBonus = progress ? equipmentBonus(progress, 'armor') : 0;
    const powerBonus = progress ? equipmentBonus(progress, 'power') : 0;
    const growthBonus = getHeroGrowthBonuses(progress?.unlockedNodes ?? []);
    return {
      ...hero,
      maxHp: hero.maxHp + (level - 1) * 5 + infirmaryLevel * 3 + hpBonus + growthBonus.hp,
      armor: hero.armor + Math.floor((level - 1) / 2) + Math.floor(trainingLevel / 2) + armorBonus + growthBonus.armor,
      skills: hero.skills.map((skill) => ({
        ...skill,
        power: skill.power + (level - 1) * 2 + forgeLevel * 2 + powerBonus + growthBonus.power,
        morale: skill.morale + growthBonus.morale,
      })),
    };
  });
}

export function canResolveDispatch(profile: CampaignProfile, dispatch: DispatchDefinition) {
  return !profile.completedDispatches.includes(dispatch.id)
    && (!dispatch.requiredMission || profile.completedMissions.includes(dispatch.requiredMission))
    && profile.supplies >= dispatch.cost;
}

export function getEquipmentSlotLabel(slot: EquipmentSlot) {
  return slot === 'weapon' ? '주 무구' : '보조 장비';
}

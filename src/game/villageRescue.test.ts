import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getOriginStoryScene } from '../data/originStory';
import type { CampaignProfile, VillageRescueAction, VillageRescueChoiceId } from '../types';
import { isCampaignProfileCandidate } from './persistence';
import { advanceOriginStory, campaignStorageKey, chooseOriginStoryPath, createNewCampaignProfile, loadCampaignProfile, saveCampaignProfile } from './progression';
import { canApplyVillageRescueAction, createVillageRescue, isVillageRescueState, resolveVillageRescueAction, villageRescueReturnPoint } from './villageRescue';
import { applyVillageRescueAction, completeVillageRescueReturn, getVillageRescue, retryVillageRescue, startVillageRescue } from './villageRescueProgression';

const right: VillageRescueAction = { type: 'move', dx: 1, dy: 0 };
const left: VillageRescueAction = { type: 'move', dx: -1, dy: 0 };
const assist: VillageRescueAction = { type: 'assist' };
const guard: VillageRescueAction = { type: 'guard' };
const scene = getOriginStoryScene('river-incident');
const routes: Record<VillageRescueChoiceId, VillageRescueAction[]> = {
  'save-child': [right, right, right, assist, assist, assist, left, left, left],
  'mark-safe-route': [right, assist, right, assist, right, assist, left, left, left],
  'draw-the-beast': [right, right, assist, assist, assist, left, left],
};

function riverProfile(choiceId: VillageRescueChoiceId = 'save-child') {
  const fresh = createNewCampaignProfile();
  fresh.originStory.currentSceneId = scene.id;
  return chooseOriginStoryPath(fresh, scene.id, choiceId);
}

function playRescue(choiceId: VillageRescueChoiceId = 'save-child') {
  return routes[choiceId].reduce(applyVillageRescueAction, startVillageRescue(riverProfile(choiceId)));
}

function nearKazrin(profile: CampaignProfile, offset = 0): CampaignProfile {
  return { ...profile, world: { ...profile.world, village: {
    ...profile.world.village, playerX: villageRescueReturnPoint.x + offset, playerY: villageRescueReturnPoint.y,
  } } };
}

let local: Map<string, string>;
beforeEach(() => {
  local = new Map();
  vi.stubGlobal('window', { localStorage: {
    getItem: (key: string) => local.get(key) ?? null,
    setItem: (key: string, value: string) => { local.set(key, value); },
  } });
});
afterEach(() => { vi.unstubAllGlobals(); });

async function reload(profile: CampaignProfile) {
  expect(await saveCampaignProfile(profile, 1)).toBe(true);
  const loaded = await loadCampaignProfile(1);
  expect(loaded.status).toBe('ready');
  if (loaded.status !== 'ready') throw new Error('Expected saved rescue');
  return loaded.profile;
}

describe('nonlethal village rescue rules', () => {
  it.each(Object.keys(routes) as VillageRescueChoiceId[])('rescues and withdraws using %s with every action preserved across reload', async (choiceId) => {
    let profile = await reload(riverProfile(choiceId));
    expect(getVillageRescue(profile)?.phase).toBe('ready');
    profile = startVillageRescue(profile);
    for (const action of routes[choiceId]) {
      const previous = profile;
      profile = applyVillageRescueAction(profile, action);
      expect(profile).not.toBe(previous);
      const saved = profile;
      profile = await reload(profile);
      expect(profile).toEqual(saved);
      expect(isVillageRescueState(getVillageRescue(profile))).toBe(true);
    }
    expect(getVillageRescue(profile)).toMatchObject({ phase: 'return', progress: 3, x: 0, attempt: 1 });
    expect(getVillageRescue(profile)?.hp).toBeGreaterThan(0);
    expect(getVillageRescue(profile)?.markedColumns).toEqual(choiceId === 'mark-safe-route' ? [1, 2, 3] : []);
  });

  it('requires the selected rescue method and rejects invalid actions without consuming a turn', () => {
    const state = createVillageRescue('save-child', 1);
    for (const action of [assist, left, { type: 'move', dx: 1, dy: 1 }, { type: 'move', dx: 0, dy: 0 }, { type: 'move', dx: NaN, dy: 0 }] as VillageRescueAction[]) {
      expect(canApplyVillageRescueAction(state, action)).toBe(false);
      expect(resolveVillageRescueAction(state, action)).toBe(state);
    }
    const route = resolveVillageRescueAction(resolveVillageRescueAction(createVillageRescue('mark-safe-route', 1), right), assist);
    expect(resolveVillageRescueAction(route, assist)).toBe(route);
    expect(canApplyVillageRescueAction({ ...state, x: 2 }, assist)).toBe(false);
    expect(canApplyVillageRescueAction({ ...state, choiceId: 'draw-the-beast', x: 2 }, assist)).toBe(true);
    const completedWork = { ...state, progress: 3, x: 3 };
    expect(resolveVillageRescueAction(completedWork, assist)).toBe(completedWork);
  });

  it('resolves the displayed warning after movement and guard blocks its damage', () => {
    const state = createVillageRescue('save-child', 1);
    const hit = resolveVillageRescueAction(state, { type: 'move', dx: 0, dy: -1 });
    expect(hit).toMatchObject({ y: 0, hp: 4, turn: 1, threatRow: 1 });
    const guarded = resolveVillageRescueAction({ ...state, y: 0 }, guard);
    expect(guarded).toMatchObject({ hp: 5, turn: 1, threatRow: 1 });
    expect(state).toMatchObject({ hp: 5, turn: 0, y: 1 });
  });

  it('fails on exhausted HP and permits only an explicit fresh retry', async () => {
    let profile = startVillageRescue(riverProfile());
    for (let turn = 0; turn < 14; turn += 1) profile = applyVillageRescueAction(profile, turn % 2 === 0 ? right : left);
    expect(getVillageRescue(profile)).toMatchObject({ phase: 'failed', hp: 0, turn: 14 });
    profile = await reload(profile);
    expect(applyVillageRescueAction(profile, guard)).toBe(profile);
    expect(startVillageRescue(profile)).toBe(profile);
    expect(completeVillageRescueReturn(nearKazrin(profile)).originStory.villageRescue?.phase).toBe('failed');
    const retried = retryVillageRescue(profile);
    expect(getVillageRescue(retried)).toMatchObject({ phase: 'active', hp: 5, attempt: 2, turn: 0, progress: 0, x: 0, y: 1 });
    expect(retried.raonPath).toEqual(profile.raonPath);
    expect(retried.originStory.selectionScore).toBe(profile.originStory.selectionScore);
    expect(retryVillageRescue(retried)).toBe(retried);
  });

  it('uses an action limit rather than elapsed wall time and fails after 24 guarded turns', () => {
    let profile = startVillageRescue(riverProfile());
    for (let turn = 0; turn < 24; turn += 1) profile = applyVillageRescueAction(profile, guard);
    expect(getVillageRescue(profile)).toMatchObject({ phase: 'failed', hp: 5, turn: 24 });
  });

  it('allows a live withdrawal on the final turn but resolves fatal damage first', () => {
    const state = { ...createVillageRescue('save-child', 1), turn: 23, threatRow: 2, progress: 3, x: 1 };
    expect(resolveVillageRescueAction(state, left).phase).toBe('return');
    expect(resolveVillageRescueAction({ ...state, hp: 1, y: 2 }, left).phase).toBe('failed');
  });
});

describe('rescue outcome and save compatibility', () => {
  it.each(Object.keys(routes) as VillageRescueChoiceId[])('records %s as intent once and confirms its outcome only after nearby return', async (choiceId) => {
    const choice = scene.choices.find((entry) => entry.id === choiceId)!;
    const chosen = riverProfile(choiceId);
    expect(chosen.raonPath[choice.path]).toBe(1);
    expect(chosen.originStory.selectionScore).toBe(choice.score);
    expect(chosen.originStory.flags).not.toContain(choice.flag);
    expect(chosen.world.npcMemories.kazrin?.rememberedFacts).not.toContain(choice.result);
    expect(chooseOriginStoryPath(chosen, scene.id, scene.choices.find((entry) => entry.id !== choiceId)!.id)).toBe(chosen);
    expect(advanceOriginStory(chosen)).toBe(chosen);
    const active = startVillageRescue(chosen);
    expect(startVillageRescue(active)).toBe(active);
    expect(advanceOriginStory(active)).toBe(active);
    const returned = playRescue(choiceId);
    expect(returned.originStory.flags).not.toContain(choice.flag);
    expect(returned.world.npcMemories.kazrin?.rememberedFacts).not.toContain(choice.result);
    expect(advanceOriginStory(returned)).toBe(returned);
    expect(applyVillageRescueAction(returned, guard)).toBe(returned);
    const tooFar = nearKazrin(returned, villageRescueReturnPoint.radius + 0.01);
    expect(completeVillageRescueReturn(tooFar)).toBe(tooFar);
    const invalidPosition = nearKazrin(returned, NaN);
    expect(completeVillageRescueReturn(invalidPosition)).toBe(invalidPosition);
    const confirmed = completeVillageRescueReturn(nearKazrin(returned, villageRescueReturnPoint.radius));
    expect(confirmed.originStory.villageRescue?.phase).toBe('complete');
    expect(confirmed.originStory.flags.filter((flag) => flag === choice.flag)).toHaveLength(1);
    expect(confirmed.world.npcMemories.kazrin?.rememberedFacts.filter((fact) => fact === choice.result)).toHaveLength(1);
    expect(confirmed.raonPath).toEqual(chosen.raonPath);
    expect(confirmed.bondLevels).toEqual(chosen.bondLevels);
    expect(confirmed.originStory.selectionScore).toBe(chosen.originStory.selectionScore);
    expect(confirmed.world.npcMemories.kazrin?.affinity).toBe(chosen.world.npcMemories.kazrin?.affinity);
    expect(completeVillageRescueReturn(confirmed)).toBe(confirmed);
    const advanced = advanceOriginStory(await reload(confirmed));
    expect(advanced.originStory.currentSceneId).toBe('recruiters-arrive');
    expect(getVillageRescue(advanced)).toBeUndefined();
    expect(startVillageRescue(advanced)).toBe(advanced);
  });

  it('migrates a choice-only v10 save into ready without duplicating its previous choice rewards', async () => {
    const legacy = riverProfile();
    delete legacy.originStory.villageRescue;
    const choice = scene.choices[0]!;
    legacy.originStory.flags.push(choice.flag);
    legacy.world.npcMemories.kazrin!.rememberedFacts = [choice.result, '이전 마을의 기억'];
    local.set(`${campaignStorageKey}-slot-1`, JSON.stringify(legacy));
    const loaded = await loadCampaignProfile(1);
    if (loaded.status !== 'ready') throw new Error('Expected legacy load');
    const pending = loaded.profile;
    expect(getVillageRescue(pending)?.phase).toBe('ready');
    expect(pending.originStory.flags).not.toContain(choice.flag);
    expect(pending.world.npcMemories.kazrin?.rememberedFacts).toEqual(['이전 마을의 기억']);
    expect(pending.raonPath).toEqual(legacy.raonPath);
    expect(pending.originStory.selectionScore).toBe(legacy.originStory.selectionScore);
    const rescued = routes['save-child'].reduce(applyVillageRescueAction, startVillageRescue(await reload(pending)));
    const complete = completeVillageRescueReturn(nearKazrin(rescued));
    expect(complete.originStory.flags).toContain(choice.flag);
    expect(complete.raonPath).toEqual(legacy.raonPath);
    expect(complete.bondLevels).toEqual(legacy.bondLevels);
    expect(complete.world.npcMemories.kazrin?.affinity).toBe(legacy.world.npcMemories.kazrin?.affinity);
  });

  it.each(['later-scene', 'river-recorded', 'graduated'])('preserves an older %s save without making it replay rescue', async (stage) => {
    const legacy = riverProfile();
    delete legacy.originStory.villageRescue;
    const choice = scene.choices[0]!;
    legacy.originStory.flags.push(choice.flag);
    if (stage === 'later-scene') legacy.originStory.currentSceneId = 'recruiters-arrive';
    if (stage === 'river-recorded') legacy.originStory.completedSceneIds.push(scene.id);
    if (stage === 'graduated') legacy.originStory.completed = true;
    const loaded = await reload(legacy);
    expect(loaded).toEqual(legacy);
    expect(getVillageRescue(loaded)).toBeUndefined();
    expect(startVillageRescue(loaded)).toBe(loaded);
    if (stage === 'river-recorded') expect(advanceOriginStory(loaded).originStory.currentSceneId).toBe('recruiters-arrive');
  });

  it('rejects malformed and contradictory rescue saves instead of silently resetting the battle', () => {
    const profile = startVillageRescue(riverProfile());
    const rescue = getVillageRescue(profile)!;
    for (const broken of [null, {}, { ...rescue, hp: -1 }, { ...rescue, x: 8 }, { ...rescue, threatRow: 2 },
      { ...rescue, phase: 'complete' }, { ...rescue, turn: 24 }, { ...rescue, choiceId: 'mark-safe-route', progress: 2, markedColumns: [1, 1] }]) {
      const candidate = { ...profile, originStory: { ...profile.originStory, villageRescue: broken } };
      expect(isCampaignProfileCandidate(candidate)).toBe(false);
    }
    expect(isCampaignProfileCandidate({ ...profile, originStory: { ...profile.originStory, choices: { [scene.id]: 'draw-the-beast' } } })).toBe(false);
    expect(isCampaignProfileCandidate({ ...profile, originStory: { ...profile.originStory, currentSceneId: 'recruiters-arrive' } })).toBe(false);
  });

  it('does not create a rescue before selecting the current river scene', () => {
    const fresh = createNewCampaignProfile();
    expect(getVillageRescue(fresh)).toBeUndefined();
    expect(startVillageRescue(fresh)).toBe(fresh);
    expect(applyVillageRescueAction(fresh, right)).toBe(fresh);
    expect(chooseOriginStoryPath(fresh, scene.id, 'save-child')).toBe(fresh);
  });
});

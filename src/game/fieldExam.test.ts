import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getOriginStoryScene, originStoryScenes } from '../data/originStory';
import type { CampaignProfile, FieldExamChoiceId, FieldExamOrder, FieldExamPlan, FieldExamState } from '../types';
import { canApplyFieldExamPlan, createFieldExam, fieldExamRules, getFieldExamLoad, isFieldExamState, resolveFieldExamPlan } from './fieldExam';
import { applyFieldExamPlan, completeFieldExamReturn, getFieldExam, migrateFieldExam, retryFieldExam, startFieldExam } from './fieldExamProgression';
import { isCampaignProfileCandidate } from './persistence';
import { advanceOriginStory, campaignStorageKey, chooseOriginStoryPath, createNewCampaignProfile, getBondKey, loadCampaignProfile, saveCampaignProfile } from './progression';
import { createVillageRescue, villageRescueReturnPoint } from './villageRescue';
import { applyVillageRescueAction, completeVillageRescueReturn, startVillageRescue } from './villageRescueProgression';

const scene = getOriginStoryScene('field-exam');
const split: FieldExamPlan = { raon: 'left', leo: 'right' };
const brace: FieldExamPlan = { raon: 'brace', leo: 'brace' };
const routes: Record<FieldExamChoiceId, FieldExamPlan[]> = {
  'rescue-team': [split, { raon: 'brace', leo: 'left' }, split, { raon: 'brace', leo: 'right' }],
  'split-route': [split, split, split],
  'defy-order': [{ raon: 'brace', leo: 'left' }, split, { raon: 'brace', leo: 'right' }, split],
};
const choices = Object.keys(routes) as FieldExamChoiceId[];

function examProfile(choiceId: FieldExamChoiceId = 'rescue-team') {
  const fresh = createNewCampaignProfile();
  fresh.originStory.currentSceneId = scene.id;
  return chooseOriginStoryPath(fresh, scene.id, choiceId);
}

function step(profile: CampaignProfile, plan: FieldExamPlan) {
  const exam = getFieldExam(profile)!;
  return applyFieldExamPlan(profile, exam.attempt, exam.turn, plan);
}

function playExam(choiceId: FieldExamChoiceId = 'rescue-team') {
  return routes[choiceId].reduce(step, startFieldExam(examProfile(choiceId)));
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
  const result = await loadCampaignProfile(1);
  expect(result.status).toBe('ready');
  if (result.status !== 'ready') throw new Error('Expected saved field exam');
  return result.profile;
}

describe('simultaneous companion rescue plans', () => {
  it.each(choices)('completes %s and preserves every turn through JSON and real campaign save/load', async (choiceId) => {
    let profile = await reload(examProfile(choiceId));
    expect(getFieldExam(profile)).toMatchObject({ phase: 'ready', attempt: 0, turn: 0 });
    profile = await reload(startFieldExam(profile));
    for (const plan of routes[choiceId]) {
      const previous = profile;
      profile = step(profile, plan);
      expect(profile).not.toBe(previous);
      expect(JSON.parse(JSON.stringify(profile.originStory.fieldExam))).toEqual(profile.originStory.fieldExam);
      const saved = profile;
      profile = await reload(profile);
      expect(profile).toEqual(saved);
      expect(isFieldExamState(getFieldExam(profile))).toBe(true);
    }
    expect(getFieldExam(profile)).toMatchObject({ phase: 'return', attempt: 1, left: 3, right: 3 });
    expect(getFieldExam(profile)?.integrity).toBeGreaterThan(0);
  });

  it('previews base load 2/2/3 and applies bracing before capped integrity takes that load', () => {
    let state = createFieldExam('split-route', 1);
    expect(Array.from({ length: 8 }, (_, turn) => getFieldExamLoad({ ...state, turn }))).toEqual([2, 2, 3, 2, 2, 3, 2, 2]);
    state = resolveFieldExamPlan(state, brace);
    expect(state).toMatchObject({ turn: 1, integrity: 6, left: 0, right: 0 });
    state = resolveFieldExamPlan(state, brace);
    expect(state.integrity).toBe(6);
    state = resolveFieldExamPlan(state, brace);
    expect(state.integrity).toBe(5);
    const weakened = { ...createFieldExam('split-route', 1), turn: 2, integrity: 3 };
    expect(resolveFieldExamPlan(weakened, { raon: 'brace', leo: 'left' }).integrity).toBe(2);
    expect(resolveFieldExamPlan({ ...weakened, choiceId: 'rescue-team' }, { raon: 'brace', leo: 'left' }).integrity).toBe(3);
  });

  it('discounts only two different incomplete lanes for split-route and clips shared rescue work', () => {
    const state = createFieldExam('split-route', 1);
    expect(resolveFieldExamPlan(state, split)).toMatchObject({ left: 1, right: 1, integrity: 5 });
    expect(resolveFieldExamPlan(state, { raon: 'left', leo: 'left' })).toMatchObject({ left: 2, right: 0, integrity: 4 });
    expect(resolveFieldExamPlan(createFieldExam('rescue-team', 1), split).integrity).toBe(4);
    const nearComplete = { ...state, turn: 1, left: 2 };
    const clipped = resolveFieldExamPlan(nearComplete, { raon: 'left', leo: 'left' });
    expect(clipped).toMatchObject({ turn: 2, left: 3, right: 0, integrity: 4 });
    expect(resolveFieldExamPlan(clipped, split)).toBe(clipped);
    expect(canApplyFieldExamPlan(clipped, split)).toBe(false);
  });

  it('requires Raon to brace defy-order first, then hands off without a permanent numerical bonus', () => {
    const initial = createFieldExam('defy-order', 1);
    expect(resolveFieldExamPlan(initial, split)).toBe(initial);
    expect(canApplyFieldExamPlan(initial, { raon: 'right', leo: 'brace' })).toBe(false);
    const next = resolveFieldExamPlan(initial, { raon: 'brace', leo: 'left' });
    expect(next).toMatchObject({ turn: 1, integrity: 6, left: 1 });
    expect(next.log.some((line) => line.includes('하도리'))).toBe(true);
    expect(resolveFieldExamPlan(next, split)).toMatchObject({ integrity: 4, left: 2, right: 1 });
  });

  it('rejects invalid plans without spending a turn or mutating the input', () => {
    const state = createFieldExam('rescue-team', 1);
    const original = structuredClone(state);
    for (const plan of [null, {}, { raon: 'left' }, { raon: 'attack', leo: 'brace' }, { raon: 'left', leo: 'center' }]) {
      expect(canApplyFieldExamPlan(state, plan as FieldExamPlan)).toBe(false);
      expect(resolveFieldExamPlan(state, plan as FieldExamPlan)).toBe(state);
    }
    expect(state).toEqual(original);
    expect(resolveFieldExamPlan(createFieldExam('rescue-team'), split).phase).toBe('ready');
  });

  it('fails on collapse even if both rescues finish that turn and allows only a fresh retry', async () => {
    let profile = [split, split, split].reduce(step, startFieldExam(examProfile()));
    expect(getFieldExam(profile)).toMatchObject({ phase: 'failed', integrity: 0, left: 3, right: 3, turn: 3 });
    profile = await reload(profile);
    expect(step(profile, brace)).toBe(profile);
    expect(startFieldExam(profile)).toBe(profile);
    expect(advanceOriginStory(profile)).toBe(profile);
    expect(completeFieldExamReturn(profile, 1)).toBe(profile);
    const retried = await reload(retryFieldExam(profile));
    expect(getFieldExam(retried)).toMatchObject({ phase: 'active', attempt: 2, turn: 0, integrity: 6, left: 0, right: 0 });
    expect(retryFieldExam(retried)).toBe(retried);
    expect(retried.raonPath).toEqual(profile.raonPath);
    expect(retried.bondLevels).toEqual(profile.bondLevels);
    expect(retried.originStory.selectionScore).toBe(profile.originStory.selectionScore);
    const rescued = routes['rescue-team'].reduce(step, retried);
    expect(completeFieldExamReturn(rescued, 1)).toBe(rescued);
    expect(completeFieldExamReturn(rescued, 2).originStory.fieldExam?.phase).toBe('complete');
  });

  it('fails after eight unfinished plans without relying on elapsed wall time', async () => {
    let profile = startFieldExam(examProfile());
    for (let turn = 0; turn < fieldExamRules.turnLimit; turn += 1) profile = step(profile, brace);
    expect(getFieldExam(profile)).toMatchObject({ phase: 'failed', turn: 8, integrity: 6, left: 0, right: 0 });
    expect(await reload(profile)).toEqual(profile);
  });

  it('allows live completion on the final turn while keeping collapse and unfinished timeout as failures', () => {
    const state = { ...createFieldExam('rescue-team', 1), turn: 7, integrity: 4, left: 2, right: 2 };
    expect(resolveFieldExamPlan(state, split)).toMatchObject({ phase: 'return', turn: 8, integrity: 2 });
    expect(resolveFieldExamPlan({ ...state, integrity: 2 }, split)).toMatchObject({ phase: 'failed', integrity: 0 });
    expect(resolveFieldExamPlan({ ...state, left: 1 }, split)).toMatchObject({ phase: 'failed', integrity: 2, left: 2 });
  });

  it('accepts every engine-generated state for all plans and choices through the turn limit', () => {
    const orders: FieldExamOrder[] = ['left', 'right', 'brace'];
    const plans = orders.flatMap((raon) => orders.map((leo) => ({ raon, leo })));
    for (const choiceId of choices) {
      const visited = new Set<string>();
      const pending: FieldExamState[] = [createFieldExam(choiceId, 1)];
      while (pending.length) {
        const state = pending.pop()!;
        const key = [state.phase, state.turn, state.integrity, state.left, state.right].join(':');
        if (visited.has(key)) continue;
        visited.add(key);
        expect(isFieldExamState(JSON.parse(JSON.stringify(state))), `${choiceId}:${key}`).toBe(true);
        if (state.phase === 'active') {
          for (const plan of plans) {
            const next = resolveFieldExamPlan(state, plan);
            if (next !== state) pending.push(next);
          }
        }
      }
      expect(visited.size).toBeGreaterThan(100);
    }
  });
});

describe('field exam progression and save boundaries', () => {
  it.each(choices)('records %s intent once and defers the outcome until everyone withdraws', async (choiceId) => {
    const choice = scene.choices.find((entry) => entry.id === choiceId)!;
    const chosen = examProfile(choiceId);
    const original = createNewCampaignProfile();
    expect(chosen.raonPath[choice.path]).toBe(1);
    expect(chosen.originStory.selectionScore).toBe(choice.score);
    expect(chosen.bondLevels[getBondKey('raon', 'leo')]).toBe((original.bondLevels[getBondKey('raon', 'leo')] ?? 0) + 4);
    expect(chosen.originStory.flags).not.toContain(choice.flag);
    expect(chosen.world.npcMemories.leo?.rememberedFacts).not.toContain(choice.result);
    expect(chooseOriginStoryPath(chosen, scene.id, choiceId)).toBe(chosen);
    expect(chooseOriginStoryPath(chosen, scene.id, choices.find((entry) => entry !== choiceId)!)).toBe(chosen);
    expect(advanceOriginStory(chosen)).toBe(chosen);
    const active = startFieldExam(chosen);
    expect(startFieldExam(active)).toBe(active);
    expect(advanceOriginStory(active)).toBe(active);
    const returned = playExam(choiceId);
    expect(returned.originStory.flags).not.toContain(choice.flag);
    expect(returned.world.npcMemories.leo?.rememberedFacts).not.toContain(choice.result);
    expect(advanceOriginStory(returned)).toBe(returned);
    expect(step(returned, brace)).toBe(returned);
    expect(completeFieldExamReturn(returned, 2)).toBe(returned);
    const confirmed = completeFieldExamReturn(returned, 1);
    expect(confirmed.originStory.flags.filter((flag) => flag === choice.flag)).toHaveLength(1);
    expect(confirmed.world.npcMemories.leo?.rememberedFacts.filter((fact) => fact === choice.result)).toHaveLength(1);
    expect(confirmed.raonPath).toEqual(chosen.raonPath);
    expect(confirmed.bondLevels).toEqual(chosen.bondLevels);
    expect(confirmed.originStory.selectionScore).toBe(chosen.originStory.selectionScore);
    expect(confirmed.world.npcMemories.leo?.affinity).toBe(chosen.world.npcMemories.leo?.affinity);
    expect(confirmed.heroProgress).toEqual(original.heroProgress);
    expect([confirmed.day, confirmed.supplies, confirmed.intel, confirmed.relics, confirmed.renown])
      .toEqual([original.day, original.supplies, original.intel, original.relics, original.renown]);
    expect(completeFieldExamReturn(confirmed, 1)).toBe(confirmed);
    const advanced = advanceOriginStory(await reload(confirmed));
    expect(advanced.originStory.currentSceneId).toBe('suspended-candidate');
    expect(await reload(advanced)).toEqual(advanced);
    expect(getFieldExam(advanced)).toBeUndefined();
    expect(startFieldExam(advanced)).toBe(advanced);
  });

  it('ignores duplicate turn callbacks and callbacks from an earlier attempt', () => {
    const initial = startFieldExam(examProfile());
    const first = applyFieldExamPlan(initial, 1, 0, split);
    expect(applyFieldExamPlan(first, 1, 0, split)).toBe(first);
    expect(applyFieldExamPlan(first, 2, 1, split)).toBe(first);
    const failed = [split, split].reduce(step, first);
    const retried = retryFieldExam(failed);
    expect(applyFieldExamPlan(retried, 1, 0, split)).toBe(retried);
    expect(applyFieldExamPlan(retried, 1, 2, split)).toBe(retried);
    expect(applyFieldExamPlan(retried, 2, 0, split)).not.toBe(retried);
  });

  it.each(choices)('migrates a pending v10 %s choice without repeating its score or relationships', async (choiceId) => {
    const legacy = examProfile(choiceId);
    delete legacy.originStory.fieldExam;
    const choice = scene.choices.find((entry) => entry.id === choiceId)!;
    legacy.originStory.flags.push(choice.flag, 'earlier-choice');
    legacy.world.npcMemories.leo!.rememberedFacts = [choice.result, '이전 기억'];
    local.set(`${campaignStorageKey}-slot-1`, JSON.stringify(legacy));
    const loaded = await loadCampaignProfile(1);
    if (loaded.status !== 'ready') throw new Error('Expected migrated legacy field exam');
    const pending = loaded.profile;
    expect(getFieldExam(pending)?.phase).toBe('ready');
    expect(pending.originStory.flags).toEqual(['earlier-choice']);
    expect(pending.world.npcMemories.leo?.rememberedFacts).toEqual(['이전 기억']);
    expect(pending.raonPath).toEqual(legacy.raonPath);
    expect(pending.bondLevels).toEqual(legacy.bondLevels);
    expect(pending.originStory.selectionScore).toBe(legacy.originStory.selectionScore);
    expect(migrateFieldExam(pending)).toBe(pending);
    const returned = routes[choiceId].reduce(step, startFieldExam(await reload(pending)));
    const confirmed = completeFieldExamReturn(returned, 1);
    expect(confirmed.originStory.flags).toEqual(['earlier-choice', choice.flag]);
    expect(confirmed.world.npcMemories.leo?.rememberedFacts.filter((fact) => fact === choice.result)).toHaveLength(1);
    expect(confirmed.world.npcMemories.leo?.affinity).toBe(legacy.world.npcMemories.leo?.affinity);
    expect(confirmed.raonPath).toEqual(legacy.raonPath);
    expect(confirmed.bondLevels).toEqual(legacy.bondLevels);
    expect(confirmed.originStory.selectionScore).toBe(legacy.originStory.selectionScore);
  });

  it.each(['later-scene', 'field-recorded', 'graduated'])('preserves an old %s save without replaying the exam', async (stage) => {
    const legacy = examProfile();
    delete legacy.originStory.fieldExam;
    legacy.originStory.flags.push(scene.choices[0]!.flag);
    legacy.world.npcMemories.leo!.rememberedFacts.push(scene.choices[0]!.result);
    if (stage === 'later-scene') legacy.originStory.currentSceneId = 'suspended-candidate';
    if (stage === 'field-recorded') legacy.originStory.completedSceneIds.push(scene.id);
    if (stage === 'graduated') legacy.originStory.completed = true;
    const loaded = await reload(legacy);
    expect(loaded).toEqual(legacy);
    expect(getFieldExam(loaded)).toBeUndefined();
    expect(startFieldExam(loaded)).toBe(loaded);
    expect(migrateFieldExam(loaded)).toBe(loaded);
    if (stage === 'field-recorded') expect(advanceOriginStory(loaded).originStory.currentSceneId).toBe('suspended-candidate');
  });

  it('rejects malformed exam states and contradictory choice or scene data', async () => {
    const profile = startFieldExam(examProfile());
    const exam = getFieldExam(profile)!;
    for (const broken of [null, {}, { ...exam, choiceId: 'unknown' }, { ...exam, integrity: NaN }, { ...exam, integrity: 9 },
      { ...exam, turn: 1.5 }, { ...exam, turn: 9 }, { ...exam, left: 4 }, { ...exam, right: -1 },
      { ...exam, attempt: 0 }, { ...exam, attempt: Infinity }, { ...exam, phase: 'complete' }, { ...exam, phase: 'failed' },
      { ...exam, phase: 'ready', turn: 1 }, { ...exam, turn: 1, left: 3 }, { ...exam, log: [1] }, { ...exam, log: Array(17).fill('x') }]) {
      expect(isFieldExamState(broken)).toBe(false);
      expect(isCampaignProfileCandidate({ ...profile, originStory: { ...profile.originStory, fieldExam: broken } })).toBe(false);
    }
    for (const changed of [
      { choices: { [scene.id]: 'split-route' } }, { currentSceneId: 'suspended-candidate' },
      { completed: true }, { completedSceneIds: [scene.id] },
    ]) {
      const candidate = { ...profile, originStory: { ...profile.originStory, ...changed } };
      expect(isCampaignProfileCandidate(candidate)).toBe(false);
      expect(await saveCampaignProfile(candidate, 1)).toBe(false);
    }
    expect(local.size).toBe(0);
  });

  it('checks the field exam even with an earlier completed village rescue, and still rejects corrupt village data', () => {
    const profile = examProfile();
    const villageRescue = { ...createVillageRescue('save-child', 1), phase: 'complete' as const, turn: 9, hp: 2, progress: 3 };
    const originStory = { ...profile.originStory, choices: { ...profile.originStory.choices, 'river-incident': 'save-child' }, villageRescue };
    expect(isCampaignProfileCandidate({ ...profile, originStory })).toBe(true);
    expect(isCampaignProfileCandidate({ ...profile, originStory: { ...originStory, fieldExam: {} } })).toBe(false);
    expect(isCampaignProfileCandidate({ ...profile, originStory: { ...originStory, villageRescue: {} } })).toBe(false);
  });

  it('saves active and completed exams alongside the completed river rescue from natural origin progression', async () => {
    let profile = createNewCampaignProfile();
    for (const originScene of originStoryScenes) {
      if (originScene.id === scene.id) break;
      profile = chooseOriginStoryPath(profile, originScene.id, originScene.choices[0]!.id);
      if (originScene.id === 'river-incident') {
        profile = startVillageRescue(profile);
        for (let index = 0; index < 3; index += 1) profile = applyVillageRescueAction(profile, { type: 'move', dx: 1, dy: 0 });
        for (let index = 0; index < 3; index += 1) profile = applyVillageRescueAction(profile, { type: 'assist' });
        for (let index = 0; index < 3; index += 1) profile = applyVillageRescueAction(profile, { type: 'move', dx: -1, dy: 0 });
        profile = completeVillageRescueReturn({ ...profile, world: { ...profile.world, village: {
          ...profile.world.village, playerX: villageRescueReturnPoint.x, playerY: villageRescueReturnPoint.y,
        } } });
      }
      profile = advanceOriginStory(profile);
    }
    expect(profile.originStory.currentSceneId).toBe(scene.id);
    expect(profile.originStory.villageRescue?.phase).toBe('complete');
    profile = startFieldExam(chooseOriginStoryPath(profile, scene.id, 'split-route'));
    expect(profile.originStory.fieldExam?.phase).toBe('active');
    expect(await reload(profile)).toEqual(profile);
    for (const plan of routes['split-route']) profile = await reload(step(profile, plan));
    profile = completeFieldExamReturn(profile, 1);
    expect(profile.originStory.fieldExam?.phase).toBe('complete');
    expect(profile.originStory.villageRescue?.phase).toBe('complete');
    expect(await reload(profile)).toEqual(profile);
    expect(await reload(advanceOriginStory(profile))).toEqual(advanceOriginStory(profile));
  });

  it('does not start or choose an exam outside its current uncompleted scene', () => {
    const fresh = createNewCampaignProfile();
    expect(getFieldExam(fresh)).toBeUndefined();
    expect(startFieldExam(fresh)).toBe(fresh);
    expect(applyFieldExamPlan(fresh, 1, 0, split)).toBe(fresh);
    expect(retryFieldExam(fresh)).toBe(fresh);
    expect(completeFieldExamReturn(fresh, 1)).toBe(fresh);
    expect(chooseOriginStoryPath(fresh, scene.id, 'rescue-team')).toBe(fresh);
    const firstScene = getOriginStoryScene(fresh.originStory.currentSceneId);
    expect(chooseOriginStoryPath(fresh, 'unknown-scene', firstScene.choices[0]!.id)).toBe(fresh);
    const unchosen = { ...fresh, originStory: { ...fresh.originStory, currentSceneId: scene.id } };
    expect(getFieldExam(unchosen)).toBeUndefined();
    expect(startFieldExam(unchosen)).toBe(unchosen);
    expect(advanceOriginStory(unchosen)).toBe(unchosen);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { missions } from '../data/campaign';
import { getOriginStoryScene, originStoryScenes } from '../data/originStory';
import type { CampaignProfile, CaptainTrialAction, CaptainTrialChoiceId, CaptainTrialSceneId, CaptainTrialState } from '../types';
import { beginCampaignBattle } from './campaignBattle';
import { canApplyCaptainTrialAction, captainTrialRules, createCaptainTrial, getCaptainTrialIntent, isCaptainTrialChoiceId, isCaptainTrialSceneId, isCaptainTrialState, resolveCaptainTrialAction } from './captainTrial';
import { applyCaptainTrialAction, completeCaptainTrial, getCaptainTrial, migrateCaptainTrials, retryCaptainTrial, startCaptainTrial } from './captainTrialProgression';
import { applyFieldExamPlan, completeFieldExamReturn, startFieldExam } from './fieldExamProgression';
import { canLaunchMission } from './missionAccess';
import { isCampaignProfileCandidate } from './persistence';
import { applyPetalTrainingAction, completePetalTraining, startPetalTraining } from './petalTrainingProgression';
import { advanceOriginStory, buildProgressedHeroes, campaignStorageKey, chooseOriginStoryPath, chooseRaonStoryPath, createNewCampaignProfile, getBondKey, loadCampaignProfile, saveCampaignProfile } from './progression';
import { villageRescueReturnPoint } from './villageRescue';
import { applyVillageRescueAction, completeVillageRescueReturn, startVillageRescue } from './villageRescueProgression';

const routes: Record<CaptainTrialChoiceId, CaptainTrialAction[]> = {
  'break-spear-not-kain': ['parry', 'counter', 'sidestep', 'counter', 'recover', 'recover', 'sidestep', 'counter'],
  'use-sixteenth-gap': ['parry', 'counter', 'sidestep', 'counter', 'parry', 'counter'],
  'declare-my-name': ['parry', 'counter', 'sidestep', 'counter'],
  'trust-her-recovery': ['sidestep', 'parry', 'counter', 'sidestep', 'recover', 'recover', 'sidestep', 'parry', 'counter', 'sidestep', 'recover', 'recover', 'sidestep', 'parry', 'counter'],
  'change-old-rhythm': ['sidestep', 'parry', 'counter', 'sidestep', 'parry', 'counter', 'sidestep', 'parry', 'counter'],
  'step-beside-not-behind': ['sidestep', 'parry', 'counter', 'sidestep', 'recover', 'recover', 'sidestep', 'parry', 'counter'],
};
const choices = Object.keys(routes) as CaptainTrialChoiceId[];
const actions: CaptainTrialAction[] = ['parry', 'sidestep', 'counter', 'recover', 'challenge'];
const hadori = getOriginStoryScene('hadori-wall');

function sceneFor(choiceId: CaptainTrialChoiceId): CaptainTrialSceneId {
  return getOriginStoryScene('captain-trials').choices.some((choice) => choice.id === choiceId) ? 'captain-trials' : 'kazrin-duel';
}

function trialProfile(choiceId: CaptainTrialChoiceId = 'use-sixteenth-gap') {
  const profile = createNewCampaignProfile();
  profile.originStory.currentSceneId = sceneFor(choiceId);
  return chooseOriginStoryPath(profile, profile.originStory.currentSceneId, choiceId);
}

function hadoriProfile() {
  const profile = createNewCampaignProfile();
  profile.originStory.currentSceneId = 'hadori-wall';
  return profile;
}

function step(profile: CampaignProfile, action: CaptainTrialAction) {
  const state = getCaptainTrial(profile)!;
  return applyCaptainTrialAction(profile, state.sceneId, state.attempt, state.turn, action);
}

function playTrial(choiceId: CaptainTrialChoiceId = 'use-sixteenth-gap') {
  return routes[choiceId].reduce(step, startCaptainTrial(trialProfile(choiceId), sceneFor(choiceId)));
}

function confirmTrial(choiceId: CaptainTrialChoiceId = 'use-sixteenth-gap') {
  return completeCaptainTrial(playTrial(choiceId), sceneFor(choiceId), 1);
}

function confirmHadori() {
  return completeCaptainTrial(step(startCaptainTrial(hadoriProfile(), 'hadori-wall'), 'challenge'), 'hadori-wall', 1);
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
  if (result.status !== 'ready') throw new Error('Expected saved captain trial');
  return result.profile;
}

describe('captain trial rules', () => {
  it.each(choices)('wins with %s and preserves each action and preview through campaign save/load', async (choiceId) => {
    const sceneId = sceneFor(choiceId);
    let profile = await reload(trialProfile(choiceId));
    expect(getCaptainTrial(profile)).toMatchObject({ phase: 'ready', attempt: 0, turn: 0, poise: 6, breath: 4, progress: 0, opening: false });
    profile = await reload(startCaptainTrial(profile, sceneId));
    for (const action of routes[choiceId]) {
      const before = profile;
      const preview = resolveCaptainTrialAction(getCaptainTrial(profile)!, action);
      profile = step(profile, action);
      expect(profile).not.toBe(before);
      expect(getCaptainTrial(profile)).toEqual(preview);
      const saved = profile;
      profile = await reload(profile);
      expect(profile).toEqual(saved);
    }
    expect(getCaptainTrial(profile)).toMatchObject({ phase: 'resolved', progress: 3, attempt: 1 });
    expect(getCaptainTrial(profile)!.poise).toBeGreaterThan(0);
  });

  it('previews the repeated Kain and Kazrin attack patterns', () => {
    const kain = createCaptainTrial('captain-trials', 'use-sixteenth-gap', 1);
    const kazrin = createCaptainTrial('kazrin-duel', 'change-old-rhythm', 1);
    expect(Array.from({ length: 8 }, (_, turn) => getCaptainTrialIntent({ ...kain, turn })))
      .toEqual(['thrust', 'recover', 'sweep', 'recover', 'thrust', 'recover', 'sweep', 'recover']);
    expect(Array.from({ length: 6 }, (_, turn) => getCaptainTrialIntent({ ...kazrin, turn })))
      .toEqual(['sweep', 'thrust', 'recover', 'sweep', 'thrust', 'recover']);
    expect(getCaptainTrialIntent(createCaptainTrial('hadori-wall'))).toBe('overwhelm');
  });

  it('requires both Kazrin defenses in sequence before a counter can use the opening', () => {
    const initial = createCaptainTrial('kazrin-duel', 'change-old-rhythm', 1);
    const first = resolveCaptainTrialAction(initial, 'sidestep');
    expect(first).toMatchObject({ opening: true, poise: 6 });
    expect(canApplyCaptainTrialAction(first, 'counter')).toBe(false);
    const second = resolveCaptainTrialAction(first, 'parry');
    expect(second.opening).toBe(true);
    expect(resolveCaptainTrialAction(second, 'counter').progress).toBe(1);
    const missedFirst = resolveCaptainTrialAction(initial, 'parry');
    const correctSecond = resolveCaptainTrialAction(missedFirst, 'parry');
    expect(correctSecond).toMatchObject({ poise: 4, opening: false });
    expect(resolveCaptainTrialAction(correctSecond, 'counter')).toBe(correctSecond);
    expect(resolveCaptainTrialAction(first, 'sidestep')).toMatchObject({ opening: false, poise: 4 });
  });

  it('applies choice-specific defense cost, recovery, counter progress and mistake damage', () => {
    const compassionate = createCaptainTrial('captain-trials', 'break-spear-not-kain', 1);
    const insight = createCaptainTrial('captain-trials', 'use-sixteenth-gap', 1);
    const resolve = createCaptainTrial('captain-trials', 'declare-my-name', 1);
    expect(resolveCaptainTrialAction(compassionate, 'parry')).toMatchObject({ breath: 3, poise: 6, opening: true });
    expect(resolveCaptainTrialAction(insight, 'parry')).toMatchObject({ breath: 4, poise: 6, opening: true });
    expect(resolveCaptainTrialAction(compassionate, 'sidestep').poise).toBe(4);
    expect(resolveCaptainTrialAction(resolve, 'sidestep').poise).toBe(3);
    for (const [initial, progress] of [[compassionate, 1], [insight, 1], [resolve, 2]] as const) {
      const defended = resolveCaptainTrialAction(initial, 'parry');
      expect(resolveCaptainTrialAction(defended, 'counter')).toMatchObject({ progress, opening: false, breath: defended.breath - 1 });
      const tired = { ...initial, turn: 1, breath: 0, poise: 2, opening: true };
      expect(resolveCaptainTrialAction(tired, 'recover')).toMatchObject({
        breath: initial === compassionate ? 3 : 2, poise: initial === compassionate ? 4 : 3, opening: false,
      });
      const recoveringUnderAttack = resolveCaptainTrialAction({ ...tired, turn: 2 }, 'recover');
      expect(recoveringUnderAttack).toMatchObject({ breath: initial === compassionate ? 3 : 2, poise: 0, opening: false, phase: 'failed' });
    }
    expect(resolveCaptainTrialAction(resolveCaptainTrialAction(compassionate, 'parry'), 'parry'))
      .toMatchObject({ breath: 2, poise: 6, progress: 0, opening: false });
  });

  it('rejects invalid or unaffordable actions unchanged while recovery remains available', () => {
    const active = createCaptainTrial('captain-trials', 'break-spear-not-kain', 1);
    for (const action of ['counter', 'challenge', 'attack', undefined, null]) {
      expect(canApplyCaptainTrialAction(active, action as CaptainTrialAction)).toBe(false);
      expect(resolveCaptainTrialAction(active, action as CaptainTrialAction)).toBe(active);
    }
    const exhausted = { ...active, turn: 4, breath: 0, progress: 2 };
    expect(resolveCaptainTrialAction(exhausted, 'parry')).toBe(exhausted);
    expect(resolveCaptainTrialAction(exhausted, 'sidestep')).toBe(exhausted);
    expect(canApplyCaptainTrialAction(exhausted, 'recover')).toBe(true);
    expect(canApplyCaptainTrialAction({ ...exhausted, choiceId: 'use-sixteenth-gap' }, 'parry')).toBe(true);
    const rest = { ...exhausted, turn: 5, opening: true };
    expect(resolveCaptainTrialAction(rest, 'counter')).toBe(rest);
    const ready = createCaptainTrial('captain-trials', 'break-spear-not-kain');
    expect(resolveCaptainTrialAction(ready, 'parry')).toBe(ready);
  });

  it('fails on lost poise and starts a clean retry without repeating choice rewards', async () => {
    let profile = startCaptainTrial(trialProfile('declare-my-name'), 'captain-trials');
    for (const action of ['sidestep', 'parry', 'parry'] as const) profile = step(profile, action);
    expect(getCaptainTrial(profile)).toMatchObject({ phase: 'failed', turn: 3, poise: 0 });
    profile = await reload(profile);
    expect(step(profile, 'recover')).toBe(profile);
    expect(startCaptainTrial(profile, 'captain-trials')).toBe(profile);
    expect(advanceOriginStory(profile)).toBe(profile);
    expect(completeCaptainTrial(profile, 'captain-trials', 1)).toBe(profile);
    const retry = await reload(retryCaptainTrial(profile, 'captain-trials', 1));
    expect(getCaptainTrial(retry)).toMatchObject({ phase: 'active', attempt: 2, turn: 0, poise: 6, breath: 4, progress: 0, opening: false });
    expect(retry.raonPath).toEqual(profile.raonPath);
    expect(retry.originStory.selectionScore).toBe(profile.originStory.selectionScore);
    expect(retry.world.npcMemories).toEqual(profile.world.npcMemories);
    expect(retryCaptainTrial(retry, 'captain-trials', 1)).toBe(retry);
    expect(retryCaptainTrial(retry, 'captain-trials', 2)).toBe(retry);
    const resolved = routes['declare-my-name'].reduce(step, retry);
    expect(completeCaptainTrial(resolved, 'captain-trials', 1)).toBe(resolved);
    expect(completeCaptainTrial(resolved, 'captain-trials', 2).originStory.captainTrials?.['captain-trials']?.phase).toBe('complete');
  });

  it('fails an unfinished eighteenth turn but allows a live winning counter on the same boundary', () => {
    const active = createCaptainTrial('captain-trials', 'use-sixteenth-gap', 1);
    let timedOut = active;
    for (let turn = 0; turn < captainTrialRules.turnLimit; turn += 1) timedOut = resolveCaptainTrialAction(timedOut,
      getCaptainTrialIntent(timedOut) === 'thrust' ? 'parry' : getCaptainTrialIntent(timedOut) === 'sweep' ? 'sidestep' : 'recover');
    expect(timedOut).toMatchObject({ phase: 'failed', turn: 18, progress: 0, poise: 6 });
    const lastOpening = { ...active, turn: 17, progress: 2, opening: true };
    expect(resolveCaptainTrialAction(lastOpening, 'counter')).toMatchObject({ phase: 'resolved', turn: 18, progress: 3 });
  });

  it('validates every reachable action output and confirmed result for all six approaches', () => {
    for (const choiceId of choices) {
      const profile = trialProfile(choiceId);
      const initial = createCaptainTrial(sceneFor(choiceId), choiceId, 1);
      const queue = [initial];
      const keyOf = (state: CaptainTrialState) => [state.phase, state.turn, state.poise, state.breath, state.progress, state.opening].join(':');
      const seen = new Set([keyOf(initial)]);
      const phases = new Set<string>();
      for (let index = 0; index < queue.length; index += 1) {
        const state = queue[index]!;
        phases.add(state.phase);
        const candidate = { ...profile, originStory: { ...profile.originStory, captainTrials: { [state.sceneId]: state } } };
        expect(isCaptainTrialState(state), `${choiceId}:${keyOf(state)}`).toBe(true);
        expect(isCampaignProfileCandidate(JSON.parse(JSON.stringify(candidate)))).toBe(true);
        if (state.phase === 'active') {
          for (const action of actions) {
            const next = resolveCaptainTrialAction(state, action);
            const key = keyOf(next);
            if (next !== state && !seen.has(key)) { seen.add(key); queue.push(next); }
          }
        } else if (state.phase === 'resolved') {
          expect(isCampaignProfileCandidate(completeCaptainTrial(candidate, state.sceneId, 1))).toBe(true);
        }
      }
      expect([...phases].sort()).toEqual(['active', 'failed', 'resolved']);
    }
  }, 20000);
});

describe('captain trial progression boundaries', () => {
  it.each(choices)('keeps %s as one intent and records the result once after confirmation', async (choiceId) => {
    const sceneId = sceneFor(choiceId);
    const scene = getOriginStoryScene(sceneId);
    const choice = scene.choices.find((entry) => entry.id === choiceId)!;
    const chosen = trialProfile(choiceId);
    expect(chosen.raonPath[choice.path]).toBe(1);
    expect(chosen.originStory.selectionScore).toBe(choice.score);
    expect(chosen.world.npcMemories[scene.speakerId]?.affinity).toBe(4);
    expect(chosen.bondLevels[getBondKey('raon', scene.speakerId)]).toBe(4);
    expect(chosen.originStory.flags).not.toContain(choice.flag);
    expect(chosen.world.npcMemories[scene.speakerId]?.rememberedFacts).not.toContain(choice.result);
    expect(chooseOriginStoryPath(chosen, sceneId, choiceId)).toBe(chosen);
    expect(advanceOriginStory(chosen)).toBe(chosen);
    const active = startCaptainTrial(chosen, sceneId);
    expect(advanceOriginStory(active)).toBe(active);
    const resolved = playTrial(choiceId);
    expect(resolved.originStory.flags).not.toContain(choice.flag);
    expect(advanceOriginStory(resolved)).toBe(resolved);
    const complete = completeCaptainTrial(resolved, sceneId, 1);
    expect(complete.originStory.flags.filter((flag) => flag === choice.flag)).toHaveLength(1);
    expect(complete.world.npcMemories[scene.speakerId]?.rememberedFacts.filter((fact) => fact === choice.result)).toHaveLength(1);
    expect(complete.world.npcMemories[scene.speakerId]?.affinity).toBe(4);
    expect(complete.raonPath).toEqual(chosen.raonPath);
    expect(complete.bondLevels).toEqual(chosen.bondLevels);
    expect(complete.originStory.selectionScore).toBe(chosen.originStory.selectionScore);
    expect(complete.heroProgress).toEqual(chosen.heroProgress);
    expect(buildProgressedHeroes(complete)).toEqual(buildProgressedHeroes(chosen));
    expect([complete.day, complete.supplies, complete.intel, complete.relics, complete.renown])
      .toEqual([chosen.day, chosen.supplies, chosen.intel, chosen.relics, chosen.renown]);
    expect(completeCaptainTrial(complete, sceneId, 1)).toBe(complete);
    const advanced = advanceOriginStory(await reload(complete));
    expect(advanced.originStory.currentSceneId).toBe(scene.nextSceneId);
    expect(advanced.originStory.captainTrials?.[sceneId]).toEqual(complete.originStory.captainTrials?.[sceneId]);
    expect(startCaptainTrial(advanced, sceneId)).toBe(advanced);
    expect(isCampaignProfileCandidate(advanced)).toBe(true);
  });

  it.each(hadori.choices)('requires Hadori’s loss and confirmation before reaction $id, with no duel reward', async (choice) => {
    const fresh = hadoriProfile();
    expect(getCaptainTrial(fresh)).toMatchObject({ phase: 'ready', sceneId: 'hadori-wall' });
    expect(getCaptainTrial(fresh)).not.toHaveProperty('choiceId');
    expect(chooseOriginStoryPath(fresh, hadori.id, choice.id)).toBe(fresh);
    const active = await reload(startCaptainTrial(fresh, 'hadori-wall'));
    for (const action of ['parry', 'sidestep', 'counter', 'recover'] as const) expect(step(active, action)).toBe(active);
    expect(chooseOriginStoryPath(active, hadori.id, choice.id)).toBe(active);
    const loss = await reload(step(active, 'challenge'));
    expect(getCaptainTrial(loss)).toMatchObject({ phase: 'resolved', turn: 1, poise: 0, breath: 4, progress: 0, opening: false });
    expect(chooseOriginStoryPath(loss, hadori.id, choice.id)).toBe(loss);
    expect(retryCaptainTrial(loss, 'hadori-wall', 1)).toBe(loss);
    expect(step(loss, 'challenge')).toBe(loss);
    const confirmed = await reload(completeCaptainTrial(loss, 'hadori-wall', 1));
    expect(confirmed.world).toEqual(fresh.world);
    expect(confirmed.bondLevels).toEqual(fresh.bondLevels);
    expect(confirmed.raonPath).toEqual(fresh.raonPath);
    expect(confirmed.originStory.flags).toEqual(fresh.originStory.flags);
    expect(confirmed.originStory.choices).toEqual(fresh.originStory.choices);
    expect(confirmed.originStory.selectionScore).toBe(0);
    expect(advanceOriginStory(confirmed)).toBe(confirmed);
    const reacted = await reload(chooseOriginStoryPath(confirmed, hadori.id, choice.id));
    expect(reacted.originStory.flags).toEqual([choice.flag]);
    expect(reacted.originStory.selectionScore).toBe(choice.score);
    expect(reacted.raonPath[choice.path]).toBe(1);
    expect(reacted.world.npcMemories.hadori?.affinity).toBe(4);
    expect(reacted.bondLevels[getBondKey('raon', 'hadori')]).toBe(4);
    expect(chooseOriginStoryPath(reacted, hadori.id, choice.id)).toBe(reacted);
    expect(completeCaptainTrial(reacted, 'hadori-wall', 1)).toBe(reacted);
    let inducted = advanceOriginStory(reacted);
    expect(inducted.originStory.currentSceneId).toBe('seventh-oath');
    inducted = chooseOriginStoryPath(inducted, 'seventh-oath', 'oath-return');
    inducted = advanceOriginStory(inducted);
    expect(inducted.originStory.completed).toBe(true);
    expect(inducted.unlockedRecords).toContain('psyche-generation-07');
    expect(await reload(inducted)).toEqual(inducted);
  });

  it('rejects stale scene, attempt and turn callbacks even when the next trial has the same attempt and turn', () => {
    const first = startCaptainTrial(trialProfile(), 'captain-trials');
    const acted = applyCaptainTrialAction(first, 'captain-trials', 1, 0, 'parry');
    expect(applyCaptainTrialAction(acted, 'captain-trials', 1, 0, 'parry')).toBe(acted);
    expect(applyCaptainTrialAction(acted, 'captain-trials', 2, 1, 'counter')).toBe(acted);
    let next = advanceOriginStory(confirmTrial());
    next = chooseOriginStoryPath(next, 'kazrin-duel', 'change-old-rhythm');
    next = startCaptainTrial(next, 'kazrin-duel');
    expect(getCaptainTrial(next)).toMatchObject({ attempt: 1, turn: 0 });
    expect(startCaptainTrial(next, 'captain-trials')).toBe(next);
    expect(applyCaptainTrialAction(next, 'captain-trials', 1, 0, 'sidestep')).toBe(next);
    expect(retryCaptainTrial(next, 'captain-trials', 1)).toBe(next);
    expect(completeCaptainTrial(next, 'captain-trials', 1)).toBe(next);
    expect(applyCaptainTrialAction(next, 'kazrin-duel', 1, 0, 'sidestep')).not.toBe(next);
  });

  it.each(choices)('migrates a pending choice-only %s save without duplicating scores or relationships', async (choiceId) => {
    const sceneId = sceneFor(choiceId);
    const scene = getOriginStoryScene(sceneId);
    const choice = scene.choices.find((entry) => entry.id === choiceId)!;
    const legacy = trialProfile(choiceId);
    delete legacy.originStory.captainTrials;
    legacy.originStory.flags.push(choice.flag, 'earlier-choice');
    legacy.world.npcMemories[scene.speakerId]!.rememberedFacts = [choice.result, '이전의 기억'];
    local.set(`${campaignStorageKey}-slot-1`, JSON.stringify(legacy));
    const result = await loadCampaignProfile(1);
    if (result.status !== 'ready') throw new Error('Expected migrated trial');
    const pending = result.profile;
    expect(getCaptainTrial(pending)?.phase).toBe('ready');
    expect(pending.originStory.flags).toEqual(['earlier-choice']);
    expect(pending.world.npcMemories[scene.speakerId]?.rememberedFacts).toEqual(['이전의 기억']);
    expect(pending.raonPath).toEqual(legacy.raonPath);
    expect(pending.originStory.selectionScore).toBe(legacy.originStory.selectionScore);
    expect(pending.bondLevels).toEqual(legacy.bondLevels);
    expect(migrateCaptainTrials(pending)).toBe(pending);
    const completed = completeCaptainTrial(routes[choiceId].reduce(step, startCaptainTrial(pending, sceneId)), sceneId, 1);
    expect(completed.originStory.flags).toEqual(['earlier-choice', choice.flag]);
    expect(completed.world.npcMemories[scene.speakerId]?.affinity).toBe(legacy.world.npcMemories[scene.speakerId]?.affinity);
    expect(completed.raonPath).toEqual(legacy.raonPath);
    expect(completed.bondLevels).toEqual(legacy.bondLevels);
  });

  it('migrates an unchosen Hadori scene to ready but preserves an existing post-defeat reaction without replay', async () => {
    const pending = await reload(hadoriProfile());
    expect(getCaptainTrial(pending)?.phase).toBe('ready');
    expect(pending.originStory.captainTrials?.['hadori-wall']?.phase).toBe('ready');
    const legacy = chooseOriginStoryPath(confirmHadori(), 'hadori-wall', hadori.choices[0]!.id);
    delete legacy.originStory.captainTrials;
    expect(getCaptainTrial(legacy)).toBeUndefined();
    expect(migrateCaptainTrials(legacy)).toBe(legacy);
    expect(startCaptainTrial(legacy, 'hadori-wall')).toBe(legacy);
    expect(await reload(legacy)).toEqual(legacy);
    expect(advanceOriginStory(legacy).originStory.currentSceneId).toBe('seventh-oath');
  });

  it.each(['later-scene', 'trial-recorded', 'graduated'])('preserves old %s trial history without a replay requirement', async (stage) => {
    const legacy = trialProfile();
    delete legacy.originStory.captainTrials;
    const choice = getOriginStoryScene('captain-trials').choices[1]!;
    legacy.originStory.flags.push(choice.flag);
    if (stage === 'later-scene') legacy.originStory.currentSceneId = 'seventh-oath';
    if (stage === 'trial-recorded') legacy.originStory.completedSceneIds.push('captain-trials');
    if (stage === 'graduated') legacy.originStory.completed = true;
    expect(await reload(legacy)).toEqual(legacy);
    expect(getCaptainTrial(legacy)).toBeUndefined();
    expect(startCaptainTrial(legacy, 'captain-trials')).toBe(legacy);
    if (stage === 'trial-recorded') expect(advanceOriginStory(legacy).originStory.currentSceneId).toBe('kazrin-duel');
  });

  it('rejects malformed or contradictory trial maps and cannot skip a corrupt entry', async () => {
    const profile = startCaptainTrial(trialProfile(), 'captain-trials');
    const state = getCaptainTrial(profile)!;
    for (const broken of [null, {}, { ...state, sceneId: 'unknown' }, { ...state, choiceId: 'change-old-rhythm' },
      { ...state, turn: 19 }, { ...state, turn: 1.5 }, { ...state, poise: 7 }, { ...state, breath: -1 },
      { ...state, progress: 4 }, { ...state, poise: NaN }, { ...state, attempt: 0 }, { ...state, attempt: Infinity },
      { ...state, opening: 1 }, { ...state, phase: 'resolved' }, { ...state, phase: 'failed' }, { ...state, log: [1] }, { ...state, log: Array(17).fill('x') }]) {
      expect(isCaptainTrialState(broken)).toBe(false);
      expect(isCampaignProfileCandidate({ ...profile, originStory: { ...profile.originStory, captainTrials: { 'captain-trials': broken } } })).toBe(false);
    }
    const foreign = createCaptainTrial('kazrin-duel', 'change-old-rhythm', 1);
    for (const captainTrials of [null, [], { unknown: state }, { 'kazrin-duel': state }, { 'captain-trials': state, 'kazrin-duel': foreign }]) {
      expect(isCampaignProfileCandidate({ ...profile, originStory: { ...profile.originStory, captainTrials } })).toBe(false);
    }
    for (const changed of [{ choices: { 'captain-trials': 'declare-my-name' } }, { currentSceneId: 'kazrin-duel' }, { completed: true }, { completedSceneIds: ['captain-trials'] }]) {
      const candidate = { ...profile, originStory: { ...profile.originStory, ...changed } };
      expect(isCampaignProfileCandidate(candidate)).toBe(false);
      expect(await saveCampaignProfile(candidate, 1)).toBe(false);
    }
    const complete = confirmTrial();
    expect(isCampaignProfileCandidate({ ...complete, originStory: { ...complete.originStory, currentSceneId: 'seventh-oath' } })).toBe(false);
    const hadoriActive = startCaptainTrial(hadoriProfile(), 'hadori-wall');
    expect(isCampaignProfileCandidate({ ...hadoriActive, originStory: { ...hadoriActive.originStory, choices: { 'hadori-wall': hadori.choices[0]!.id } } })).toBe(false);
    const hadoriState = getCaptainTrial(hadoriActive)!;
    expect(isCaptainTrialState({ ...hadoriState, choiceId: 'declare-my-name' })).toBe(false);
    expect(isCaptainTrialState({ ...hadoriState, phase: 'failed', poise: 0, turn: 1 })).toBe(false);
    expect(isCaptainTrialState({ ...getCaptainTrial(confirmHadori())!, attempt: 2 })).toBe(false);
    expect(local.size).toBe(0);
  });

  it('rejects unknown scenes, choices and wrong-scene starts without changing a profile', () => {
    const fresh = createNewCampaignProfile();
    expect(startCaptainTrial(fresh, 'captain-trials')).toBe(fresh);
    expect(applyCaptainTrialAction(fresh, 'captain-trials', 1, 0, 'parry')).toBe(fresh);
    const current = { ...fresh, originStory: { ...fresh.originStory, currentSceneId: 'captain-trials' } };
    expect(chooseOriginStoryPath(current, 'captain-trials', 'unknown')).toBe(current);
    expect(chooseOriginStoryPath(current, 'captain-trials', 'change-old-rhythm')).toBe(current);
    expect(chooseOriginStoryPath(current, 'unknown', 'use-sixteenth-gap')).toBe(current);
    expect(getCaptainTrial(current)).toBeUndefined();
    expect(startCaptainTrial(current, 'captain-trials')).toBe(current);
    expect(isCaptainTrialChoiceId('thank-hadori')).toBe(false);
    expect(isCaptainTrialSceneId('grey-bridge-escort')).toBe(false);
  });

  it('saves all six encounters through natural induction and starts the first official mission with unchanged combat stats', async () => {
    const fresh = createNewCampaignProfile();
    let profile = fresh;
    for (const scene of originStoryScenes) {
      if (scene.id === 'hadori-wall') {
        profile = startCaptainTrial(profile, scene.id);
        profile = await reload(step(profile, 'challenge'));
        profile = completeCaptainTrial(profile, scene.id, 1);
      }
      profile = chooseOriginStoryPath(profile, scene.id, scene.choices[0]!.id);
      if (scene.id === 'river-incident') {
        profile = startVillageRescue(profile);
        for (let index = 0; index < 3; index += 1) profile = applyVillageRescueAction(profile, { type: 'move', dx: 1, dy: 0 });
        for (let index = 0; index < 3; index += 1) profile = applyVillageRescueAction(profile, { type: 'assist' });
        for (let index = 0; index < 3; index += 1) profile = applyVillageRescueAction(profile, { type: 'move', dx: -1, dy: 0 });
        profile = completeVillageRescueReturn({ ...profile, world: { ...profile.world, village: {
          ...profile.world.village, playerX: villageRescueReturnPoint.x, playerY: villageRescueReturnPoint.y,
        } } });
      }
      if (scene.id === 'field-exam') {
        profile = startFieldExam(profile);
        profile = applyFieldExamPlan(profile, 1, 0, { raon: 'left', leo: 'right' });
        profile = applyFieldExamPlan(profile, 1, 1, { raon: 'brace', leo: 'left' });
        profile = applyFieldExamPlan(profile, 1, 2, { raon: 'left', leo: 'right' });
        profile = applyFieldExamPlan(profile, 1, 3, { raon: 'brace', leo: 'right' });
        profile = completeFieldExamReturn(profile, 1);
      }
      if (scene.id === 'sixteen-petals') {
        profile = startPetalTraining(profile);
        for (const action of ['trace', 'trace', 'trace', 'breathe', 'trace', 'trace', 'balance'] as const) {
          profile = applyPetalTrainingAction(profile, 1, profile.originStory.petalTraining!.turn, action);
        }
        profile = completePetalTraining(profile, 1);
      }
      if (scene.id === 'captain-trials' || scene.id === 'kazrin-duel') {
        profile = startCaptainTrial(profile, scene.id);
        for (const action of routes[scene.choices[0]!.id as CaptainTrialChoiceId]) profile = await reload(step(profile, action));
        profile = completeCaptainTrial(profile, scene.id, 1);
      }
      profile = await reload(advanceOriginStory(profile));
    }
    expect(profile.originStory.completed).toBe(true);
    expect(profile.originStory.completedSceneIds).toHaveLength(15);
    expect(profile.originStory.flags).toHaveLength(15);
    expect(profile.originStory.selectionScore).toBe(originStoryScenes.reduce((total, scene) => total + scene.choices[0]!.score, 0));
    expect(profile.originStory.villageRescue?.phase).toBe('complete');
    expect(profile.originStory.fieldExam?.phase).toBe('complete');
    expect(profile.originStory.petalTraining?.phase).toBe('complete');
    expect(Object.values(profile.originStory.captainTrials!).map((trial) => trial.phase)).toEqual(['complete', 'complete', 'complete']);
    expect(profile.heroProgress).toEqual(fresh.heroProgress);
    expect(buildProgressedHeroes(profile)).toEqual(buildProgressedHeroes(fresh));
    const mission = missions[0]!;
    expect(canLaunchMission(profile, mission.id)).toBe(false);
    profile = chooseRaonStoryPath(profile, mission.id, 'insight');
    expect(canLaunchMission(profile, mission.id)).toBe(true);
    const deployed = beginCampaignBattle(profile, mission.id, 'shelter', 'standard', 'origin-first-mission');
    expect(deployed.battleAttempt?.missionId).toBe(mission.id);
    expect(await reload(deployed)).toEqual(deployed);
    expect(deployed.battleAttempt?.heroes).toEqual(buildProgressedHeroes(profile));
    const legacy = { ...fresh, originStory: { ...fresh.originStory, completed: true }, storyChoices: { [mission.id]: 'insight' as const } };
    expect(canLaunchMission(await reload(legacy), mission.id)).toBe(true);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getOriginStoryScene, originStoryScenes } from '../data/originStory';
import type { CampaignProfile, PetalTrainingAction, PetalTrainingChoiceId, PetalTrainingState } from '../types';
import { applyFieldExamPlan, completeFieldExamReturn, startFieldExam } from './fieldExamProgression';
import { canLaunchMission } from './missionAccess';
import { isCampaignProfileCandidate } from './persistence';
import { canApplyPetalTrainingAction, createPetalTraining, isPetalTrainingChoiceId, isPetalTrainingState, petalTrainingRules, resolvePetalTrainingAction } from './petalTraining';
import { applyPetalTrainingAction, completePetalTraining, getPetalTraining, migratePetalTraining, retryPetalTraining, startPetalTraining } from './petalTrainingProgression';
import { advanceOriginStory, buildProgressedHeroes, campaignStorageKey, chooseOriginStoryPath, createNewCampaignProfile, loadCampaignProfile, saveCampaignProfile } from './progression';
import { villageRescueReturnPoint } from './villageRescue';
import { applyVillageRescueAction, completeVillageRescueReturn, startVillageRescue } from './villageRescueProgression';

const scene = getOriginStoryScene('sixteen-petals');
const routes: Record<PetalTrainingChoiceId, PetalTrainingAction[]> = {
  'remember-voices': ['trace', 'trace', 'trace', 'breathe', 'trace', 'trace', 'balance'],
  'distribute-weight': ['balance', 'balance', 'balance', 'balance', 'balance', 'balance'],
  'step-beyond-fall': ['trace', 'trace', 'breathe', 'trace', 'balance'],
};
const choices = Object.keys(routes) as PetalTrainingChoiceId[];
const actions: PetalTrainingAction[] = ['trace', 'balance', 'breathe'];

function trainingProfile(choiceId: PetalTrainingChoiceId = 'remember-voices') {
  const fresh = createNewCampaignProfile();
  fresh.originStory.currentSceneId = scene.id;
  return chooseOriginStoryPath(fresh, scene.id, choiceId);
}

function step(profile: CampaignProfile, action: PetalTrainingAction) {
  const training = getPetalTraining(profile)!;
  return applyPetalTrainingAction(profile, training.attempt, training.turn, action);
}

function playTraining(choiceId: PetalTrainingChoiceId = 'remember-voices') {
  return routes[choiceId].reduce(step, startPetalTraining(trainingProfile(choiceId)));
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
  if (result.status !== 'ready') throw new Error('Expected saved petal training');
  return result.profile;
}

describe('petal training rules', () => {
  it.each(choices)('completes %s with every action preserved through JSON and campaign save/load', async (choiceId) => {
    let profile = await reload(trainingProfile(choiceId));
    expect(getPetalTraining(profile)).toMatchObject({ phase: 'ready', attempt: 0, turn: 0, petals: 0, burden: 0 });
    profile = await reload(startPetalTraining(profile));
    for (const action of routes[choiceId]) {
      const previous = profile;
      const preview = resolvePetalTrainingAction(getPetalTraining(profile)!, action);
      profile = step(profile, action);
      expect(profile).not.toBe(previous);
      expect(getPetalTraining(profile)).toEqual(preview);
      expect(JSON.parse(JSON.stringify(preview))).toEqual(preview);
      const saved = profile;
      profile = await reload(profile);
      expect(profile).toEqual(saved);
      expect(isPetalTrainingState(getPetalTraining(profile))).toBe(true);
    }
    expect(getPetalTraining(profile)).toMatchObject({ phase: 'review', attempt: 1, petals: 16 });
    expect(getPetalTraining(profile)!.burden).toBeLessThan(petalTrainingRules.maxBurden);
  });

  it('applies each chosen approach without changing the other actions', () => {
    const initial = createPetalTraining('remember-voices', 1);
    expect(resolvePetalTrainingAction(initial, 'trace')).toMatchObject({ petals: 3, burden: 2, turn: 1 });
    expect(resolvePetalTrainingAction(initial, 'balance')).toMatchObject({ petals: 2, burden: 1, turn: 1 });
    const insight = createPetalTraining('distribute-weight', 1);
    expect(resolvePetalTrainingAction(insight, 'balance')).toMatchObject({ petals: 3, burden: 1, turn: 1 });
    expect(resolvePetalTrainingAction(insight, 'trace')).toMatchObject({ petals: 3, burden: 2, turn: 1 });
    const resolve = createPetalTraining('step-beyond-fall', 1);
    expect(resolvePetalTrainingAction(resolve, 'trace')).toMatchObject({ petals: 5, burden: 3, turn: 1 });
    expect(resolvePetalTrainingAction(resolve, 'balance')).toMatchObject({ petals: 2, burden: 1, turn: 1 });
    for (const choiceId of choices) {
      const burdened = { ...createPetalTraining(choiceId, 1), turn: 2, petals: 6, burden: 5 };
      expect(resolvePetalTrainingAction(burdened, 'breathe')).toMatchObject({ petals: 6, turn: 3, burden: choiceId === 'remember-voices' ? 1 : 2 });
      expect(resolvePetalTrainingAction({ ...burdened, burden: 1 }, 'breathe')).toMatchObject({ petals: 6, burden: 0, turn: 3 });
    }
  });

  it('rejects breathing without burden, unknown actions, and inactive states without mutation or turn cost', () => {
    const active = createPetalTraining('remember-voices', 1);
    const before = structuredClone(active);
    for (const action of ['breathe', 'attack', undefined, null, {}]) {
      expect(canApplyPetalTrainingAction(active, action as PetalTrainingAction)).toBe(false);
      expect(resolvePetalTrainingAction(active, action as PetalTrainingAction)).toBe(active);
    }
    expect(active).toEqual(before);
    const ready = createPetalTraining('remember-voices');
    expect(resolvePetalTrainingAction(ready, 'trace')).toBe(ready);
    const review = getPetalTraining(playTraining())!;
    expect(resolvePetalTrainingAction(review, 'breathe')).toBe(review);
  });

  it('fails at the burden limit even when the same action completes sixteen petals', async () => {
    const profile = ['trace', 'trace', 'balance', 'balance', 'balance', 'balance'].reduce(
      (current, action) => step(current, action as PetalTrainingAction), startPetalTraining(trainingProfile('distribute-weight')),
    );
    expect(getPetalTraining(profile)).toMatchObject({ phase: 'failed', petals: 16, burden: 8, turn: 6 });
    expect(await reload(profile)).toEqual(profile);
    expect(completePetalTraining(profile, 1)).toBe(profile);
    expect(advanceOriginStory(profile)).toBe(profile);
    expect(step(profile, 'breathe')).toBe(profile);
  });

  it('caps excess burden at eight and permits only an explicit new attempt after failure', async () => {
    let profile = startPetalTraining(trainingProfile('step-beyond-fall'));
    for (let index = 0; index < 3; index += 1) profile = step(profile, 'trace');
    expect(getPetalTraining(profile)).toMatchObject({ phase: 'failed', burden: 8, petals: 15, turn: 3 });
    profile = await reload(profile);
    expect(startPetalTraining(profile)).toBe(profile);
    expect(step(profile, 'balance')).toBe(profile);
    const retried = await reload(retryPetalTraining(profile));
    expect(getPetalTraining(retried)).toMatchObject({ phase: 'active', attempt: 2, turn: 0, petals: 0, burden: 0 });
    expect(retryPetalTraining(retried)).toBe(retried);
    expect(retried.raonPath).toEqual(profile.raonPath);
    expect(retried.originStory.selectionScore).toBe(profile.originStory.selectionScore);
    expect(retried.world.npcMemories).toEqual(profile.world.npcMemories);
    const reviewed = routes['step-beyond-fall'].reduce(step, retried);
    expect(completePetalTraining(reviewed, 1)).toBe(reviewed);
    expect(completePetalTraining(reviewed, 2).originStory.petalTraining?.phase).toBe('complete');
  });

  it('fails after ten unfinished actions without elapsed-time progression', async () => {
    let profile = startPetalTraining(trainingProfile());
    for (let turn = 0; turn < petalTrainingRules.turnLimit; turn += 1) profile = step(profile, turn % 2 === 0 ? 'balance' : 'breathe');
    expect(getPetalTraining(profile)).toMatchObject({ phase: 'failed', turn: 10, petals: 10, burden: 0 });
    expect(await reload(profile)).toEqual(profile);
  });

  it('allows reaching sixteen petals on the final tenth action', () => {
    const finalRoute: PetalTrainingAction[] = ['balance', 'breathe', 'balance', 'breathe', 'trace', 'breathe', 'trace', 'trace', 'balance', 'balance'];
    const profile = finalRoute.reduce(step, startPetalTraining(trainingProfile()));
    expect(getPetalTraining(profile)).toMatchObject({ phase: 'review', turn: 10, petals: 16, burden: 6 });
    expect(completePetalTraining(profile, 1).originStory.petalTraining?.phase).toBe('complete');
  });

  it('accepts every reachable action output as a JSON save candidate and finds both failure and completion for each choice', () => {
    for (const choiceId of choices) {
      const profile = trainingProfile(choiceId);
      const visited = new Set<string>();
      const pending: PetalTrainingState[] = [createPetalTraining(choiceId, 1)];
      const phases = new Set<string>();
      while (pending.length) {
        const state = pending.pop()!;
        const key = [state.phase, state.turn, state.petals, state.burden].join(':');
        if (visited.has(key)) continue;
        visited.add(key);
        phases.add(state.phase);
        const candidate = { ...profile, originStory: { ...profile.originStory, petalTraining: state } };
        expect(isPetalTrainingState(state), `${choiceId}:${key}`).toBe(true);
        expect(isCampaignProfileCandidate(JSON.parse(JSON.stringify(candidate))), `${choiceId}:${key}`).toBe(true);
        if (state.phase === 'active') {
          for (const action of actions) {
            const next = resolvePetalTrainingAction(state, action);
            if (next !== state) pending.push(next);
          }
        } else if (state.phase === 'review') {
          const confirmed = completePetalTraining(candidate, 1);
          expect(confirmed.originStory.petalTraining?.phase).toBe('complete');
          expect(isCampaignProfileCandidate(JSON.parse(JSON.stringify(confirmed)))).toBe(true);
        }
      }
      expect([...phases].sort()).toEqual(['active', 'failed', 'review']);
    }
  });
});

describe('petal training progression and save boundaries', () => {
  it.each(choices)('records %s intent once and confirms its outcome only when training is reviewed with Maru', async (choiceId) => {
    const choice = scene.choices.find((entry) => entry.id === choiceId)!;
    const chosen = trainingProfile(choiceId);
    const original = createNewCampaignProfile();
    expect(chosen.raonPath[choice.path]).toBe(1);
    expect(chosen.originStory.selectionScore).toBe(choice.score);
    expect(chosen.world.npcMemories.maru?.affinity).toBe(2);
    expect(chosen.bondLevels).toEqual(original.bondLevels);
    expect(chosen.originStory.flags).not.toContain(choice.flag);
    expect(chosen.world.npcMemories.maru?.rememberedFacts).not.toContain(choice.result);
    expect(chooseOriginStoryPath(chosen, scene.id, choiceId)).toBe(chosen);
    expect(chooseOriginStoryPath(chosen, scene.id, choices.find((entry) => entry !== choiceId)!)).toBe(chosen);
    expect(advanceOriginStory(chosen)).toBe(chosen);
    const active = startPetalTraining(chosen);
    expect(startPetalTraining(active)).toBe(active);
    expect(advanceOriginStory(active)).toBe(active);
    expect(completePetalTraining(active, 1)).toBe(active);
    const reviewed = playTraining(choiceId);
    expect(reviewed.originStory.flags).not.toContain(choice.flag);
    expect(reviewed.world.npcMemories.maru?.rememberedFacts).not.toContain(choice.result);
    expect(advanceOriginStory(reviewed)).toBe(reviewed);
    expect(completePetalTraining(reviewed, 2)).toBe(reviewed);
    const confirmed = completePetalTraining(reviewed, 1);
    expect(confirmed.originStory.flags.filter((flag) => flag === choice.flag)).toHaveLength(1);
    expect(confirmed.world.npcMemories.maru?.rememberedFacts.filter((fact) => fact === choice.result)).toHaveLength(1);
    expect(confirmed.world.npcMemories.maru?.affinity).toBe(2);
    expect(confirmed.raonPath).toEqual(chosen.raonPath);
    expect(confirmed.bondLevels).toEqual(chosen.bondLevels);
    expect(confirmed.originStory.selectionScore).toBe(chosen.originStory.selectionScore);
    expect(confirmed.heroProgress).toEqual(original.heroProgress);
    expect(buildProgressedHeroes(confirmed)).toEqual(buildProgressedHeroes(original));
    expect([confirmed.day, confirmed.supplies, confirmed.intel, confirmed.relics, confirmed.renown])
      .toEqual([original.day, original.supplies, original.intel, original.relics, original.renown]);
    expect(completePetalTraining(confirmed, 1)).toBe(confirmed);
    expect(retryPetalTraining(confirmed)).toBe(confirmed);
    const advanced = advanceOriginStory(await reload(confirmed));
    expect(advanced.originStory.currentSceneId).toBe('captain-trials');
    expect(await reload(advanced)).toEqual(advanced);
    expect(getPetalTraining(advanced)).toBeUndefined();
    expect(startPetalTraining(advanced)).toBe(advanced);
  });

  it('ignores duplicate action callbacks and callbacks belonging to an earlier attempt', () => {
    const initial = startPetalTraining(trainingProfile('step-beyond-fall'));
    const first = applyPetalTrainingAction(initial, 1, 0, 'trace');
    expect(applyPetalTrainingAction(first, 1, 0, 'trace')).toBe(first);
    expect(applyPetalTrainingAction(first, 2, 1, 'trace')).toBe(first);
    const failed = step(step(first, 'trace'), 'trace');
    const retried = retryPetalTraining(failed);
    expect(applyPetalTrainingAction(retried, 1, 0, 'trace')).toBe(retried);
    expect(applyPetalTrainingAction(retried, 1, 2, 'trace')).toBe(retried);
    expect(applyPetalTrainingAction(retried, 2, 0, 'trace')).not.toBe(retried);
  });

  it.each(choices)('migrates a pending v10 %s choice while preserving its existing score and Maru affinity', async (choiceId) => {
    const legacy = trainingProfile(choiceId);
    delete legacy.originStory.petalTraining;
    const choice = scene.choices.find((entry) => entry.id === choiceId)!;
    legacy.originStory.flags.push(choice.flag, 'earlier-choice');
    legacy.world.npcMemories.maru!.rememberedFacts = [choice.result, '이전 마루의 기억'];
    local.set(`${campaignStorageKey}-slot-1`, JSON.stringify(legacy));
    const loaded = await loadCampaignProfile(1);
    if (loaded.status !== 'ready') throw new Error('Expected migrated legacy training');
    const pending = loaded.profile;
    expect(getPetalTraining(pending)?.phase).toBe('ready');
    expect(pending.originStory.flags).toEqual(['earlier-choice']);
    expect(pending.world.npcMemories.maru?.rememberedFacts).toEqual(['이전 마루의 기억']);
    expect(pending.raonPath).toEqual(legacy.raonPath);
    expect(pending.bondLevels).toEqual(legacy.bondLevels);
    expect(pending.originStory.selectionScore).toBe(legacy.originStory.selectionScore);
    expect(migratePetalTraining(pending)).toBe(pending);
    const reviewed = routes[choiceId].reduce(step, startPetalTraining(await reload(pending)));
    const confirmed = completePetalTraining(reviewed, 1);
    expect(confirmed.originStory.flags).toEqual(['earlier-choice', choice.flag]);
    expect(confirmed.world.npcMemories.maru?.rememberedFacts.filter((fact) => fact === choice.result)).toHaveLength(1);
    expect(confirmed.world.npcMemories.maru?.affinity).toBe(legacy.world.npcMemories.maru?.affinity);
    expect(confirmed.raonPath).toEqual(legacy.raonPath);
    expect(confirmed.bondLevels).toEqual(legacy.bondLevels);
    expect(confirmed.originStory.selectionScore).toBe(legacy.originStory.selectionScore);
  });

  it('offers virtual ready for a pending choice-only profile and defers its outcome before direct start', () => {
    const legacy = trainingProfile();
    delete legacy.originStory.petalTraining;
    const choice = scene.choices[0]!;
    legacy.originStory.flags.push(choice.flag);
    legacy.world.npcMemories.maru!.rememberedFacts.push(choice.result);
    expect(getPetalTraining(legacy)).toMatchObject({ phase: 'ready', attempt: 0 });
    expect(advanceOriginStory(legacy)).toBe(legacy);
    const active = startPetalTraining(legacy);
    expect(active.originStory.petalTraining?.phase).toBe('active');
    expect(active.originStory.flags).not.toContain(choice.flag);
    expect(active.world.npcMemories.maru?.rememberedFacts).not.toContain(choice.result);
    expect(active.world.npcMemories.maru?.affinity).toBe(legacy.world.npcMemories.maru?.affinity);
  });

  it.each(['later-scene', 'training-recorded', 'graduated'])('preserves an older %s save without replaying training', async (stage) => {
    const legacy = trainingProfile();
    delete legacy.originStory.petalTraining;
    legacy.originStory.flags.push(scene.choices[0]!.flag);
    legacy.world.npcMemories.maru!.rememberedFacts.push(scene.choices[0]!.result);
    if (stage === 'later-scene') legacy.originStory.currentSceneId = 'captain-trials';
    if (stage === 'training-recorded') legacy.originStory.completedSceneIds.push(scene.id);
    if (stage === 'graduated') legacy.originStory.completed = true;
    const loaded = await reload(legacy);
    expect(loaded).toEqual(legacy);
    expect(getPetalTraining(loaded)).toBeUndefined();
    expect(startPetalTraining(loaded)).toBe(loaded);
    expect(migratePetalTraining(loaded)).toBe(loaded);
    if (stage === 'training-recorded') expect(advanceOriginStory(loaded).originStory.currentSceneId).toBe('captain-trials');
  });

  it('keeps an old graduated save without training history eligible for its chosen first operation', async () => {
    const legacy = createNewCampaignProfile();
    legacy.originStory.completed = true;
    legacy.storyChoices['grey-bridge-escort'] = 'resolve';
    expect(canLaunchMission(await reload(legacy), 'grey-bridge-escort')).toBe(true);
    expect(legacy.originStory.petalTraining).toBeUndefined();
  });

  it('rejects malformed training state and contradictory choice or current scene before saving', async () => {
    const profile = startPetalTraining(trainingProfile());
    const training = getPetalTraining(profile)!;
    for (const broken of [null, {}, { ...training, choiceId: 'unknown' }, { ...training, burden: NaN }, { ...training, burden: 9 },
      { ...training, burden: -1 }, { ...training, petals: 17 }, { ...training, petals: 0.5 }, { ...training, petals: 3 },
      { ...training, attempt: 0 }, { ...training, attempt: Infinity }, { ...training, turn: 11 }, { ...training, turn: 1.5 },
      { ...training, phase: 'review' }, { ...training, phase: 'complete' }, { ...training, phase: 'failed' },
      { ...training, phase: 'ready', turn: 1 }, { ...training, log: [1] }, { ...training, log: Array(17).fill('x') }]) {
      expect(isPetalTrainingState(broken)).toBe(false);
      expect(isCampaignProfileCandidate({ ...profile, originStory: { ...profile.originStory, petalTraining: broken } })).toBe(false);
    }
    for (const changed of [
      { choices: { [scene.id]: 'distribute-weight' } }, { choices: { [scene.id]: 'unknown' } },
      { currentSceneId: 'captain-trials' }, { currentSceneId: 'unknown' }, { completed: true }, { completedSceneIds: [scene.id] },
    ]) {
      const candidate = { ...profile, originStory: { ...profile.originStory, ...changed } };
      expect(isCampaignProfileCandidate(candidate)).toBe(false);
      expect(await saveCampaignProfile(candidate, 1)).toBe(false);
    }
    expect(local.size).toBe(0);
  });

  it('preserves all three encounters together through natural origin progression and checks every optional state', async () => {
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
      if (originScene.id === 'field-exam') {
        profile = startFieldExam(profile);
        profile = applyFieldExamPlan(profile, 1, 0, { raon: 'left', leo: 'right' });
        profile = applyFieldExamPlan(profile, 1, 1, { raon: 'brace', leo: 'left' });
        profile = applyFieldExamPlan(profile, 1, 2, { raon: 'left', leo: 'right' });
        profile = applyFieldExamPlan(profile, 1, 3, { raon: 'brace', leo: 'right' });
        profile = completeFieldExamReturn(profile, 1);
      }
      profile = advanceOriginStory(profile);
    }
    expect(profile.originStory.currentSceneId).toBe(scene.id);
    expect(profile.originStory.villageRescue?.phase).toBe('complete');
    expect(profile.originStory.fieldExam?.phase).toBe('complete');
    profile = await reload(startPetalTraining(chooseOriginStoryPath(profile, scene.id, 'remember-voices')));
    const previousMaruAffinity = profile.world.npcMemories.maru?.affinity;
    for (const action of routes['remember-voices']) profile = await reload(step(profile, action));
    profile = completePetalTraining(profile, 1);
    expect(profile.originStory.petalTraining?.phase).toBe('complete');
    expect(profile.world.npcMemories.maru?.affinity).toBe(previousMaruAffinity);
    expect(await reload(profile)).toEqual(profile);
    for (const field of ['villageRescue', 'fieldExam', 'petalTraining']) {
      expect(isCampaignProfileCandidate({ ...profile, originStory: { ...profile.originStory, [field]: {} } })).toBe(false);
    }
    profile = advanceOriginStory(profile);
    expect(await reload(profile)).toEqual(profile);
    expect(profile.originStory.currentSceneId).toBe('captain-trials');
  });

  it('rejects unknown choices and scene IDs and cannot start outside the current uncompleted scene', () => {
    const fresh = createNewCampaignProfile();
    expect(getPetalTraining(fresh)).toBeUndefined();
    expect(startPetalTraining(fresh)).toBe(fresh);
    expect(applyPetalTrainingAction(fresh, 1, 0, 'trace')).toBe(fresh);
    expect(retryPetalTraining(fresh)).toBe(fresh);
    expect(completePetalTraining(fresh, 1)).toBe(fresh);
    expect(chooseOriginStoryPath(fresh, scene.id, 'remember-voices')).toBe(fresh);
    const firstScene = getOriginStoryScene(fresh.originStory.currentSceneId);
    expect(chooseOriginStoryPath(fresh, 'unknown-scene', firstScene.choices[0]!.id)).toBe(fresh);
    const unchosen = { ...fresh, originStory: { ...fresh.originStory, currentSceneId: scene.id } };
    expect(chooseOriginStoryPath(unchosen, scene.id, 'unknown-choice')).toBe(unchosen);
    expect(getPetalTraining(unchosen)).toBeUndefined();
    expect(startPetalTraining(unchosen)).toBe(unchosen);
    expect(advanceOriginStory(unchosen)).toBe(unchosen);
    expect(isPetalTrainingChoiceId('unknown-choice')).toBe(false);
  });
});

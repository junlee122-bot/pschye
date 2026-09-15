import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { heroDefinitions } from '../data/battle';
import { missions } from '../data/campaign';
import { originStoryScenes } from '../data/originStory';
import type { BattleState, CampaignProfile, CaptainTrialAction, FieldExamPlan, PetalTrainingAction, RaonStoryChoiceId, VillageRescueAction } from '../types';
import { getBattleRecommendation } from './battleDecision';
import { applyHeroSkill, endPlayerTurn, triggerTeamFinisher } from './battleEngine';
import { abandonCampaignBattle, beginCampaignBattle, restartCampaignBattle, saveCampaignBattleCheckpoint, settleCampaignBattle } from './campaignBattle';
import { applyCaptainTrialAction, completeCaptainTrial, getCaptainTrial, migrateCaptainTrials, startCaptainTrial } from './captainTrialProgression';
import { applyFieldExamPlan, completeFieldExamReturn, getFieldExam, startFieldExam } from './fieldExamProgression';
import { canLaunchMission } from './missionAccess';
import { applyPetalTrainingAction, completePetalTraining, getPetalTraining, startPetalTraining } from './petalTrainingProgression';
import { advanceOriginStory, buildProgressedHeroes, chooseOriginStoryPath, chooseRaonStoryPath, createNewCampaignProfile, getBondKey, loadCampaignProfile, saveCampaignProfile, toggleSquadMember, unlockHeroNode } from './progression';
import { executeGameCommand } from './simulation';
import { villageRescueReturnPoint } from './villageRescue';
import { applyVillageRescueAction, completeVillageRescueReturn, startVillageRescue } from './villageRescueProgression';

// These are deterministic input scripts, not a browser playtest or a balance survey.
// No fixture directly assigns completion flags, encounter phases or battle outcomes.
const mission = missions[0]!;
const stances: RaonStoryChoiceId[] = ['compassion', 'insight', 'resolve'];
const right: VillageRescueAction = { type: 'move', dx: 1, dy: 0 };
const left: VillageRescueAction = { type: 'move', dx: -1, dy: 0 };
const assist: VillageRescueAction = { type: 'assist' };
const rescueRoutes: Record<RaonStoryChoiceId, VillageRescueAction[]> = {
  compassion: [right, right, right, assist, assist, assist, left, left, left],
  insight: [right, assist, right, assist, right, assist, left, left, left],
  resolve: [right, right, assist, assist, assist, left, left],
};
const both: FieldExamPlan = { raon: 'left', leo: 'right' };
const fieldRoutes: Record<RaonStoryChoiceId, FieldExamPlan[]> = {
  compassion: [both, { raon: 'brace', leo: 'left' }, both, { raon: 'brace', leo: 'right' }],
  insight: [both, both, both],
  resolve: [{ raon: 'brace', leo: 'left' }, both, { raon: 'brace', leo: 'right' }, both],
};
const petalRoutes: Record<RaonStoryChoiceId, PetalTrainingAction[]> = {
  compassion: ['trace', 'trace', 'trace', 'breathe', 'trace', 'trace', 'balance'],
  insight: ['balance', 'balance', 'balance', 'balance', 'balance', 'balance'],
  resolve: ['trace', 'trace', 'breathe', 'trace', 'balance'],
};
const kainRoutes: Record<RaonStoryChoiceId, CaptainTrialAction[]> = {
  compassion: ['parry', 'counter', 'sidestep', 'counter', 'recover', 'recover', 'sidestep', 'counter'],
  insight: ['parry', 'counter', 'sidestep', 'counter', 'parry', 'counter'],
  resolve: ['parry', 'counter', 'sidestep', 'counter'],
};
const kazrinRoutes: Record<RaonStoryChoiceId, CaptainTrialAction[]> = {
  compassion: ['sidestep', 'parry', 'counter', 'sidestep', 'recover', 'recover', 'sidestep', 'parry', 'counter', 'sidestep', 'recover', 'recover', 'sidestep', 'parry', 'counter'],
  insight: ['sidestep', 'parry', 'counter', 'sidestep', 'parry', 'counter', 'sidestep', 'parry', 'counter'],
  resolve: ['sidestep', 'parry', 'counter', 'sidestep', 'recover', 'recover', 'sidestep', 'parry', 'counter'],
};

let failWrites: boolean;
beforeEach(() => {
  const local = new Map<string, string>();
  failWrites = false;
  // IndexedDB is unavailable here; persistence's separate tests exercise its backup paths.
  vi.stubGlobal('window', { localStorage: {
    getItem: (key: string) => local.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (failWrites) throw new Error('Storage unavailable');
      local.set(key, value);
    },
  } });
});
afterEach(() => vi.unstubAllGlobals());

async function read(slot = 1) {
  const result = await loadCampaignProfile(slot);
  expect(result.status).toBe('ready');
  if (result.status !== 'ready') throw new Error('Expected a recoverable journey');
  return result.profile;
}

async function reload(profile: CampaignProfile, slot = 1) {
  expect(await saveCampaignProfile(profile, slot)).toBe(true);
  const restored = await read(slot);
  // Entering Hadori's scene materializes its virtual ready state on load.
  expect(restored).toEqual(migrateCaptainTrials(profile));
  return restored;
}

function resources(profile: CampaignProfile) {
  return { day: profile.day, supplies: profile.supplies, intel: profile.intel, relics: profile.relics, renown: profile.renown };
}

async function graduate(stance: RaonStoryChoiceId) {
  const fresh = createNewCampaignProfile();
  let profile = fresh;
  const expectedAffinities: Record<string, number> = {};
  const expectedBonds = { ...fresh.bondLevels };
  let expectedScore = 0;
  for (const scene of originStoryScenes) {
    expect(profile.originStory.currentSceneId).toBe(scene.id);
    expect(canLaunchMission(profile, mission.id)).toBe(false);
    if (scene.id === 'hadori-wall') {
      profile = await reload(startCaptainTrial(profile, scene.id));
      profile = await reload(applyCaptainTrialAction(profile, scene.id, 1, 0, 'challenge'));
      profile = await reload(completeCaptainTrial(profile, scene.id, 1));
    }
    const choice = scene.choices.find((entry) => entry.path === stance)!;
    profile = await reload(chooseOriginStoryPath(profile, scene.id, choice.id));
    expectedScore += choice.score;
    const companion = scene.speakerId !== 'raon' && heroDefinitions.some((hero) => hero.id === scene.speakerId);
    expectedAffinities[scene.speakerId] = (expectedAffinities[scene.speakerId] ?? 0) + (companion ? 4 : 2);
    if (companion) {
      const key = getBondKey('raon', scene.speakerId);
      expectedBonds[key] = (expectedBonds[key] ?? 0) + 4;
    }
    if (scene.id === 'river-incident') {
      profile = await reload(startVillageRescue(profile));
      for (const action of rescueRoutes[stance]) profile = await reload(applyVillageRescueAction(profile, action));
      expect(profile.originStory.villageRescue?.phase).toBe('return');
      profile = { ...profile, world: executeGameCommand(profile.world, { type: 'move', ...villageRescueReturnPoint }).state };
      profile = await reload(completeVillageRescueReturn(profile));
    } else if (scene.id === 'field-exam') {
      profile = await reload(startFieldExam(profile));
      for (const plan of fieldRoutes[stance]) {
        const state = getFieldExam(profile)!;
        profile = await reload(applyFieldExamPlan(profile, state.attempt, state.turn, plan));
      }
      profile = await reload(completeFieldExamReturn(profile, getFieldExam(profile)!.attempt));
    } else if (scene.id === 'sixteen-petals') {
      profile = await reload(startPetalTraining(profile));
      for (const action of petalRoutes[stance]) {
        const state = getPetalTraining(profile)!;
        profile = await reload(applyPetalTrainingAction(profile, state.attempt, state.turn, action));
      }
      profile = await reload(completePetalTraining(profile, getPetalTraining(profile)!.attempt));
    } else if (scene.id === 'captain-trials' || scene.id === 'kazrin-duel') {
      profile = await reload(startCaptainTrial(profile, scene.id));
      for (const action of (scene.id === 'captain-trials' ? kainRoutes : kazrinRoutes)[stance]) {
        const state = getCaptainTrial(profile)!;
        profile = await reload(applyCaptainTrialAction(profile, scene.id, state.attempt, state.turn, action));
      }
      profile = await reload(completeCaptainTrial(profile, scene.id, getCaptainTrial(profile)!.attempt));
    }
    expect(profile.originStory.flags).toContain(choice.flag);
    expect(profile.world.npcMemories[scene.speakerId]?.rememberedFacts).toContain(choice.result);
    profile = await reload(advanceOriginStory(profile));
  }
  expect(profile.originStory.completed).toBe(true);
  expect(profile.originStory.completedSceneIds).toEqual(originStoryScenes.map((scene) => scene.id));
  expect(profile.originStory.flags).toHaveLength(originStoryScenes.length);
  expect(profile.originStory.selectionScore).toBe(expectedScore);
  expect(profile.raonPath).toEqual({ compassion: 0, insight: 0, resolve: 0, [stance]: originStoryScenes.length });
  for (const [npcId, affinity] of Object.entries(expectedAffinities)) expect(profile.world.npcMemories[npcId]?.affinity).toBe(affinity);
  expect(profile.bondLevels).toEqual(expectedBonds);
  expect(profile.heroProgress).toEqual(fresh.heroProgress);
  expect(buildProgressedHeroes(profile)).toEqual(buildProgressedHeroes(fresh));
  expect(resources(profile)).toEqual(resources(fresh));
  expect([
    profile.originStory.villageRescue?.phase, profile.originStory.fieldExam?.phase, profile.originStory.petalTraining?.phase,
    ...(['captain-trials', 'kazrin-duel', 'hadori-wall'] as const).map((id) => profile.originStory.captainTrials?.[id]?.phase),
  ]).toEqual(Array<string>(6).fill('complete'));
  // Induction itself does not silently choose the first formal mission's answer.
  expect(canLaunchMission(profile, mission.id)).toBe(false);
  return profile;
}

function deploy(profile: CampaignProfile, id: string) {
  const begun = beginCampaignBattle(profile, mission.id, 'counterfire', 'standard', id);
  expect(begun.battleAttempt?.id).toBe(id);
  return saveCampaignBattleCheckpoint(begun, id, {
    mode: 'tactical', tactical: { history: [], selectedHeroId: 'raon', selectedSkillId: 'sixteen-petals' },
  });
}

function checkpoint(profile: CampaignProfile, battle: BattleState) {
  const next = saveCampaignBattleCheckpoint(profile, profile.battleAttempt!.id, { battle });
  expect(next).not.toBe(profile);
  expect(next.battleAttempt!.battle).toEqual(battle);
  return next;
}

async function win(profile: CampaignProfile, slot = 1) {
  let current = await reload(profile, slot);
  // Witness the canonical first-mission revelation through legal skills before winning.
  for (const [heroId, skillId] of [['chris', 'side-read'], ['raon', 'sixteen-petals']]) {
    const attempt = current.battleAttempt!;
    current = await reload(checkpoint(current, applyHeroSkill(attempt.battle, mission, attempt.heroes, heroId, skillId, mission.revelation!.enemyId)), slot);
  }
  expect(current.battleAttempt!.battle.revelationTriggered).toBe(true);
  for (let step = 0; current.battleAttempt!.battle.outcome === 'active' && step < 100; step += 1) {
    const attempt = current.battleAttempt!;
    let battle = attempt.battle;
    if (battle.morale >= 100 && !battle.finisherUsed) battle = triggerTeamFinisher(battle, mission);
    else {
      const action = battle.commandPoints > 0 ? getBattleRecommendation(battle, mission, attempt.heroes) : undefined;
      battle = action
        ? applyHeroSkill(battle, mission, attempt.heroes, action.heroId, action.skillId, action.targetId)
        : endPlayerTurn(battle, mission, attempt.heroes);
    }
    current = await reload(checkpoint(current, battle), slot);
  }
  expect(current.battleAttempt!.battle.outcome).toBe('victory');
  expect(current.battleAttempt!.settled).toBe(false);
  return current;
}

describe('fresh origin to saved formal battle journey', () => {
  it.each(stances)('carries %s through six encounters, equal four/six-person growth, real victory and a new deployment', async (stance) => {
    const graduated = await graduate(stance);
    let prepared = chooseRaonStoryPath(graduated, mission.id, stance);
    expect(canLaunchMission(prepared, mission.id)).toBe(true);
    const baseHeroes = buildProgressedHeroes(prepared);
    for (const hero of heroDefinitions) prepared = unlockHeroNode(prepared, hero.id, 'fieldcraft');
    const grownHeroes = buildProgressedHeroes(prepared);
    for (const hero of grownHeroes) expect(hero.maxHp).toBeGreaterThan(baseHeroes.find((entry) => entry.id === hero.id)!.maxHp);
    const four = toggleSquadMember(toggleSquadMember(prepared, 'kain'), 'leo');
    const profiles = [four, prepared];
    const settledRuns: CampaignProfile[] = [];
    for (const [index, ready] of profiles.entries()) {
      const slot = index + 1;
      const deployed = await reload(deploy(ready, `${stance}-${ready.activeSquad.length}`), slot);
      const attempt = deployed.battleAttempt!;
      expect(attempt.heroes).toHaveLength(index === 0 ? 4 : 6);
      expect(attempt.raonStance).toBe(stance);
      expect(attempt.heroes).toEqual(grownHeroes.filter((hero) => ready.activeSquad.includes(hero.id)));
      for (const hero of attempt.heroes) expect(attempt.battle.heroes.find((unit) => unit.id === hero.id)!.hp).toBe(hero.maxHp);
      const won = await win(deployed, slot);
      expect(won.heroProgress).toEqual(ready.heroProgress);
      expect(won.completedMissions).not.toContain(mission.id);
      const settled = await reload(settleCampaignBattle(won, attempt.id, won.battleAttempt!.battle), slot);
      expect(settled.battleAttempt!.settled).toBe(true);
      expect(settled.completedMissions).toEqual([mission.id]);
      expect(settled.supplies).toBe(ready.supplies + mission.reward.supplies);
      expect(settled.day).toBe(ready.day + 3);
      expect(settled.unlockedRecords.filter((id) => id === `witness-${mission.id}`)).toHaveLength(1);
      for (const hero of heroDefinitions) {
        const progress = settled.heroProgress[hero.id];
        expect(progress.xp).toBe(ready.heroProgress[hero.id].xp + (ready.activeSquad.includes(hero.id) ? mission.reward.xp : 0));
      }
      expect(settleCampaignBattle(settled, attempt.id, settled.battleAttempt!.battle)).toBe(settled);
      settledRuns.push(settled);
      const next = await reload(deploy(settled, `${attempt.id}-new`), slot);
      expect(next.battleAttempt!.heroes).toEqual(buildProgressedHeroes(settled).filter((hero) => ready.activeSquad.includes(hero.id)));
      expect(saveCampaignBattleCheckpoint(next, attempt.id, { battle: won.battleAttempt!.battle })).toBe(next);
      expect(settleCampaignBattle(next, attempt.id, won.battleAttempt!.battle)).toBe(next);
      expect(abandonCampaignBattle(next, attempt.id)).toBe(next);
      expect(next.originStory).toEqual(graduated.originStory);
    }
    for (const id of four.activeSquad) expect(settledRuns[0]!.heroProgress[id]).toEqual(settledRuns[1]!.heroProgress[id]);
  });

  it('restores a defeat produced by enemy turns without rewards and preserves deployment until it is abandoned', async () => {
    const prepared = chooseRaonStoryPath(await graduate('insight'), mission.id, 'insight');
    let profile = await reload(deploy(prepared, 'loss'));
    const frozen = profile.battleAttempt!;
    // Deliberately end turns without attacking; the actual enemy/round rules decide defeat.
    for (let turn = 0; profile.battleAttempt!.battle.outcome === 'active' && turn < 20; turn += 1) {
      profile = await reload(checkpoint(profile, endPlayerTurn(profile.battleAttempt!.battle, mission, frozen.heroes)));
    }
    expect(profile.battleAttempt!.battle.outcome).toBe('defeat');
    expect(profile.battleAttempt!.battle.carriageHp).toBeLessThan(frozen.battle.carriageHp);
    expect(settleCampaignBattle(profile, frozen.id, profile.battleAttempt!.battle)).toBe(profile);
    expect(resources(profile)).toEqual(resources(prepared));
    expect(profile.heroProgress).toEqual(prepared.heroProgress);
    expect(profile.completedMissions).toEqual([]);
    expect(profile.unlockedRecords).not.toContain(`witness-${mission.id}`);
    const trained = unlockHeroNode(profile, 'raon', 'fieldcraft');
    const retry = await reload(restartCampaignBattle(trained, frozen.id, 'loss-retry', 'tactical'));
    expect(retry.battleAttempt!.heroes).toEqual(frozen.heroes);
    expect(retry.battleAttempt!.battle).toEqual(frozen.battle);
    const next = await reload(deploy(abandonCampaignBattle(retry, 'loss-retry'), 'fresh-preparation'));
    expect(next.battleAttempt!.heroes).toEqual(buildProgressedHeroes(trained));
    expect(next.battleAttempt!.heroes.find((hero) => hero.id === 'raon')!.maxHp).toBeGreaterThan(frozen.heroes.find((hero) => hero.id === 'raon')!.maxHp);
    expect(saveCampaignBattleCheckpoint(next, 'loss-retry', { battle: retry.battleAttempt!.battle })).toBe(next);
  });

  it.each(['checkpoint', 'settlement'] as const)('recovers a failed victory %s write without granting duplicate rewards', async (failedStage) => {
    const prepared = chooseRaonStoryPath(await graduate('resolve'), mission.id, 'resolve');
    const active = deploy(prepared, 'write-recovery');
    const won = await win(active);
    const attempt = won.battleAttempt!;
    const expectedSettlement = settleCampaignBattle(won, attempt.id, attempt.battle);
    // Make the last durable snapshot correspond to the selected crash boundary.
    await reload(failedStage === 'checkpoint' ? active : won);
    failWrites = true;
    expect(await saveCampaignProfile(failedStage === 'checkpoint' ? won : expectedSettlement, 1)).toBe(false);
    let restored = await read();
    expect(resources(restored)).toEqual(resources(prepared));
    expect(restored.completedMissions).toEqual([]);
    expect(restored.battleAttempt!.settled).toBe(false);
    if (failedStage === 'checkpoint') {
      expect(restored.battleAttempt!.battle.outcome).toBe('active');
      expect(settleCampaignBattle(restored, attempt.id, attempt.battle)).toBe(restored);
      restored = checkpoint(restored, attempt.battle);
    } else expect(restored.battleAttempt!.battle.outcome).toBe('victory');
    failWrites = false;
    restored = await reload(restored);
    const settled = await reload(settleCampaignBattle(restored, attempt.id, restored.battleAttempt!.battle));
    expect(settled).toEqual(expectedSettlement);
    expect(settleCampaignBattle(settled, attempt.id, attempt.battle)).toBe(settled);
    expect(settled.unlockedRecords.filter((id) => id === `witness-${mission.id}`)).toHaveLength(1);
    expect(settled.supplies).toBe(prepared.supplies + mission.reward.supplies);
    expect(settled.heroProgress.raon.xp).toBe(prepared.heroProgress.raon.xp + mission.reward.xp);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { missions } from '../data/campaign';
import type { BattleState, CampaignProfile } from '../types';
import { applyHeroSkill, createInitialBattleState } from './battleEngine';
import { createInitialActionBattleCheckpoint } from './actionBattleCheckpoint';
import { createActionBattleModel } from './actionBattleRules';
import { isBattleStateCheckpoint, isCampaignBattleAttempt, sameBattleCheckpoint } from './battleCheckpointValidation';
import { abandonCampaignBattle, beginCampaignBattle, restartCampaignBattle, saveCampaignBattleCheckpoint, settleCampaignBattle } from './campaignBattle';
import { missionReadyProfile, victoriousBattle } from './campaignTestFixtures';
import { canChooseMissionStory, canLaunchMission } from './missionAccess';
import { isCampaignProfileCandidate } from './persistence';
import { campaignStorageKey, chooseRaonStoryPath, completeMission, createNewCampaignProfile, loadCampaignProfile, saveCampaignProfile, unlockHeroNode } from './progression';

const mission = missions[0]!;
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
  if (loaded.status !== 'ready') throw new Error('Expected valid saved battle');
  return loaded.profile;
}

function started() { return beginCampaignBattle(missionReadyProfile(), mission.id, 'counterfire', 'veteran', 'attempt-1'); }
function tactical(profile = started()) {
  return saveCampaignBattleCheckpoint(profile, profile.battleAttempt!.id, {
    mode: 'tactical', tactical: { history: [], selectedHeroId: 'raon', selectedSkillId: 'unfinished-flow' },
  });
}
function winning(profile = tactical()) {
  const attempt = profile.battleAttempt!;
  const battle: BattleState = { ...attempt.battle, outcome: 'victory', enemies: attempt.battle.enemies.map((enemy) => ({ ...enemy, hp: 0 })) };
  return saveCampaignBattleCheckpoint(profile, attempt.id, { battle });
}

describe('formal mission access and result boundaries', () => {
  it('requires graduation, a known and unlocked mission, a choice and a valid deployed squad', () => {
    const fresh = createNewCampaignProfile();
    expect(canChooseMissionStory(fresh, mission.id)).toBe(false);
    expect(chooseRaonStoryPath(fresh, mission.id, 'compassion')).toBe(fresh);
    expect(beginCampaignBattle(fresh, mission.id, 'shelter', 'story', 'first')).toBe(fresh);
    const ready = missionReadyProfile();
    for (const blocked of [
      { ...ready, storyChoices: {} },
      { ...ready, activeSquad: ['raon', 'kain', 'leo'] },
      { ...ready, activeSquad: ['hadori', 'kain', 'leo', 'chris'] },
      { ...ready, activeSquad: ['raon', 'raon', 'leo', 'chris'] },
      { ...ready, activeSquad: ['raon', 'unknown', 'leo', 'chris'] },
    ]) {
      expect(canLaunchMission(blocked, mission.id)).toBe(false);
      expect(beginCampaignBattle(blocked, mission.id, 'shelter', 'story', 'first')).toBe(blocked);
    }
    expect(chooseRaonStoryPath(ready, 'unknown', 'resolve')).toBe(ready);
    expect(beginCampaignBattle(ready, missions[1]!.id, 'shelter', 'story', 'first')).toBe(ready);
    expect(beginCampaignBattle(ready, 'unknown', 'shelter', 'story', 'first')).toBe(ready);
    expect(started().battleAttempt?.mode).toBe('select');
  });

  it('rejects missing, active, defeated, wrong-mission, contradictory and unchosen results', () => {
    const ready = missionReadyProfile();
    const victory = victoriousBattle(ready);
    for (const state of [undefined, { ...victory, outcome: 'active' as const }, { ...victory, outcome: 'defeat' as const },
      { ...victory, missionId: missions[1]!.id }, { ...victory, carriageHp: 0 }, { ...victory, heroes: [] },
      { ...victory, enemies: [] }, { ...victory, morale: NaN }]) {
      expect(completeMission(ready, mission, state).profile).toBe(ready);
    }
    const noChoice = { ...ready, storyChoices: {} };
    expect(completeMission(noChoice, mission, victory).profile).toBe(noChoice);
    expect(completeMission(createNewCampaignProfile(), mission, victory).firstClear).toBe(false);
  });

  it('uses official rewards even if a caller modifies the supplied mission object', () => {
    const ready = missionReadyProfile();
    const modified = { ...mission, reward: { ...mission.reward, supplies: 1_000_000 } };
    expect(completeMission(ready, modified, victoriousBattle(ready)).profile.supplies).toBe(ready.supplies + mission.reward.supplies);
  });

  it('freezes the active mission choice while allowing preparation of another unlocked mission', () => {
    const profile = started();
    expect(chooseRaonStoryPath(profile, mission.id, 'compassion')).toBe(profile);
    const availableSecond = { ...profile, completedMissions: [mission.id] };
    expect(chooseRaonStoryPath(availableSecond, missions[1]!.id, 'insight').storyChoices[missions[1]!.id]).toBe('insight');
  });
});

describe('persisted campaign battle attempts', () => {
  it('round-trips an untouched v10 save and a paused mode selection', async () => {
    const old = missionReadyProfile();
    expect(await reload(old)).toEqual(old);
    const profile = started();
    expect(await reload(profile)).toEqual(profile);
    expect(beginCampaignBattle(profile, mission.id, 'shelter', 'story', 'other')).toBe(profile);
  });

  it('clears the settled attempt when changing its answer without losing rewards or accepting its stale callbacks', () => {
    const won = winning();
    const settled = settleCampaignBattle(won, 'attempt-1', won.battleAttempt!.battle);
    const changed = chooseRaonStoryPath(settled, mission.id, 'compassion');
    expect(changed.battleAttempt).toBeUndefined();
    expect(changed.storyChoices[mission.id]).toBe('compassion');
    expect(isCampaignProfileCandidate(changed)).toBe(true);
    for (const key of ['supplies', 'intel', 'relics', 'renown', 'inventory', 'heroProgress', 'missionGrades', 'unlockedRecords', 'completedMissions', 'careerStats', 'day', 'factions'] as const) {
      expect(changed[key]).toEqual(settled[key]);
    }
    expect(restartCampaignBattle(changed, 'attempt-1', 'old-retry')).toBe(changed);
    expect(settleCampaignBattle(changed, 'attempt-1', won.battleAttempt!.battle)).toBe(changed);
    expect(saveCampaignBattleCheckpoint(changed, 'attempt-1', { battle: won.battleAttempt!.battle })).toBe(changed);
    expect(abandonCampaignBattle(changed, 'attempt-1')).toBe(changed);
    const deployed = beginCampaignBattle(changed, mission.id, 'shelter', 'story', 'new-answer');
    expect(deployed.battleAttempt).toMatchObject({ id: 'new-answer', raonStance: 'compassion', settled: false });
    expect(deployed.battleAttempt!.battle.raonStance).toBe('compassion');
    expect(isCampaignProfileCandidate(deployed)).toBe(true);
  });

  it('keeps the settled result when its existing answer is selected again', () => {
    const won = winning();
    const settled = settleCampaignBattle(won, 'attempt-1', won.battleAttempt!.battle);
    expect(chooseRaonStoryPath(settled, mission.id, 'resolve')).toBe(settled);
    expect(isCampaignProfileCandidate(settled)).toBe(true);
  });

  it('keeps a settled result while preparing a different unlocked mission', () => {
    const won = winning();
    const settled = settleCampaignBattle(won, 'attempt-1', won.battleAttempt!.battle);
    const changed = chooseRaonStoryPath(settled, missions[1]!.id, 'insight');
    expect(changed.battleAttempt).toBe(settled.battleAttempt);
    expect(changed.storyChoices[missions[1]!.id]).toBe('insight');
    expect(isCampaignProfileCandidate(changed)).toBe(true);
  });

  it('restores tactical actions, selection and undo history without resetting deployed stats', async () => {
    const profile = tactical();
    const attempt = profile.battleAttempt!;
    const battle = applyHeroSkill(attempt.battle, mission, attempt.heroes, 'hadori', 'iron-gate');
    expect(battle).not.toBe(attempt.battle);
    const checkpoint = saveCampaignBattleCheckpoint(profile, attempt.id, {
      battle, tactical: { history: [attempt.battle], selectedHeroId: 'hadori', selectedSkillId: 'iron-gate' },
    });
    expect(checkpoint).not.toBe(profile);
    const loaded = await reload(checkpoint);
    expect(loaded).toEqual(checkpoint);
    expect(loaded.battleAttempt!.battle.carriageShield).toBeGreaterThan(attempt.battle.carriageShield);
    const undone = saveCampaignBattleCheckpoint(loaded, attempt.id, { battle: attempt.battle, tactical: { ...loaded.battleAttempt!.tactical!, history: [] } });
    expect(undone.battleAttempt!.battle).toEqual(attempt.battle);
  });

  it('keeps original deployment through roster growth, retry and mode switch', () => {
    const profile = tactical();
    const original = profile.battleAttempt!;
    const trained = unlockHeroNode(profile, 'raon', 'fieldcraft');
    expect(trained.heroProgress.raon).not.toEqual(profile.heroProgress.raon);
    const switched = restartCampaignBattle({ ...trained, day: 30, activeSquad: ['raon', 'hadori', 'leo', 'chris'] }, original.id, 'attempt-2', 'action');
    const next = switched.battleAttempt!;
    expect(next).toMatchObject({ id: 'attempt-2', mode: 'action', heroes: original.heroes, difficulty: 'veteran', warPressure: original.warPressure, bondSupport: original.bondSupport });
    expect(next.battle).toEqual(original.battle);
    expect(next.tactical).toBeUndefined();
    expect(next.action).toBeUndefined();
    expect(isCampaignProfileCandidate(switched)).toBe(true);
    expect(restartCampaignBattle(switched, next.id, next.id)).toBe(switched);
  });

  it('accepts action mode before its first tick only when the battle is untouched', async () => {
    const profile = started();
    const selected = saveCampaignBattleCheckpoint(profile, 'attempt-1', { mode: 'action' });
    expect(selected.battleAttempt!.mode).toBe('action');
    expect(await reload(selected)).toEqual(selected);
    const damaged = { ...selected.battleAttempt!.battle, carriageHp: 1 };
    expect(saveCampaignBattleCheckpoint(selected, 'attempt-1', { battle: damaged })).toBe(selected);
    expect(saveCampaignBattleCheckpoint(tactical(), 'attempt-1', { mode: 'action' }).battleAttempt!.mode).toBe('tactical');
  });

  it('ignores stale checkpoints, restarts, settlements and exits from an earlier attempt', () => {
    const original = tactical();
    const next = restartCampaignBattle(original, 'attempt-1', 'attempt-2');
    expect(saveCampaignBattleCheckpoint(next, 'attempt-1', { battle: original.battleAttempt!.battle })).toBe(next);
    expect(restartCampaignBattle(next, 'attempt-1', 'attempt-3')).toBe(next);
    expect(settleCampaignBattle(next, 'attempt-1', winning(original).battleAttempt!.battle)).toBe(next);
    expect(abandonCampaignBattle(next, 'attempt-1')).toBe(next);
    const abandoned = abandonCampaignBattle(next, 'attempt-2');
    expect(abandoned.battleAttempt).toBeUndefined();
    expect(saveCampaignBattleCheckpoint(abandoned, 'attempt-2', { mode: 'tactical' })).toBe(abandoned);
    expect(beginCampaignBattle(abandoned, mission.id, 'shelter', 'story', 'attempt-3').battleAttempt?.id).toBe('attempt-3');
  });

  it('round-trips action movement and timers and settles its matching final snapshot', async () => {
    const profile = started();
    const attempt = profile.battleAttempt!;
    const action = createInitialActionBattleCheckpoint(createActionBattleModel({ ...attempt, mission }));
    action.elapsed = 1;
    action.player.x += 20;
    action.timers.heavy = 400;
    const checkpoint = saveCampaignBattleCheckpoint(profile, attempt.id, { mode: 'action', battle: action.battle, action });
    expect(checkpoint).not.toBe(profile);
    const restored = await reload(checkpoint);
    expect(restored).toEqual(checkpoint);
    const victory = {
      ...action,
      battle: { ...action.battle, outcome: 'victory' as const, enemies: action.battle.enemies.map((enemy) => ({ ...enemy, hp: 0 })) },
      enemies: action.enemies.map((enemy) => ({ ...enemy, nextAttack: 0, telegraph: 0, stunned: 0 })),
    };
    const won = saveCampaignBattleCheckpoint(restored, attempt.id, { battle: victory.battle, action: victory });
    expect(won.battleAttempt!.battle.outcome).toBe('victory');
    const settled = settleCampaignBattle(won, attempt.id, won.battleAttempt!.battle);
    expect(settled.battleAttempt!.settled).toBe(true);
    const switched = restartCampaignBattle(settled, attempt.id, 'tactical-retry', 'tactical');
    expect(switched.battleAttempt!.action).toBeUndefined();
    expect(switched.battleAttempt!.battle.outcome).toBe('active');
  });

  it('saves defeat and restores it for retry without granting a completion', async () => {
    const profile = tactical();
    const attempt = profile.battleAttempt!;
    const failed: BattleState = { ...attempt.battle, carriageHp: 0, outcome: 'defeat' };
    const checkpoint = saveCampaignBattleCheckpoint(profile, attempt.id, { battle: failed });
    expect(checkpoint.battleAttempt!.battle.outcome).toBe('defeat');
    const loaded = await reload(checkpoint);
    expect(settleCampaignBattle(loaded, attempt.id, failed)).toBe(loaded);
    expect(loaded.completedMissions).not.toContain(mission.id);
    expect(saveCampaignBattleCheckpoint(loaded, attempt.id, { battle: attempt.battle })).toBe(loaded);
    expect(restartCampaignBattle(loaded, attempt.id, 'retry').battleAttempt!.battle.outcome).toBe('active');
  });

  it('settles a restored victory once and atomically persists rewards with the settled marker', async () => {
    const profile = tactical();
    const victorious = winning(profile);
    expect(victorious.battleAttempt!.battle.outcome).toBe('victory');
    expect(victorious.completedMissions).not.toContain(mission.id);
    expect(settleCampaignBattle(profile, 'attempt-1', victorious.battleAttempt!.battle)).toBe(profile);
    const restored = await reload(victorious);
    const settled = settleCampaignBattle(restored, 'attempt-1', restored.battleAttempt!.battle);
    expect(settled.battleAttempt!.settled).toBe(true);
    expect(settled.completedMissions).toContain(mission.id);
    expect(settled.supplies).toBe(profile.supplies + Math.round(mission.reward.supplies * 1.25));
    const loaded = await reload(settled);
    expect(settleCampaignBattle(loaded, 'attempt-1', loaded.battleAttempt!.battle)).toBe(loaded);
    expect(saveCampaignBattleCheckpoint(loaded, 'attempt-1', { battle: profile.battleAttempt!.battle })).toBe(loaded);
    expect(beginCampaignBattle(loaded, mission.id, 'shelter', 'story', 'next').battleAttempt!.id).toBe('next');
  });

  it('gives XP to the original deployment when the waiting squad changes', () => {
    const ready = missionReadyProfile();
    ready.activeSquad = ['raon', 'hadori', 'kazrin', 'kain'];
    const original = tactical(beginCampaignBattle(ready, mission.id, 'shelter', 'standard', 'attempt-1'));
    const changed = { ...winning(original), activeSquad: ['raon', 'hadori', 'leo', 'chris'] };
    const settled = settleCampaignBattle(changed, 'attempt-1', changed.battleAttempt!.battle);
    expect(settled.heroProgress.kazrin.xp).toBe(ready.heroProgress.kazrin.xp + mission.reward.xp);
    expect(settled.heroProgress.leo.xp).toBe(ready.heroProgress.leo.xp);
    expect(settled.activeSquad).toEqual(changed.activeSquad);
  });

  it('rejects malformed battle data and leaves the original save untouched', async () => {
    const profile = tactical();
    const attempt = profile.battleAttempt!;
    const corruptions: unknown[] = [
      null, {}, { ...attempt, mode: 'unknown' }, { ...attempt, settled: true },
      { ...attempt, difficulty: 'unknown' }, { ...attempt, warPressure: Infinity },
      { ...attempt, heroes: [] }, { ...attempt, heroes: attempt.heroes.map((hero) => ({ ...hero, armor: NaN })) },
      { ...attempt, battle: { ...attempt.battle, heroes: [] } },
      { ...attempt, battle: { ...attempt.battle, enemies: attempt.battle.enemies.slice(1) } },
      { ...attempt, battle: { ...attempt.battle, round: 0 } },
      { ...attempt, battle: { ...attempt.battle, carriageHp: 1_000_000 } },
      { ...attempt, battle: { ...attempt.battle, enemies: attempt.battle.enemies.map((enemy) => ({ ...enemy, hp: 1_000_000 })) } },
      { ...attempt, battle: { ...attempt.battle, log: [...attempt.battle.log, ...attempt.battle.log] } },
      { ...attempt, battle: { ...attempt.battle, outcome: 'victory' } },
      { ...attempt, tactical: { ...attempt.tactical, history: [null] } },
      { ...attempt, tactical: { ...attempt.tactical, selectedSkillId: 'missing' } },
      { ...attempt, action: {} },
    ];
    await reload(profile);
    const original = local.get(`${campaignStorageKey}-slot-1`);
    for (const broken of corruptions) {
      expect(() => isCampaignBattleAttempt(broken)).not.toThrow();
      expect(isCampaignBattleAttempt(broken)).toBe(false);
      const candidate = { ...profile, battleAttempt: broken };
      expect(isCampaignProfileCandidate(candidate)).toBe(false);
      expect(await saveCampaignProfile(candidate as CampaignProfile, 1)).toBe(false);
    }
    expect(local.get(`${campaignStorageKey}-slot-1`)).toBe(original);
    local.set(`${campaignStorageKey}-slot-1`, JSON.stringify({ ...profile, battleAttempt: {} }));
    expect(await loadCampaignProfile(1)).toMatchObject({ status: 'blocked' });
  });

  it('validates frozen hero numbers by shape rather than current balance equality', () => {
    const profile = tactical();
    const attempt = profile.battleAttempt!;
    const altered = { ...attempt, heroes: attempt.heroes.map((hero) => ({ ...hero, armor: hero.armor + 0.5,
      skills: hero.skills.map((skill) => ({ ...skill, power: skill.power + 0.5 })),
    })) };
    expect(isCampaignBattleAttempt(altered)).toBe(true);
  });

  it('records simultaneous collateral loss as defeat and accepts the real engine checkpoint', () => {
    const fractured = missions.find((entry) => entry.battlefieldRule.id === 'fractured-truce')!;
    const heroes = started().battleAttempt!.heroes;
    const state = createInitialBattleState('shelter', fractured, heroes);
    const terminal = applyHeroSkill({ ...state, carriageHp: 4, carriageShield: 0, enemies: state.enemies.map((enemy) => ({ ...enemy, hp: 1, revealed: true })) }, fractured, heroes, 'raon', 'unfinished-flow');
    expect(terminal.carriageHp).toBe(0);
    expect(terminal.enemies.every((enemy) => enemy.hp === 0)).toBe(true);
    expect(terminal.outcome).toBe('defeat');
    expect(isBattleStateCheckpoint(terminal, { mission: fractured, heroes, doctrine: 'shelter' })).toBe(true);
  });

  it('keeps battle log IDs unique after restoring and initializing another battle', () => {
    const profile = tactical();
    const attempt = profile.battleAttempt!;
    const state = applyHeroSkill(attempt.battle, mission, attempt.heroes, 'hadori', 'iron-gate');
    const restored = JSON.parse(JSON.stringify(state)) as BattleState;
    createInitialBattleState('shelter', mission, attempt.heroes);
    const continued = applyHeroSkill(restored, mission, attempt.heroes, 'raon', 'unfinished-flow', mission.enemies.find((enemy) => !enemy.hidden)!.id);
    expect(continued).not.toBe(restored);
    expect(new Set(continued.log.map((entry) => entry.id)).size).toBe(continued.log.length);
    expect(sameBattleCheckpoint(restored, JSON.parse(JSON.stringify(restored)))).toBe(true);
  });
});

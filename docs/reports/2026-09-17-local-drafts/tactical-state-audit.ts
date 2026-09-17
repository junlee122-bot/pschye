import { expect, it, vi } from 'vitest';
import type { BattleState, HeroDefinition, MissionDefinition } from '../src/types';
import type { BattleCheckpointContext } from '../src/game/battleCheckpointValidation';

const audit = vi.hoisted(() => ({
  contexts: new Map<string, BattleCheckpointContext>(),
  inspect: (_state: BattleState, _operation: string) => {},
}));

vi.mock('../src/game/battleEngine', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/game/battleEngine')>();
  return {
    ...original,
    createInitialBattleState: (...args: Parameters<typeof original.createInitialBattleState>) => {
      const state = original.createInitialBattleState(...args);
      audit.contexts.set(state.missionId, { mission: args[1], heroes: args[2], doctrine: args[0], difficulty: state.difficulty,
        raonStance: state.raonStance, warPressure: state.warPressure, bondSupport: state.bondSupport, mode: 'tactical' });
      audit.inspect(state, 'create');
      return state;
    },
    applyHeroSkill: (...args: Parameters<typeof original.applyHeroSkill>) => {
      const state = original.applyHeroSkill(...args);
      audit.inspect(state, 'skill');
      return state;
    },
    endPlayerTurn: (...args: Parameters<typeof original.endPlayerTurn>) => {
      const state = original.endPlayerTurn(...args);
      audit.inspect(state, 'turn');
      return state;
    },
    triggerTeamFinisher: (...args: Parameters<typeof original.triggerTeamFinisher>) => {
      const state = original.triggerTeamFinisher(...args);
      audit.inspect(state, 'finisher');
      return state;
    },
  };
});

import { runPlaytestAudit } from '../src/game/playtestAudit';
import { isBattleStateCheckpoint } from '../src/game/battleCheckpointValidation';
import { applyHeroSkill, createInitialBattleState, endPlayerTurn, triggerTeamFinisher } from '../src/game/battleEngine';
import { getBattleRecommendation } from '../src/game/battleDecision';
import { buildProgressedHeroes, createNewCampaignProfile } from '../src/game/progression';
import { missions } from '../src/data/campaign';

it('inspects every real tactical state in the 204-path audit and all valid 4–6 hero deployments', () => {
  let checked = 0;
  let rejected = 0;
  let fullLogs = 0;
  let fullChains = 0;
  let roundLimitStates = 0;
  let highPressure = 0;
  const operations: Record<string, number> = {};
  const parties: Record<string, number> = {};
  const outcomes: Record<string, number> = {};
  const rules: Record<string, number> = {};
  const failures: unknown[] = [];
  audit.inspect = (state, operation) => {
    const context = audit.contexts.get(state.missionId)!;
    checked += 1;
    operations[operation] = (operations[operation] ?? 0) + 1;
    parties[context.heroes.length] = (parties[context.heroes.length] ?? 0) + 1;
    outcomes[state.outcome] = (outcomes[state.outcome] ?? 0) + 1;
    rules[context.mission.battlefieldRule.id] = (rules[context.mission.battlefieldRule.id] ?? 0) + 1;
    if (state.log.length === 18) fullLogs += 1;
    if (state.focusChain.length >= 3) fullChains += 1;
    if (state.round === state.roundLimit) roundLimitStates += 1;
    if ((state.warPressure ?? 0) >= 75) highPressure += 1;
    if (!isBattleStateCheckpoint(state, context)) {
      rejected += 1;
      if (failures.length < 8) failures.push({ operation, context: { mission: state.missionId, doctrine: context.doctrine, party: context.heroes.map((hero) => hero.id) }, state });
    }
  };

  const baseline = runPlaytestAudit(204);
  const heroes = buildProgressedHeroes(createNewCampaignProfile());
  const raon = heroes.find((hero) => hero.id === 'raon')!;
  const companions = heroes.filter((hero) => hero.id !== 'raon');
  const squads: HeroDefinition[][] = [];
  for (let mask = 0; mask < 1 << companions.length; mask += 1) {
    const squad = [raon, ...companions.filter((_hero, index) => mask & (1 << index))];
    if (squad.length >= 4) squads.push(squad);
  }
  let stressBattles = 0;
  const stances = ['compassion', 'insight', 'resolve'] as const;
  const pressures = [75, 85, 100];
  function finish(mission: MissionDefinition, squad: HeroDefinition[], difficulty: 'story' | 'standard' | 'veteran', doctrine: 'shelter' | 'counterfire') {
    const index = stressBattles++;
    let state = createInitialBattleState(doctrine, mission, squad, difficulty, stances[index % 3], { warPressure: pressures[Math.floor(index / 3) % 3], bondSupport: index % 2 === 0 ? 0 : 100 });
    for (let action = 0; action < 100 && state.outcome === 'active'; action += 1) {
      if (state.morale >= 100 && !state.finisherUsed) state = triggerTeamFinisher(state, mission);
      else {
        const recommendation = getBattleRecommendation(state, mission, squad);
        if (state.commandPoints > 0 && recommendation) {
          const next = applyHeroSkill(state, mission, squad, recommendation.heroId, recommendation.skillId, recommendation.targetId);
          state = next === state ? endPlayerTurn(state, mission, squad) : next;
        } else state = endPlayerTurn(state, mission, squad);
      }
    }
    expect(state.outcome).not.toBe('active');
  }
  for (const mission of missions) for (const squad of squads) for (const difficulty of ['story', 'standard', 'veteran'] as const) for (const doctrine of ['shelter', 'counterfire'] as const) finish(mission, squad, difficulty, doctrine);
  console.log(JSON.stringify({ baselineBattles: baseline.battleRuns, stressBattles, squadVariants: squads.length, checked, rejected, fullLogs, fullChains, roundLimitStates, highPressure, operations, parties, outcomes, rules, failures }, null, 2));
  expect(rejected).toBe(0);
  expect(checked).toBeGreaterThan(10000);
  expect(Object.keys(parties)).toEqual(['4', '5', '6']);
});

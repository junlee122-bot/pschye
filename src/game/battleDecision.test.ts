import { describe, expect, it } from 'vitest';
import { heroDefinitions } from '../data/battle';
import { missions } from '../data/campaign';
import { applyHeroSkill, createInitialBattleState } from './battleEngine';
import { getBattleRecommendation } from './battleDecision';

describe('battleDecision', () => {
  it('reveals a hidden threat before recommending direct damage', () => {
    const mission = missions[0]!;
    const battle = createInitialBattleState('shelter', mission, heroDefinitions);
    const recommendation = getBattleRecommendation(battle, mission, heroDefinitions);

    expect(recommendation?.heroId).toBe('chris');
    expect(recommendation?.targetId).toBe('sky-sniper');
    expect(
      heroDefinitions
        .find((hero) => hero.id === recommendation?.heroId)
        ?.skills.find((skill) => skill.id === recommendation?.skillId)
        ?.kind,
    ).toBe('reveal');
  });

  it('keeps attacking after the cursed-border sniper is revealed', () => {
    const mission = missions.find((entry) => entry.id === 'cursed-border')!;
    const initial = createInitialBattleState('shelter', mission, heroDefinitions);
    const revealed = applyHeroSkill(
      initial,
      mission,
      heroDefinitions,
      'chris',
      'side-read',
      'false-flag-sniper',
    );
    const recommendation = getBattleRecommendation(revealed, mission, heroDefinitions);
    const skill = heroDefinitions
      .find((hero) => hero.id === recommendation?.heroId)
      ?.skills.find((entry) => entry.id === recommendation?.skillId);

    expect(recommendation).toBeDefined();
    expect(skill?.kind).not.toBe('guard');
  });

  it('prioritizes a guard only when the protected objective can collapse', () => {
    const mission = missions.find((entry) => entry.id === 'cursed-border')!;
    const initial = createInitialBattleState('shelter', mission, heroDefinitions);
    const critical = {
      ...initial,
      carriageHp: 1,
      carriageShield: 0,
      enemies: initial.enemies.map((enemy) => ({ ...enemy, revealed: true })),
    };
    const recommendation = getBattleRecommendation(critical, mission, heroDefinitions);
    const skill = heroDefinitions
      .find((hero) => hero.id === recommendation?.heroId)
      ?.skills.find((entry) => entry.id === recommendation?.skillId);

    expect(skill?.kind).toBe('guard');
  });
});

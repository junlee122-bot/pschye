import { describe, expect, it } from 'vitest';
import { heroDefinitions } from '../data/battle';
import { missions } from '../data/campaign';
import { applyHeroSkill, createInitialBattleState, endPlayerTurn } from './battleEngine';
import { getBattleRecommendation, hasAvailableHeroAction } from './battleDecision';
import { buildProgressedHeroes, createNewCampaignProfile } from './progression';

describe('battleDecision', () => {
  it('allows a turn to end when only Kain and a hidden sniper remain', () => {
    const profile = createNewCampaignProfile();
    profile.activeSquad = ['raon', 'kazrin', 'kain', 'leo'];
    profile.heroProgress.raon.level = 50;
    const heroes = buildProgressedHeroes(profile).filter((hero) => profile.activeSquad.includes(hero.id));
    const mission = missions[0]!;
    let battle = createInitialBattleState('shelter', mission, heroes, 'story', 'compassion');
    battle = applyHeroSkill(battle, mission, heroes, 'raon', 'unfinished-flow');
    battle = applyHeroSkill(battle, mission, heroes, 'kazrin', 'guardian-orbit');
    battle = applyHeroSkill(battle, mission, heroes, 'leo', 'gate-stance');

    expect(battle.commandPoints).toBe(1);
    expect(battle.heroes.filter((hero) => !hero.acted).map((hero) => hero.id)).toEqual(['kain']);
    expect(battle.enemies.filter((enemy) => enemy.hp > 0).map((enemy) => enemy.id)).toEqual(['sky-sniper']);
    expect(hasAvailableHeroAction(battle, mission, heroes)).toBe(false);
    const nextRound = endPlayerTurn(battle, mission, heroes);
    expect(nextRound.round).toBe(2);
    expect(nextRound.enemies.find((enemy) => enemy.id === 'sky-sniper')?.revealed).toBe(true);
    expect(hasAvailableHeroAction(nextRound, mission, heroes)).toBe(true);
  });

  it('recognizes legal protection and reveal actions without changing the battle', () => {
    const mission = missions[0]!;
    const initial = createInitialBattleState('shelter', mission, heroDefinitions);
    const hidden = { ...initial, enemies: initial.enemies.map((enemy) => ({ ...enemy, revealed: false })) };
    const snapshot = JSON.stringify(hidden);
    expect(hasAvailableHeroAction(hidden, mission, heroDefinitions.filter((hero) => hero.id === 'hadori'))).toBe(true);
    expect(hasAvailableHeroAction(hidden, mission, heroDefinitions.filter((hero) => hero.id === 'chris'))).toBe(true);
    expect(hasAvailableHeroAction({ ...hidden, commandPoints: 0 }, mission, heroDefinitions)).toBe(false);
    expect(hasAvailableHeroAction({ ...hidden, outcome: 'victory' }, mission, heroDefinitions)).toBe(false);
    expect(JSON.stringify(hidden)).toBe(snapshot);
  });

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

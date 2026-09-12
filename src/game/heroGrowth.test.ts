import { describe, expect, it } from 'vitest';
import { heroDefinitions } from '../data/battle';
import { missions } from '../data/campaign';
import { getHeroGrowthBonuses } from '../data/heroGrowth';
import { applyHeroSkill, createInitialBattleState } from './battleEngine';
import { buildProgressedHeroes, createNewCampaignProfile, unlockHeroNode } from './progression';

const mission = missions[0]!;

function profileWithNodes(nodes: string[], heroId = 'raon') {
  const profile = createNewCampaignProfile();
  profile.heroProgress[heroId] = {
    ...profile.heroProgress[heroId]!,
    unlockedNodes: nodes,
    skillPoints: 3,
  };
  return profile;
}

describe('hero growth nodes', () => {
  it('rejects unknown IDs and out-of-order unlocks without spending points', () => {
    const profile = createNewCampaignProfile();
    expect(unlockHeroNode(profile, 'raon', 'unknown-node')).toBe(profile);
    expect(unlockHeroNode(profile, 'unknown-hero', 'fieldcraft')).toBe(profile);
    expect(unlockHeroNode(profile, 'raon', 'bond-technique')).toBe(profile);
    expect(unlockHeroNode(profile, 'raon', 'personal-style')).toBe(profile);
    const injectedHero = { ...profile, heroProgress: { ...profile.heroProgress, impostor: profile.heroProgress.raon! } };
    expect(unlockHeroNode(injectedHero, 'impostor', 'fieldcraft')).toBe(injectedHero);
  });

  it('charges each node once and rejects insufficient or invalid points', () => {
    const profile = createNewCampaignProfile();
    const upgraded = unlockHeroNode(profile, 'raon', 'fieldcraft');
    expect(upgraded.heroProgress.raon!.skillPoints).toBe(0);
    expect(upgraded.heroProgress.raon!.unlockedNodes).toEqual(['foundation', 'fieldcraft']);
    expect(unlockHeroNode(upgraded, 'raon', 'fieldcraft')).toBe(upgraded);
    expect(unlockHeroNode(upgraded, 'raon', 'bond-technique')).toBe(upgraded);
    expect(profile.heroProgress.raon!.skillPoints).toBe(1);
    const invalid = profileWithNodes(['foundation']);
    invalid.heroProgress.raon!.skillPoints = Number.NaN;
    expect(unlockHeroNode(invalid, 'raon', 'fieldcraft')).toBe(invalid);
  });

  it('allows the free foundation node with no skill points', () => {
    const profile = profileWithNodes([]);
    profile.heroProgress.raon!.skillPoints = 0;
    const upgraded = unlockHeroNode(profile, 'raon', 'foundation');
    expect(upgraded.heroProgress.raon!.unlockedNodes).toEqual(['foundation']);
    expect(upgraded.heroProgress.raon!.skillPoints).toBe(0);
  });

  it('preserves the original combat stats for foundation-only saves', () => {
    const profile = profileWithNodes(['foundation']);
    profile.heroProgress.raon = { ...profile.heroProgress.raon!, level: 1, equipment: ['', ''] };
    profile.facilities = { ...profile.facilities, training: 0, infirmary: 0, forge: 0 };
    const hero = buildProgressedHeroes(profile).find((entry) => entry.id === 'raon');
    expect(hero).toEqual(heroDefinitions.find((entry) => entry.id === 'raon'));
  });

  it('applies fieldcraft to starting battle health and actual attack damage', () => {
    const profile = createNewCampaignProfile();
    const upgraded = unlockHeroNode(profile, 'raon', 'fieldcraft');
    const beforeHeroes = buildProgressedHeroes(profile);
    const afterHeroes = buildProgressedHeroes(upgraded);
    const before = createInitialBattleState('shelter', mission, beforeHeroes);
    const after = createInitialBattleState('shelter', mission, afterHeroes);
    expect(after.heroes.find((hero) => hero.id === 'raon')!.hp)
      .toBe(before.heroes.find((hero) => hero.id === 'raon')!.hp + 10);
    const beforeAttack = applyHeroSkill(before, mission, beforeHeroes, 'raon', 'sixteen-petals', 'rifleman-a');
    const afterAttack = applyHeroSkill(after, mission, afterHeroes, 'raon', 'sixteen-petals', 'rifleman-a');
    expect(afterAttack.enemies.find((enemy) => enemy.id === 'rifleman-a')!.hp)
      .toBe(beforeAttack.enemies.find((enemy) => enemy.id === 'rifleman-a')!.hp - 4);
    expect(afterHeroes.find((hero) => hero.id === 'kazrin')).toEqual(beforeHeroes.find((hero) => hero.id === 'kazrin'));
  });

  it('applies fieldcraft power to protection skills as well as damage', () => {
    const profile = createNewCampaignProfile();
    const upgraded = unlockHeroNode(profile, 'hadori', 'fieldcraft');
    const beforeHeroes = buildProgressedHeroes(profile);
    const afterHeroes = buildProgressedHeroes(upgraded);
    const before = applyHeroSkill(createInitialBattleState('shelter', mission, beforeHeroes), mission, beforeHeroes, 'hadori', 'iron-gate');
    const after = applyHeroSkill(createInitialBattleState('shelter', mission, afterHeroes), mission, afterHeroes, 'hadori', 'iron-gate');
    expect(after.carriageShield).toBe(before.carriageShield + 4);
  });

  it.each([
    ['raon', 'sixteen-petals', 'rifleman-a'],
    ['raon', 'unfinished-flow', undefined],
    ['hadori', 'iron-gate', undefined],
    ['chris', 'side-read', 'sky-sniper'],
  ])('increases earned battle morale for %s / %s', (heroId, skillId, targetId) => {
    const profile = profileWithNodes(['foundation', 'fieldcraft'], heroId);
    const upgraded = unlockHeroNode(profile, heroId!, 'bond-technique');
    const beforeHeroes = buildProgressedHeroes(profile);
    const afterHeroes = buildProgressedHeroes(upgraded);
    const before = applyHeroSkill(createInitialBattleState('shelter', mission, beforeHeroes), mission, beforeHeroes, heroId!, skillId!, targetId);
    const after = applyHeroSkill(createInitialBattleState('shelter', mission, afterHeroes), mission, afterHeroes, heroId!, skillId!, targetId);
    expect(after.morale).toBe(before.morale + 4);
  });

  it('adds personal style power and armor without reapplying earlier nodes', () => {
    const profile = profileWithNodes(['foundation', 'fieldcraft', 'bond-technique']);
    const upgraded = unlockHeroNode(profile, 'raon', 'personal-style');
    const before = buildProgressedHeroes(profile).find((hero) => hero.id === 'raon')!;
    const after = buildProgressedHeroes(upgraded).find((hero) => hero.id === 'raon')!;
    expect(after.maxHp).toBe(before.maxHp);
    expect(after.armor).toBe(before.armor + 2);
    after.skills.forEach((skill, index) => {
      expect(skill.power).toBe(before.skills[index]!.power + 6);
      expect(skill.morale).toBe(before.skills[index]!.morale);
    });
    expect(buildProgressedHeroes(upgraded).find((hero) => hero.id === 'raon')).toEqual(after);
  });

  it('retains legacy unlocks while ignoring unknown and repeated saved IDs', () => {
    const legacy = profileWithNodes(['personal-style']);
    const repeated = profileWithNodes(['personal-style', 'unknown-node', 'personal-style']);
    const base = buildProgressedHeroes(profileWithNodes([])).find((hero) => hero.id === 'raon')!;
    const hero = buildProgressedHeroes(legacy).find((entry) => entry.id === 'raon')!;
    expect(hero.armor).toBe(base.armor + 2);
    expect(hero.skills[0]!.power).toBe(base.skills[0]!.power + 6);
    expect(buildProgressedHeroes(repeated)).toEqual(buildProgressedHeroes(legacy));
    expect(getHeroGrowthBonuses(['fieldcraft', 'fieldcraft', 'unknown-node']))
      .toEqual({ hp: 10, armor: 0, power: 4, morale: 0 });
  });
});

import { describe, expect, it } from 'vitest';
import { heroDefinitions } from '../data/battle';
import { missions } from '../data/campaign';
import {
  ACTION_ROUND_SECONDS, addActionMorale, advanceActionRounds, applyActionCompanion,
  applyActionFinisher, buildActionBattleResult, createActionBattleModel, damageActionObjective,
  damageActionRaon, getActionAttack, getActionEnemyTarget, getActionIncomingDamage,
  hitActionEnemy, interruptActionAttack, resolveActionOutcome, revealActionEnemy, type ActionBattleInput,
} from './actionBattleRules';

const mission = missions[0]!;
function model(overrides: Partial<ActionBattleInput> = {}) {
  return createActionBattleModel({ mission, heroes: heroDefinitions, doctrine: 'counterfire', difficulty: 'standard', raonStance: 'resolve', warPressure: 0, bondSupport: 0, ...overrides });
}

describe('action battle growth and deployment', () => {
  it('uses progressed health, armor, power and skill morale in the actual action values', () => {
    const base = model();
    const improved = model({ heroes: heroDefinitions.map((hero) => hero.id === 'raon' ? {
      ...hero, maxHp: hero.maxHp + 40, armor: hero.armor + 10,
      skills: hero.skills.map((skill) => ({ ...skill, power: skill.power + 10, morale: skill.morale + 6 })),
    } : hero) });
    expect(improved.initialState.heroes.find((hero) => hero.id === 'raon')!.hp).toBe(base.raon.maxHp + 40);
    expect(getActionAttack(improved, 'light').power - getActionAttack(base, 'light').power).toBe(10);
    expect(getActionAttack(improved, 'heavy').power - getActionAttack(base, 'heavy').power).toBe(10);
    expect(getActionAttack(improved, 'light').morale - getActionAttack(base, 'light').morale).toBe(6);
    expect(getActionAttack(improved, 'heavy').morale - getActionAttack(base, 'heavy').morale).toBe(6);
    const baseHit = damageActionRaon(base.initialState, base, 30);
    const betterHit = damageActionRaon(improved.initialState, improved, 30);
    const baseLost = base.raon.maxHp - baseHit.heroes.find((hero) => hero.id === 'raon')!.hp;
    const betterLost = improved.raon.maxHp - betterHit.heroes.find((hero) => hero.id === 'raon')!.hp;
    expect(betterLost).toBeLessThan(baseLost);
  });

  it('includes all five selected companions and refuses a missing Raon', () => {
    expect(model().companions.map((order) => order.slot)).toEqual([1, 2, 3, 4, 5]);
    expect(model().companions.map((order) => order.hero.id)).toEqual(['hadori', 'kazrin', 'kain', 'leo', 'chris']);
    expect(() => model({ heroes: heroDefinitions.filter((hero) => hero.id !== 'raon') })).toThrow('라온');
  });

  it('never calls an absent companion and uses guard as a shield rather than healing', () => {
    const deployed = model({ heroes: heroDefinitions.filter((hero) => hero.id === 'raon' || hero.id === 'leo') });
    const hurt = damageActionObjective(deployed.initialState, 20);
    expect(applyActionCompanion(hurt, deployed, 'hadori')).toBe(hurt);
    const guarded = applyActionCompanion(hurt, deployed, 'leo');
    expect(guarded.carriageHp).toBe(hurt.carriageHp);
    expect(guarded.carriageShield).toBe(hurt.carriageShield + deployed.companions[0].skill.power);
    expect(guarded.morale).toBe(hurt.morale + deployed.companions[0].skill.morale);
    expect(deployed.initialState.carriageShield).toBe(0);
  });

  it('preserves doctrine, choices, war pressure and bond bonuses from the shared opening state', () => {
    const compassion = model({ doctrine: 'shelter', raonStance: 'compassion' });
    const insight = model({ raonStance: 'insight' });
    const resolve = model();
    expect(compassion.initialState.carriageShield).toBe(42);
    expect(compassion.initialState.carriageHp).toBe(resolve.initialState.carriageHp + 17);
    expect(insight.initialState.enemies.filter((enemy) => enemy.revealed).every((enemy) => enemy.exposed === 1)).toBe(true);
    expect(resolve.initialState.morale - insight.initialState.morale).toBe(20);
    const pressured = model({ warPressure: 80 });
    const supported = model({ bondSupport: 65 });
    expect(pressured.initialState.morale).toBe(resolve.initialState.morale - 20);
    expect(pressured.initialState.enemies[0].hp).toBeGreaterThan(resolve.initialState.enemies[0].hp);
    expect(supported.initialState.morale).toBe(resolve.initialState.morale + 15);
    expect(supported.initialState.carriageShield).toBe(16);
  });

  it('keeps story and veteran enemy health and damage scales distinct', () => {
    const story = model({ difficulty: 'story' });
    const veteran = model({ difficulty: 'veteran' });
    expect(story.initialState.enemies[0].hp).toBeLessThan(veteran.initialState.enemies[0].hp);
    expect(getActionIncomingDamage(story, mission.enemies[0].id)).toBeLessThan(getActionIncomingDamage(veteran, mission.enemies[0].id));
    expect(story.initialState.carriageHp).toBeGreaterThan(veteran.initialState.carriageHp);
  });

  it('absorbs enemy damage with the real opening objective shield', () => {
    const deployed = model({ raonStance: 'compassion' });
    const blocked = damageActionObjective(deployed.initialState, 18);
    expect(blocked.carriageHp).toBe(deployed.initialState.carriageHp);
    expect(blocked.carriageShield).toBe(6);
    const hit = damageActionObjective(blocked, 10);
    expect(hit.carriageShield).toBe(0);
    expect(hit.carriageHp).toBe(blocked.carriageHp - 4);
  });

  it('requires reveal for hidden targets and applies Chris and Kain exposure skills', () => {
    const deployed = model();
    const hidden = deployed.initialState.enemies.find((enemy) => !enemy.revealed)!;
    expect(hitActionEnemy(deployed.initialState, deployed, hidden.id, 60)).toBe(deployed.initialState);
    expect(getActionEnemyTarget(deployed, deployed.initialState, hidden.id)).toBe('objective');
    const scouted = applyActionCompanion(deployed.initialState, deployed, 'chris', hidden.id);
    expect(scouted.enemies.find((enemy) => enemy.id === hidden.id)).toMatchObject({ revealed: true, exposed: 2 });
    const marked = applyActionCompanion(scouted, deployed, 'kain', hidden.id);
    expect(marked.enemies.find((enemy) => enemy.id === hidden.id)!.exposed).toBe(3);
    expect(marked.enemies.find((enemy) => enemy.id === hidden.id)!.hp).toBeLessThan(scouted.enemies.find((enemy) => enemy.id === hidden.id)!.hp);
  });
});

describe('action mission testimony and interrupted attacks', () => {
  it.each(missions.filter((entry) => entry.revelation && entry.revelation.heroId !== 'raon'))(
    'connects the actual companion skill and testimony in $id', (currentMission) => {
      const deployed = model({ mission: currentMission });
      const revelation = currentMission.revelation!;
      const command = deployed.companions.find((entry) => entry.hero.id === revelation.heroId)!;
      expect(command.skill.id).toBe(revelation.skillId);
      const initial = revealActionEnemy(deployed.initialState, revelation.enemyId);
      const result = applyActionCompanion(initial, deployed, revelation.heroId, revelation.enemyId);
      expect(result.revelationTriggered).toBe(true);
      expect(result.log.filter((entry) => entry.message === revelation.line)).toHaveLength(1);
      if (command.skill.kind === 'guard') {
        expect(result.carriageShield).toBe(initial.carriageShield + command.skill.power);
        expect(result.enemies).toEqual(initial.enemies);
      } else {
        expect(result.enemies.find((enemy) => enemy.id === revelation.enemyId)!.hp).toBeLessThan(initial.enemies.find((enemy) => enemy.id === revelation.enemyId)!.hp);
      }
      if (command.skill.id === 'ground-break') expect(result.enemies.find((enemy) => enemy.id === revelation.enemyId)!.stunned).toBe(1);
      if (command.skill.id === 'silent-counter') expect(result.heroes.find((hero) => hero.id === revelation.heroId)!.shield).toBe(16);
      const again = applyActionCompanion(result, deployed, revelation.heroId, revelation.enemyId);
      expect(again.log.filter((entry) => entry.message === revelation.line)).toHaveLength(1);
    },
  );

  it('does not create testimony for a different target or an unwitnessed guard', () => {
    const deployed = model({ mission: missions.find((entry) => entry.id === 'citizen-cartridge')! });
    const revelation = deployed.mission.revelation!;
    const other = deployed.initialState.enemies.find((enemy) => enemy.id !== revelation.enemyId)!;
    const revealed = revealActionEnemy(deployed.initialState, other.id);
    expect(applyActionCompanion(revealed, deployed, revelation.heroId, other.id).revelationTriggered).toBe(false);
    const escort = model({ mission: missions.find((entry) => entry.id === 'wingless-convoy')! });
    expect(applyActionCompanion(escort.initialState, escort, 'kazrin').revelationTriggered).toBe(false);
  });

  it('cancels an old telegraph and leaves preparation time after a posture break', () => {
    const interrupted = interruptActionAttack({ telegraphUntil: 1100, nextAttackAt: 800, stunnedUntil: 0 }, 1000);
    expect(interrupted.telegraphUntil).toBe(0);
    expect(interrupted.stunnedUntil).toBe(2700);
    expect(interrupted.nextAttackAt).toBeGreaterThan(interrupted.stunnedUntil);
    const repeated = interruptActionAttack(interrupted, 1100, 500);
    expect(repeated.stunnedUntil).toBe(2700);
    expect(repeated.nextAttackAt).toBe(3080);
    expect(interruptActionAttack({ telegraphUntil: 0, nextAttackAt: 6000, stunnedUntil: 0 }, 1000).nextAttackAt).toBe(6000);
  });
});

describe('action battlefield rules and result safety', () => {
  it('fires the surviving artillery core once per completed 24 seconds', () => {
    const deployed = model({ mission: { ...mission, battlefieldRule: { id: 'aerial-barrage', name: '', description: '' }, enemies: [{ ...mission.enemies[0], id: 'sky-battery-core' }, ...mission.enemies.slice(1)] } });
    expect(advanceActionRounds(deployed.initialState, deployed, ACTION_ROUND_SECONDS - 0.001)).toBe(deployed.initialState);
    const first = advanceActionRounds(deployed.initialState, deployed, ACTION_ROUND_SECONDS);
    expect(first.carriageHp).toBe(deployed.initialState.carriageHp - 12);
    expect(first.round).toBe(2);
    expect(advanceActionRounds(first, deployed, ACTION_ROUND_SECONDS)).toBe(first);
    const destroyed = { ...first, enemies: first.enemies.map((enemy) => enemy.id === 'sky-battery-core' ? { ...enemy, hp: 0 } : enemy) };
    expect(advanceActionRounds(destroyed, deployed, ACTION_ROUND_SECONDS * 2).carriageHp).toBe(first.carriageHp);
  });

  it('reseals only unexposed hidden units after even rounds', () => {
    const deployed = model({ mission: { ...mission, battlefieldRule: { id: 'archive-seal', name: '', description: '' } } });
    const hidden = deployed.initialState.enemies.find((enemy) => !enemy.revealed)!;
    const revealed = revealActionEnemy(deployed.initialState, hidden.id);
    const first = advanceActionRounds(revealed, deployed, 24);
    expect(first.enemies.find((enemy) => enemy.id === hidden.id)!.revealed).toBe(true);
    const second = advanceActionRounds(first, deployed, 48);
    expect(second.enemies.find((enemy) => enemy.id === hidden.id)!.revealed).toBe(false);
    const exposed = revealActionEnemy(deployed.initialState, hidden.id, 2);
    expect(advanceActionRounds(exposed, deployed, 48).enemies.find((enemy) => enemy.id === hidden.id)).toMatchObject({ revealed: true, exposed: 0 });
  });

  it('damages all deployed heroes and gains 12 morale on temporal rounds', () => {
    const deployed = model({ mission: { ...mission, battlefieldRule: { id: 'temporal-echo', name: '', description: '' } } });
    const first = advanceActionRounds(deployed.initialState, deployed, 24);
    first.heroes.forEach((hero, index) => expect(hero.hp).toBe(deployed.initialState.heroes[index].hp - 5));
    expect(first.morale).toBe(deployed.initialState.morale + 12);
    const exhausted = { ...first, heroes: first.heroes.map((hero) => hero.id === 'leo' ? { ...hero, hp: 0 } : hero) };
    expect(applyActionCompanion(exhausted, deployed, 'leo')).toBe(exhausted);
  });

  it('fails when the final area attack also destroys the neutral objective', () => {
    const deployed = model({ mission: { ...mission, battlefieldRule: { id: 'fractured-truce', name: '', description: '' } } });
    const critical = { ...deployed.initialState, carriageHp: 4, carriageShield: 0, morale: 100, enemies: deployed.initialState.enemies.map((enemy) => ({ ...enemy, hp: 1 })) };
    const result = resolveActionOutcome(applyActionFinisher(critical, deployed));
    expect(result.enemies.every((enemy) => enemy.hp === 0)).toBe(true);
    expect(result.carriageHp).toBe(0);
    expect(result.outcome).toBe('defeat');
  });

  it('allows a finisher once and records actual use independently of remaining morale', () => {
    const deployed = model();
    const full = addActionMorale(deployed.initialState, 100);
    const used = applyActionFinisher(full, deployed);
    expect(used.finisherUsed).toBe(true);
    expect(used.morale).toBe(0);
    const refilled = addActionMorale(used, 100);
    expect(applyActionFinisher(refilled, deployed)).toBe(refilled);
    expect(buildActionBattleResult({ ...deployed.initialState, morale: 0 }, 0).finisherUsed).toBe(false);
  });

  it('enforces the actual round limit and cannot turn a timed-out attempt into victory', () => {
    const deployed = model({ mission: { ...mission, roundLimit: 2 } });
    const almost = advanceActionRounds(deployed.initialState, deployed, 47.999);
    expect(almost.outcome).toBe('active');
    expect(almost.round).toBe(2);
    const expired = advanceActionRounds(almost, deployed, 48);
    expect(expired.outcome).toBe('defeat');
    const result = buildActionBattleResult(expired, 3);
    expect(result.outcome).toBe('defeat');
    expect(result.breakCount).toBe(3);
    expect(result.enemies).toEqual(expired.enemies);
    expect(applyActionFinisher(addActionMorale(expired, 100), deployed).outcome).toBe('defeat');
  });

  it('exports actual survivor health, objective shield and morale without rewriting enemies', () => {
    const deployed = model();
    const won = { ...deployed.initialState, carriageShield: 17, morale: 21, round: 3, heroes: deployed.initialState.heroes.map((hero) => ({ ...hero, hp: hero.id === 'raon' ? 23 : 7 })), enemies: deployed.initialState.enemies.map((enemy) => ({ ...enemy, hp: 0 })) };
    const result = buildActionBattleResult(won, 2);
    expect(result).toMatchObject({ outcome: 'victory', carriageShield: 17, morale: 21, round: 3, breakCount: 2, finisherUsed: false });
    expect(result.heroes).toEqual(won.heroes);
    expect(result.enemies).toEqual(won.enemies);
    expect(buildActionBattleResult(deployed.initialState, 0).outcome).toBe('active');
  });
});

import { describe, expect, it } from 'vitest';
import {
  createInitialBattleState,
  applyHeroSkill,
  endPlayerTurn,
  getEnemyIntents,
  getFocusPreview,
  triggerTeamFinisher,
} from './battleEngine';
import { heroDefinitions } from '../data/battle';
import { missions } from '../data/campaign';

const mission = missions[0]!;

describe('battleEngine', () => {
  it('applies the selected opening doctrine', () => {
    const shelter = createInitialBattleState('shelter', mission, heroDefinitions);
    const counterfire = createInitialBattleState('counterfire', mission, heroDefinitions);

    expect(shelter.carriageHp).toBeGreaterThan(counterfire.carriageHp);
    expect(counterfire.morale).toBeGreaterThan(shelter.morale);
  });

  it('scales battlefield pressure by mission difficulty', () => {
    const story = createInitialBattleState('shelter', mission, heroDefinitions, 'story');
    const veteran = createInitialBattleState('shelter', mission, heroDefinitions, 'veteran');

    expect(story.commandPoints).toBeGreaterThan(veteran.commandPoints);
    expect(story.carriageHp).toBeGreaterThan(veteran.carriageHp);
    expect(story.enemies[0]?.hp).toBeLessThan(veteran.enemies[0]?.hp ?? 0);
  });

  it('turns Raon story choices into opening battle advantages', () => {
    const compassion = createInitialBattleState('counterfire', mission, heroDefinitions, 'standard', 'compassion');
    const insight = createInitialBattleState('counterfire', mission, heroDefinitions, 'standard', 'insight');
    const resolve = createInitialBattleState('counterfire', mission, heroDefinitions, 'standard', 'resolve');

    expect(compassion.carriageShield).toBe(24);
    expect(insight.enemies.find((enemy) => enemy.id === 'rifleman-a')?.exposed).toBe(1);
    expect(insight.enemies.find((enemy) => enemy.id === 'sky-sniper')?.exposed).toBe(0);
    expect(resolve.morale).toBe(45);
  });

  it('carries campaign pressure and companion trust into the battlefield', () => {
    const trusted = createInitialBattleState('shelter', mission, heroDefinitions, 'standard', 'compassion', {
      warPressure: 10,
      bondSupport: 65,
    });
    const pressured = createInitialBattleState('shelter', mission, heroDefinitions, 'standard', 'compassion', {
      warPressure: 80,
      bondSupport: 0,
    });

    expect(trusted.carriageShield).toBeGreaterThan(pressured.carriageShield);
    expect(trusted.morale).toBeGreaterThan(pressured.morale);
    expect(pressured.enemies[0]?.hp).toBeGreaterThan(trusted.enemies[0]?.hp ?? 0);
    expect(pressured.warPressure).toBe(80);
    expect(trusted.bondSupport).toBe(65);
  });

  it('prevents attacking a hidden sniper before reveal', () => {
    const initial = createInitialBattleState('shelter', mission, heroDefinitions);
    const afterAttack = applyHeroSkill(
      initial,
      mission,
      heroDefinitions,
      'raon',
      'sixteen-petals',
      'sky-sniper',
    );

    expect(afterAttack.commandPoints).toBe(3);
    expect(afterAttack.enemies[0]?.hp).toBe(initial.enemies[0]?.hp);
    expect(afterAttack.log.at(-1)?.speaker).toBe('전술 경고');
  });

  it('lets Chris reveal and expose a hidden target', () => {
    const initial = createInitialBattleState('counterfire', mission, heroDefinitions);
    const revealed = applyHeroSkill(initial, mission, heroDefinitions, 'chris', 'side-read', 'sky-sniper');
    const sniper = revealed.enemies.find((enemy) => enemy.id === 'sky-sniper');

    expect(sniper?.revealed).toBe(true);
    expect(sniper?.exposed).toBe(2);
    expect(revealed.commandPoints).toBe(2);
  });

  it('triggers the convoy guard revelation once when Kazrin protects a visible living witness', () => {
    const convoy = missions.find((entry) => entry.id === 'wingless-convoy')!;
    const initial = createInitialBattleState('shelter', convoy, heroDefinitions);
    const guarded = applyHeroSkill(initial, convoy, heroDefinitions, 'kazrin', 'guardian-orbit');
    expect(guarded.revelationTriggered).toBe(true);
    expect(guarded.carriageShield).toBe(initial.carriageShield + 24);
    expect(guarded.log.find((entry) => entry.message === convoy.revelation!.line))
      .toMatchObject({ speaker: '붉은 깃발대장', tone: 'story' });

    const nextRound = endPlayerTurn(guarded, convoy, heroDefinitions);
    const repeated = applyHeroSkill(nextRound, convoy, heroDefinitions, 'kazrin', 'guardian-orbit');
    expect(repeated.revelationTriggered).toBe(true);
    expect(repeated.log.filter((entry) => entry.message === convoy.revelation!.line)).toHaveLength(1);
  });

  it.each(['hidden', 'dead'] as const)('does not trigger a guard revelation when its witness is %s', (condition) => {
    const convoy = missions.find((entry) => entry.id === 'wingless-convoy')!;
    const initial = createInitialBattleState('shelter', convoy, heroDefinitions);
    const unavailableWitness = {
      ...initial,
      enemies: initial.enemies.map((enemy) => enemy.id === convoy.revelation!.enemyId
        ? { ...enemy, revealed: condition !== 'hidden', hp: condition === 'dead' ? 0 : enemy.hp }
        : enemy),
    };
    const guarded = applyHeroSkill(unavailableWitness, convoy, heroDefinitions, 'kazrin', 'guardian-orbit');
    expect(guarded.carriageShield).toBe(initial.carriageShield + 24);
    expect(guarded.revelationTriggered).toBe(false);
    expect(guarded.log.some((entry) => entry.message === convoy.revelation!.line)).toBe(false);
  });

  it('requires the specified hero and guard skill for the convoy revelation', () => {
    const convoy = missions.find((entry) => entry.id === 'wingless-convoy')!;
    const initial = createInitialBattleState('shelter', convoy, heroDefinitions);
    const otherGuard = applyHeroSkill(initial, convoy, heroDefinitions, 'hadori', 'iron-gate');
    const otherSkill = applyHeroSkill(initial, convoy, heroDefinitions, 'kazrin', 'silver-line', convoy.revelation!.enemyId);
    expect(otherGuard.revelationTriggered).toBe(false);
    expect(otherSkill.revelationTriggered).toBe(false);
    expect(otherGuard.log.some((entry) => entry.message === convoy.revelation!.line)).toBe(false);
    expect(otherSkill.log.some((entry) => entry.message === convoy.revelation!.line)).toBe(false);
  });

  it('builds a three-captain focus chain and breaks the target', () => {
    const initial = createInitialBattleState('counterfire', mission, heroDefinitions);
    const first = applyHeroSkill(initial, mission, heroDefinitions, 'chris', 'side-read', 'sky-sniper');
    const second = applyHeroSkill(first, mission, heroDefinitions, 'raon', 'sixteen-petals', 'sky-sniper');
    const preview = getFocusPreview(second, 'kain', 'sky-sniper');
    const broken = applyHeroSkill(second, mission, heroDefinitions, 'kain', 'duel-mark', 'sky-sniper');
    const sniper = broken.enemies.find((enemy) => enemy.id === 'sky-sniper');

    expect(preview.level).toBe(3);
    expect(preview.breakTriggered).toBe(true);
    expect(broken.focusChain).toEqual(['chris', 'raon', 'kain']);
    expect(broken.breakCount).toBe(1);
    expect(sniper?.stunned).toBe(1);
    expect(broken.morale).toBeGreaterThan(second.morale);
  });

  it('starts a new focus chain when the target changes', () => {
    const initial = createInitialBattleState('counterfire', mission, heroDefinitions);
    const first = applyHeroSkill(initial, mission, heroDefinitions, 'chris', 'side-read', 'sky-sniper');
    const switched = applyHeroSkill(first, mission, heroDefinitions, 'kain', 'duel-mark', 'rifleman-a');

    expect(switched.focusTargetId).toBe('rifleman-a');
    expect(switched.focusChain).toEqual(['kain']);
  });

  it('telegraphs enemy targets before their actions resolve', () => {
    const initial = createInitialBattleState('shelter', mission, heroDefinitions);
    const intents = getEnemyIntents(initial, mission, heroDefinitions);

    expect(intents).toHaveLength(initial.enemies.length);
    expect(intents.some((intent) => intent.type === 'objective')).toBe(true);
    expect(intents.some((intent) => intent.type === 'hero')).toBe(true);
    expect(intents.every((intent) => intent.targetLabel.length > 0)).toBe(true);
  });

  it('clears the focus chain when the next round begins', () => {
    const initial = createInitialBattleState('shelter', mission, heroDefinitions);
    const focused = {
      ...initial,
      focusTargetId: 'rifleman-a',
      focusChain: ['raon', 'kain'],
    };
    const nextRound = endPlayerTurn(focused, mission, heroDefinitions);

    expect(nextRound.round).toBe(2);
    expect(nextRound.focusTargetId).toBeUndefined();
    expect(nextRound.focusChain).toEqual([]);
  });

  it('spends full morale on the team finisher', () => {
    const initial = { ...createInitialBattleState('shelter', mission, heroDefinitions), morale: 100 };
    const finished = triggerTeamFinisher(initial, mission);

    expect(finished.morale).toBe(0);
    expect(finished.finisherUsed).toBe(true);
    expect(finished.enemies.every((enemy) => enemy.revealed)).toBe(true);
  });

  it('applies aerial battery damage while the sky core survives', () => {
    const skyMission = missions.find((entry) => entry.id === 'sky-gunfire')!;
    const initial = createInitialBattleState('shelter', skyMission, heroDefinitions);
    const isolated = {
      ...initial,
      enemies: initial.enemies.map((enemy) => ({ ...enemy, hp: enemy.id === 'sky-battery-core' ? enemy.hp : 0 })),
    };
    const resolved = endPlayerTurn(isolated, skyMission, heroDefinitions);
    expect(resolved.log.some((entry) => entry.speaker === '전장 규칙')).toBe(true);
    expect(resolved.carriageHp).toBeLessThan(isolated.carriageHp);
  });

  it('reseals unexposed infiltrators on even archive rounds', () => {
    const archiveMission = missions.find((entry) => entry.id === 'violet-infiltration')!;
    const initial = createInitialBattleState('shelter', archiveMission, heroDefinitions);
    const hiddenId = archiveMission.enemies.find((enemy) => enemy.hidden)?.id;
    const roundTwo = {
      ...initial,
      round: 2,
      enemies: initial.enemies.map((enemy) => ({
        ...enemy,
        hp: enemy.id === hiddenId ? enemy.hp : 0,
        revealed: true,
        exposed: 0,
      })),
    };
    const resolved = endPlayerTurn(roundTwo, archiveMission, heroDefinitions);
    expect(resolved.enemies.find((enemy) => enemy.id === hiddenId)?.revealed).toBe(false);
  });

  it('makes area attacks damage the truce objective', () => {
    const borderMission = missions.find((entry) => entry.id === 'cursed-border')!;
    const initial = createInitialBattleState('shelter', borderMission, heroDefinitions);
    const resolved = applyHeroSkill(initial, borderMission, heroDefinitions, 'raon', 'unfinished-flow');
    expect(resolved.carriageHp + resolved.carriageShield).toBe(initial.carriageHp + initial.carriageShield - 8);
  });

  it('makes temporal echoes strain every deployed hero', () => {
    const echoMission = missions.find((entry) => entry.id === 'stopped-petal')!;
    const initial = createInitialBattleState('shelter', echoMission, heroDefinitions);
    const resolved = endPlayerTurn(
      { ...initial, enemies: initial.enemies.map((enemy) => ({ ...enemy, hp: 0 })) },
      echoMission,
      heroDefinitions,
    );
    expect(resolved.heroes[0]?.hp).toBe((initial.heroes[0]?.hp ?? 0) - 5);
    expect(resolved.morale).toBe(12);
  });
});

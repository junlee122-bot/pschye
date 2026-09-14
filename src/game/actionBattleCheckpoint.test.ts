import { describe, expect, it } from 'vitest';
import { heroDefinitions } from '../data/battle';
import { missions } from '../data/campaign';
import { ACTION_ROUND_SECONDS, advanceActionRounds, createActionBattleModel, resolveActionOutcome } from './actionBattleRules';
import {
  captureActionBattleCheckpoint, createInitialActionBattleCheckpoint, isActionBattleCheckpoint,
  restoreActionBattleCheckpoint, type ActionBattleCheckpoint,
} from './actionBattleCheckpoint';

function fixture() {
  const model = createActionBattleModel({
    mission: missions[0]!, heroes: heroDefinitions, doctrine: 'counterfire', difficulty: 'standard',
    raonStance: 'resolve', warPressure: 0, bondSupport: 0,
  });
  return { model, checkpoint: createInitialActionBattleCheckpoint(model) };
}

describe('action checkpoint time and state recovery', () => {
  it('creates valid initial checkpoints for every mission and difficulty without changing the deployment', () => {
    for (const mission of missions) for (const difficulty of ['story', 'standard', 'veteran'] as const) {
      const model = createActionBattleModel({ mission, difficulty, heroes: heroDefinitions, doctrine: 'shelter', raonStance: 'insight', warPressure: 85, bondSupport: 40 });
      const checkpoint = createInitialActionBattleCheckpoint(model);
      expect(isActionBattleCheckpoint(checkpoint, model), `${mission.id}/${difficulty}`).toBe(true);
      checkpoint.battle.heroes[0].hp = 1;
      expect(model.initialState.heroes[0].hp).toBe(model.heroes[0].maxHp);
    }
  });

  it('rebases every deadline and retains damage, shields, hidden enemies, morale and consumed finisher after a long offline gap', () => {
    const { model, checkpoint } = fixture();
    checkpoint.elapsed = 13.25;
    checkpoint.player = { x: 72, y: 648, facingX: -0.6, facingY: 0.8, posture: 45, combo: 13 };
    checkpoint.timers = { light: 123, heavy: 1500, parry: 1000, dodge: 900, parryWindow: 330, dodgeWindow: 210, invulnerable: 290, combo: 1450 };
    Object.keys(checkpoint.orders).forEach((id, index) => { checkpoint.orders[id] = 8900 - index * 500; });
    checkpoint.battle.heroes[0].hp -= 17;
    checkpoint.battle.heroes[0].shield = 22;
    checkpoint.battle.carriageHp -= 4;
    checkpoint.battle.carriageShield = 31;
    checkpoint.battle.morale = 63;
    checkpoint.battle.finisherUsed = true;
    checkpoint.battle.revelationTriggered = true;
    checkpoint.battle.breakCount = 7;
    checkpoint.battle.enemies[0].revealed = false;
    checkpoint.enemies[0].telegraph = 415;
    checkpoint.enemies[0].nextAttack = 0;
    checkpoint.enemies[1].stunned = 1333;
    checkpoint.enemies[1].nextAttack = 1713;
    expect(isActionBattleCheckpoint(checkpoint, model)).toBe(true);
    const runtime = restoreActionBattleCheckpoint(checkpoint, 86_400_000);
    expect(runtime.timers.heavy).toBe(86_401_500);
    expect(runtime.enemies[0].telegraph).toBe(86_400_415);
    expect(runtime.enemies[0].nextAttack).toBe(0);
    expect(runtime.elapsed).toBe(13.25);
    expect(captureActionBattleCheckpoint(runtime, 86_400_000)).toEqual(checkpoint);
    runtime.battle.heroes[0].hp = 0;
    runtime.battle.log[0].message = 'changed runtime';
    runtime.player.x = 400;
    expect(checkpoint.battle.heroes[0].hp).toBeGreaterThan(0);
    expect(checkpoint.battle.log[0].message).not.toBe('changed runtime');
    expect(checkpoint.player.x).toBe(72);
  });

  it('only consumes simulated milliseconds and normalizes expired combos and defeated actor timers', () => {
    const { model, checkpoint } = fixture();
    checkpoint.player.combo = 4;
    checkpoint.timers.combo = 50;
    checkpoint.timers.heavy = 900;
    checkpoint.enemies[0].telegraph = 200;
    const runtime = restoreActionBattleCheckpoint(checkpoint, 5000);
    runtime.elapsed = 0.1;
    runtime.battle.enemies[0].hp = 0;
    const saved = captureActionBattleCheckpoint(runtime, 5100);
    expect(saved.player.combo).toBe(0);
    expect(saved.timers.combo).toBe(0);
    expect(saved.timers.heavy).toBe(800);
    expect(saved.enemies[0]).toMatchObject({ telegraph: 0, stunned: 0, nextAttack: 0 });
    expect(isActionBattleCheckpoint(saved, model)).toBe(true);
  });

  it('keeps a fractional frame checkpoint valid at round and maximum timer boundaries', () => {
    const { model, checkpoint } = fixture();
    for (const elapsed of [23.99999999, 24, 24.00000001]) {
      checkpoint.elapsed = elapsed;
      checkpoint.battle = advanceActionRounds(model.initialState, model, elapsed);
      const now = elapsed * 1000;
      const runtime = restoreActionBattleCheckpoint(checkpoint, now);
      runtime.timers.heavy = now + 1850;
      runtime.timers.parry = now + 1100;
      runtime.timers.parryWindow = now + 430;
      runtime.timers.dodge = now + 920;
      runtime.timers.dodgeWindow = now + 260;
      runtime.timers.invulnerable = now + 340;
      const saved = captureActionBattleCheckpoint(runtime, now);
      expect(isActionBattleCheckpoint(saved, model)).toBe(true);
    }
  });

  it('restores an unfinished attack warning without replaying damage or resetting its full warning', () => {
    const { checkpoint } = fixture();
    checkpoint.enemies[0].nextAttack = 0;
    checkpoint.enemies[0].telegraph = 7.25;
    const hp = checkpoint.battle.heroes[0].hp;
    const runtime = restoreActionBattleCheckpoint(checkpoint, 100_000);
    expect(runtime.enemies[0].telegraph).toBe(100_007.25);
    expect(runtime.battle.heroes[0].hp).toBe(hp);
    expect(captureActionBattleCheckpoint(runtime, 100_004).enemies[0].telegraph).toBe(3.25);
  });

  it('accepts valid victory, health defeat and time-limit defeat while preserving result flags', () => {
    const { model, checkpoint } = fixture();
    const victory = structuredClone(checkpoint);
    victory.battle.enemies.forEach((enemy) => { enemy.hp = 0; });
    victory.battle = resolveActionOutcome(victory.battle);
    victory.battle.finisherUsed = true;
    victory.battle.revelationTriggered = true;
    const savedVictory = captureActionBattleCheckpoint(victory, 0);
    expect(isActionBattleCheckpoint(savedVictory, model)).toBe(true);
    expect(restoreActionBattleCheckpoint(savedVictory, 3000).battle).toEqual(savedVictory.battle);
    const defeat = structuredClone(checkpoint);
    defeat.battle.carriageHp = 0;
    defeat.battle = resolveActionOutcome(defeat.battle);
    expect(isActionBattleCheckpoint(defeat, model)).toBe(true);
    const expired = structuredClone(checkpoint);
    expired.elapsed = model.mission.roundLimit * ACTION_ROUND_SECONDS;
    expired.battle = advanceActionRounds(expired.battle, model, expired.elapsed);
    expect(expired.battle.outcome).toBe('defeat');
    expect(isActionBattleCheckpoint(expired, model)).toBe(true);
  });
});

describe('action checkpoint validation', () => {
  it.each([
    ['nonfinite elapsed', (c: ActionBattleCheckpoint) => { c.elapsed = NaN; }],
    ['negative timer', (c: ActionBattleCheckpoint) => { c.timers.light = -1; }],
    ['excess cooldown', (c: ActionBattleCheckpoint) => { c.timers.heavy = 1851; }],
    ['invalid facing', (c: ActionBattleCheckpoint) => { c.player.facingX = 0; }],
    ['outside arena', (c: ActionBattleCheckpoint) => { c.player.x = 1209; }],
    ['expired combo', (c: ActionBattleCheckpoint) => { c.player.combo = 3; }],
    ['mismatched round', (c: ActionBattleCheckpoint) => { c.battle.round = 2; }],
    ['duplicate actor', (c: ActionBattleCheckpoint) => { c.enemies[1].id = c.enemies[0].id; }],
    ['unknown command', (c: ActionBattleCheckpoint) => { c.orders.unknown = 0; }],
    ['overlapping warning and stun', (c: ActionBattleCheckpoint) => { c.enemies[0].telegraph = 1; c.enemies[0].stunned = 1; }],
    ['dead actor warning', (c: ActionBattleCheckpoint) => { c.battle.enemies[0].hp = 0; c.enemies[0].telegraph = 1; }],
    ['false victory', (c: ActionBattleCheckpoint) => { c.battle.outcome = 'victory'; }],
    ['false defeat', (c: ActionBattleCheckpoint) => { c.battle.outcome = 'defeat'; }],
    ['inflated frozen health', (c: ActionBattleCheckpoint) => { c.battle.heroes[0].hp += 1; }],
    ['wrong mission', (c: ActionBattleCheckpoint) => { c.battle.missionId = 'another-operation'; }],
  ])('rejects %s without mutating its input', (_name, mutate) => {
    const { model, checkpoint } = fixture();
    mutate(checkpoint);
    const original = structuredClone(checkpoint);
    expect(isActionBattleCheckpoint(checkpoint, model)).toBe(false);
    expect(checkpoint).toEqual(original);
  });

  it('rejects malformed values and nonfinite simulation clocks', () => {
    const { checkpoint } = fixture();
    for (const value of [null, [], {}, { ...checkpoint, battle: null }, { ...checkpoint, enemies: null }]) expect(isActionBattleCheckpoint(value)).toBe(false);
    for (const now of [NaN, Infinity, -1]) {
      expect(() => captureActionBattleCheckpoint(checkpoint, now)).toThrow(RangeError);
      expect(() => restoreActionBattleCheckpoint(checkpoint, now)).toThrow(RangeError);
    }
  });
});

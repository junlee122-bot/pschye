import { getEnemyMaximumHp, getObjectiveMaximumHp } from './battleEngine';
import { ACTION_ROUND_SECONDS, type ActionBattleInput, type ActionBattleModel } from './actionBattleRules';
import type { BattleState } from '../types';

export interface ActionBattleCheckpoint {
  battle: BattleState;
  /** Time actually simulated, in seconds; wall-clock time is never replayed. */
  elapsed: number;
  player: { x: number; y: number; facingX: number; facingY: number; posture: number; combo: number };
  /** All timers below are remaining milliseconds, never performance/Date timestamps. */
  timers: { light: number; heavy: number; parry: number; dodge: number; parryWindow: number; dodgeWindow: number; invulnerable: number; combo: number };
  orders: Record<string, number>;
  enemies: Array<{ id: string; x: number; y: number; posture: number; nextAttack: number; telegraph: number; stunned: number }>;
}

/** Same fields at the scene boundary, but timer values are deadlines on its simulation clock. */
export type ActionBattleRuntimeState = ActionBattleCheckpoint;

const timerLimits = { light: 310, heavy: 1850, parry: 1100, dodge: 920, parryWindow: 430, dodgeWindow: 260, invulnerable: 620, combo: 1550 } as const;
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown, min = 0, max = 1_000_000): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max + 0.000001;
const integer = (value: unknown, min = 0, max = 1_000_000): value is number => finite(value, min, max) && Number.isInteger(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 4000;
const sameIds = (left: string[], right: string[]) => left.length === right.length && new Set(left).size === left.length && left.every((id) => right.includes(id));

export function isActionBattleCheckpoint(value: unknown, context?: ActionBattleInput): value is ActionBattleCheckpoint {
  if (!object(value) || !object(value.battle) || !object(value.player) || !object(value.timers) || !object(value.orders) || !Array.isArray(value.enemies)) return false;
  const { battle, player, timers, orders } = value;
  if (!text(battle.missionId) || !['story', 'standard', 'veteran'].includes(String(battle.difficulty))
    || !integer(battle.roundLimit, 1, 1000) || !integer(battle.round, 1, battle.roundLimit)
    || !integer(battle.commandPoints, 0, 100) || !finite(battle.morale, 0, 100)
    || !finite(battle.carriageHp) || !finite(battle.carriageShield) || !integer(battle.breakCount)
    || !['active', 'victory', 'defeat'].includes(String(battle.outcome))
    || !['compassion', 'insight', 'resolve'].includes(String(battle.raonStance))
    || typeof battle.finisherUsed !== 'boolean' || typeof battle.revelationTriggered !== 'boolean'
    || (battle.warPressure !== undefined && !finite(battle.warPressure, 0, 100))
    || (battle.bondSupport !== undefined && !finite(battle.bondSupport, 0, 100))
    || !finite(value.elapsed, 0, battle.roundLimit * ACTION_ROUND_SECONDS + 1)) return false;
  const roundLimit = battle.roundLimit;
  const validUnits = (units: unknown) => Array.isArray(units) && units.length > 0 && units.length <= 100
    && units.every((unit) => object(unit) && text(unit.id) && finite(unit.hp) && finite(unit.shield)
      && typeof unit.acted === 'boolean' && typeof unit.revealed === 'boolean' && integer(unit.exposed, 0, 3) && integer(unit.stunned, 0, 100));
  if (!validUnits(battle.heroes) || !validUnits(battle.enemies) || !Array.isArray(battle.log) || battle.log.length > 100
    || !battle.log.every((entry) => object(entry) && integer(entry.id) && integer(entry.round, 1, roundLimit)
      && text(entry.speaker) && text(entry.message) && ['system', 'hero', 'enemy', 'story'].includes(String(entry.tone)))
    || !Array.isArray(battle.focusChain) || battle.focusChain.length > 100 || !battle.focusChain.every(text)) return false;
  const state = battle as unknown as BattleState;
  const heroIds = state.heroes.map((unit) => unit.id);
  const enemyIds = state.enemies.map((unit) => unit.id);
  if (!sameIds(heroIds, heroIds) || !sameIds(enemyIds, enemyIds) || !heroIds.includes('raon')
    || (state.focusTargetId !== undefined && !enemyIds.includes(state.focusTargetId))
    || state.focusChain.some((id) => !heroIds.includes(id))) return false;
  const aliveRaon = state.heroes.find((unit) => unit.id === 'raon')!.hp > 0;
  const enemyAlive = state.enemies.some((unit) => unit.hp > 0);
  const expired = value.elapsed >= state.roundLimit * ACTION_ROUND_SECONDS;
  if (state.outcome === 'victory' && (!aliveRaon || state.carriageHp <= 0 || enemyAlive)) return false;
  if (state.outcome === 'defeat' && aliveRaon && state.carriageHp > 0 && !expired) return false;
  if (state.outcome === 'active' && (!aliveRaon || state.carriageHp <= 0 || !enemyAlive || expired)) return false;
  if (value.elapsed + 0.001 < (state.round - 1) * ACTION_ROUND_SECONDS
    || (state.outcome === 'active' && value.elapsed >= state.round * ACTION_ROUND_SECONDS)) return false;
  if (!finite(player.x, 72, 1208) || !finite(player.y, 104, 648) || !finite(player.posture, 0, 100)
    || !integer(player.combo, 0, 13) || !finite(player.facingX, -1, 1) || !finite(player.facingY, -1, 1)
    || Math.abs(Math.hypot(player.facingX, player.facingY) - 1) > 0.001
    || Object.entries(timerLimits).some(([key, max]) => !finite(timers[key], 0, max))) return false;
  if ((player.combo > 0 && timers.combo === 0) || Number(timers.parryWindow) > Number(timers.parry)
    || Number(timers.dodgeWindow) > Number(timers.invulnerable) || Number(timers.invulnerable) > Number(timers.dodge) && Number(timers.dodgeWindow) > 0) return false;
  const expectedOrders = context ? context.heroes.filter((hero) => hero.id !== 'raon' && hero.skills.length > 0).map((hero) => hero.id) : heroIds.filter((id) => id !== 'raon');
  if (!sameIds(Object.keys(orders), expectedOrders) || Object.values(orders).some((remaining) => !finite(remaining, 0, 9000))) return false;
  if (!value.enemies.every((actor) => object(actor) && text(actor.id) && finite(actor.x, 0, 1600) && finite(actor.y, 0, 720)
    && finite(actor.posture, 0, 72) && finite(actor.nextAttack, 0, 60000) && finite(actor.telegraph, 0, 880) && finite(actor.stunned, 0, 1700))) return false;
  const actors = value.enemies as ActionBattleCheckpoint['enemies'];
  if (!sameIds(actors.map((actor) => actor.id), enemyIds)) return false;
  if (actors.some((actor) => (actor.telegraph > 0 && actor.stunned > 0)
    || (state.enemies.find((unit) => unit.id === actor.id)!.hp === 0 && (actor.nextAttack > 0 || actor.telegraph > 0 || actor.stunned > 0)))) return false;
  if (context) {
    const pressure = Math.max(0, Math.min(100, context.warPressure));
    const pressureScale = pressure >= 75 ? 1.1 : pressure >= 50 ? 1.05 : 1;
    if (state.missionId !== context.mission.id || state.roundLimit !== context.mission.roundLimit || state.difficulty !== context.difficulty
      || state.raonStance !== context.raonStance || state.warPressure !== pressure || state.bondSupport !== Math.max(0, Math.min(100, context.bondSupport))
      || !sameIds(heroIds, context.heroes.map((hero) => hero.id)) || !sameIds(enemyIds, context.mission.enemies.map((enemy) => enemy.id))
      || state.carriageHp > getObjectiveMaximumHp(context.mission, context.doctrine, context.difficulty)
      || state.heroes.some((unit) => unit.hp > context.heroes.find((hero) => hero.id === unit.id)!.maxHp)
      || state.enemies.some((unit) => unit.hp > Math.round(getEnemyMaximumHp(context.mission.enemies.find((enemy) => enemy.id === unit.id)!.maxHp, context.difficulty) * pressureScale))
      || actors.some((actor) => actor.posture > (context.mission.enemies.find((enemy) => enemy.id === actor.id)!.elite ? 72 : 48))) return false;
  }
  return true;
}

function copyCheckpoint(value: ActionBattleCheckpoint): ActionBattleCheckpoint {
  return {
    ...value, battle: { ...value.battle, heroes: value.battle.heroes.map((unit) => ({ ...unit })), enemies: value.battle.enemies.map((unit) => ({ ...unit })), log: value.battle.log.map((entry) => ({ ...entry })), focusChain: [...value.battle.focusChain] },
    player: { ...value.player }, timers: { ...value.timers }, orders: { ...value.orders }, enemies: value.enemies.map((actor) => ({ ...actor })),
  };
}

/** Uses the already-created deployment model; does not initialize or mutate battle state. */
export function createInitialActionBattleCheckpoint(model: ActionBattleModel): ActionBattleCheckpoint {
  return copyCheckpoint({
    battle: model.initialState, elapsed: 0,
    player: { x: 330, y: 365, facingX: 1, facingY: 0, posture: 100, combo: 0 },
    timers: { light: 0, heavy: 0, parry: 0, dodge: 0, parryWindow: 0, dodgeWindow: 0, invulnerable: 0, combo: 0 },
    orders: Object.fromEntries(model.companions.map(({ hero }) => [hero.id, 0])),
    enemies: model.mission.enemies.map((enemy, index) => ({
      id: enemy.id, x: 790 + (index % 2) * 210 + Math.floor(index / 2) * 50, y: Math.min(610, 185 + index * 105),
      posture: enemy.elite ? 72 : 48, nextAttack: 2800 + index * 380, telegraph: 0, stunned: 0,
    })),
  });
}

/** Capture between synchronous combat resolutions. Hit animations never carry pending damage. */
export function captureActionBattleCheckpoint(runtime: ActionBattleRuntimeState, now: number): ActionBattleCheckpoint {
  if (!Number.isFinite(now) || now < 0) throw new RangeError('Action simulation time must be finite and nonnegative.');
  const copy = copyCheckpoint(runtime);
  const remaining = (deadline: number) => Math.max(0, deadline - now);
  for (const key of Object.keys(timerLimits) as Array<keyof ActionBattleCheckpoint['timers']>) copy.timers[key] = remaining(copy.timers[key]);
  copy.orders = Object.fromEntries(Object.entries(copy.orders).map(([id, deadline]) => [id, remaining(deadline)]));
  copy.enemies = copy.enemies.map((actor) => {
    const alive = copy.battle.enemies.find((unit) => unit.id === actor.id)!.hp > 0;
    return { ...actor, nextAttack: alive ? remaining(actor.nextAttack) : 0, telegraph: alive ? remaining(actor.telegraph) : 0, stunned: alive ? remaining(actor.stunned) : 0 };
  });
  if (copy.timers.combo === 0) copy.player.combo = 0;
  return copy;
}

/** Rebase only onto the new simulation clock; no saved-at/offline duration is subtracted. */
export function restoreActionBattleCheckpoint(checkpoint: ActionBattleCheckpoint, now: number): ActionBattleRuntimeState {
  if (!Number.isFinite(now) || now < 0) throw new RangeError('Action simulation time must be finite and nonnegative.');
  const copy = copyCheckpoint(checkpoint);
  const deadline = (remaining: number) => remaining > 0 ? now + remaining : 0;
  for (const key of Object.keys(timerLimits) as Array<keyof ActionBattleCheckpoint['timers']>) copy.timers[key] = deadline(copy.timers[key]);
  copy.orders = Object.fromEntries(Object.entries(copy.orders).map(([id, remaining]) => [id, deadline(remaining)]));
  copy.enemies = copy.enemies.map((actor) => ({ ...actor, nextAttack: deadline(actor.nextAttack), telegraph: deadline(actor.telegraph), stunned: deadline(actor.stunned) }));
  return copy;
}

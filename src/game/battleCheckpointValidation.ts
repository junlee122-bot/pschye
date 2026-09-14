import { heroDefinitions } from '../data/battle';
import { getMission } from '../data/campaign';
import type { BattleState, CampaignBattleAttempt, HeroDefinition, MissionDefinition } from '../types';
import { isActionBattleCheckpoint } from './actionBattleCheckpoint';
import { createInitialBattleState, getDifficultyRules, getEnemyMaximumHp, getObjectiveMaximumHp, type BattleDoctrine } from './battleEngine';

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function finite(value: unknown, min = 0, max = 1_000_000_000): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}
function integer(value: unknown, min = 0, max = 1_000_000_000): value is number {
  return finite(value, min, max) && Number.isSafeInteger(value);
}
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every((entry) => typeof entry === 'string'); }
function idsMatch(value: Array<{ id: string }>, expected: Array<{ id: string }>) {
  return value.length === expected.length && new Set(value.map((entry) => entry.id)).size === value.length
    && value.every((entry) => expected.some((item) => item.id === entry.id));
}

// JSON checkpoints contain plain data. Key order is deliberately ignored so a
// restored snapshot and the same live result compare equally.
export function sameBattleCheckpoint(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((value, index) => sameBattleCheckpoint(value, right[index]));
  if (!object(left) || !object(right)) return false;
  const keys = Object.keys(left).filter((key) => left[key] !== undefined);
  return keys.length === Object.keys(right).filter((key) => right[key] !== undefined).length
    && keys.every((key) => sameBattleCheckpoint(left[key], right[key]));
}

export function isFrozenBattleHeroes(value: unknown): value is HeroDefinition[] {
  if (!Array.isArray(value) || value.length < 4 || value.length > heroDefinitions.length || !value.some((hero) => object(hero) && hero.id === 'raon')) return false;
  const ids = new Set<string>();
  return value.every((hero: unknown) => {
    if (!object(hero) || typeof hero.id !== 'string' || ids.has(hero.id)) return false;
    ids.add(hero.id);
    const definition = heroDefinitions.find((entry) => entry.id === hero.id);
    if (!definition || !['name', 'title', 'art', 'accent'].every((key) => typeof hero[key] === 'string')
      || !finite(hero.maxHp, 1, 1_000_000) || !finite(hero.armor, 0, 1_000_000)
      || !object(hero.position) || !finite(hero.position.x, -10000, 10000) || !finite(hero.position.y, -10000, 10000)
      || !Array.isArray(hero.skills) || hero.skills.length === 0 || hero.skills.length > definition.skills.length) return false;
    const skills = new Set<string>();
    return hero.skills.every((skill: unknown) => {
      if (!object(skill) || typeof skill.id !== 'string' || skills.has(skill.id)) return false;
      skills.add(skill.id);
      const original = definition.skills.find((entry) => entry.id === skill.id);
      return Boolean(original) && typeof skill.name === 'string' && typeof skill.description === 'string'
        && skill.kind === original?.kind && skill.target === original?.target
        && finite(skill.power, 0, 1_000_000) && finite(skill.morale, 0, 100)
        && (skill.cooldown === undefined || finite(skill.cooldown, 0, 1_000_000));
    });
  });
}

export interface BattleCheckpointContext {
  mission: MissionDefinition;
  heroes: HeroDefinition[];
  difficulty?: string;
  raonStance?: string;
  warPressure?: number;
  bondSupport?: number;
  mode?: string;
  doctrine?: BattleDoctrine;
}

export function isBattleStateCheckpoint(value: unknown, context: BattleCheckpointContext): value is BattleState {
  if (!object(value) || value.missionId !== context.mission.id
    || !['story', 'standard', 'veteran'].includes(String(value.difficulty))
    || !['compassion', 'insight', 'resolve'].includes(String(value.raonStance))
    || (context.difficulty !== undefined && value.difficulty !== context.difficulty)
    || (context.raonStance !== undefined && value.raonStance !== context.raonStance)
    || !integer(value.round, 1, context.mission.roundLimit) || value.roundLimit !== context.mission.roundLimit
    || !integer(value.commandPoints, 0, 4) || !finite(value.morale, 0, 100)
    || !finite(value.carriageHp) || !finite(value.carriageShield) || !integer(value.breakCount)
    || typeof value.finisherUsed !== 'boolean' || typeof value.revelationTriggered !== 'boolean'
    || !['active', 'victory', 'defeat'].includes(String(value.outcome))
    || !strings(value.focusChain) || new Set(value.focusChain).size !== value.focusChain.length
    || !value.focusChain.every((id) => context.heroes.some((hero) => hero.id === id))
    || (value.focusTargetId !== undefined && !context.mission.enemies.some((enemy) => enemy.id === value.focusTargetId))
    || (value.warPressure !== undefined && !finite(value.warPressure, 0, 100))
    || (value.bondSupport !== undefined && !finite(value.bondSupport, 0, 100))
    || (context.warPressure !== undefined && value.warPressure !== context.warPressure)
    || (context.bondSupport !== undefined && value.bondSupport !== context.bondSupport)) return false;
  const unit = (entry: unknown) => object(entry) && typeof entry.id === 'string'
    && finite(entry.hp) && finite(entry.shield) && integer(entry.exposed) && integer(entry.stunned)
    && typeof entry.acted === 'boolean' && typeof entry.revealed === 'boolean';
  if (!Array.isArray(value.heroes) || !value.heroes.every(unit) || !Array.isArray(value.enemies) || !value.enemies.every(unit)
    || !Array.isArray(value.log) || value.log.length > 18 || !value.log.every((entry) => object(entry)
      && integer(entry.id) && integer(entry.round, 1, context.mission.roundLimit)
      && typeof entry.speaker === 'string' && typeof entry.message === 'string' && ['system', 'hero', 'enemy', 'story'].includes(String(entry.tone)))) return false;
  const state = value as unknown as BattleState;
  const pressure = context.warPressure ?? state.warPressure ?? 0;
  const pressureScale = pressure >= 75 ? 1.1 : pressure >= 50 ? 1.05 : 1;
  if (!idsMatch(state.heroes, context.heroes) || !idsMatch(state.enemies, context.mission.enemies)
    || state.heroes.some((hero) => hero.hp > context.heroes.find((entry) => entry.id === hero.id)!.maxHp)
    || state.enemies.some((enemy) => enemy.hp > Math.round(getEnemyMaximumHp(context.mission.enemies.find((entry) => entry.id === enemy.id)!.maxHp, state.difficulty) * pressureScale))
    || state.carriageHp > getObjectiveMaximumHp(context.mission, context.doctrine ?? 'shelter', state.difficulty)
    || state.commandPoints > getDifficultyRules(state.difficulty).commandPoints
    || new Set(state.log.map((entry) => entry.id)).size !== state.log.length) return false;
  const alive = context.mode === 'action' ? (state.heroes.find((hero) => hero.id === 'raon')?.hp ?? 0) > 0 : state.heroes.some((hero) => hero.hp > 0);
  const enemiesAlive = state.enemies.some((enemy) => enemy.hp > 0);
  if (state.outcome === 'victory') return state.carriageHp > 0 && alive && !enemiesAlive;
  if (state.outcome === 'active') return state.carriageHp > 0 && alive && enemiesAlive;
  return state.carriageHp === 0 || !alive || state.round === state.roundLimit;
}

export function isCampaignBattleAttempt(value: unknown): value is CampaignBattleAttempt {
  if (!object(value) || typeof value.id !== 'string' || value.id.length === 0 || value.id.length > 200
    || typeof value.missionId !== 'string' || !['shelter', 'counterfire'].includes(String(value.doctrine))
    || !['select', 'tactical', 'action'].includes(String(value.mode)) || typeof value.settled !== 'boolean'
    || !finite(value.warPressure, 0, 100) || !finite(value.bondSupport, 0, 100) || !isFrozenBattleHeroes(value.heroes)) return false;
  const mission = getMission(value.missionId);
  if (!mission) return false;
  const attempt = value as unknown as CampaignBattleAttempt;
  const context = { ...attempt, mission };
  if (!isBattleStateCheckpoint(attempt.battle, context) || (attempt.settled && attempt.battle.outcome !== 'victory')) return false;
  if (attempt.mode === 'select') return !attempt.action && !attempt.tactical && isFreshBattle(attempt);
  if (attempt.mode === 'tactical') {
    if (attempt.action) return false;
    const tactical = attempt.tactical;
    if (!tactical || !Array.isArray(tactical.history) || tactical.history.length > 8
      || !tactical.history.every((state) => object(state) && state.outcome === 'active' && isBattleStateCheckpoint(state, context))) return false;
    return attempt.heroes.some((hero) => hero.id === tactical.selectedHeroId && hero.skills.some((skill) => skill.id === tactical.selectedSkillId));
  }
  if (attempt.tactical) return false;
  if (!attempt.action) return isFreshBattle(attempt);
  return isActionBattleCheckpoint(attempt.action, context) && sameBattleCheckpoint(attempt.action.battle, attempt.battle);
}

function isFreshBattle(attempt: CampaignBattleAttempt) {
  return !attempt.settled && sameBattleCheckpoint(attempt.battle,
    createInitialBattleState(attempt.doctrine, getMission(attempt.missionId)!, attempt.heroes, attempt.difficulty, attempt.raonStance, attempt));
}

import { createInitialBattleState, getDifficultyRules, type BattleDoctrine } from './battleEngine';
import type { BattleState, HeroDefinition, MissionDefinition, MissionDifficulty, RaonStoryChoiceId, SkillDefinition } from '../types';

/** One completed 24-second action interval resolves one tactical round's battlefield rule. */
export const ACTION_ROUND_SECONDS = 24;
export const ACTION_ORDER_COOLDOWN_SECONDS = 9;
const ACTION_ENEMY_DAMAGE_SCALE = 0.72;

export interface ActionAttackTiming {
  telegraphUntil: number;
  stunnedUntil: number;
  nextAttackAt: number;
}

export function interruptActionAttack(timing: ActionAttackTiming, now: number, duration = 1700): ActionAttackTiming {
  const stunnedUntil = Math.max(timing.stunnedUntil, now + duration);
  return { telegraphUntil: 0, stunnedUntil, nextAttackAt: Math.max(timing.nextAttackAt, stunnedUntil + 380) };
}

export interface ActionBattleInput {
  mission: MissionDefinition;
  doctrine: BattleDoctrine;
  difficulty: MissionDifficulty;
  heroes: HeroDefinition[];
  raonStance: RaonStoryChoiceId;
  warPressure: number;
  bondSupport: number;
}

export interface ActionCompanion {
  hero: HeroDefinition;
  skill: SkillDefinition;
  slot: number;
}

export interface ActionBattleModel extends ActionBattleInput {
  raon: HeroDefinition;
  lightSkill: SkillDefinition;
  heavySkill: SkillDefinition;
  companions: ActionCompanion[];
  initialState: BattleState;
}

export function createActionBattleModel(input: ActionBattleInput): ActionBattleModel {
  const heroes = input.heroes.filter((hero, index, all) => all.findIndex((entry) => entry.id === hero.id) === index);
  const raon = heroes.find((hero) => hero.id === 'raon');
  if (!raon) throw new Error('액션 전투에는 라온을 출격조에 편성해야 합니다.');
  const lightSkill = raon.skills.find((skill) => skill.id === 'unfinished-flow') ?? raon.skills[0];
  const heavySkill = raon.skills.find((skill) => skill.id === 'sixteen-petals') ?? raon.skills[0];
  if (!lightSkill || !heavySkill) throw new Error('라온의 전투 기술이 없습니다.');
  return {
    ...input,
    heroes,
    raon,
    lightSkill,
    heavySkill,
    companions: heroes.filter((hero) => hero.id !== 'raon' && hero.skills.length > 0)
      .map((hero, index) => ({
        hero,
        skill: (input.mission.revelation?.heroId === hero.id
          ? hero.skills.find((skill) => skill.id === input.mission.revelation?.skillId) : undefined) ?? hero.skills[0],
        slot: index + 1,
      })),
    initialState: createInitialBattleState(input.doctrine, input.mission, heroes, input.difficulty, input.raonStance, {
      warPressure: input.warPressure,
      bondSupport: input.bondSupport,
    }),
  };
}

export function getActionAttack(model: ActionBattleModel, kind: 'light' | 'heavy' | 'parry', combo = 0) {
  const skill = kind === 'light' ? model.lightSkill : model.heavySkill;
  return {
    power: kind === 'light' ? skill.power + Math.min(12, combo) * 2
      : kind === 'heavy' ? skill.power + Math.min(36, combo * 3) : Math.round(skill.power / 3),
    posture: kind === 'light' ? 12 + Math.min(12, combo) : kind === 'heavy' ? 34 : 36,
    morale: Math.max(0, skill.morale),
  };
}

export function getActionIncomingDamage(model: ActionBattleModel, enemyId: string) {
  const enemy = model.mission.enemies.find((entry) => entry.id === enemyId);
  return enemy ? Math.round(enemy.damage * getDifficultyRules(model.difficulty).enemyDamage * ACTION_ENEMY_DAMAGE_SCALE) : 0;
}

export function getActionEnemyTarget(model: ActionBattleModel, state: BattleState, enemyId: string) {
  const enemy = model.mission.enemies.find((entry) => entry.id === enemyId);
  const unit = state.enemies.find((entry) => entry.id === enemyId);
  return (!unit?.revealed && enemy?.hidden) || enemy?.targetPreference === 'objective'
    || (enemy?.targetPreference === 'mixed' && (state.round + enemyId.length) % 2 === 0) ? 'objective' : 'raon';
}

export function addActionMorale(state: BattleState, amount: number): BattleState {
  return { ...state, morale: Math.max(0, Math.min(100, state.morale + amount)) };
}

export function damageActionObjective(state: BattleState, amount: number): BattleState {
  const absorbed = Math.min(state.carriageShield, Math.max(0, amount));
  return { ...state, carriageShield: state.carriageShield - absorbed, carriageHp: Math.max(0, state.carriageHp - Math.max(0, amount) + absorbed) };
}

export function damageActionRaon(state: BattleState, model: ActionBattleModel, amount: number): BattleState {
  if (state.outcome !== 'active' || amount <= 0) return state;
  const afterArmor = Math.max(5, amount - Math.floor(model.raon.armor / 2));
  return {
    ...state,
    heroes: state.heroes.map((hero) => hero.id === 'raon' ? {
      ...hero,
      hp: Math.max(0, hero.hp - Math.max(0, afterArmor - hero.shield)),
      shield: Math.max(0, hero.shield - afterArmor),
    } : hero),
  };
}

export function revealActionEnemy(state: BattleState, enemyId: string, exposure = 0): BattleState {
  return { ...state, enemies: state.enemies.map((enemy) => enemy.id === enemyId ? {
    ...enemy, revealed: true, exposed: Math.min(3, enemy.exposed + exposure),
  } : enemy) };
}

export function hitActionEnemy(state: BattleState, model: ActionBattleModel, enemyId: string, power: number, reveal = false): BattleState {
  if (state.outcome !== 'active') return state;
  const unit = state.enemies.find((enemy) => enemy.id === enemyId);
  const definition = model.mission.enemies.find((enemy) => enemy.id === enemyId);
  if (!unit || !definition || unit.hp <= 0 || (!unit.revealed && !reveal)) return state;
  const damage = Math.max(7, Math.round(power) - definition.armor + unit.exposed * 6);
  return { ...state, enemies: state.enemies.map((enemy) => enemy.id === enemyId ? {
    ...enemy, hp: Math.max(0, enemy.hp - damage), revealed: true,
  } : enemy) };
}

export function applyActionAreaCollateral(state: BattleState, model: ActionBattleModel, hits: number) {
  return hits > 0 && model.mission.battlefieldRule.id === 'fractured-truce' ? damageActionObjective(state, 8) : state;
}

/** The caller supplies a successful hit, or a guard performed while the named witness is present. */
export function recordActionRevelation(state: BattleState, model: ActionBattleModel, heroId: string, skillId: string, enemyId?: string): BattleState {
  const revelation = model.mission.revelation;
  if (!revelation || state.revelationTriggered || revelation.heroId !== heroId || revelation.skillId !== skillId || revelation.enemyId !== enemyId) return state;
  return {
    ...state,
    revelationTriggered: true,
    log: [...state.log, {
      id: Math.max(0, ...state.log.map((entry) => entry.id)) + 1,
      round: state.round,
      speaker: model.mission.enemies.find((enemy) => enemy.id === enemyId)?.name ?? '생존자 증언',
      message: revelation.line,
      tone: 'story' as const,
    }].slice(-18),
  };
}

export function applyActionCompanion(state: BattleState, model: ActionBattleModel, heroId: string, targetId?: string) {
  const order = model.companions.find((companion) => companion.hero.id === heroId);
  const unit = state.heroes.find((hero) => hero.id === heroId);
  if (state.outcome !== 'active' || !order || !unit || unit.hp <= 0) return state;
  const { skill } = order;
  let next = state;
  if (skill.kind === 'guard') {
    next = { ...state, carriageShield: state.carriageShield + skill.power };
  } else if (skill.kind === 'area') {
    const targets = state.enemies.filter((enemy) => enemy.hp > 0 && enemy.revealed);
    if (!targets.length) return state;
    for (const target of targets) next = hitActionEnemy(next, model, target.id, skill.power);
    next = applyActionAreaCollateral(next, model, targets.length);
  } else {
    const target = state.enemies.find((enemy) => enemy.id === targetId);
    if (!target || target.hp <= 0 || (!target.revealed && skill.kind !== 'reveal')) return state;
    next = hitActionEnemy(state, model, target.id, skill.power, skill.kind === 'reveal');
    if (next === state) return state;
    if (skill.kind === 'reveal' || skill.id === 'duel-mark') {
      next = revealActionEnemy(next, target.id, skill.kind === 'reveal' ? 2 : 1);
    }
    if (skill.id === 'ground-break') next = {
      ...next, enemies: next.enemies.map((enemy) => enemy.id === target.id ? { ...enemy, stunned: Math.max(1, enemy.stunned) } : enemy),
    };
    if (skill.id === 'silent-counter') next = {
      ...next, heroes: next.heroes.map((hero) => hero.id === heroId ? { ...hero, shield: hero.shield + 16 } : hero),
    };
  }
  const witness = state.enemies.find((enemy) => enemy.id === targetId && enemy.hp > 0 && enemy.revealed);
  if (skill.kind !== 'guard' || witness) next = recordActionRevelation(next, model, heroId, skill.id, targetId);
  return addActionMorale(next, skill.morale);
}

export function applyActionFinisher(state: BattleState, model: ActionBattleModel) {
  if (state.outcome !== 'active' || state.finisherUsed || state.morale < 100) return state;
  let next = { ...state, morale: 0, finisherUsed: true };
  const targets = state.enemies.filter((enemy) => enemy.hp > 0);
  const power = model.lightSkill.power + model.heavySkill.power;
  for (const target of targets) next = hitActionEnemy(next, model, target.id, power, true);
  return applyActionAreaCollateral(next, model, targets.length);
}

/** Loss takes precedence when an area action destroys the objective and the last enemy together. */
export function resolveActionOutcome(state: BattleState): BattleState {
  if (state.outcome !== 'active') return state;
  const raon = state.heroes.find((hero) => hero.id === 'raon');
  const outcome = !raon || raon.hp <= 0 || state.carriageHp <= 0 ? 'defeat'
    : state.enemies.every((enemy) => enemy.hp <= 0) ? 'victory' : 'active';
  return outcome === 'active' ? state : { ...state, outcome };
}

/** Resolve only the environment phase; live enemy attacks are handled by the action scene. */
export function resolveActionRoundEnd(state: BattleState, model: ActionBattleModel): BattleState {
  if (state.outcome !== 'active') return state;
  let next = state;
  const rule = model.mission.battlefieldRule.id;
  if (rule === 'aerial-barrage' && next.enemies.some((enemy) => enemy.id === 'sky-battery-core' && enemy.hp > 0)) {
    next = damageActionObjective(next, Math.round(12 * getDifficultyRules(model.difficulty).enemyDamage));
  }
  if (rule === 'temporal-echo') {
    next = addActionMorale({ ...next, heroes: next.heroes.map((hero) => ({ ...hero, hp: Math.max(0, hero.hp - 5) })) }, 12);
  }
  if (rule === 'archive-seal' && state.round % 2 === 0) {
    const hiddenIds = new Set(model.mission.enemies.filter((enemy) => enemy.hidden).map((enemy) => enemy.id));
    next = { ...next, enemies: next.enemies.map((enemy) => hiddenIds.has(enemy.id) && enemy.hp > 0 && enemy.exposed === 0
      ? { ...enemy, revealed: false } : enemy) };
  }
  next = resolveActionOutcome(next);
  if (next.outcome !== 'active') return next;
  if (state.round >= model.mission.roundLimit) return { ...next, outcome: 'defeat' };
  return { ...next, round: state.round + 1, enemies: next.enemies.map((enemy) => ({ ...enemy, exposed: Math.max(0, enemy.exposed - 1) })) };
}

export function advanceActionRounds(state: BattleState, model: ActionBattleModel, elapsedSeconds: number): BattleState {
  let next = state;
  while (next.outcome === 'active' && elapsedSeconds >= next.round * ACTION_ROUND_SECONDS) next = resolveActionRoundEnd(next, model);
  return next;
}

export function getActionRuleDescription(mission: MissionDefinition) {
  const rule = {
    standard: mission.battlefieldRule.description,
    'aerial-barrage': '24초마다 살아 있는 공중 포대 핵이 목표에 추가 포격을 가합니다.',
    'archive-seal': '48초마다 노출이 없는 은폐 적이 다시 숨습니다. 노출은 24초마다 1 감소합니다.',
    'fractured-truce': '광역 연계가 적을 맞히면 중립 구역에 8 피해가 발생합니다.',
    'temporal-echo': '24초마다 편성 전원이 생명 5를 잃고 사기 12를 얻습니다.',
  }[mission.battlefieldRule.id];
  return `${rule} 24초 = 1라운드 · 제한 ${mission.roundLimit * ACTION_ROUND_SECONDS}초 (${mission.roundLimit}라운드).`;
}

export function buildActionBattleResult(state: BattleState, breakCount: number): BattleState {
  return { ...resolveActionOutcome(state), breakCount };
}

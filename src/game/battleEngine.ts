import type {
  BattleLogEntry,
  BattleState,
  BattleUnitState,
  HeroDefinition,
  MissionDifficulty,
  MissionDefinition,
  RaonStoryChoiceId,
  SkillDefinition,
} from '../types';

export type BattleDoctrine = 'shelter' | 'counterfire';

export interface BattleContextModifiers {
  warPressure?: number;
  bondSupport?: number;
}

export interface FocusPreview {
  chain: string[];
  level: number;
  multiplier: number;
  breakTriggered: boolean;
}

export interface EnemyIntent {
  enemyId: string;
  type: 'objective' | 'hero' | 'blocked';
  targetId?: string;
  targetLabel: string;
  rawDamage: number;
  damage: number;
}

export interface ThreatForecast {
  objectiveDamage: number;
  heroDamage: Record<string, number>;
  priorityEnemyId?: string;
  totalDamage: number;
}

export const battleDifficultyOptions: Array<{
  id: MissionDifficulty;
  label: string;
  subtitle: string;
  description: string;
}> = [
  { id: 'story', label: '기록', subtitle: '서사 중심', description: '지휘점 4 · 아군 목표 강화 · 적 공격 약화' },
  { id: 'standard', label: '정규', subtitle: '권장 경험', description: '원래 전장 규칙과 보상을 그대로 적용' },
  { id: 'veteran', label: '생환', subtitle: '고난도', description: '적 생명·공격 강화 · 전리품과 명성 추가' },
];

export function getDifficultyRules(difficulty: MissionDifficulty) {
  return {
    story: { commandPoints: 4, enemyHp: 0.85, enemyDamage: 0.82, objectiveHp: 26, objectiveShield: 8 },
    standard: { commandPoints: 3, enemyHp: 1, enemyDamage: 1, objectiveHp: 0, objectiveShield: 0 },
    veteran: { commandPoints: 3, enemyHp: 1.1, enemyDamage: 1.1, objectiveHp: 10, objectiveShield: 4 },
  }[difficulty];
}

export function getEnemyMaximumHp(maxHp: number, difficulty: MissionDifficulty) {
  return Math.round(maxHp * getDifficultyRules(difficulty).enemyHp);
}

export function getObjectiveMaximumHp(
  mission: MissionDefinition,
  doctrine: BattleDoctrine,
  difficulty: MissionDifficulty,
) {
  return mission.objectiveBaseHp + (doctrine === 'shelter' ? 17 : 0) + getDifficultyRules(difficulty).objectiveHp;
}

function createUnit(id: string, maxHp: number, revealed = true): BattleUnitState {
  return {
    id,
    hp: maxHp,
    shield: 0,
    acted: false,
    exposed: 0,
    stunned: 0,
    revealed,
  };
}

function addLog(
  state: BattleState,
  speaker: string,
  message: string,
  tone: BattleLogEntry['tone'],
): BattleState {
  return {
    ...state,
    log: [
      ...state.log,
      { id: Math.max(0, ...state.log.map((entry) => entry.id)) + 1, round: state.round, speaker, message, tone },
    ].slice(-18),
  };
}

export function createInitialBattleState(
  doctrine: BattleDoctrine,
  mission: MissionDefinition,
  heroes: HeroDefinition[],
  difficulty: MissionDifficulty = 'standard',
  raonStance?: RaonStoryChoiceId,
  context: BattleContextModifiers = {},
): BattleState {
  const shelter = doctrine === 'shelter';
  const difficultyRules = getDifficultyRules(difficulty);
  const resolvedStance = raonStance ?? 'resolve';
  const warPressure = Math.max(0, Math.min(100, context.warPressure ?? 0));
  const bondSupport = Math.max(0, Math.min(100, context.bondSupport ?? 0));
  const pressureMoralePenalty = warPressure >= 75 ? 20 : warPressure >= 50 ? 10 : 0;
  const bondMoraleBonus = bondSupport >= 60 ? 15 : bondSupport >= 30 ? 8 : bondSupport >= 10 ? 4 : 0;
  const bondShieldBonus = bondSupport >= 60 ? 16 : bondSupport >= 30 ? 8 : 0;
  const pressureEnemyScale = warPressure >= 75 ? 1.1 : warPressure >= 50 ? 1.05 : 1;
  return {
    missionId: mission.id,
    difficulty,
    round: 1,
    roundLimit: mission.roundLimit,
    commandPoints: difficultyRules.commandPoints,
    morale: Math.max(0, Math.min(100, (shelter ? 0 : 25) + (raonStance === 'resolve' ? 20 : 0) + bondMoraleBonus - pressureMoralePenalty)),
    carriageHp: getObjectiveMaximumHp(mission, doctrine, difficulty),
    carriageShield: (shelter ? 18 : 0) + difficultyRules.objectiveShield + (raonStance === 'compassion' ? 24 : 0) + bondShieldBonus,
    heroes: heroes.map((hero) => createUnit(hero.id, hero.maxHp)),
    enemies: mission.enemies.map((enemy) => ({
      ...createUnit(enemy.id, Math.round(getEnemyMaximumHp(enemy.maxHp, difficulty) * pressureEnemyScale), !enemy.hidden),
      exposed: raonStance === 'insight' && !enemy.hidden ? 1 : 0,
    })),
    log: [
      {
        id: 1,
        round: 1,
        speaker: '작전 기록',
        message: shelter
          ? '하도리의 제안으로 마차 장갑을 보강했다. 호송대가 버틸 시간이 늘어난다.'
          : '크리스의 제안으로 선행 정찰을 보냈다. 제7기의 사기가 상승한다.',
        tone: 'story',
      },
    ],
    outcome: 'active',
    finisherUsed: false,
    revelationTriggered: false,
    focusTargetId: undefined,
    focusChain: [],
    breakCount: 0,
    raonStance: resolvedStance,
    warPressure,
    bondSupport,
  };
}

function calculateDamage(power: number, armor: number, exposed: number) {
  return Math.max(7, power - armor + exposed * 6);
}

export function getFocusPreview(
  state: BattleState,
  heroId: string,
  targetId: string,
): FocusPreview {
  const continues = state.focusTargetId === targetId;
  const existing = continues ? state.focusChain : [];
  const chain = existing.includes(heroId) ? existing : [...existing, heroId];
  const level = Math.min(3, chain.length);
  return {
    chain,
    level,
    multiplier: 1 + Math.max(0, level - 1) * 0.18,
    breakTriggered: level >= 3 && existing.length < 3,
  };
}

export function getSkillDamagePreview(
  state: BattleState,
  mission: MissionDefinition,
  heroes: HeroDefinition[],
  heroId: string,
  skillId: string,
  targetId: string,
) {
  const target = state.enemies.find((enemy) => enemy.id === targetId);
  const enemyDefinition = mission.enemies.find((enemy) => enemy.id === targetId);
  const skill = heroes.find((hero) => hero.id === heroId)?.skills.find((entry) => entry.id === skillId);
  if (!target || !enemyDefinition || !skill || target.hp <= 0) return null;
  if (!target.revealed && skill.kind !== 'reveal') return null;
  const focus = getFocusPreview(state, heroId, targetId);
  const baseDamage = calculateDamage(skill.power, enemyDefinition.armor, target.exposed);
  const damage = Math.round(baseDamage * focus.multiplier) + (focus.breakTriggered ? 18 : 0);
  return { damage, baseDamage, focus };
}

function updateEnemy(
  state: BattleState,
  enemyId: string,
  updater: (unit: BattleUnitState) => BattleUnitState,
) {
  return {
    ...state,
    enemies: state.enemies.map((enemy) =>
      enemy.id === enemyId ? updater(enemy) : enemy,
    ),
  };
}

function updateHero(
  state: BattleState,
  heroId: string,
  updater: (unit: BattleUnitState) => BattleUnitState,
) {
  return {
    ...state,
    heroes: state.heroes.map((hero) =>
      hero.id === heroId ? updater(hero) : hero,
    ),
  };
}

function markHeroActed(state: BattleState, heroId: string, morale: number) {
  const updated = updateHero(state, heroId, (hero) => ({ ...hero, acted: true }));
  return {
    ...updated,
    commandPoints: Math.max(0, updated.commandPoints - 1),
    morale: Math.min(100, updated.morale + morale),
  };
}

function resolveTargetedSkill(
  state: BattleState,
  mission: MissionDefinition,
  heroes: HeroDefinition[],
  heroId: string,
  skill: SkillDefinition,
  targetId: string,
) {
  const target = state.enemies.find((enemy) => enemy.id === targetId);
  const enemyDefinition = mission.enemies.find((enemy) => enemy.id === targetId);
  const heroDefinition = heroes.find((hero) => hero.id === heroId);
  if (!target || !enemyDefinition || !heroDefinition || target.hp <= 0) return state;

  if (!target.revealed && skill.kind !== 'reveal') {
    return addLog(
      state,
      '전술 경고',
      '표적의 정확한 위치가 확인되지 않았다. 크리스의 측면 유도가 필요하다.',
      'system',
    );
  }

  const preview = getSkillDamagePreview(state, mission, heroes, heroId, skill.id, targetId);
  if (!preview) return state;
  const { damage, focus } = preview;
  let updated = updateEnemy(state, targetId, (enemy) => ({
    ...enemy,
    hp: Math.max(0, enemy.hp - damage),
    revealed: true,
    exposed:
      skill.id === 'duel-mark'
        ? Math.min(3, enemy.exposed + 1)
        : skill.kind === 'reveal'
          ? Math.min(3, enemy.exposed + 2)
          : enemy.exposed,
    stunned: skill.id === 'ground-break' || focus.breakTriggered ? Math.max(1, enemy.stunned) : enemy.stunned,
  }));

  updated = {
    ...updated,
    focusTargetId: targetId,
    focusChain: focus.chain,
  };

  if (skill.id === 'valder-pierce') {
    updated = updateHero(updated, heroId, (hero) => ({
      ...hero,
      hp: Math.max(1, hero.hp - 12),
    }));
  }

  if (skill.id === 'silent-counter') {
    updated = updateHero(updated, heroId, (hero) => ({
      ...hero,
      shield: hero.shield + 16,
    }));
  }

  updated = markHeroActed(updated, heroId, skill.morale);
  updated = addLog(
    updated,
    heroDefinition.name,
    `${skill.name} — ${enemyDefinition.name}에게 ${damage} 피해${focus.level > 1 ? ` · 집중 연계 ${focus.level}` : ''}.`,
    'hero',
  );

  if (focus.breakTriggered) {
    updated = {
      ...updated,
      morale: Math.min(100, updated.morale + 20),
      breakCount: updated.breakCount + 1,
    };
    updated = addLog(
      updated,
      '집중 파쇄',
      `${enemyDefinition.name}의 자세가 무너졌다. 다음 행동이 봉쇄되고 사기 20을 얻었다.`,
      'story',
    );
  }

  if (
    mission.revelation?.heroId === heroId &&
    mission.revelation.skillId === skill.id &&
    mission.revelation.enemyId === targetId &&
    !updated.revelationTriggered
  ) {
    updated = {
      ...updated,
      revelationTriggered: true,
    };
    updated = addLog(
      updated,
      enemyDefinition.name,
      mission.revelation.line,
      'story',
    );
  }

  return checkOutcome(updated, mission);
}

function resolveAreaSkill(
  state: BattleState,
  mission: MissionDefinition,
  heroes: HeroDefinition[],
  heroId: string,
  skill: SkillDefinition,
) {
  const heroDefinition = heroes.find((hero) => hero.id === heroId);
  if (!heroDefinition) return state;
  let hits = 0;
  const enemies = state.enemies.map((enemy) => {
    const enemyDefinition = mission.enemies.find((entry) => entry.id === enemy.id);
    if (!enemyDefinition || !enemy.revealed || enemy.hp <= 0) return enemy;
    hits += 1;
    const damage = calculateDamage(skill.power, enemyDefinition.armor, enemy.exposed);
    return { ...enemy, hp: Math.max(0, enemy.hp - damage) };
  });
  let updated = markHeroActed({ ...state, enemies }, heroId, skill.morale);
  updated = addLog(
    updated,
    heroDefinition.name,
    `${skill.name} — 확인된 적 ${hits}명에게 검로가 번졌다.`,
    'hero',
  );
  if (mission.battlefieldRule.id === 'fractured-truce' && hits > 0) {
    updated = damageObjective(
      updated,
      mission.objectiveLabel,
      8,
      '깨진 휴전선',
    );
    updated = addLog(
      updated,
      '전장 규칙',
      '광역 체능의 여파가 중립 구역까지 흔들었다. 모든 공격은 외교적 대가를 남긴다.',
      'story',
    );
  }
  return checkOutcome(updated, mission);
}

function resolveGuardSkill(
  state: BattleState,
  mission: MissionDefinition,
  heroes: HeroDefinition[],
  heroId: string,
  skill: SkillDefinition,
) {
  const heroDefinition = heroes.find((hero) => hero.id === heroId);
  if (!heroDefinition) return state;
  let updated = markHeroActed(
    { ...state, carriageShield: state.carriageShield + skill.power },
    heroId,
    skill.morale,
  );
  updated = addLog(
    updated,
    heroDefinition.name,
    `${skill.name} — ${mission.objectiveLabel}에 ${skill.power} 방벽을 전개했다.`,
    'hero',
  );
  const revelation = mission.revelation;
  const witness = updated.enemies.find((enemy) => enemy.id === revelation?.enemyId);
  const witnessDefinition = mission.enemies.find((enemy) => enemy.id === revelation?.enemyId);
  if (
    revelation?.heroId === heroId
    && revelation.skillId === skill.id
    && witness && witness.hp > 0 && witness.revealed
    && witnessDefinition
    && !updated.revelationTriggered
  ) {
    updated = { ...updated, revelationTriggered: true };
    updated = addLog(updated, witnessDefinition.name, revelation.line, 'story');
  }
  return updated;
}

export function applyHeroSkill(
  state: BattleState,
  mission: MissionDefinition,
  heroes: HeroDefinition[],
  heroId: string,
  skillId: string,
  targetId?: string,
): BattleState {
  if (state.outcome !== 'active' || state.commandPoints <= 0) return state;
  const heroState = state.heroes.find((hero) => hero.id === heroId);
  const heroDefinition = heroes.find((hero) => hero.id === heroId);
  const skill = heroDefinition?.skills.find((entry) => entry.id === skillId);
  if (!heroState || !heroDefinition || !skill || heroState.hp <= 0 || heroState.acted) {
    return state;
  }
  if (skill.kind === 'guard') return resolveGuardSkill(state, mission, heroes, heroId, skill);
  if (skill.kind === 'area') return resolveAreaSkill(state, mission, heroes, heroId, skill);
  if (!targetId) return state;
  return resolveTargetedSkill(state, mission, heroes, heroId, skill, targetId);
}

function damageObjective(
  state: BattleState,
  objectiveLabel: string,
  amount: number,
  attacker: string,
) {
  const absorbed = Math.min(state.carriageShield, amount);
  const damage = amount - absorbed;
  return addLog(
    {
      ...state,
      carriageShield: state.carriageShield - absorbed,
      carriageHp: Math.max(0, state.carriageHp - damage),
    },
    attacker,
    `${objectiveLabel}에 ${damage} 피해${absorbed > 0 ? ` · 방벽 ${absorbed} 흡수` : ''}.`,
    'enemy',
  );
}

function damageHero(
  state: BattleState,
  heroes: HeroDefinition[],
  heroId: string,
  amount: number,
  attacker: string,
) {
  const heroDefinition = heroes.find((hero) => hero.id === heroId);
  const heroState = state.heroes.find((hero) => hero.id === heroId);
  if (!heroDefinition || !heroState) return state;
  const afterArmor = Math.max(5, amount - Math.floor(heroDefinition.armor / 2));
  const absorbed = Math.min(heroState.shield, afterArmor);
  const damage = afterArmor - absorbed;
  const updated = updateHero(state, heroId, (hero) => ({
    ...hero,
    shield: hero.shield - absorbed,
    hp: Math.max(0, hero.hp - damage),
  }));
  return addLog(
    updated,
    attacker,
    `${heroDefinition.name}에게 ${damage} 피해${absorbed > 0 ? ` · 방벽 ${absorbed} 흡수` : ''}.`,
    'enemy',
  );
}

export function getEnemyIntents(
  state: BattleState,
  mission: MissionDefinition,
  heroes: HeroDefinition[],
): EnemyIntent[] {
  const difficultyRules = getDifficultyRules(state.difficulty);
  const livingHeroes = state.heroes.filter((hero) => hero.hp > 0);

  return state.enemies.flatMap((enemy): EnemyIntent[] => {
    if (enemy.hp <= 0) return [];
    const enemyDefinition = mission.enemies.find((entry) => entry.id === enemy.id);
    if (!enemyDefinition) return [];
    if (enemy.stunned > 0) {
      return [{
        enemyId: enemy.id,
        type: 'blocked' as const,
        targetLabel: '행동 봉쇄',
        rawDamage: 0,
        damage: 0,
      }];
    }

    const rawDamage = Math.round(enemyDefinition.damage * difficultyRules.enemyDamage);
    const attacksObjective = !enemy.revealed && enemyDefinition.hidden
      ? true
      : enemyDefinition.targetPreference === 'objective'
        || (enemyDefinition.targetPreference === 'mixed' && (state.round + enemy.id.length) % 2 === 0);
    if (attacksObjective || livingHeroes.length === 0) {
      return [{
        enemyId: enemy.id,
        type: 'objective' as const,
        targetLabel: mission.objectiveLabel,
        rawDamage,
        damage: Math.max(0, rawDamage - state.carriageShield),
      }];
    }

    const targetIndex = (state.round + enemy.id.length) % livingHeroes.length;
    const target = livingHeroes[targetIndex] ?? livingHeroes[0];
    const heroDefinition = heroes.find((hero) => hero.id === target?.id);
    if (!target || !heroDefinition) return [];
    const afterArmor = Math.max(5, rawDamage - Math.floor(heroDefinition.armor / 2));
    return [{
      enemyId: enemy.id,
      type: 'hero' as const,
      targetId: target.id,
      targetLabel: heroDefinition.name,
      rawDamage,
      damage: Math.max(0, afterArmor - target.shield),
    }];
  });
}

export function getThreatForecast(
  state: BattleState,
  mission: MissionDefinition,
  heroes: HeroDefinition[],
): ThreatForecast {
  const intents = getEnemyIntents(state, mission, heroes);
  const heroDamage: Record<string, number> = {};
  let objectiveDamage = intents
    .filter((intent) => intent.type === 'objective')
    .reduce((total, intent) => total + intent.rawDamage, 0);
  for (const intent of intents) {
    if (intent.type === 'hero' && intent.targetId) {
      heroDamage[intent.targetId] = (heroDamage[intent.targetId] ?? 0) + intent.damage;
    }
  }
  if (
    mission.battlefieldRule.id === 'aerial-barrage'
    && state.enemies.some((enemy) => enemy.id === 'sky-battery-core' && enemy.hp > 0)
  ) {
    objectiveDamage += Math.round(12 * getDifficultyRules(state.difficulty).enemyDamage);
  }
  const priorityEnemyId = intents
    .filter((intent) => intent.type !== 'blocked')
    .sort((left, right) => (
      (right.type === 'objective' ? right.rawDamage + 12 : right.damage)
      - (left.type === 'objective' ? left.rawDamage + 12 : left.damage)
    ))[0]?.enemyId;
  return {
    objectiveDamage,
    heroDamage,
    priorityEnemyId,
    totalDamage: objectiveDamage + Object.values(heroDamage).reduce((total, damage) => total + damage, 0),
  };
}

export function endPlayerTurn(
  state: BattleState,
  mission: MissionDefinition,
  heroes: HeroDefinition[],
): BattleState {
  if (state.outcome !== 'active') return state;
  let updated = state;
  const difficultyRules = getDifficultyRules(state.difficulty);
  const intents = getEnemyIntents(state, mission, heroes);

  for (const intent of intents) {
    const enemy = updated.enemies.find((entry) => entry.id === intent.enemyId);
    if (!enemy) continue;
    if (enemy.hp <= 0) continue;
    const enemyDefinition = mission.enemies.find((entry) => entry.id === enemy.id);
    if (!enemyDefinition) continue;
    if (intent.type === 'blocked') {
      updated = updateEnemy(updated, enemy.id, (unit) => ({
        ...unit,
        stunned: unit.stunned - 1,
      }));
      updated = addLog(updated, enemyDefinition.name, '지반 충격으로 행동하지 못했다.', 'enemy');
      continue;
    }

    if (intent.type === 'objective') {
      updated = damageObjective(updated, mission.objectiveLabel, intent.rawDamage, enemyDefinition.name);
    } else {
      const intendedTarget = updated.heroes.find((hero) => hero.id === intent.targetId && hero.hp > 0);
      const fallbackTarget = updated.heroes.find((hero) => hero.hp > 0);
      const target = intendedTarget ?? fallbackTarget;
      if (target) {
        updated = damageHero(updated, heroes, target.id, intent.rawDamage, enemyDefinition.name);
      }
    }

    if (enemyDefinition.hidden && !enemy.revealed) {
      updated = updateEnemy(updated, enemy.id, (unit) => ({ ...unit, revealed: true }));
      updated = addLog(
        updated,
        '크리스',
        `탄도 확인. ${enemyDefinition.title}의 사선이 드러났어.`,
        'hero',
      );
    }
  }

  if (
    mission.battlefieldRule.id === 'aerial-barrage'
    && updated.enemies.some((enemy) => enemy.id === 'sky-battery-core' && enemy.hp > 0)
  ) {
    updated = damageObjective(updated, mission.objectiveLabel, Math.round(12 * difficultyRules.enemyDamage), '공중 포대 핵');
    updated = addLog(
      updated,
      '전장 규칙',
      '공중 포대 핵이 살아 있는 동안 매 라운드 목표 지점에 포격이 누적된다.',
      'system',
    );
  }

  if (mission.battlefieldRule.id === 'temporal-echo') {
    updated = {
      ...updated,
      heroes: updated.heroes.map((hero) => ({ ...hero, hp: Math.max(0, hero.hp - 5) })),
      morale: Math.min(100, updated.morale + 12),
    };
    updated = addLog(
      updated,
      '멈춘 꽃잎',
      '기억의 시간이 육체를 깎아내린다. 모든 생존자가 5 피해를 받고 사기 12를 얻었다.',
      'story',
    );
  }

  if (mission.battlefieldRule.id === 'archive-seal' && updated.round % 2 === 0) {
    const hiddenIds = new Set(
      mission.enemies.filter((enemy) => enemy.hidden).map((enemy) => enemy.id),
    );
    updated = {
      ...updated,
      enemies: updated.enemies.map((enemy) => (
        hiddenIds.has(enemy.id) && enemy.hp > 0 && enemy.exposed === 0
          ? { ...enemy, revealed: false }
          : enemy
      )),
    };
    updated = addLog(
      updated,
      '바이올렛 봉인식',
      '짝수 라운드의 봉인이 닫혔다. 노출되지 않은 잠입조가 다시 기록 사이로 숨는다.',
      'system',
    );
  }

  updated = checkOutcome(updated, mission);
  if (updated.outcome !== 'active') return updated;
  if (updated.round >= mission.roundLimit) {
    return addLog(
      { ...updated, outcome: 'defeat' },
      '작전 실패',
      mission.defeatText,
      'system',
    );
  }

  const nextRound = updated.round + 1;
  updated = {
    ...updated,
    round: nextRound,
    commandPoints: difficultyRules.commandPoints,
    heroes: updated.heroes.map((hero) => ({
      ...hero,
      acted: false,
      exposed: Math.max(0, hero.exposed - 1),
    })),
    enemies: updated.enemies.map((enemy) => ({
      ...enemy,
      exposed: Math.max(0, enemy.exposed - 1),
    })),
    focusTargetId: undefined,
    focusChain: [],
  };
  return addLog(
    updated,
    '작전 기록',
    `라운드 ${nextRound}. 남은 지휘점 ${difficultyRules.commandPoints}.`,
    'system',
  );
}

export function triggerTeamFinisher(
  state: BattleState,
  mission: MissionDefinition,
): BattleState {
  if (state.outcome !== 'active' || state.morale < 100 || state.finisherUsed) return state;
  const enemies = state.enemies.map((enemy) => {
    if (enemy.hp <= 0) return enemy;
    const enemyDefinition = mission.enemies.find((entry) => entry.id === enemy.id);
    if (!enemyDefinition) return enemy;
    const damage = calculateDamage(62, enemyDefinition.armor, enemy.exposed + 1);
    return {
      ...enemy,
      hp: Math.max(0, enemy.hp - damage),
      revealed: true,
      exposed: Math.min(3, enemy.exposed + 1),
    };
  });
  let updated = {
    ...state,
    enemies,
    morale: 0,
    finisherUsed: true,
  };
  updated = addLog(
    updated,
    '프시케 제7기',
    '연계 전술 「새벽의 여섯 궤도」 — 누구도 혼자 구원자가 되지 않는다.',
    'story',
  );
  return checkOutcome(updated, mission);
}

function checkOutcome(state: BattleState, mission: MissionDefinition): BattleState {
  if (state.carriageHp <= 0 || state.heroes.every((hero) => hero.hp <= 0)) {
    return addLog({ ...state, outcome: 'defeat' }, '작전 실패', mission.defeatText, 'system');
  }
  if (state.enemies.every((enemy) => enemy.hp <= 0)) {
    return addLog(
      { ...state, outcome: 'victory' },
      '작전 성공',
      mission.victoryText,
      'story',
    );
  }
  return state;
}

import type {
  BattleState,
  HeroDefinition,
  MissionDefinition,
} from '../types';
import { getSkillDamagePreview, getThreatForecast } from './battleEngine';

export interface BattleRecommendation {
  heroId: string;
  skillId: string;
  targetId?: string;
  reason: string;
}

function getReadyHeroes(battle: BattleState, heroes: HeroDefinition[]) {
  return heroes.filter((hero) => battle.heroes.some(
    (unit) => unit.id === hero.id && unit.hp > 0 && !unit.acted,
  ));
}

function getBestStrike(
  battle: BattleState,
  mission: MissionDefinition,
  heroes: HeroDefinition[],
  targetId: string,
) {
  return getReadyHeroes(battle, heroes)
    .flatMap((hero) => hero.skills.map((skill) => {
      if (skill.target !== 'enemy') return undefined;
      const preview = getSkillDamagePreview(
        battle,
        mission,
        heroes,
        hero.id,
        skill.id,
        targetId,
      );
      return preview ? { hero, skill, damage: preview.damage } : undefined;
    }))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((left, right) => right.damage - left.damage)[0];
}

export function getBattleRecommendation(
  battle: BattleState,
  mission: MissionDefinition,
  heroes: HeroDefinition[],
): BattleRecommendation | undefined {
  const readyHeroes = getReadyHeroes(battle, heroes);
  const threatForecast = getThreatForecast(battle, mission, heroes);
  const hiddenEnemy = battle.enemies.find((enemy) => enemy.hp > 0 && !enemy.revealed);
  const chris = readyHeroes.find((hero) => hero.id === 'chris');
  const revealSkill = chris?.skills.find((skill) => skill.kind === 'reveal');

  if (hiddenEnemy && chris && revealSkill) {
    return {
      heroId: chris.id,
      skillId: revealSkill.id,
      targetId: hiddenEnemy.id,
      reason: '숨은 사선을 먼저 드러내 브레이크 경로를 엽니다.',
    };
  }

  const incomingObjectiveDamage = Math.max(
    0,
    threatForecast.objectiveDamage - battle.carriageShield,
  );
  const objectiveAtRisk = incomingObjectiveDamage >= battle.carriageHp
    || (
      battle.carriageHp <= mission.objectiveBaseHp * 0.38
      && incomingObjectiveDamage >= Math.max(18, battle.carriageHp * 0.22)
    );
  if (objectiveAtRisk) {
    const guardian = readyHeroes.find((hero) => hero.skills.some((skill) => skill.kind === 'guard'));
    const guardSkill = guardian?.skills.find((skill) => skill.kind === 'guard');
    if (guardian && guardSkill) {
      return {
        heroId: guardian.id,
        skillId: guardSkill.id,
        reason: `${mission.objectiveLabel}이 다음 공격에 붕괴할 수 있습니다. 방벽으로 생존선을 확보합니다.`,
      };
    }
  }

  const currentTarget = battle.enemies.find(
    (enemy) => enemy.id === battle.focusTargetId && enemy.hp > 0,
  );
  if (currentTarget && battle.focusChain.length < 3) {
    const linker = readyHeroes.find((hero) => (
      !battle.focusChain.includes(hero.id)
      && hero.skills.some(
        (skill) => skill.target === 'enemy' && (currentTarget.revealed || skill.kind === 'reveal'),
      )
    ));
    const linkSkill = linker?.skills.find(
      (skill) => skill.target === 'enemy' && (currentTarget.revealed || skill.kind === 'reveal'),
    );
    if (linker && linkSkill) {
      return {
        heroId: linker.id,
        skillId: linkSkill.id,
        targetId: currentTarget.id,
        reason: `집중 연계 ${battle.focusChain.length + 1}/3. 같은 적을 이어 브레이크를 완성합니다.`,
      };
    }
  }

  const visibleEnemies = battle.enemies.filter((enemy) => enemy.hp > 0 && enemy.revealed);
  const lethalTarget = visibleEnemies
    .map((enemy) => ({ enemy, strike: getBestStrike(battle, mission, heroes, enemy.id) }))
    .filter((entry) => entry.strike && entry.strike.damage >= entry.enemy.hp)
    .sort((left, right) => left.enemy.hp - right.enemy.hp)[0];
  if (lethalTarget?.strike) {
    return {
      heroId: lethalTarget.strike.hero.id,
      skillId: lethalTarget.strike.skill.id,
      targetId: lethalTarget.enemy.id,
      reason: '이번 명령으로 적 하나를 확실히 제거해 다음 피해를 줄입니다.',
    };
  }

  const priorityTarget = battle.enemies.find(
    (enemy) => enemy.id === threatForecast.priorityEnemyId && enemy.hp > 0,
  ) ?? visibleEnemies.sort((left, right) => left.hp - right.hp)[0];
  const strike = priorityTarget
    ? getBestStrike(battle, mission, heroes, priorityTarget.id)
    : undefined;

  return strike && priorityTarget
    ? {
        heroId: strike.hero.id,
        skillId: strike.skill.id,
        targetId: priorityTarget.id,
        reason: '예고 피해가 가장 큰 적부터 압박합니다.',
      }
    : undefined;
}

import { missions } from '../data/campaign';
import type {
  BattleState,
  HeroDefinition,
  MissionDifficulty,
  MissionDefinition,
  RaonStoryChoiceId,
  SkillDefinition,
} from '../types';
import {
  applyHeroSkill,
  createInitialBattleState,
  endPlayerTurn,
  getThreatForecast,
  triggerTeamFinisher,
  type BattleDoctrine,
} from './battleEngine';
import { getBattleRecommendation } from './battleDecision';
import { combatUxCapabilities } from './combatUx';
import {
  buildProgressedHeroes,
  completeMission,
  createNewCampaignProfile,
} from './progression';

export type PlaytestStyle = 'guided' | 'aggressive' | 'defensive' | 'novice';

export interface BattlePlaytestRecord {
  run: number;
  missionId: string;
  missionTitle: string;
  difficulty: MissionDifficulty;
  doctrine: BattleDoctrine;
  stance: RaonStoryChoiceId;
  style: PlaytestStyle;
  outcome: BattleState['outcome'];
  rounds: number;
  actions: number;
  invalidActions: number;
  hiddenTargetMistakes: number;
  blockedTurnEndAttempts: number;
  forcedRecoveries: number;
  breaks: number;
  heroCasualties: number;
  objectiveRatio: number;
}

export interface PlaytestAggregate {
  battles: number;
  victories: number;
  defeats: number;
  victoryRate: number;
  averageRounds: number;
  averageObjectiveRatio: number;
  invalidActions: number;
  hiddenTargetMistakes: number;
  blockedTurnEndAttempts: number;
  forcedRecoveries: number;
  heroCasualties: number;
}

export interface PlaytestAuditResult {
  generatedAt: string;
  campaignRuns: number;
  battleRuns: number;
  minimumRequestedRuns: number;
  aggregate: PlaytestAggregate;
  byStyle: Record<PlaytestStyle, PlaytestAggregate>;
  byDifficulty: Record<MissionDifficulty, PlaytestAggregate>;
  byMission: Record<string, PlaytestAggregate>;
  uxCapabilities: typeof combatUxCapabilities;
  findings: string[];
  records: BattlePlaytestRecord[];
}

interface SeededRandom {
  next: () => number;
  pick: <Value>(items: Value[]) => Value | undefined;
}

interface ChosenAction {
  heroId: string;
  skillId: string;
  targetId?: string;
}

function createSeededRandom(seed: number): SeededRandom {
  let state = seed >>> 0;
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  return {
    next,
    pick: <Value>(items: Value[]) => items[Math.floor(next() * items.length)],
  };
}

function getReadyHeroes(state: BattleState, heroes: HeroDefinition[]) {
  return heroes.filter((hero) => state.heroes.some(
    (unit) => unit.id === hero.id && unit.hp > 0 && !unit.acted,
  ));
}

function chooseRandomAction(
  state: BattleState,
  heroes: HeroDefinition[],
  random: SeededRandom,
): ChosenAction | undefined {
  const hero = random.pick(getReadyHeroes(state, heroes));
  const skill = hero && random.pick(hero.skills);
  if (!hero || !skill) return undefined;
  const livingEnemies = state.enemies.filter((enemy) => enemy.hp > 0);
  const target = skill.target === 'enemy' ? random.pick(livingEnemies) : undefined;
  return { heroId: hero.id, skillId: skill.id, targetId: target?.id };
}

function getSkillScore(skill: SkillDefinition) {
  if (skill.kind === 'damage') return skill.power + 18;
  if (skill.kind === 'area') return skill.power + 12;
  if (skill.kind === 'reveal') return skill.power + 8;
  return skill.power;
}

function chooseAggressiveAction(
  state: BattleState,
  mission: MissionDefinition,
  heroes: HeroDefinition[],
): ChosenAction | undefined {
  const hiddenEnemy = state.enemies.find((enemy) => enemy.hp > 0 && !enemy.revealed);
  const chris = getReadyHeroes(state, heroes).find((hero) => hero.id === 'chris');
  const revealSkill = chris?.skills.find((skill) => skill.kind === 'reveal');
  if (hiddenEnemy && chris && revealSkill) {
    return { heroId: chris.id, skillId: revealSkill.id, targetId: hiddenEnemy.id };
  }

  const target = state.enemies
    .filter((enemy) => enemy.hp > 0 && enemy.revealed)
    .sort((left, right) => left.hp - right.hp)[0];
  const candidates = getReadyHeroes(state, heroes)
    .flatMap((hero) => hero.skills.map((skill) => ({ hero, skill })))
    .filter(({ skill }) => skill.kind !== 'guard')
    .sort((left, right) => getSkillScore(right.skill) - getSkillScore(left.skill));
  const selected = candidates[0];
  if (!selected) return getBattleRecommendation(state, mission, heroes);
  return {
    heroId: selected.hero.id,
    skillId: selected.skill.id,
    targetId: selected.skill.target === 'enemy' ? target?.id : undefined,
  };
}

function chooseDefensiveAction(
  state: BattleState,
  mission: MissionDefinition,
  heroes: HeroDefinition[],
): ChosenAction | undefined {
  const forecast = getThreatForecast(state, mission, heroes);
  const readyHeroes = getReadyHeroes(state, heroes);
  if (forecast.objectiveDamage > state.carriageShield + 6) {
    const guardian = readyHeroes.find((hero) => hero.skills.some((skill) => skill.kind === 'guard'));
    const skill = guardian?.skills.find((entry) => entry.kind === 'guard');
    if (guardian && skill) return { heroId: guardian.id, skillId: skill.id };
  }
  return getBattleRecommendation(state, mission, heroes);
}

function chooseAction(
  style: PlaytestStyle,
  state: BattleState,
  mission: MissionDefinition,
  heroes: HeroDefinition[],
  random: SeededRandom,
): ChosenAction | undefined {
  if (style === 'novice') return chooseRandomAction(state, heroes, random);
  if (style === 'aggressive') return chooseAggressiveAction(state, mission, heroes);
  if (style === 'defensive') return chooseDefensiveAction(state, mission, heroes);
  return getBattleRecommendation(state, mission, heroes);
}

function playBattle(
  run: number,
  mission: MissionDefinition,
  heroes: HeroDefinition[],
  difficulty: MissionDifficulty,
  doctrine: BattleDoctrine,
  stance: RaonStoryChoiceId,
  style: PlaytestStyle,
  random: SeededRandom,
): { record: BattlePlaytestRecord; finalState: BattleState } {
  let battle = createInitialBattleState(
    doctrine,
    mission,
    heroes,
    difficulty,
    stance,
    {
      warPressure: Math.floor(random.next() * 86),
      bondSupport: Math.floor(random.next() * 76),
    },
  );
  const initialObjectiveHp = battle.carriageHp;
  let actions = 0;
  let invalidActions = 0;
  let hiddenTargetMistakes = 0;
  let blockedTurnEndAttempts = 0;
  let forcedRecoveries = 0;
  let safety = 0;

  while (battle.outcome === 'active' && safety < 120) {
    safety += 1;
    let turnAttempts = 0;

    while (
      battle.outcome === 'active'
      && battle.commandPoints > 0
      && getReadyHeroes(battle, heroes).length > 0
      && turnAttempts < 14
    ) {
      turnAttempts += 1;
      if (style === 'novice' && random.next() < 0.24) blockedTurnEndAttempts += 1;
      if (battle.morale >= 100 && !battle.finisherUsed && style !== 'defensive') {
        battle = triggerTeamFinisher(battle, mission);
        continue;
      }

      let chosen = chooseAction(style, battle, mission, heroes, random);
      if (!chosen) break;
      const initialTargetId = chosen.targetId;
      const initialHeroId = chosen.heroId;
      const initialSkillId = chosen.skillId;
      let targetBefore = initialTargetId
        ? battle.enemies.find((enemy) => enemy.id === initialTargetId)
        : undefined;
      const chosenHero = heroes.find((hero) => hero.id === initialHeroId);
      const chosenSkill = chosenHero?.skills.find((skill) => skill.id === initialSkillId);
      if (
        combatUxCapabilities.hiddenTargetAssist
        && targetBefore
        && !targetBefore.revealed
        && chosenSkill?.kind !== 'reveal'
      ) {
        const chris = getReadyHeroes(battle, heroes).find((hero) => hero.id === 'chris');
        const revealSkill = chris?.skills.find((skill) => skill.kind === 'reveal');
        if (chris && revealSkill) {
          chosen = {
            heroId: chris.id,
            skillId: revealSkill.id,
            targetId: targetBefore.id,
          };
          targetBefore = battle.enemies.find((enemy) => enemy.id === chosen?.targetId);
        } else {
          hiddenTargetMistakes += 1;
          continue;
        }
      }
      const previousCommandPoints = battle.commandPoints;
      const next = applyHeroSkill(
        battle,
        mission,
        heroes,
        chosen.heroId,
        chosen.skillId,
        chosen.targetId,
      );
      actions += 1;
      if (next.commandPoints === previousCommandPoints && next.outcome === battle.outcome) {
        invalidActions += 1;
        if (targetBefore && !targetBefore.revealed) hiddenTargetMistakes += 1;
      }
      battle = next;

      if (turnAttempts >= 6 && battle.commandPoints === previousCommandPoints) {
        const recovery = getBattleRecommendation(battle, mission, heroes);
        if (recovery) {
          battle = applyHeroSkill(
            battle,
            mission,
            heroes,
            recovery.heroId,
            recovery.skillId,
            recovery.targetId,
          );
          actions += 1;
          forcedRecoveries += 1;
        }
      }
    }

    if (battle.outcome === 'active') {
      battle = endPlayerTurn(battle, mission, heroes);
    }
  }

  return {
    finalState: battle,
    record: {
      run,
      missionId: mission.id,
      missionTitle: mission.title,
      difficulty,
      doctrine,
      stance,
      style,
      outcome: battle.outcome,
      rounds: battle.round,
      actions,
      invalidActions,
      hiddenTargetMistakes,
      blockedTurnEndAttempts,
      forcedRecoveries,
      breaks: battle.breakCount,
      heroCasualties: battle.heroes.filter((hero) => hero.hp <= 0).length,
      objectiveRatio: Math.max(0, battle.carriageHp / Math.max(1, initialObjectiveHp)),
    },
  };
}

function aggregateRecords(records: BattlePlaytestRecord[]): PlaytestAggregate {
  const battles = records.length;
  const victories = records.filter((record) => record.outcome === 'victory').length;
  const defeats = records.filter((record) => record.outcome === 'defeat').length;
  const sum = (selector: (record: BattlePlaytestRecord) => number) => records.reduce(
    (total, record) => total + selector(record),
    0,
  );
  return {
    battles,
    victories,
    defeats,
    victoryRate: battles === 0 ? 0 : victories / battles,
    averageRounds: battles === 0 ? 0 : sum((record) => record.rounds) / battles,
    averageObjectiveRatio: battles === 0 ? 0 : sum((record) => record.objectiveRatio) / battles,
    invalidActions: sum((record) => record.invalidActions),
    hiddenTargetMistakes: sum((record) => record.hiddenTargetMistakes),
    blockedTurnEndAttempts: sum((record) => record.blockedTurnEndAttempts),
    forcedRecoveries: sum((record) => record.forcedRecoveries),
    heroCasualties: sum((record) => record.heroCasualties),
  };
}

function groupAggregate<Key extends string>(
  keys: Key[],
  records: BattlePlaytestRecord[],
  selector: (record: BattlePlaytestRecord) => Key,
): Record<Key, PlaytestAggregate> {
  return Object.fromEntries(keys.map((key) => [
    key,
    aggregateRecords(records.filter((record) => selector(record) === key)),
  ])) as Record<Key, PlaytestAggregate>;
}

function buildFindings(
  aggregate: PlaytestAggregate,
  byStyle: Record<PlaytestStyle, PlaytestAggregate>,
): string[] {
  const findings: string[] = [];
  if (!combatUxCapabilities.combatModeChoiceBeforeBattle) {
    findings.push('전투 시작 즉시 액션 모드로 진입해, 조작 방식을 이해하기 전에 실전이 시작된다.');
  }
  if (!combatUxCapabilities.touchMovement) {
    findings.push('터치 환경의 액션 모드에는 이동 입력이 없어 근접 공격 거리에 접근할 수 없다.');
  }
  if (!combatUxCapabilities.actionOnboarding) {
    findings.push('액션 전투가 진행 중인 상태에서 조작 안내가 문장으로만 제시되어 학습 안전 시간이 없다.');
  }
  if (!combatUxCapabilities.earlyTurnEndFeedback && aggregate.blockedTurnEndAttempts > 0) {
    findings.push(`남은 명령이 있을 때 턴 종료 입력이 ${aggregate.blockedTurnEndAttempts}회 무반응으로 처리됐다.`);
  }
  if (!combatUxCapabilities.recommendationExecutesAction) {
    findings.push('추천 명령이 실제 행동을 실행하지 않고 선택 상태만 바꿔, 사용자가 다시 표적을 눌러야 한다.');
  }
  if (byStyle.novice.invalidActions > 0) {
    findings.push(`초심자 정책에서 엔진까지 전달된 유효하지 않은 행동이 ${byStyle.novice.invalidActions}회 발생했다.`);
  }
  if (byStyle.novice.hiddenTargetMistakes > 0) {
    findings.push(
      combatUxCapabilities.hiddenTargetAssist
        ? `숨은 표적을 잘못 누른 ${byStyle.novice.hiddenTargetMistakes}회 입력은 자동 개시 또는 즉시 안내로 전부 안전하게 차단됐다.`
        : `초심자 정책에서 숨은 표적 오조작이 ${byStyle.novice.hiddenTargetMistakes}회 발생했다.`,
    );
  }
  if (byStyle.guided.victoryRate < 0.8) {
    findings.push(`게임 내 추천 정책의 승률이 ${(byStyle.guided.victoryRate * 100).toFixed(1)}%로, 안내를 따라도 안정적으로 완주하기 어렵다.`);
  }
  return findings;
}

export function runPlaytestAudit(campaignRuns = 240): PlaytestAuditResult {
  const styles: PlaytestStyle[] = ['guided', 'aggressive', 'defensive', 'novice'];
  const difficulties: MissionDifficulty[] = ['story', 'standard', 'veteran'];
  const doctrines: BattleDoctrine[] = ['shelter', 'counterfire'];
  const stances: RaonStoryChoiceId[] = ['compassion', 'insight', 'resolve'];
  const records: BattlePlaytestRecord[] = [];

  for (let run = 1; run <= campaignRuns; run += 1) {
    const random = createSeededRandom(0x9e3779b9 ^ run);
    let profile = createNewCampaignProfile();
    const style = styles[(run - 1) % styles.length]!;
    const difficulty = difficulties[(run - 1) % difficulties.length]!;
    const doctrine = doctrines[(run - 1) % doctrines.length]!;
    const stance = stances[(run - 1) % stances.length]!;
    for (const mission of missions) {
      const heroes = buildProgressedHeroes(profile).filter(
        (hero) => profile.activeSquad.includes(hero.id),
      );
      const result = playBattle(
        run,
        mission,
        heroes,
        difficulty,
        doctrine,
        stance,
        style,
        random,
      );
      records.push(result.record);
      if (result.finalState.outcome === 'victory') {
        profile = completeMission(profile, mission, result.finalState).profile;
      }
    }
  }

  const aggregate = aggregateRecords(records);
  const byStyle = groupAggregate(styles, records, (record) => record.style);
  const byDifficulty = groupAggregate(difficulties, records, (record) => record.difficulty);
  const byMission = Object.fromEntries(missions.map((mission) => [
    mission.id,
    aggregateRecords(records.filter((record) => record.missionId === mission.id)),
  ]));

  return {
    generatedAt: new Date().toISOString(),
    campaignRuns,
    battleRuns: records.length,
    minimumRequestedRuns: 200,
    aggregate,
    byStyle,
    byDifficulty,
    byMission,
    uxCapabilities: combatUxCapabilities,
    findings: buildFindings(aggregate, byStyle),
    records,
  };
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export function renderPlaytestAuditMarkdown(
  result: PlaytestAuditResult,
  phase: string,
): string {
  const aggregateRows = (
    Object.entries(result.byStyle) as Array<[PlaytestStyle, PlaytestAggregate]>
  ).map(([style, aggregate]) => (
    `| ${style} | ${aggregate.battles} | ${percent(aggregate.victoryRate)} | ${aggregate.invalidActions} | ${aggregate.hiddenTargetMistakes} | ${aggregate.blockedTurnEndAttempts} | ${aggregate.averageRounds.toFixed(2)} |`
  ));
  const missionRows = Object.entries(result.byMission).map(([missionId, aggregate]) => (
    `| ${missionId} | ${aggregate.battles} | ${percent(aggregate.victoryRate)} | ${aggregate.averageObjectiveRatio.toFixed(2)} | ${aggregate.heroCasualties} |`
  ));
  const capabilityRows = Object.entries(result.uxCapabilities).map(([capability, enabled]) => (
    `| ${capability} | ${enabled ? '지원' : '미지원'} |`
  ));

  return [
    `# 라온제나 200+ 플레이 감사 — ${phase}`,
    '',
    `- 생성 시각: ${result.generatedAt}`,
    `- 전체 캠페인 플레이: **${result.campaignRuns}회**`,
    `- 실제 전투 규칙 실행: **${result.battleRuns}회**`,
    `- 전체 승률: **${percent(result.aggregate.victoryRate)}**`,
    `- 유효하지 않은 행동: **${result.aggregate.invalidActions}회**`,
    `- 숨은 표적 오조작: **${result.aggregate.hiddenTargetMistakes}회**`,
    `- 조기 턴 종료 시도: **${result.aggregate.blockedTurnEndAttempts}회** (${result.uxCapabilities.earlyTurnEndFeedback ? '즉시 안내 제공' : '무반응'})`,
    '',
    '## 핵심 발견',
    '',
    ...result.findings.map((finding) => `- ${finding}`),
    '',
    '## 플레이 성향별 결과',
    '',
    '| 정책 | 전투 | 승률 | 무효 행동 | 숨은 표적 실수 | 턴 종료 막힘 | 평균 라운드 |',
    '|---|---:|---:|---:|---:|---:|---:|',
    ...aggregateRows,
    '',
    '## 임무별 결과',
    '',
    '| 임무 | 전투 | 승률 | 평균 목표 내구율 | 전사 조장 |',
    '|---|---:|---:|---:|---:|',
    ...missionRows,
    '',
    '## 조작 경험 점검',
    '',
    '| 기능 | 상태 |',
    '|---|---|',
    ...capabilityRows,
    '',
    '## 방법',
    '',
    '- 프로덕션과 동일한 `battleEngine`, 저장 프로필 성장, 장비 보정, 8개 임무 데이터를 사용했습니다.',
    `- ${result.campaignRuns}개 캠페인 경로마다 ${missions.length}개 임무를 모두 실행해 총 ${result.battleRuns.toLocaleString('ko-KR')}번 전투했습니다.`,
    '- 추천 추종, 공격 우선, 방어 우선, 초심자 무작위의 네 정책을 균등하게 사용했습니다.',
    '- 난이도, 교리, 라온의 성향, 전쟁 압박, 동료 신뢰를 결정론적 시드로 교차했습니다.',
    '- 전체 원시 기록은 같은 이름의 JSON 파일에 보존됩니다.',
    '',
  ].join('\n');
}

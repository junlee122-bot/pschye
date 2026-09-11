import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  CircleHelp,
  Eye,
  Gauge,
  Handshake,
  Link2,
  Undo2,
  RotateCcw,
  Sparkles,
  Swords,
  Target,
  X,
} from 'lucide-react';
import {
  createInitialBattleState,
  endPlayerTurn,
  applyHeroSkill,
  triggerTeamFinisher,
  battleDifficultyOptions,
  getEnemyIntents,
  getDifficultyRules,
  getObjectiveMaximumHp,
  getThreatForecast,
  type BattleDoctrine,
} from '../game/battleEngine';
import { getBattleRecommendation } from '../game/battleDecision';
import { calculateMissionGrade, getAdjustedMissionReward } from '../game/progression';
import { getRaonStoryBeat, raonChoiceMeta } from '../data/story';
import type { BattleState, HeroDefinition, MissionDefinition, MissionDifficulty, RaonStoryChoiceId } from '../types';
import { BattleTutorial } from './BattleTutorial';

const PhaserBattlefield = lazy(async () => ({
  default: (await import('./PhaserBattlefield')).PhaserBattlefield,
}));

const RaonActionBattle = lazy(async () => ({
  default: (await import('./RaonActionBattle')).RaonActionBattle,
}));

interface BattleScreenProps {
  doctrine: BattleDoctrine;
  difficulty: MissionDifficulty;
  mission: MissionDefinition;
  heroes: HeroDefinition[];
  raonStance: RaonStoryChoiceId;
  warPressure: number;
  bondSupport: number;
  onComplete: (state: BattleState) => void;
  onExit: () => void;
}

export function BattleScreen({ doctrine, difficulty, mission, heroes, raonStance, warPressure, bondSupport, onComplete, onExit }: BattleScreenProps) {
  const [combatMode, setCombatMode] = useState<'select' | 'action' | 'tactical'>('select');
  const [battle, setBattle] = useState(() => createInitialBattleState(doctrine, mission, heroes, difficulty, raonStance, { warPressure, bondSupport }));
  const initialHero = heroes.find((hero) => hero.id === 'raon') ?? heroes[0];
  const [selectedHeroId, setSelectedHeroId] = useState(initialHero?.id ?? '');
  const [selectedSkillId, setSelectedSkillId] = useState(initialHero?.skills[0]?.id ?? '');
  const [battleHistory, setBattleHistory] = useState<BattleState[]>([]);
  const [mobileConsoleOpen, setMobileConsoleOpen] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [guideOpen, setGuideOpen] = useState(() => window.localStorage.getItem('raonjena-battle-guide-v2') !== 'seen');
  const [turnNotice, setTurnNotice] = useState<string | null>(null);
  const touchPreferred = useMemo(() => window.matchMedia?.('(pointer: coarse)').matches ?? false, []);
  const reportedVictory = useRef(false);
  const selectedHero = heroes.find((hero) => hero.id === selectedHeroId);
  const selectedSkill = selectedHero?.skills.find((skill) => skill.id === selectedSkillId);
  const livingEnemies = useMemo(
    () => battle.enemies.filter((enemy) => enemy.hp > 0),
    [battle.enemies],
  );
  const availableHeroes = useMemo(
    () => battle.heroes.filter((hero) => hero.hp > 0 && !hero.acted),
    [battle.heroes],
  );
  const missionGrade = calculateMissionGrade(battle);
  const difficultyRules = getDifficultyRules(difficulty);
  const difficultyLabel = battleDifficultyOptions.find((option) => option.id === difficulty)?.label ?? '정규';
  const adjustedReward = getAdjustedMissionReward(mission, difficulty);
  const objectiveMaximum = getObjectiveMaximumHp(mission, doctrine, difficulty);
  const enemyIntents = useMemo(
    () => getEnemyIntents(battle, mission, heroes),
    [battle, heroes, mission],
  );
  const threatForecast = useMemo(
    () => getThreatForecast(battle, mission, heroes),
    [battle, heroes, mission],
  );
  const actionsUsed = difficultyRules.commandPoints - battle.commandPoints;
  const objectiveIncoming = Math.max(0, threatForecast.objectiveDamage - battle.carriageShield);
  const mostThreatenedHero = Object.entries(threatForecast.heroDamage)
    .sort((left, right) => right[1] - left[1])[0];
  const focusTarget = mission.enemies.find((enemy) => enemy.id === battle.focusTargetId);
  const storyBeat = getRaonStoryBeat(mission.id);

  const recommendation = useMemo(() => {
    return getBattleRecommendation(battle, mission, heroes);
  }, [battle, heroes, mission]);

  useEffect(() => {
    if (battle.outcome === 'victory' && !reportedVictory.current) {
      reportedVictory.current = true;
      onComplete(battle);
    }
  }, [battle, onComplete]);

  useEffect(() => {
    if (battle.outcome !== 'active') return;
    const current = battle.heroes.find((hero) => hero.id === selectedHeroId);
    if (current && current.hp > 0 && !current.acted) return;
    const next = heroes.find((hero) => battle.heroes.some((unit) => unit.id === hero.id && unit.hp > 0 && !unit.acted));
    if (next) {
      setSelectedHeroId(next.id);
      setSelectedSkillId(next.skills[0]?.id ?? '');
    }
  }, [battle, heroes, selectedHeroId]);

  useEffect(() => {
    if (!confirmExit) return;
    const timeout = window.setTimeout(() => setConfirmExit(false), 3200);
    return () => window.clearTimeout(timeout);
  }, [confirmExit]);

  useEffect(() => {
    if (!turnNotice) return;
    const timeout = window.setTimeout(() => setTurnNotice(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [turnNotice]);

  const commitBattle = (update: (current: BattleState) => BattleState) => {
    const next = update(battle);
    if (next === battle) return;
    setBattleHistory((history) => [...history, battle].slice(-8));
    setBattle(next);
  };

  const selectHero = (heroId: string) => {
    const hero = heroes.find((entry) => entry.id === heroId);
    setSelectedHeroId(heroId);
    setSelectedSkillId(hero?.skills[0]?.id ?? '');
  };

  const chooseSkill = (skillId: string) => {
    setSelectedSkillId(skillId);
    const skill = selectedHero?.skills.find((entry) => entry.id === skillId);
    if (skill?.target === 'carriage' || skill?.target === 'all-enemies') {
      commitBattle((current) => applyHeroSkill(current, mission, heroes, selectedHeroId, skillId));
    }
    setMobileConsoleOpen(false);
  };

  const attackEnemy = (enemyId: string) => {
    if (!selectedSkill || selectedSkill.target !== 'enemy') return;
    const target = battle.enemies.find((enemy) => enemy.id === enemyId);
    if (target && !target.revealed && selectedSkill.kind !== 'reveal') {
      const chris = heroes.find((hero) => hero.id === 'chris');
      const chrisState = battle.heroes.find((hero) => hero.id === 'chris');
      const revealSkill = chris?.skills.find((skill) => skill.kind === 'reveal');
      if (chris && chrisState && chrisState.hp > 0 && !chrisState.acted && revealSkill && battle.commandPoints > 0) {
        setSelectedHeroId(chris.id);
        setSelectedSkillId(revealSkill.id);
        commitBattle((current) => applyHeroSkill(current, mission, heroes, chris.id, revealSkill.id, enemyId));
        setTurnNotice('숨은 표적을 감지해 크리스의 개시 명령으로 자동 전환했습니다.');
        setMobileConsoleOpen(false);
        return;
      }
      setTurnNotice('숨은 적은 직접 공격할 수 없습니다. 다음 라운드에 크리스의 개시 기술로 먼저 드러내십시오.');
      setMobileConsoleOpen(true);
      return;
    }
    commitBattle((current) => applyHeroSkill(current, mission, heroes, selectedHeroId, selectedSkill.id, enemyId));
    setTurnNotice(null);
  };

  const undoAction = () => {
    const previous = battleHistory[battleHistory.length - 1];
    if (!previous) return;
    setBattle(previous);
    setBattleHistory((history) => history.slice(0, -1));
  };

  const selectNextHero = () => {
    if (availableHeroes.length === 0) return;
    const currentIndex = availableHeroes.findIndex((hero) => hero.id === selectedHeroId);
    const next = availableHeroes[(currentIndex + 1 + availableHeroes.length) % availableHeroes.length];
    if (next) selectHero(next.id);
  };

  const finishTurn = () => {
    if (battle.commandPoints > 0 && availableHeroes.length > 0) {
      setTurnNotice(`아직 명령 ${battle.commandPoints}회가 남았습니다. 추천 명령을 실행하거나 행동 가능한 조장을 선택하십시오.`);
      setMobileConsoleOpen(true);
      return;
    }
    setBattleHistory([]);
    setBattle((current) => endPlayerTurn(current, mission, heroes));
    setMobileConsoleOpen(false);
    setTurnNotice(null);
  };

  const restart = () => {
    reportedVictory.current = false;
    setBattle(createInitialBattleState(doctrine, mission, heroes, difficulty, raonStance, { warPressure, bondSupport }));
    setBattleHistory([]);
    setSelectedHeroId(initialHero?.id ?? '');
    setSelectedSkillId(initialHero?.skills[0]?.id ?? '');
  };

  const requestExit = () => {
    if (confirmExit) onExit();
    else setConfirmExit(true);
  };

  const closeGuide = () => {
    window.localStorage.setItem('raonjena-battle-guide-v2', 'seen');
    setGuideOpen(false);
  };

  const applyRecommendation = () => {
    if (!recommendation) return;
    setSelectedHeroId(recommendation.heroId);
    setSelectedSkillId(recommendation.skillId);
    commitBattle((current) => applyHeroSkill(
      current,
      mission,
      heroes,
      recommendation.heroId,
      recommendation.skillId,
      recommendation.targetId,
    ));
    setMobileConsoleOpen(false);
    setTurnNotice('추천 명령을 즉시 실행했습니다. 전장 변화를 확인하십시오.');
  };

  useEffect(() => {
    if (combatMode !== 'tactical' || battle.outcome !== 'active' || guideOpen) return;

    const handleTacticalKeys = (event: KeyboardEvent) => {
      const element = event.target as HTMLElement | null;
      if (element?.matches('input, textarea, select, [contenteditable="true"]')) return;

      if (/^[1-6]$/.test(event.key)) {
        const hero = heroes[Number(event.key) - 1];
        const unit = hero && battle.heroes.find((entry) => entry.id === hero.id);
        if (hero && unit && unit.hp > 0) {
          event.preventDefault();
          setSelectedHeroId(hero.id);
          setSelectedSkillId(hero.skills[0]?.id ?? '');
        }
        return;
      }

      if (event.key.toLowerCase() === 'q' || event.key.toLowerCase() === 'w') {
        const hero = heroes.find((entry) => entry.id === selectedHeroId);
        const skillIndex = event.key.toLowerCase() === 'q' ? 0 : 1;
        const skill = hero?.skills[skillIndex];
        if (skill) {
          event.preventDefault();
          setSelectedSkillId(skill.id);
        }
        return;
      }

      if (event.key === 'Tab') {
        event.preventDefault();
        const ready = heroes.filter((hero) => battle.heroes.some((unit) => unit.id === hero.id && unit.hp > 0 && !unit.acted));
        if (ready.length === 0) return;
        const currentIndex = ready.findIndex((hero) => hero.id === selectedHeroId);
        const next = ready[(currentIndex + 1 + ready.length) % ready.length];
        if (next) {
          setSelectedHeroId(next.id);
          setSelectedSkillId(next.skills[0]?.id ?? '');
        }
        return;
      }

      if (event.code === 'Space') {
        event.preventDefault();
        if (battle.commandPoints > 0 && availableHeroes.length > 0) {
          setTurnNotice(`아직 명령 ${battle.commandPoints}회가 남았습니다. 추천 명령 [R]을 실행하거나 행동 가능한 조장을 선택하십시오.`);
          setMobileConsoleOpen(true);
          return;
        }
        setBattleHistory([]);
        setBattle((current) => endPlayerTurn(current, mission, heroes));
        setMobileConsoleOpen(false);
        setTurnNotice(null);
        return;
      }

      if (event.key.toLowerCase() === 'r' && recommendation) {
        event.preventDefault();
        setSelectedHeroId(recommendation.heroId);
        setSelectedSkillId(recommendation.skillId);
        const next = applyHeroSkill(
          battle,
          mission,
          heroes,
          recommendation.heroId,
          recommendation.skillId,
          recommendation.targetId,
        );
        if (next !== battle) {
          setBattleHistory((history) => [...history, battle].slice(-8));
          setBattle(next);
          setMobileConsoleOpen(false);
          setTurnNotice('추천 명령을 즉시 실행했습니다. 전장 변화를 확인하십시오.');
        }
      }
    };

    window.addEventListener('keydown', handleTacticalKeys);
    return () => window.removeEventListener('keydown', handleTacticalKeys);
  }, [availableHeroes.length, battle, combatMode, guideOpen, heroes, mission, recommendation, selectedHeroId]);

  if (combatMode === 'select') {
    return (
      <main
        className="combat-mode-page page-enter"
        style={{ backgroundImage: `linear-gradient(120deg, rgba(5, 7, 11, .9), rgba(5, 7, 11, .58)), url(${mission.background})` }}
      >
        <button className="combat-mode-exit" onClick={onExit}><ArrowLeft size={17} /> 작전 브리핑으로</button>
        <section className="combat-mode-panel" aria-labelledby="combat-mode-title">
          <span>{mission.operation} · COMBAT APPROACH</span>
          <h1 id="combat-mode-title">라온은 어떻게 전장에 들어갈까?</h1>
          <p>같은 이야기와 보상을 서로 다른 방식으로 진행합니다. 언제든 전투 중 다른 방식으로 전환할 수 있습니다.</p>
          <div className="combat-mode-summary">
            <i />
            <div><small>{mission.battlefieldRule.name}</small><strong>{mission.title}</strong></div>
            <span>{difficultyLabel}</span>
          </div>
          <div className="combat-mode-grid">
            <button className="combat-mode-card action" onClick={() => setCombatMode('action')}>
              <div><Swords size={28} /><span>RAON DIRECT</span></div>
              <h2>라온 직접 조작</h2>
              <p>이동, 검격, 패링과 회피를 직접 연결하는 실시간 액션 전투입니다.</p>
              <ul>
                <li>WASD·방향키 또는 화면 이동 패드</li>
                <li>짧고 역동적인 전투</li>
                <li>라온의 시점과 손맛 중심</li>
              </ul>
              <strong>액션 전투 시작 <ChevronRight size={18} /></strong>
            </button>
            <button className={`combat-mode-card tactical ${touchPreferred ? 'recommended' : ''}`} onClick={() => setCombatMode('tactical')}>
              {touchPreferred && <em>현재 기기 추천</em>}
              <div><Target size={28} /><span>PSYCHE COMMAND</span></div>
              <h2>제7기 전술 지휘</h2>
              <p>조장별 기술과 적의 예고 행동을 읽고 명령을 조합하는 턴제 전투입니다.</p>
              <ul>
                <li>추천 명령과 행동 취소 지원</li>
                <li>집중 연계·브레이크 설계</li>
                <li>터치·키보드 모두 정밀 조작</li>
              </ul>
              <strong>전술 전투 시작 <ChevronRight size={18} /></strong>
            </button>
          </div>
          <small className="combat-mode-footnote">처음이라면 전술 지휘로 규칙을 익힌 뒤 액션 전투에 도전하는 것을 권장합니다.</small>
        </section>
      </main>
    );
  }

  if (combatMode === 'action') {
    return (
      <Suspense fallback={<div className="full-engine-loading"><i /><strong>라온 전투 엔진 구성 중</strong><span>직접 조작 전장을 준비하고 있습니다.</span></div>}>
        <RaonActionBattle
          doctrine={doctrine}
          difficulty={difficulty}
          mission={mission}
          heroes={heroes}
          raonStance={raonStance}
          warPressure={warPressure}
          bondSupport={bondSupport}
          onComplete={onComplete}
          onExit={onExit}
          onSwitchMode={() => setCombatMode('tactical')}
        />
      </Suspense>
    );
  }

  return (
    <section className="battle-page page-enter">
      <header className="battle-header">
        <div className="battle-header-actions">
          <button className={`icon-text-button ${confirmExit ? 'confirming' : ''}`} onClick={requestExit}><ArrowLeft size={17} /> {confirmExit ? '다시 누르면 포기' : '작전 포기'}</button>
          <button className="icon-text-button battle-undo" onClick={undoAction} disabled={battleHistory.length === 0 || battle.outcome !== 'active'}><Undo2 size={16} /> 행동 취소</button>
          <button className="icon-text-button" onClick={() => setCombatMode('action')}><Swords size={16} /> 라온 액션</button>
        </div>
        <div>
          <span>{mission.operation}</span>
          <strong>{mission.title}</strong>
          <small className="battle-rule-label">{mission.battlefieldRule.name}</small>
          <small className={`battle-difficulty difficulty-${difficulty}`}>{difficultyLabel}</small>
        </div>
        <div className="battle-round">
          <span>ROUND</span><strong>{String(battle.round).padStart(2, '0')}</strong><small>/ {String(mission.roundLimit).padStart(2, '0')}</small>
        </div>
      </header>

      <section className="battle-command-overview" aria-label="현재 전투 흐름">
        <div className={`battle-raon-stance stance-${raonStance}`}>
          <span>라온의 선택 · {raonChoiceMeta[raonStance].label}</span>
          <strong>{raonChoiceMeta[raonStance].battleEffect}</strong>
        </div>
        <div className={`battle-context-chip pressure-${warPressure >= 75 ? 'collapse' : warPressure >= 50 ? 'critical' : warPressure >= 25 ? 'strained' : 'calm'}`}>
          <Gauge size={16} /><span>전쟁 압박</span><strong>{warPressure}%</strong>
        </div>
        <div className="battle-context-chip bond-support">
          <Handshake size={16} /><span>현장 신뢰</span><strong>{bondSupport}</strong>
        </div>
        <div className="battle-phase-track">
          <span className={actionsUsed === 0 ? 'active' : 'complete'}><b>1</b> 위협 확인</span>
          <i />
          <span className={battle.commandPoints > 0 ? 'active' : 'complete'}><b>2</b> 명령 {actionsUsed}/{difficultyRules.commandPoints}</span>
          <i />
          <span className={battle.commandPoints === 0 || availableHeroes.length === 0 ? 'ready' : ''}><b>3</b> 적 행동</span>
        </div>
        <div className="battle-focus-status">
          <div><Link2 size={15} /><span>집중 연계</span></div>
          <strong>{focusTarget ? focusTarget.name : '대상 없음'}</strong>
          <div className="focus-pips" aria-label={`집중 연계 ${battle.focusChain.length}/3`}>
            {[0, 1, 2].map((index) => <i key={index} className={index < battle.focusChain.length ? 'filled' : ''} />)}
          </div>
          <small>{battle.focusChain.length >= 3 ? 'BREAK · 행동 봉쇄' : '다른 조장으로 같은 적을 공격'}</small>
        </div>
        <div className={`battle-forecast ${objectiveIncoming > 0 ? 'danger' : ''}`}>
          <AlertTriangle size={16} />
          <div><span>다음 적 행동 예상</span><strong>{mission.objectiveLabel} {objectiveIncoming} · 조장 {Object.values(threatForecast.heroDamage).reduce((total, damage) => total + damage, 0)}</strong></div>
        </div>
        <button className="battle-help-button" onClick={() => setGuideOpen(true)}><CircleHelp size={16} /> 전투 규칙</button>
      </section>

      <div className="battle-layout">
        <div className="battlefield engine-battlefield" aria-label={`${mission.title} tactical battlefield`}>
          <Suspense fallback={<div className="engine-loading"><i /><strong>전술 전장 구성 중</strong><span>Phaser 전투 엔진을 준비하고 있습니다.</span></div>}>
            <PhaserBattlefield
              battle={battle}
              mission={mission}
              heroes={heroes}
              difficulty={difficulty}
              selectedHeroId={selectedHeroId}
              selectedSkillId={selectedSkillId}
              enemyIntents={enemyIntents}
              threatForecast={threatForecast}
              objectiveMaximum={objectiveMaximum}
              recommendationTargetId={recommendation?.targetId}
              onHeroSelect={selectHero}
              onEnemySelect={attackEnemy}
              onOpenCommands={() => setMobileConsoleOpen(true)}
            />
          </Suspense>
          <div className="battlefield-status engine-battlefield-status">
            <div><span>COMMAND</span><strong>{battle.commandPoints} / {difficultyRules.commandPoints}</strong></div>
            <div><span>ENEMY</span><strong>{livingEnemies.length} / {mission.enemies.length}</strong></div>
            <div><span>BREAK</span><strong>{battle.breakCount}</strong></div>
          </div>
        </div>
        {mobileConsoleOpen && <button className="battle-console-backdrop" aria-label="전술 명령 닫기" onClick={() => setMobileConsoleOpen(false)} />}
        <aside id="battle-command-console" className={`battle-console ${mobileConsoleOpen ? 'mobile-open' : ''}`}>
          <button className="mobile-console-close" aria-label="전술 명령 닫기" onClick={() => setMobileConsoleOpen(false)}><X size={18} /></button>
          {recommendation && (
            <button className="tactical-recommendation" onClick={applyRecommendation}>
              <Sparkles size={16} />
              <span><small>추천 즉시 실행 · R</small><strong>{heroes.find((hero) => hero.id === recommendation.heroId)?.name} · {heroes.find((hero) => hero.id === recommendation.heroId)?.skills.find((skill) => skill.id === recommendation.skillId)?.name}</strong><em>{recommendation.reason}</em></span>
              <ChevronRight size={16} />
            </button>
          )}
          <section className="selected-hero-card" style={{ '--accent': selectedHero?.accent } as CSSProperties}>
            {selectedHero && <img src={selectedHero.art} alt={`${selectedHero.name} 설정화`} />}
            <div>
              <span>ACTIVE UNIT</span>
              <h3>{selectedHero?.name}</h3>
              <p>{selectedHero?.title}</p>
              <small>{battle.heroes.find((hero) => hero.id === selectedHero?.id)?.acted ? '행동 완료' : '행동 대기'} · 남은 조장 {availableHeroes.length}</small>
            </div>
            <button onClick={selectNextHero} disabled={availableHeroes.length < 2}>다음 조장 <ChevronRight size={15} /></button>
          </section>

          <section className="skill-console">
            <div className="battle-rule-card">
              <Sparkles size={15} />
              <div><strong>{mission.battlefieldRule.name}</strong><span>{mission.battlefieldRule.description}</span><small>승리: 모든 적 제압 · 실패: {mission.objectiveLabel} 파괴 또는 {mission.roundLimit}라운드 초과</small></div>
            </div>
            <div className="console-label"><Swords size={15} /> 전술 선택</div>
            {selectedHero?.skills.map((skill) => {
              const heroState = battle.heroes.find((hero) => hero.id === selectedHero.id);
              return (
                <button
                  key={skill.id}
                  className={selectedSkillId === skill.id ? 'selected' : ''}
                  onClick={() => chooseSkill(skill.id)}
                  disabled={Boolean(heroState?.acted || heroState?.hp === 0 || battle.commandPoints === 0)}
                >
                  <div>
                    <strong>{skill.name}</strong>
                    <span>{skill.description}</span>
                  </div>
                  <small>{skill.kind === 'guard' ? '방어' : skill.kind === 'reveal' ? '개시' : skill.kind === 'area' ? '광역' : '타격'} · 위력 {skill.power} · {skill.target === 'enemy' ? '표적 선택' : '즉시 발동'} · 사기 +{skill.morale}</small>
                </button>
              );
            })}
            {selectedSkill?.target === 'enemy' && (
              <div className="target-prompt"><Target size={14} /> 붉게 점멸하는 적을 선택하십시오. 같은 적을 다른 조장으로 이으면 피해가 증가합니다.</div>
            )}
          </section>

          <section className="enemy-intent-console">
            <div className="console-label"><Eye size={15} /> 다음 적 행동</div>
            <div className="enemy-intent-list">
              {enemyIntents.map((intent) => {
                const enemy = mission.enemies.find((entry) => entry.id === intent.enemyId);
                return (
                  <div key={intent.enemyId} className={`intent-${intent.type}`}>
                    <span>{intent.type === 'blocked' ? 'BLOCK' : intent.type === 'objective' ? 'OBJECTIVE' : 'ATTACK'}</span>
                    <strong>{enemy?.name}</strong>
                    <small>{intent.type === 'blocked' ? '브레이크로 행동 봉쇄' : `${intent.targetLabel} · 예상 ${intent.type === 'objective' ? intent.rawDamage : intent.damage}`}</small>
                  </div>
                );
              })}
            </div>
            {mostThreatenedHero && <p><AlertTriangle size={13} /> 조장 집중 위험: {heroes.find((hero) => hero.id === mostThreatenedHero[0])?.name}에게 총 {mostThreatenedHero[1]} 피해 예상</p>}
          </section>

          <section className="morale-console">
            <div><span>연대 사기</span><strong>{battle.morale}%</strong></div>
            <div className="morale-bar"><i style={{ width: `${battle.morale}%` }} /></div>
            <button
              onClick={() => commitBattle((current) => triggerTeamFinisher(current, mission))}
              disabled={battle.morale < 100 || battle.finisherUsed}
            >
              <Sparkles size={16} /> 새벽의 여섯 궤도
            </button>
          </section>

          <section className="battle-log" aria-live="polite">
            <div className="console-label">FIELD LOG</div>
            <div>
              {[...battle.log].reverse().map((entry) => (
                <p key={entry.id} className={entry.tone}>
                  <span>R{entry.round} · {entry.speaker}</span>
                  {entry.message}
                </p>
              ))}
            </div>
          </section>

          {turnNotice && <p className="turn-feedback" role="status"><AlertTriangle size={15} /> {turnNotice}</p>}
          <button
            className={`end-turn-button ${battle.commandPoints > 0 && availableHeroes.length > 0 ? 'has-commands' : ''}`}
            onClick={finishTurn}
            disabled={battle.outcome !== 'active'}
          >
            {battle.commandPoints > 0 && availableHeroes.length > 0
              ? `명령 ${battle.commandPoints}회 남음`
              : '예고된 적 행동 실행'} <ChevronRight size={18} />
          </button>
        </aside>
      </div>

      {guideOpen && <BattleTutorial mission={mission} onClose={closeGuide} />}

      {battle.outcome !== 'active' && (
        <div className="outcome-overlay" role="dialog" aria-modal="true" aria-label="작전 결과">
          <div className={`outcome-card ${battle.outcome}`}>
            <span>{battle.outcome === 'victory' ? 'MISSION COMPLETE' : 'MISSION FAILED'}</span>
            {battle.outcome === 'victory' && <div className={`mission-grade grade-${missionGrade.toLowerCase()}`}>{missionGrade}</div>}
            <h2>{battle.outcome === 'victory' ? mission.subtitle : '작전선 붕괴'}</h2>
            <p>
              {battle.outcome === 'victory'
                ? battle.revelationTriggered
                  ? `${mission.revelation?.line ?? mission.victoryText} 숨겨진 기록이 아카이브에 해금되었습니다.`
                  : mission.victoryText
                : mission.defeatText}
            </p>
            {storyBeat && (
              <blockquote className="outcome-raon-reflection">
                <span>라온의 기록</span>
                “{battle.outcome === 'victory' ? storyBeat.victoryReflection : storyBeat.defeatReflection}”
              </blockquote>
            )}
            {battle.outcome === 'victory' && (
              <div className="outcome-rewards">
                <span>XP +{adjustedReward.xp}</span><span>보급 +{adjustedReward.supplies}</span><span>정보 +{adjustedReward.intel}</span><span>유물 +{adjustedReward.relics}</span>
              </div>
            )}
            {battle.outcome === 'victory' && <div className="battle-performance"><span>완료 라운드 <strong>{battle.round}</strong></span><span>집중 파쇄 <strong>{battle.breakCount}</strong></span><span>생존 조장 <strong>{battle.heroes.filter((hero) => hero.hp > 0).length}/{battle.heroes.length}</strong></span></div>}
            {battle.outcome === 'victory' && <small className="grade-note">재현 작전에서는 자원 대신 최고 등급 기록만 갱신됩니다.</small>}
            <div>
              <button onClick={restart}><RotateCcw size={16} /> 다시 시도</button>
              <button className="primary" onClick={onExit}>라온의 여정으로 <ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

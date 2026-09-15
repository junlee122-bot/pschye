import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { PlayerArchive } from './components/PlayerArchive';
import { Activities } from './components/Activities';
import { BattleScreen } from './components/BattleScreen';
import { CampaignHub } from './components/CampaignHub';
import { CommandDeck } from './components/CommandDeck';
import { Chronicle } from './components/Chronicle';
import { Codex } from './components/Codex';
import { Headquarters } from './components/Headquarters';
import { OriginStory } from './components/OriginStory';
import { Roster } from './components/Roster';
import { TitleScreen } from './components/TitleScreen';
import { TopNavigation } from './components/TopNavigation';
import { WorldMap } from './components/WorldMap';
import { getMission } from './data/campaign';
import { getOriginStoryScene } from './data/originStory';
import { isVillageOriginScene } from './data/village';
import type { BattleDoctrine } from './game/battleEngine';
import { executeGameCommand } from './game/simulation';
import { CampaignSlotSession } from './game/persistence';
import { isAuthorWorkspace } from './game/storyAccess';
import { abandonCampaignBattle, beginCampaignBattle, restartCampaignBattle, saveCampaignBattleCheckpoint, settleCampaignBattle } from './game/campaignBattle';
import { applyVillageRescueAction, completeVillageRescueReturn, getVillageRescue, retryVillageRescue, startVillageRescue } from './game/villageRescueProgression';
import { applyFieldExamPlan, completeFieldExamReturn, getFieldExam, retryFieldExam, startFieldExam } from './game/fieldExamProgression';
import { applyPetalTrainingAction, completePetalTraining, getPetalTraining, retryPetalTraining, startPetalTraining } from './game/petalTrainingProgression';
import {
  advanceDay,
  advanceOriginStory,
  createNewCampaignProfile,
  craftEquipment,
  claimDailyOrders,
  chooseRaonStoryPath,
  chooseOriginStoryPath,
  equipHeroItem,
  getActiveCampaignSlot,
  listCampaignSlots,
  loadCampaignProfile,
  placeHeadquartersRoom,
  performBondActivity,
  performDailyActivity,
  performTraining,
  resolveDispatch,
  saveCampaignProfile,
  setActiveCampaignSlot,
  toggleSquadMember,
  unlockHeroNode,
  upgradeFacility,
} from './game/progression';
import type { BattleState, CampaignBattleCheckpointPatch, CampaignBattleMode, DailyActivityId, FacilityId, FieldExamPlan, MissionDifficulty, NavigationSection, PetalTrainingAction, RaonStoryChoiceId, TrainingFocus, VillageRescueAction } from './types';

const VillageAdventure = lazy(() => import('./components/VillageAdventure').then((module) => ({ default: module.VillageAdventure })));
const VillageRescueEncounter = lazy(() => import('./components/VillageRescueEncounter').then((module) => ({ default: module.VillageRescueEncounter })));
const FieldExamEncounter = lazy(() => import('./components/FieldExamEncounter').then((module) => ({ default: module.FieldExamEncounter })));
const PetalTrainingEncounter = lazy(() => import('./components/PetalTrainingEncounter').then((module) => ({ default: module.PetalTrainingEncounter })));
const AuthorWorkspace = import.meta.env.DEV ? lazy(() => import('./components/AuthorWorkspace').then((module) => ({ default: module.AuthorWorkspace }))) : null;
const navigationSections: NavigationSection[] = [
  'title', 'campaign', 'world', 'roster', 'headquarters', 'activities', 'chronicle', 'codex', 'archive',
];
const createBattleAttemptId = () => crypto.randomUUID();

export function App() {
  if (AuthorWorkspace && isAuthorWorkspace(import.meta.env.DEV, window.location.search)) {
    return <Suspense fallback={<div className="save-recovery">제작 자료를 불러오는 중...</div>}><AuthorWorkspace /></Suspense>;
  }
  return <CampaignApp />;
}

function CampaignApp() {
  const [section, setSection] = useState<NavigationSection>(() => {
    const requestedSection = new URLSearchParams(window.location.search).get('section') as NavigationSection | null;
    return requestedSection && navigationSections.includes(requestedSection) ? requestedSection : 'title';
  });
  const [activeSlot, setActiveSlot] = useState(getActiveCampaignSlot);
  const [profile, setProfile] = useState(createNewCampaignProfile);
  const [saveSession] = useState(() => new CampaignSlotSession());
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [hydration, setHydration] = useState<{ slot: number; status: 'loading' | 'ready' | 'blocked'; message?: string }>({ slot: activeSlot, status: 'loading' });
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const [focusedMissionId, setFocusedMissionId] = useState<string | undefined>();
  const [battleSession, setBattleSession] = useState(0);
  const liveBattleSession = useRef(0);
  const [notice, setNotice] = useState<{ title: string; detail: string } | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const attempt = profile.battleAttempt;
  const activeAttempt = attempt?.missionId === activeMissionId ? attempt : undefined;
  const activeAttemptId = activeAttempt?.id;
  const activeMission = activeAttempt ? getMission(activeAttempt.missionId) : undefined;
  const fieldExam = getFieldExam(profile);
  const fieldAttempt = fieldExam?.attempt;
  const fieldTurn = fieldExam?.turn;
  const petalTraining = getPetalTraining(profile);
  const trainingAttempt = petalTraining?.attempt;
  const trainingTurn = petalTraining?.turn;

  useEffect(() => {
    setHydration({ slot: activeSlot, status: 'loading' });
    void saveSession.load(activeSlot, loadCampaignProfile).then((result) => {
      if (!result) return;
      if (result.status === 'ready') {
        const pending = result.profile.battleAttempt;
        setProfile(pending?.battle.outcome === 'victory' && !pending.settled
          ? settleCampaignBattle(result.profile, pending.id, pending.battle) : result.profile);
        setHydration({ slot: activeSlot, status: 'ready' });
      } else {
        setHydration({ slot: activeSlot, status: 'blocked', message: result.message });
      }
    });
    return () => saveSession.invalidate();
  }, [activeSlot, loadAttempt, saveSession]);

  useEffect(() => {
    if (hydration.status !== 'ready' || hydration.slot !== activeSlot || !saveSession.canSave(activeSlot)) return;
    let active = true;
    void saveCampaignProfile(profile, activeSlot).then((saved) => {
      if (active && saveSession.canSave(activeSlot)) setSaveFailed(!saved);
    });
    return () => { active = false; };
  }, [activeSlot, hydration, profile, saveSession]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    const url = new URL(window.location.href);
    if (section === 'title') url.searchParams.delete('section');
    else url.searchParams.set('section', section);
    window.history.replaceState(null, '', url);
  }, [section, activeMissionId]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const navigate = useCallback((nextSection: NavigationSection) => {
    setSection(nextSection);
    if (nextSection !== 'campaign') setActiveMissionId(null);
    else if (profile.battleAttempt) setActiveMissionId(profile.battleAttempt.missionId);
  }, [profile.battleAttempt]);

  const launchMission = useCallback((missionId: string, doctrine: BattleDoctrine, difficulty: MissionDifficulty) => {
    const id = createBattleAttemptId();
    if (beginCampaignBattle(profile, missionId, doctrine, difficulty, id) === profile) {
      setNotice({ title: '출전 준비 확인', detail: '진행 중인 작전을 먼저 이어가거나 정리하고, 선택과 출격조 편성을 확인해 주세요.' });
      return;
    }
    setProfile((current) => beginCampaignBattle(current, missionId, doctrine, difficulty, id));
    setActiveMissionId(missionId);
    setSection('campaign');
  }, [profile]);

  const checkpointBattle = useCallback((patch: CampaignBattleCheckpointPatch) => {
    if (!activeAttemptId || liveBattleSession.current !== battleSession || !saveSession.canSave(activeSlot)) return;
    setProfile((current) => liveBattleSession.current === battleSession && saveSession.canSave(activeSlot)
      ? saveCampaignBattleCheckpoint(current, activeAttemptId, patch) : current);
  }, [activeAttemptId, activeSlot, battleSession, saveSession]);

  const finishMission = useCallback((state: BattleState) => {
    if (!activeAttemptId || liveBattleSession.current !== battleSession || !saveSession.canSave(activeSlot)) return;
    setProfile((current) => liveBattleSession.current === battleSession && saveSession.canSave(activeSlot)
      ? settleCampaignBattle(current, activeAttemptId, state) : current);
  }, [activeAttemptId, activeSlot, battleSession, saveSession]);

  const restartBattle = useCallback((mode: CampaignBattleMode) => {
    if (!activeAttemptId || liveBattleSession.current !== battleSession || !saveSession.canSave(activeSlot)) return;
    const nextId = createBattleAttemptId();
    setProfile((current) => liveBattleSession.current === battleSession && saveSession.canSave(activeSlot)
      ? restartCampaignBattle(current, activeAttemptId, nextId, mode) : current);
  }, [activeAttemptId, activeSlot, battleSession, saveSession]);

  const resumeBattle = () => {
    if (!profile.battleAttempt) return;
    setSection('campaign');
    setActiveMissionId(profile.battleAttempt.missionId);
  };

  const discardBattle = () => {
    const saved = profile.battleAttempt;
    if (!saved || !window.confirm('저장된 작전 진행을 정리하고 출전 준비로 돌아갈까요? 이미 받은 보상과 이야기 선택은 유지됩니다.')) return;
    setProfile((current) => abandonCampaignBattle(current, saved.id));
    setActiveMissionId(null);
  };

  const leaveBattle = () => {
    if (activeAttempt?.settled) setProfile((current) => abandonCampaignBattle(current, activeAttempt.id));
    setActiveMissionId(null);
  };

  const openMission = useCallback((missionId: string) => {
    setFocusedMissionId(missionId);
    setActiveMissionId(null);
    setSection('campaign');
  }, []);

  const handleUpgradeFacility = useCallback((facilityId: FacilityId) => {
    setProfile((current) => upgradeFacility(current, facilityId));
    setNotice({ title: '시설 확장 완료', detail: '본부 효과가 조장단의 다음 출격에 반영됩니다.' });
  }, []);

  const handlePlaceFacility = useCallback((slot: number, facilityId: FacilityId) => {
    setProfile((current) => placeHeadquartersRoom(current, slot, facilityId));
    setNotice({ title: '본부 구역 재배치', detail: '시설 동선이 다음 활동과 파견 화면에 반영되었습니다.' });
  }, []);

  const handleUnlockNode = useCallback((heroId: string, nodeId: string) => {
    setProfile((current) => unlockHeroNode(current, heroId, nodeId));
    setNotice({ title: '체능 노드 개방', detail: '새 성장 효과가 즉시 적용되었습니다.' });
  }, []);

  const handleToggleSquadMember = useCallback((heroId: string) => {
    setProfile((current) => toggleSquadMember(current, heroId));
  }, []);

  const handleEquipItem = useCallback((heroId: string, equipmentId: string) => {
    setProfile((current) => equipHeroItem(current, heroId, equipmentId));
    setNotice({ title: '장비 변경', detail: '생명·방어·기술 위력 수치가 갱신되었습니다.' });
  }, []);

  const handleDispatch = useCallback((dispatchId: string) => {
    setProfile((current) => resolveDispatch(current, dispatchId));
    setNotice({ title: '파견대 귀환', detail: '자원과 평판, 회수 장비를 지휘 기록에 반영했습니다.' });
  }, []);

  const handleAdvanceDay = useCallback(() => {
    setProfile((current) => advanceDay(current));
    setNotice({ title: '새로운 하루', detail: '지휘 행동이 회복되고 본부 수입이 정산되었습니다.' });
  }, []);

  const handleTraining = useCallback((heroId: string, focus: TrainingFocus) => {
    setProfile((current) => performTraining(current, heroId, focus));
    setNotice({ title: '훈련 완료', detail: '경험치와 유대, 일일 지휘 목표가 갱신되었습니다.' });
  }, []);

  const handleBondActivity = useCallback((firstHeroId: string, secondHeroId: string) => {
    setProfile((current) => performBondActivity(current, firstHeroId, secondHeroId));
    setNotice({ title: '연계 훈련 완료', detail: '두 조장의 유대 기록이 한 단계 가까워졌습니다.' });
  }, []);

  const handleDailyActivity = useCallback((activityId: DailyActivityId) => {
    setProfile((current) => performDailyActivity(current, activityId));
    setNotice({ title: '현장 활동 완료', detail: '자원과 세력 평판 변화를 정산했습니다.' });
  }, []);

  const handleCraft = useCallback((equipmentId: string) => {
    setProfile((current) => craftEquipment(current, equipmentId));
    setNotice({ title: '유산 장비 복원', detail: '완성된 장비를 조장단 메뉴에서 장착할 수 있습니다.' });
  }, []);

  const handleClaimDailyOrders = useCallback(() => {
    setProfile((current) => claimDailyOrders(current));
    setNotice({ title: '일일 지휘 완수', detail: '균형 잡힌 지휘 보상으로 보급·정보·유물을 획득했습니다.' });
  }, []);

  const handleChooseStory = useCallback((missionId: string, choiceId: RaonStoryChoiceId) => {
    setProfile((current) => chooseRaonStoryPath(current, missionId, choiceId));
    setNotice({ title: '라온의 선택', detail: '이 답은 라온의 성향과 다음 전투의 시작 조건에 남습니다.' });
  }, []);

  const handleChooseOrigin = useCallback((sceneId: string, choiceId: string) => {
    setProfile((current) => chooseOriginStoryPath(current, sceneId, choiceId));
  }, []);

  const handleAdvanceOrigin = useCallback(() => {
    setProfile((current) => liveBattleSession.current === battleSession && saveSession.canSave(activeSlot)
      && current.originStory.currentSceneId === profile.originStory.currentSceneId ? advanceOriginStory(current) : current);
  }, [activeSlot, battleSession, profile.originStory.currentSceneId, saveSession]);

  const handleStartFieldExam = useCallback(() => {
    setProfile((current) => liveBattleSession.current === battleSession && saveSession.canSave(activeSlot) ? startFieldExam(current) : current);
  }, [activeSlot, battleSession, saveSession]);
  const handleFieldExamPlan = useCallback((plan: FieldExamPlan) => {
    if (fieldAttempt === undefined || fieldTurn === undefined) return;
    setProfile((current) => liveBattleSession.current === battleSession && saveSession.canSave(activeSlot)
      ? applyFieldExamPlan(current, fieldAttempt, fieldTurn, plan) : current);
  }, [activeSlot, battleSession, fieldAttempt, fieldTurn, saveSession]);
  const handleRetryFieldExam = useCallback(() => {
    setProfile((current) => liveBattleSession.current === battleSession && saveSession.canSave(activeSlot)
      && current.originStory.fieldExam?.attempt === fieldAttempt ? retryFieldExam(current) : current);
  }, [activeSlot, battleSession, fieldAttempt, saveSession]);
  const handleFieldExamReturn = useCallback(() => {
    if (fieldAttempt === undefined) return;
    setProfile((current) => liveBattleSession.current === battleSession && saveSession.canSave(activeSlot)
      ? completeFieldExamReturn(current, fieldAttempt) : current);
  }, [activeSlot, battleSession, fieldAttempt, saveSession]);

  const handleStartPetalTraining = useCallback(() => {
    setProfile((current) => liveBattleSession.current === battleSession && saveSession.canSave(activeSlot) ? startPetalTraining(current) : current);
  }, [activeSlot, battleSession, saveSession]);
  const handlePetalTrainingAction = useCallback((action: PetalTrainingAction) => {
    if (trainingAttempt === undefined || trainingTurn === undefined) return;
    setProfile((current) => liveBattleSession.current === battleSession && saveSession.canSave(activeSlot)
      ? applyPetalTrainingAction(current, trainingAttempt, trainingTurn, action) : current);
  }, [activeSlot, battleSession, trainingAttempt, trainingTurn, saveSession]);
  const handleRetryPetalTraining = useCallback(() => {
    setProfile((current) => liveBattleSession.current === battleSession && saveSession.canSave(activeSlot)
      && current.originStory.petalTraining?.attempt === trainingAttempt ? retryPetalTraining(current) : current);
  }, [activeSlot, battleSession, trainingAttempt, saveSession]);
  const handleCompletePetalTraining = useCallback(() => {
    if (trainingAttempt === undefined) return;
    setProfile((current) => liveBattleSession.current === battleSession && saveSession.canSave(activeSlot)
      ? completePetalTraining(current, trainingAttempt) : current);
  }, [activeSlot, battleSession, trainingAttempt, saveSession]);

  const handleStartVillageRescue = useCallback(() => setProfile(startVillageRescue), []);
  const handleVillageRescueAction = useCallback((action: VillageRescueAction) => {
    setProfile((current) => applyVillageRescueAction(current, action));
  }, []);
  const handleRetryVillageRescue = useCallback(() => setProfile(retryVillageRescue), []);
  const handleVillageRescueReturn = useCallback(() => setProfile(completeVillageRescueReturn), []);

  const handleVillageMove = useCallback((x: number, y: number, landmark?: string) => {
    setProfile((current) => ({
      ...current,
      world: executeGameCommand(current.world, { type: 'move', x, y, landmark }).state,
    }));
  }, []);

  const resetCampaign = useCallback(() => {
    liveBattleSession.current += 1;
    setBattleSession(liveBattleSession.current);
    saveSession.startNew(activeSlot);
    setProfile(createNewCampaignProfile());
    setHydration({ slot: activeSlot, status: 'ready' });
    setActiveMissionId(null);
    setFocusedMissionId(undefined);
    setSection('title');
  }, [activeSlot, saveSession]);

  const selectCampaignSlot = useCallback((slot: number) => {
    if (slot === activeSlot) return;
    liveBattleSession.current += 1;
    setBattleSession(liveBattleSession.current);
    saveSession.invalidate();
    setHydration({ slot, status: 'loading' });
    setActiveCampaignSlot(slot);
    setActiveSlot(slot);
    setActiveMissionId(null);
    setFocusedMissionId(undefined);
  }, [activeSlot, saveSession]);

  const withSaveStatus = (content: ReactNode) => <>{content}{saveFailed && (
    <aside className="game-notice save-failure-banner" role="alert">
      <span>!</span><div><strong>최근 진행을 저장하지 못했습니다</strong><small>브라우저 저장 공간을 확인해 주세요. 저장 전 화면을 닫으면 최근 진행을 잃을 수 있습니다.</small></div>
      <button onClick={() => {
        if (saveSession.canSave(activeSlot)) void saveCampaignProfile(profile, activeSlot).then((saved) => {
          if (saveSession.canSave(activeSlot)) setSaveFailed(!saved);
        });
      }}>다시 저장</button>
    </aside>
  )}</>;

  if (hydration.status !== 'ready' || hydration.slot !== activeSlot) {
    const loading = hydration.status === 'loading' || hydration.slot !== activeSlot;
    return (
      <main className="save-recovery" aria-busy={loading}>
        {loading && <i />}
        <strong>{loading ? `슬롯 ${activeSlot}의 여정을 불러오는 중...` : `슬롯 ${activeSlot}의 기록을 확인해 주세요`}</strong>
        <p role="status">{loading ? '저장 기록과 복구 백업을 확인하고 있습니다.' : hydration.message}</p>
        <div>
          {!loading && <button className="secondary-action" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>다시 읽기</button>}
          {[1, 2, 3].filter((slot) => slot !== activeSlot).map((slot) => (
            <button className="secondary-action" key={slot} onClick={() => selectCampaignSlot(slot)}>슬롯 {slot} 선택</button>
          ))}
          <button className="secondary-action" onClick={() => {
            if (window.confirm(`슬롯 ${activeSlot}의 기존 기록을 새 여정으로 교체할까요?`)) resetCampaign();
          }}>이 슬롯에서 새 여정 시작</button>
        </div>
      </main>
    );
  }

  if (section === 'title') {
    return withSaveStatus(
      <TitleScreen
        activeSlot={activeSlot}
        slots={listCampaignSlots().map((slot) => slot.slot === activeSlot ? {
          ...slot, exists: true, day: profile.day, originCompleted: profile.originStory.completed,
          sceneTitle: profile.originStory.completed ? `작전 ${profile.completedMissions.length}건 완료` : getOriginStoryScene(profile.originStory.currentSceneId).title,
          missions: profile.completedMissions.length,
        } : slot)}
        profile={profile}
        onNavigate={navigate}
        onReset={resetCampaign}
        onSelectSlot={selectCampaignSlot}
        onResumeBattle={resumeBattle}
      />
    );
  }

  if (!profile.originStory.completed && ['world', 'roster', 'headquarters', 'activities'].includes(section)) {
    return withSaveStatus(<div className="app-shell"><TopNavigation current={section} onNavigate={navigate} campaignUnlocked={false} /><main className="empty-state"><h2>입단 후에 열리는 기록입니다.</h2><p>먼저 변방 마을에서 라온의 여정을 이어가십시오.</p><button className="secondary-action" onClick={() => navigate('campaign')}>여정 계속</button></main></div>);
  }

  if (section === 'campaign' && !activeMission && !profile.originStory.completed) {
    const originScene = getOriginStoryScene(profile.originStory.currentSceneId);
    const rescue = getVillageRescue(profile);
    if (originScene.id === 'sixteen-petals' && petalTraining) {
      return withSaveStatus(
        <Suspense fallback={<div className="full-engine-loading">폐정원의 수련을 불러오는 중...</div>}>
          <PetalTrainingEncounter key={`${activeSlot}:${battleSession}:${petalTraining.attempt}`} state={petalTraining}
            onStart={handleStartPetalTraining} onAction={handlePetalTrainingAction} onRetry={handleRetryPetalTraining}
            onComplete={handleCompletePetalTraining} onAdvance={handleAdvanceOrigin} onExit={() => setSection('title')} />
        </Suspense>,
      );
    }
    if (originScene.id === 'field-exam' && fieldExam) {
      return withSaveStatus(
        <Suspense fallback={<div className="full-engine-loading">폐광 구조 현장을 불러오는 중...</div>}>
          <FieldExamEncounter key={`${activeSlot}:${battleSession}:${fieldExam.attempt}`} state={fieldExam}
            onStart={handleStartFieldExam} onPlan={handleFieldExamPlan} onRetry={handleRetryFieldExam}
            onReturn={handleFieldExamReturn} onAdvance={handleAdvanceOrigin} onExit={() => setSection('title')} />
        </Suspense>,
      );
    }
    if (originScene.id === 'river-incident' && rescue && ['active', 'failed'].includes(rescue.phase)) {
      return withSaveStatus(
        <Suspense fallback={<div className="full-engine-loading">수로 구출을 불러오는 중...</div>}>
          <VillageRescueEncounter state={rescue} onAction={handleVillageRescueAction} onRetry={handleRetryVillageRescue} onExit={() => setSection('title')} />
        </Suspense>,
      );
    }
    if (isVillageOriginScene(originScene)) {
      return withSaveStatus(
        <Suspense fallback={<div className="full-engine-loading"><i /><span>변방 마을을 불러오는 중...</span></div>}>
          <VillageAdventure
            profile={profile}
            onChoose={handleChooseOrigin}
            onAdvance={handleAdvanceOrigin}
            onMove={handleVillageMove}
            onStartRescue={handleStartVillageRescue}
            onRescueReturn={handleVillageRescueReturn}
            onExit={() => setSection('title')}
          />
        </Suspense>
      );
    }
    return withSaveStatus(
      <OriginStory
        profile={profile}
        onChoose={handleChooseOrigin}
        onAdvance={handleAdvanceOrigin}
        onExit={() => setSection('title')}
      />
    );
  }

  return withSaveStatus(
    <div className="app-shell">
      {!activeMission && <TopNavigation current={section} onNavigate={navigate} campaignUnlocked={profile.originStory.completed} />}
      {!activeMission && section !== 'campaign' && <CommandDeck profile={profile} current={section} onNavigate={navigate} />}
      <main className={`app-main ${activeMission ? 'app-main-battle' : ''}`}>
        {section === 'campaign' && activeMission && activeAttempt && (
          <BattleScreen
            key={`${activeSlot}:${activeAttempt.id}`}
            initialAttempt={activeAttempt}
            doctrine={activeAttempt.doctrine}
            difficulty={activeAttempt.difficulty}
            mission={activeMission}
            heroes={activeAttempt.heroes}
            raonStance={activeAttempt.raonStance}
            warPressure={activeAttempt.warPressure}
            bondSupport={activeAttempt.bondSupport}
            onCheckpoint={checkpointBattle}
            onRestart={restartBattle}
            onComplete={finishMission}
            onExit={leaveBattle}
          />
        )}
        {section === 'campaign' && !activeMission && (
          <CampaignHub
            profile={profile}
            focusMissionId={focusedMissionId}
            onLaunch={launchMission}
            onNavigate={navigate}
            onToggleHero={handleToggleSquadMember}
            onChooseStory={handleChooseStory}
            onResumeBattle={resumeBattle}
            onDiscardBattle={discardBattle}
          />
        )}
        {section === 'world' && <WorldMap profile={profile} onOpenMission={openMission} />}
        {section === 'headquarters' && (
          <Headquarters profile={profile} onUpgrade={handleUpgradeFacility} onDispatch={handleDispatch} onPlaceFacility={handlePlaceFacility} />
        )}
        {section === 'activities' && (
          <Activities
            profile={profile}
            onAdvanceDay={handleAdvanceDay}
            onTrain={handleTraining}
            onBond={handleBondActivity}
            onFieldActivity={handleDailyActivity}
            onCraft={handleCraft}
            onClaimDailyOrders={handleClaimDailyOrders}
          />
        )}
        {section === 'roster' && (
          <Roster profile={profile} onUnlockNode={handleUnlockNode} onEquip={handleEquipItem} />
        )}
        {section === 'chronicle' && <Chronicle profile={profile} />}
        {section === 'codex' && <Codex profile={profile} />}
        {section === 'archive' && <PlayerArchive profile={profile} />}
      </main>
      {notice && (
        <div className="game-notice" role="status" aria-live="polite">
          <span>✓</span><div><strong>{notice.title}</strong><small>{notice.detail}</small></div>
          <button aria-label="알림 닫기" onClick={() => setNotice(null)}>×</button>
        </div>
      )}
    </div>
  );
}

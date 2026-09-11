import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { ArchiveGallery } from './components/ArchiveGallery';
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
import { getRaonStoryBeat } from './data/story';
import { isVillageOriginScene } from './data/village';
import type { BattleDoctrine } from './game/battleEngine';
import { executeGameCommand } from './game/simulation';
import {
  buildProgressedHeroes,
  advanceDay,
  advanceOriginStory,
  completeMission,
  createNewCampaignProfile,
  craftEquipment,
  claimDailyOrders,
  chooseRaonStoryPath,
  chooseOriginStoryPath,
  equipHeroItem,
  getBondKey,
  getActiveCampaignSlot,
  getWarPressure,
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
import type { BattleState, DailyActivityId, FacilityId, MissionDifficulty, NavigationSection, RaonStoryChoiceId, TrainingFocus } from './types';

const VillageAdventure = lazy(() => import('./components/VillageAdventure').then((module) => ({ default: module.VillageAdventure })));
const navigationSections: NavigationSection[] = [
  'title', 'campaign', 'world', 'roster', 'headquarters', 'activities', 'chronicle', 'codex', 'archive',
];

export function App() {
  const [section, setSection] = useState<NavigationSection>(() => {
    const requestedSection = new URLSearchParams(window.location.search).get('section') as NavigationSection | null;
    return requestedSection && navigationSections.includes(requestedSection) ? requestedSection : 'title';
  });
  const [activeSlot, setActiveSlot] = useState(getActiveCampaignSlot);
  const [profile, setProfile] = useState(() => loadCampaignProfile(activeSlot));
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const [focusedMissionId, setFocusedMissionId] = useState<string | undefined>();
  const [activeDoctrine, setActiveDoctrine] = useState<BattleDoctrine>('shelter');
  const [activeDifficulty, setActiveDifficulty] = useState<MissionDifficulty>('standard');
  const [activeStoryChoice, setActiveStoryChoice] = useState<RaonStoryChoiceId>('resolve');
  const [notice, setNotice] = useState<{ title: string; detail: string } | null>(null);
  const activeMission = activeMissionId ? getMission(activeMissionId) : undefined;
  const progressedHeroes = useMemo(() => buildProgressedHeroes(profile), [profile]);
  const deployedHeroes = useMemo(
    () => progressedHeroes.filter((hero) => profile.activeSquad.includes(hero.id)),
    [profile.activeSquad, progressedHeroes],
  );
  const activeStoryBeat = activeMission ? getRaonStoryBeat(activeMission.id) : undefined;
  const activeWarPressure = getWarPressure(profile).value;
  const activeBondSupport = activeStoryBeat
    ? profile.bondLevels[getBondKey('raon', activeStoryBeat.companionId)] ?? 0
    : 0;

  useEffect(() => {
    saveCampaignProfile(profile, activeSlot);
  }, [activeSlot, profile]);

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
  }, []);

  const launchMission = useCallback((missionId: string, doctrine: BattleDoctrine, difficulty: MissionDifficulty) => {
    setActiveMissionId(missionId);
    setActiveDoctrine(doctrine);
    setActiveDifficulty(difficulty);
    setActiveStoryChoice(profile.storyChoices[missionId] ?? 'resolve');
    setSection('campaign');
  }, [profile.storyChoices]);

  const finishMission = useCallback((state: BattleState) => {
    const mission = getMission(state.missionId);
    if (!mission) return;
    setProfile((current) => completeMission(current, mission, state).profile);
    setNotice({ title: '작전 기록 반영', detail: `${mission.title} 전투 결과와 최고 등급을 저장했습니다.` });
  }, []);

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
    setProfile((current) => advanceOriginStory(current));
  }, []);

  const handleVillageMove = useCallback((x: number, y: number, landmark?: string) => {
    setProfile((current) => ({
      ...current,
      world: executeGameCommand(current.world, { type: 'move', x, y, landmark }).state,
    }));
  }, []);

  const resetCampaign = useCallback(() => {
    setProfile(createNewCampaignProfile());
    setActiveMissionId(null);
    setFocusedMissionId(undefined);
    setSection('title');
  }, []);

  const selectCampaignSlot = useCallback((slot: number) => {
    setActiveCampaignSlot(slot);
    setActiveSlot(slot);
    setProfile(loadCampaignProfile(slot));
    setActiveMissionId(null);
    setFocusedMissionId(undefined);
  }, []);

  if (section === 'title') {
    return (
      <TitleScreen
        activeSlot={activeSlot}
        slots={listCampaignSlots()}
        profile={profile}
        onNavigate={navigate}
        onReset={resetCampaign}
        onSelectSlot={selectCampaignSlot}
      />
    );
  }

  if (section === 'campaign' && !activeMission && !profile.originStory.completed) {
    const originScene = getOriginStoryScene(profile.originStory.currentSceneId);
    if (isVillageOriginScene(originScene)) {
      return (
        <Suspense fallback={<div className="full-engine-loading"><i /><span>변방 마을을 불러오는 중...</span></div>}>
          <VillageAdventure
            profile={profile}
            onChoose={handleChooseOrigin}
            onAdvance={handleAdvanceOrigin}
            onMove={handleVillageMove}
            onExit={() => setSection('title')}
          />
        </Suspense>
      );
    }
    return (
      <OriginStory
        profile={profile}
        onChoose={handleChooseOrigin}
        onAdvance={handleAdvanceOrigin}
        onExit={() => setSection('title')}
      />
    );
  }

  return (
    <div className="app-shell">
      <TopNavigation current={section} onNavigate={navigate} />
      {!activeMission && section !== 'campaign' && <CommandDeck profile={profile} current={section} onNavigate={navigate} />}
      <main className={`app-main ${activeMission ? 'app-main-battle' : ''}`}>
        {section === 'campaign' && activeMission && (
          <BattleScreen
            doctrine={activeDoctrine}
            difficulty={activeDifficulty}
            mission={activeMission}
            heroes={deployedHeroes}
            raonStance={activeStoryChoice}
            warPressure={activeWarPressure}
            bondSupport={activeBondSupport}
            onComplete={finishMission}
            onExit={() => setActiveMissionId(null)}
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
        {section === 'chronicle' && <Chronicle />}
        {section === 'codex' && <Codex battleCompleted={profile.completedMissions.length > 0} />}
        {section === 'archive' && <ArchiveGallery />}
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

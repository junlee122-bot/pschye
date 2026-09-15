import { Archive, BookOpenText, ChevronRight, Clock3, Footprints, HardDrive, RotateCcw, Sparkles } from 'lucide-react';
import { getOriginStoryScene, originStoryScenes } from '../data/originStory';
import { raonChoiceMeta } from '../data/story';
import type { CampaignProfile, NavigationSection, RaonStoryChoiceId } from '../types';
import type { CampaignSlotSummary } from '../game/persistence';
import { getVillageRescue } from '../game/villageRescueProgression';
import { getFieldExam } from '../game/fieldExamProgression';
import { getPetalTraining } from '../game/petalTrainingProgression';
import { getCaptainTrial } from '../game/captainTrialProgression';
import { getKnownMissions } from '../game/storyAccess';
import { BattleResumeCard } from './BattleResumeCard';

interface TitleScreenProps {
  activeSlot: number;
  slots: CampaignSlotSummary[];
  profile: CampaignProfile;
  onNavigate: (section: NavigationSection) => void;
  onReset: () => void;
  onSelectSlot: (slot: number) => void;
  onResumeBattle?: () => void;
}

export function TitleScreen({ activeSlot, slots, profile, onNavigate, onReset, onSelectSlot, onResumeBattle }: TitleScreenProps) {
  const savedBattle = profile.originStory.completed && profile.battleAttempt
    && getKnownMissions(profile).some((mission) => mission.id === profile.battleAttempt?.missionId)
    ? profile.battleAttempt : undefined;
  const hasProgress = profile.originStory.completedSceneIds.length > 0
    || Object.keys(profile.originStory.choices).length > 0
    || profile.completedMissions.length > 0
    || Object.keys(profile.storyChoices).length > 0;
  const originScene = getOriginStoryScene(profile.originStory.currentSceneId);
  const rescue = originScene.id === 'river-incident' ? getVillageRescue(profile) : undefined;
  const fieldExam = getFieldExam(profile);
  const petalTraining = getPetalTraining(profile);
  const captainTrial = getCaptainTrial(profile);
  const trialOpponent = captainTrial ? { 'captain-trials': '카인', 'kazrin-duel': '카즈린', 'hadori-wall': '하도리' }[captainTrial.sceneId] : undefined;
  const trialResume = captainTrial ? {
    ready: `${trialOpponent} 대결 준비`,
    active: captainTrial.sceneId === 'hadori-wall' ? '하도리에게 첫 발을 내딛을 차례' : `${trialOpponent} 대결 중 · 승부 ${captainTrial.progress}/3 · 균형 ${captainTrial.poise}/6`,
    failed: `${trialOpponent} 대결 · 다시 시도할 차례`,
    resolved: captainTrial.sceneId === 'hadori-wall' ? '하도리 도전전 종료 · 의무동으로' : `${trialOpponent} 대결 · 승부 확인 대기`,
    complete: captainTrial.sceneId === 'hadori-wall' ? '의무동 · 하도리와 나눌 말' : `${trialOpponent} 대결 마무리 · 다음 장면으로`,
  }[captainTrial.phase] : undefined;
  const trainingResume = petalTraining ? {
    ready: '마루 수련 준비 · 선택한 방침으로 시작',
    active: `마루 수련 중 · 궤적 ${petalTraining.petals}/16 · 부담 ${petalTraining.burden}/8`,
    failed: '마루 수련 · 쉬고 다시 연습할 차례',
    review: '열여섯 궤적 연결 · 마루 앞 마무리 대기',
    complete: '마루 수련 마무리 · 조장 선발전으로',
  }[petalTraining.phase] : undefined;
  const fieldResume = fieldExam ? {
    ready: '폐광 구조 준비 · 선택한 방침으로 시작',
    active: `폐광 구조 중 · ${fieldExam.turn}턴 · 통로 버팀 ${fieldExam.integrity}`,
    failed: '폐광 구조 재도전 대기',
    return: '지원자 둘 출구 도착 · 함께 철수할 차례',
    complete: '폐광 전원 철수 완료 · 선발 12일차로',
  }[fieldExam.phase] : undefined;
  const rescueResume = rescue ? {
    ready: '수로 구출 준비 · 선택한 방법으로 시작',
    active: `수로 구출 중 · ${rescue.turn}턴 · 체력 ${rescue.hp}`,
    failed: '수로 구출 재도전 대기',
    return: '아이 구출 완료 · 마을로 돌아가는 길',
    complete: '무사 귀환 확인 완료 · 선발 공고일로',
  }[rescue.phase] : undefined;
  const dominantPath = (Object.entries(profile.raonPath) as Array<[RaonStoryChoiceId, number]>)
    .sort((left, right) => right[1] - left[1])[0];

  const reset = () => {
    if (window.confirm('현재 여정과 라온의 선택을 지우고 A.S. 84의 첫날부터 다시 시작할까요?')) onReset();
  };

  return (
    <main className="title-screen raon-title-screen">
      <div className="title-backdrop" aria-hidden="true" />
      <div className="title-vignette" aria-hidden="true" />
      <div className="title-content">
        <div className="title-kicker">
          <span>A.S. 84</span>
          <i />
          <span>THE SEVENTH GENERATION</span>
        </div>
        <h1>
          라온제나
          <span>RAONJENA</span>
        </h1>
        <p className="title-epigraph">
          나는 카즈린을 따라 변방 마을을 나왔다.
          <br />영웅의 검을 빌리기 전, 내 이야기는 그곳에서 시작됐다.
        </p>

        <div className="title-viewpoint-note">
          <Footprints size={18} />
          <div><strong>라온 시점 스토리 RPG</strong><span>선택 · 동료 관계 · 전투 · 기억이 하나의 여정으로 이어집니다.</span></div>
        </div>

        <div className="title-actions">
          <button className="primary-action" onClick={() => savedBattle && onResumeBattle ? onResumeBattle() : onNavigate('campaign')}>
            <Footprints size={18} />
            {savedBattle ? savedBattle.battle.outcome === 'active' ? '저장된 작전 이어하기' : '저장된 결과 보기' : hasProgress ? '라온의 이야기 계속' : '변방 마을에서 시작'}
            <ChevronRight size={18} />
          </button>
          <button className="secondary-action" onClick={() => onNavigate('codex')}>
            <BookOpenText size={17} /> 만난 사람
          </button>
          <button className="secondary-action" onClick={() => onNavigate('archive')}>
            <Archive size={17} /> 여정 화첩
          </button>
        </div>

        <BattleResumeCard profile={profile} compact />

        <section className="title-save-slots" aria-label="여정 저장 슬롯">
          <div className="title-save-heading"><HardDrive size={15} /><span>오프라인 자동 저장 · 슬롯 {activeSlot}</span></div>
          <div className="title-save-grid">
            {slots.map((slot) => (
              <button
                key={slot.slot}
                className={slot.slot === activeSlot ? 'active' : ''}
                onClick={() => onSelectSlot(slot.slot)}
                aria-pressed={slot.slot === activeSlot}
              >
                <span>SLOT {String(slot.slot).padStart(2, '0')}</span>
                <strong>{slot.exists ? slot.sceneTitle : '새로운 라온'}</strong>
                <small><Clock3 size={11} /> {slot.exists ? `DAY ${slot.day} · 작전 ${slot.missions}` : '변방 마을에서 시작'}</small>
              </button>
            ))}
          </div>
        </section>

        <div className="title-status raon-title-status">
          <div>
            <Sparkles size={17} />
            <span>{dominantPath && dominantPath[1] > 0 ? `지금의 라온 · ${raonChoiceMeta[dominantPath[0]].label}` : '아직 어떤 답도 고르지 않은 라온'}</span>
          </div>
          <div>
            <span className={`status-dot ${hasProgress ? 'complete' : ''}`} />
            <span>
              {!profile.originStory.completed
                ? trialResume ?? trainingResume ?? fieldResume ?? rescueResume ?? `서장 ${Math.min(originScene.sequence, originStoryScenes.length)} / ${originStoryScenes.length} · ${originScene.title}`
                : `입단 완료 · 작전 ${profile.completedMissions.length}건 · 여정 DAY ${profile.day}`}
            </span>
          </div>
        </div>
      </div>
      <footer className="title-footer">
        <span>ONE BOY · ONE BORROWED SWORD · ONE NEW ANSWER</span>
        <button className="title-reset" onClick={reset}><RotateCcw size={12} /> 여정 초기화</button>
      </footer>
    </main>
  );
}

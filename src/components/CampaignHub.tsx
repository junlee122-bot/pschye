import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  ArrowRight,
  Brain,
  Check,
  ClipboardCheck,
  Crosshair,
  Dice5,
  Eye,
  Flame,
  Heart,
  Link2,
  LockKeyhole,
  MapPin,
  MessageCircle,
  Search,
  Shield,
  Sparkles,
  Swords,
  UsersRound,
} from 'lucide-react';
import { heroDefinitions } from '../data/battle';
import { missions } from '../data/campaign';
import { originStoryScenes } from '../data/originStory';
import { getRaonStoryBeat, raonChoiceMeta } from '../data/story';
import { getFieldSceneDirection } from '../data/characterPresentation';
import {
  getAdjustedMissionReward,
  getMissionStatus,
  getNarrativeCheckChance,
} from '../game/progression';
import { battleDifficultyOptions, type BattleDoctrine } from '../game/battleEngine';
import { getKnownMissions } from '../game/storyAccess';
import { hasValidCampaignSquad } from '../game/missionAccess';
import { BattleResumeCard } from './BattleResumeCard';
import { RaonMindPanel } from './RaonMindPanel';
import { CharacterDialogueStage } from './CharacterDialogueStage';
import type {
  CampaignProfile,
  MissionDifficulty,
  NavigationSection,
  RaonStoryChoiceId,
} from '../types';

interface CampaignHubProps {
  profile: CampaignProfile;
  focusMissionId?: string;
  onLaunch: (missionId: string, doctrine: BattleDoctrine, difficulty: MissionDifficulty) => void;
  onNavigate: (section: NavigationSection) => void;
  onToggleHero: (heroId: string) => void;
  onChooseStory: (missionId: string, choiceId: RaonStoryChoiceId) => void;
  onResumeBattle?: () => void;
  onDiscardBattle?: () => void;
}

const choiceIcons = {
  compassion: Heart,
  insight: Search,
  resolve: Flame,
};

type StoryStage = 'scene' | 'voices' | 'choice' | 'briefing';

const storyStages: Array<{ id: StoryStage; label: string; subtitle: string; icon: typeof MessageCircle }> = [
  { id: 'scene', label: '장면', subtitle: '보고 듣기', icon: MessageCircle },
  { id: 'voices', label: '내면', subtitle: '라온의 생각', icon: Brain },
  { id: 'choice', label: '결정', subtitle: '말과 대가', icon: Dice5 },
  { id: 'briefing', label: '출전', subtitle: '전술 준비', icon: ClipboardCheck },
];

export function CampaignHub({
  profile,
  focusMissionId,
  onLaunch,
  onNavigate,
  onToggleHero,
  onChooseStory,
  onResumeBattle,
  onDiscardBattle,
}: CampaignHubProps) {
  const knownMissions = getKnownMissions(profile);
  const knownMissionIds = new Set(knownMissions.map((mission) => mission.id));
  const firstAvailable = knownMissions.find((mission) => getMissionStatus(profile, mission) === 'available') ?? knownMissions[0];
  const allowedFocusId = knownMissions.find((mission) => mission.id === focusMissionId)?.id;
  const [selectedMissionId, setSelectedMissionId] = useState(allowedFocusId ?? firstAvailable?.id);
  const [doctrine, setDoctrine] = useState<BattleDoctrine>('shelter');
  const [difficulty, setDifficulty] = useState<MissionDifficulty>('standard');
  const [storyStage, setStoryStage] = useState<StoryStage>('scene');

  useEffect(() => {
    if (allowedFocusId) {
      setSelectedMissionId(allowedFocusId);
      setStoryStage('scene');
    }
  }, [allowedFocusId]);

  const selectedMission = knownMissions.find((mission) => mission.id === selectedMissionId)
    ?? knownMissions.find((mission) => mission.id === allowedFocusId)
    ?? firstAvailable;
  const visibleMissionId = selectedMission?.id;
  useEffect(() => {
    if (selectedMissionId === visibleMissionId) return;
    setSelectedMissionId(visibleMissionId);
    setStoryStage('scene');
    setDifficulty('standard');
    setDoctrine('shelter');
  }, [selectedMissionId, visibleMissionId]);
  const storyBeat = selectedMission ? getRaonStoryBeat(selectedMission.id) : undefined;
  const selectedChoiceId = selectedMission ? profile.storyChoices[selectedMission.id] : undefined;
  const selectedChoice = storyBeat?.choices.find((choice) => choice.id === selectedChoiceId);
  const narrativeCheck = selectedMission ? profile.narrativeChecks[selectedMission.id] : undefined;
  const relationshipMemory = selectedMission ? profile.relationshipMemories[selectedMission.id] : undefined;
  const missionStatus = selectedMission ? getMissionStatus(profile, selectedMission) : 'locked';
  const pendingBattle = profile.battleAttempt && !profile.battleAttempt.settled;
  const choiceLocked = Boolean(pendingBattle && profile.battleAttempt?.missionId === selectedMission?.id);
  const squadValid = hasValidCampaignSquad(profile);

  useEffect(() => {
    if (selectedChoice) setDoctrine(selectedChoice.doctrine);
  }, [selectedChoice]);

  const actCompleted = useMemo(
    () => missions.filter((mission) => profile.completedMissions.includes(mission.id)).length,
    [profile.completedMissions],
  );
  const dominantOriginPath = (Object.entries(profile.raonPath) as Array<[RaonStoryChoiceId, number]>)
    .sort((left, right) => right[1] - left[1])[0];
  const originMemories = originStoryScenes
    .filter((scene) => profile.originStory.choices[scene.id])
    .slice(-3)
    .map((scene) => scene.choices.find((choice) => choice.id === profile.originStory.choices[scene.id]))
    .filter(Boolean);

  if (!selectedMission || !storyBeat) return null;

  const playable = missionStatus === 'available' || missionStatus === 'complete';
  const companion = heroDefinitions.find((hero) => hero.id === storyBeat.companionId) ?? heroDefinitions[0];
  const raon = heroDefinitions.find((hero) => hero.id === 'raon') ?? heroDefinitions[0];
  const activeLevels = profile.activeSquad.map((id) => profile.heroProgress[id]?.level ?? 1);
  const averageLevel = activeLevels.reduce((total, level) => total + level, 0) / Math.max(1, activeLevels.length);
  const readiness = Math.max(20, Math.min(100, Math.round(
    42 + profile.activeSquad.length * 6 + (averageLevel - selectedMission.recommendedLevel) * 10,
  )));
  const adjustedReward = getAdjustedMissionReward(selectedMission, difficulty);
  const fieldDirection = getFieldSceneDirection(selectedChoice?.id);

  const selectMission = (missionId: string) => {
    if (!knownMissionIds.has(missionId)) return;
    setSelectedMissionId(missionId);
    setStoryStage('scene');
    setDifficulty('standard');
    const nextChoice = getRaonStoryBeat(missionId)?.choices.find((choice) => choice.id === profile.storyChoices[missionId]);
    setDoctrine(nextChoice?.doctrine ?? 'shelter');
  };

  const chooseStory = (choiceId: RaonStoryChoiceId) => {
    if (choiceLocked) return;
    const choice = storyBeat.choices.find((entry) => entry.id === choiceId);
    if (!choice) return;
    onChooseStory(selectedMission.id, choiceId);
    setDoctrine(choice.doctrine);
  };

  return (
    <section className="raon-journey-page page-enter">
      <header className="raon-journey-heading">
        <div>
          <span className="eyebrow">RAON'S JOURNEY · A.S. 84</span>
          <h2>라온의 기록</h2>
          <p>변방 마을에서 고른 답을 품고, 이제 제2조장 라온의 첫 실전이 시작됩니다.</p>
        </div>
        <div className="journey-progress" aria-label="제1부 진행도">
          <span>제1부 · 꽃잎이 피기 전</span>
          <strong>{actCompleted}<small> / {missions.length}</small></strong>
          <i><b style={{ width: `${(actCompleted / Math.max(1, missions.length)) * 100}%` }} /></i>
        </div>
      </header>

      <BattleResumeCard profile={profile} onResume={onResumeBattle ?? (() => onNavigate('campaign'))} onDiscard={onDiscardBattle} />
      {pendingBattle && <p className="battle-preparation-notice">저장된 작전을 이어가거나 진행을 정리하면 새로 출전할 수 있습니다. 편성·성장·장비·교리·난이도 변경은 다음 새 출전에 적용됩니다.</p>}

      <section className="origin-recap-card">
        <div className="origin-recap-lead">
          <span><Sparkles size={15} /> 입단 기록</span>
          <strong>{dominantOriginPath ? `${raonChoiceMeta[dominantOriginPath[0]].label}의 라온` : '아직 이름 붙지 않은 라온'}</strong>
          <p>선발 평가 {profile.originStory.selectionScore}점 · 프시케 제7기 제2조장</p>
        </div>
        <div className="origin-recap-paths">
          {(Object.entries(raonChoiceMeta) as Array<[RaonStoryChoiceId, typeof raonChoiceMeta.compassion]>).map(([path, meta]) => {
            const Icon = choiceIcons[path];
            return <span key={path} className={path}><Icon size={14} /> {meta.label}<b>{profile.raonPath[path]}</b></span>;
          })}
        </div>
        <div className="origin-recap-memories">
          {originMemories.map((choice) => choice && <span key={choice.id}>“{choice.line}”</span>)}
        </div>
      </section>

      <nav className="story-chapter-rail" aria-label="라온의 장면 목록">
        {missions.map((mission, index) => {
          const known = knownMissionIds.has(mission.id);
          const status = known ? getMissionStatus(profile, mission) : 'locked';
          return (
            <button
              key={mission.id}
              className={`${status} ${mission.id === selectedMission.id ? 'selected' : ''}`}
              onClick={() => selectMission(mission.id)}
              disabled={!known}
              aria-label={`${mission.operation} · ${known ? mission.title : '미공개 작전'}`}
              aria-current={mission.id === selectedMission.id ? 'step' : undefined}
            >
              <span>{status === 'complete' ? <Check size={14} /> : status === 'locked' ? <LockKeyhole size={13} /> : index + 1}</span>
              <div><small>{mission.operation}</small><strong>{known ? mission.title : '미공개 작전'}</strong></div>
              {known && profile.missionGrades[mission.id] && <b>{profile.missionGrades[mission.id]}</b>}
            </button>
          );
        })}
      </nav>

      <nav className="narrative-stage-rail" aria-label="현재 장면 진행 단계">
        {storyStages.map((stage, index) => {
          const Icon = stage.icon;
          const locked = stage.id === 'briefing' && !selectedChoiceId;
          return (
            <button
              key={stage.id}
              className={`${storyStage === stage.id ? 'active' : ''} ${locked ? 'locked' : ''}`}
              onClick={() => !locked && setStoryStage(stage.id)}
              disabled={locked}
              aria-current={storyStage === stage.id ? 'step' : undefined}
            >
              <span>{locked ? <LockKeyhole size={14} /> : <Icon size={15} />}</span>
              <div><small>STEP {index + 1}</small><strong>{stage.label}</strong><em>{stage.subtitle}</em></div>
            </button>
          );
        })}
      </nav>

      <article className="raon-story-scene" hidden={storyStage !== 'scene'}>
        <div className="raon-story-backdrop" style={{ backgroundImage: `url(${selectedMission.background})` }} />
        <div className="raon-story-gradient" />
        <div className="story-scene-copy">
          <div className="story-scene-meta">
            <span>{storyBeat.scene}</span>
            <span>DANGER {selectedMission.threat}</span>
            {missionStatus === 'complete' && <span className="scene-complete"><Check size={13} /> 기록 완료</span>}
          </div>
          <span className="story-scene-kicker">{selectedMission.chapter}</span>
          <h3>{selectedMission.title}</h3>
          <p className="story-narration">{storyBeat.narration}</p>
          <blockquote>
            <span>라온의 생각</span>
            “{storyBeat.monologue}”
          </blockquote>
        </div>
        <div className="raon-scene-portrait" aria-hidden="true">
          <img src={raon?.art} alt="" />
        </div>
      </article>

      <section className="campaign-character-conversation" hidden={storyStage !== 'scene'}>
        <CharacterDialogueStage
          speakerId={companion.id}
          speakerName={companion.name}
          speakerRole={companion.title}
          speakerArt={companion.art}
          dialogue={storyBeat.companionLine}
          direction={fieldDirection}
          contextLabel={storyBeat.scene}
          compact
        />
        <button className="stage-next-button conversation-next" onClick={() => setStoryStage('voices')}>
          내 생각을 정리한다 <ArrowRight size={16} />
        </button>
      </section>

      <div hidden={storyStage !== 'voices'}>
        <RaonMindPanel profile={profile} mission={selectedMission} companion={companion} />
        <div className="stage-navigation-row">
          <button onClick={() => setStoryStage('scene')}>장면 다시 보기</button>
          <button className="stage-next-button" onClick={() => setStoryStage('choice')}>라온의 답을 고른다 <ArrowRight size={16} /></button>
        </div>
      </div>

      <section className="raon-choice-section" hidden={storyStage !== 'choice'}>
        <div className="choice-question">
          <span>라온의 선택</span>
          <h3>{storyBeat.question}</h3>
          <p>정답은 없습니다. 선택은 라온의 성향과 이번 전투의 시작 조건을 바꿉니다.</p>
        </div>
        {choiceLocked && <p className="battle-preparation-notice">저장된 작전을 이어갈 때는 출전 당시 선택을 유지합니다. 새 선택은 진행을 정리한 뒤 고를 수 있습니다.</p>}
        <div className="story-choice-grid">
          {storyBeat.choices.map((choice) => {
            const Icon = choiceIcons[choice.id];
            const selected = selectedChoiceId === choice.id;
            const chance = getNarrativeCheckChance(profile, choice.id, storyBeat.companionId);
            return (
              <button
                key={choice.id}
                className={`story-choice-card choice-${choice.id} ${selected ? 'selected' : ''}`}
                onClick={() => chooseStory(choice.id)}
                disabled={!playable || choiceLocked}
                aria-pressed={selected}
              >
                <span className="choice-icon"><Icon size={19} /></span>
                <small>{raonChoiceMeta[choice.id].label}</small>
                <strong>{choice.title}</strong>
                <p>“{choice.line}”</p>
                <div><Sparkles size={13} /> {raonChoiceMeta[choice.id].battleEffect}</div>
                <div className="choice-check"><Dice5 size={13} /> 뜻을 온전히 전할 확률 {chance}%</div>
                {selected && <b><Check size={13} /> 내가 고른 답</b>}
              </button>
            );
          })}
        </div>
        {narrativeCheck && relationshipMemory && (
          <article className={`narrative-check-result result-${narrativeCheck.outcome}`}>
            <Dice5 size={20} />
            <div>
              <span>{narrativeCheck.outcome === 'clear' ? '의도가 온전히 닿았다' : '대가를 치르고 뜻을 전했다'}</span>
              <strong>{relationshipMemory.reaction}</strong>
              <small>판정 {narrativeCheck.roll} / 성공선 {narrativeCheck.chance} · 실패해도 이야기는 멈추지 않습니다.</small>
            </div>
          </article>
        )}
        <div className="stage-navigation-row">
          <button onClick={() => setStoryStage('voices')}>내면 다시 보기</button>
          <button className="stage-next-button" disabled={!selectedChoice} onClick={() => setStoryStage('briefing')}>선택을 행동으로 옮긴다 <ArrowRight size={16} /></button>
        </div>
      </section>

      <div className="raon-path-layout" hidden={storyStage !== 'briefing'}>
        <section className="raon-path-card panel">
          <div className="panel-heading">
            <span className="eyebrow">WHO RAON BECOMES</span>
            <h3>쌓여 가는 세 가지 마음</h3>
          </div>
          {(['compassion', 'insight', 'resolve'] as const).map((path) => {
            const Icon = choiceIcons[path];
            const value = profile.raonPath[path];
            return (
              <div className={`raon-path-row path-${path}`} key={path}>
                <Icon size={17} />
                <div><strong>{raonChoiceMeta[path].label}</strong><small>{raonChoiceMeta[path].shortEffect}</small></div>
                <i><b style={{ width: `${Math.min(100, value * 18)}%` }} /></i>
                <span>{value}</span>
              </div>
            );
          })}
          <p>누적 성향은 이후 대화, 기록 해석, 라온류의 성장 방향을 바꿉니다.</p>
        </section>

        <section className="story-preparation panel">
          <div className="panel-heading horizontal">
            <div><span className="eyebrow">BEFORE THE BATTLE</span><h3>선택을 행동으로 옮기기</h3></div>
            <span className="readiness-score">준비도 {readiness}%</span>
          </div>

          {selectedChoice ? (
            <div className={`chosen-story-consequence consequence-${selectedChoice.id}`}>
              <span>{raonChoiceMeta[selectedChoice.id].label}</span>
              <strong>{selectedChoice.effect}</strong>
              <small>{raonChoiceMeta[selectedChoice.id].battleEffect}</small>
            </div>
          ) : (
            <div className="choice-required"><Heart size={17} /><span>먼저 라온의 답을 선택해야 출전할 수 있습니다.</span></div>
          )}

          <div className="story-doctrine-selector">
            <span className="console-label">동료의 작전안</span>
            {selectedMission.doctrines.map((option) => (
              <button
                key={option.id}
                className={doctrine === option.id ? 'selected' : ''}
                onClick={() => setDoctrine(option.id)}
                disabled={!playable}
              >
                {option.id === 'shelter' ? <Shield size={18} /> : <Crosshair size={18} />}
                <div><strong>{option.title}</strong><small>{option.author} · {option.description}</small></div>
              </button>
            ))}
          </div>

          <div className="story-difficulty-selector">
            <span className="console-label">이야기 난이도</span>
            <div>
              {battleDifficultyOptions.map((option) => (
                <button
                  key={option.id}
                  className={difficulty === option.id ? 'selected' : ''}
                  onClick={() => setDifficulty(option.id)}
                  disabled={!playable}
                  aria-pressed={difficulty === option.id}
                >
                  <strong>{option.label}</strong><small>{option.subtitle}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="story-combat-promise">
            <article><Eye size={16} /><span><strong>적 의도를 읽고</strong><small>누가 공격받을지 먼저 확인</small></span></article>
            <article><Link2 size={16} /><span><strong>다른 동료와 잇고</strong><small>같은 적 3연계로 브레이크</small></span></article>
            <article><Shield size={16} /><span><strong>모두 돌아온다</strong><small>승리보다 생환을 우선</small></span></article>
          </div>

          <div className="story-launch-footer">
            <div>
              <span>예상 보상</span>
              <strong>XP {selectedMission.reward.xp} · 보급 {adjustedReward.supplies} · 정보 {adjustedReward.intel}</strong>
            </div>
            <button
              className="story-launch-button"
              disabled={!playable || !selectedChoice || !squadValid || Boolean(pendingBattle)}
              aria-describedby={pendingBattle || !squadValid ? 'battle-launch-reason' : undefined}
              onClick={() => onLaunch(selectedMission.id, doctrine, difficulty)}
            >
              {missionStatus === 'complete' ? '이 장면 다시 걷기' : '라온으로 출전하기'} <ArrowRight size={18} />
            </button>
          </div>
          {(pendingBattle || !squadValid) && <p className="battle-launch-reason" id="battle-launch-reason">{pendingBattle ? '저장된 작전을 이어가거나 진행을 정리한 뒤 새로 출전하세요.' : !profile.activeSquad.includes('raon') ? '라온을 포함한 4~6명을 편성해야 출전할 수 있습니다. 출격조에 라온을 추가하세요.' : '라온을 포함한 4~6명의 출격조를 확인하세요.'}</p>}
        </section>
      </div>

      <section className="story-companions panel" hidden={storyStage !== 'briefing'}>
        <div className="panel-heading horizontal">
          <div><span className="eyebrow">TRAVELING COMPANIONS</span><h3>이번 장면에 함께할 사람들</h3></div>
          <button className="story-support-link" onClick={() => onNavigate('roster')}><UsersRound size={15} /> 자세히 보기</button>
        </div>
        <div className="story-companion-strip">
          {heroDefinitions.map((hero) => {
            const deployed = profile.activeSquad.includes(hero.id);
            const isRaon = hero.id === 'raon';
            return (
              <button
                key={hero.id}
                className={deployed ? 'deployed' : ''}
                style={{ '--accent': hero.accent } as CSSProperties}
                onClick={() => (!isRaon || !deployed) && onToggleHero(hero.id)}
                disabled={isRaon && deployed}
                aria-pressed={deployed}
              >
                <img src={hero.art} alt={`${hero.name} 설정화`} />
                <span><strong>{hero.name}</strong><small>{isRaon ? deployed ? '주인공 · 고정' : '주인공 · 편성 필요' : deployed ? '동행' : '대기'}</small></span>
                {deployed && <Check size={14} />}
              </button>
            );
          })}
        </div>
        <div className="story-support-actions">
          <button onClick={() => onNavigate('world')}><MapPin size={15} /> 라온이 본 세계</button>
          <button onClick={() => onNavigate('archive')}><Swords size={15} /> 되살아난 기억</button>
        </div>
      </section>
    </section>
  );
}

import { useEffect, useRef, type CSSProperties } from 'react';
import {
  ArrowLeft,
  BookOpenText,
  ChevronRight,
  Clock3,
  Flame,
  Footprints,
  Heart,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { getOriginStoryScene, originStoryScenes } from '../data/originStory';
import { getOriginSceneDirection } from '../data/characterPresentation';
import { CharacterDialogueStage } from './CharacterDialogueStage';
import type { CampaignProfile, OriginStoryChoice, RaonStoryChoiceId } from '../types';

interface OriginStoryProps {
  profile: CampaignProfile;
  onChoose: (sceneId: string, choiceId: string) => void;
  onAdvance: () => void;
  onExit: () => void;
}

const pathMeta: Record<RaonStoryChoiceId, { label: string; description: string; icon: typeof Heart }> = {
  compassion: { label: '연민', description: '사람을 먼저 보는 라온', icon: Heart },
  insight: { label: '통찰', description: '보이지 않는 길을 읽는 라온', icon: Search },
  resolve: { label: '결의', description: '두려움보다 먼저 걷는 라온', icon: Flame },
};

function getSelectionRemark(score: number) {
  if (score >= 64) return '선발관 주목 · 조장 후보';
  if (score >= 46) return '상위권 평가 · 특이 재능';
  if (score >= 28) return '관찰 대상 · 성장 중';
  return '변방 지원자 · 기록 축적 중';
}

function ChoiceIcon({ choice }: { choice: OriginStoryChoice }) {
  const Icon = pathMeta[choice.path].icon;
  return <Icon size={18} />;
}

export function OriginStory({ profile, onChoose, onAdvance, onExit }: OriginStoryProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const scene = getOriginStoryScene(profile.originStory.currentSceneId);
  const selectedChoiceId = profile.originStory.choices[scene.id];
  const selectedChoice = scene.choices.find((choice) => choice.id === selectedChoiceId);
  const sceneDirection = getOriginSceneDirection(scene.sequence, scene.speakerId, selectedChoice?.path);
  const currentIndex = originStoryScenes.findIndex((entry) => entry.id === scene.id);
  const progress = ((currentIndex + (selectedChoice ? 1 : 0)) / originStoryScenes.length) * 100;
  const recentChoices = originStoryScenes
    .filter((entry) => profile.originStory.choices[entry.id])
    .slice(-4)
    .reverse();

  useEffect(() => {
    headingRef.current?.focus();
  }, [scene.id]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && selectedChoice) {
        onAdvance();
        return;
      }
      const index = Number(event.key) - 1;
      const choice = scene.choices[index];
      if (!selectedChoice && choice) onChoose(scene.id, choice.id);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onAdvance, onChoose, scene, selectedChoice]);

  const stageStyle = {
    '--origin-background': `url("${scene.background}")`,
  } as CSSProperties;

  return (
    <main className="origin-story-screen" style={stageStyle}>
      <div className="origin-background" aria-hidden="true" />
      <div className="origin-atmosphere" aria-hidden="true" />

      <header className="origin-topbar">
        <button className="origin-back" onClick={onExit}><ArrowLeft size={16} /> 타이틀</button>
        <div className="origin-chapter-mark">
          <span>{scene.chapter}</span>
          <strong>{String(scene.sequence).padStart(2, '0')} / {originStoryScenes.length}</strong>
        </div>
        <div className="origin-progress" aria-label={`서장 진행도 ${Math.round(progress)}%`}>
          <span><i style={{ width: `${progress}%` }} /></span>
          <small>{Math.round(progress)}%</small>
        </div>
      </header>

      <section className="origin-layout">
        <article className="origin-stage">
          <div className="origin-scene-meta">
            <span><Clock3 size={13} /> {scene.time}</span>
            <span><MapPin size={13} /> {scene.location}</span>
          </div>

          <div className="origin-heading">
            <span>RAON'S ORIGIN · SCENE {String(scene.sequence).padStart(2, '0')}</span>
            <h1 ref={headingRef} tabIndex={-1}>{scene.title}</h1>
            <p>{scene.subtitle}</p>
          </div>

          <div className="origin-story-copy">
            {scene.narration.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>

          <blockquote className="origin-monologue">
            <Sparkles size={17} />
            <div><small>라온의 생각</small><p>“{scene.monologue}”</p></div>
          </blockquote>

          <CharacterDialogueStage
            speakerId={scene.speakerId}
            speakerName={scene.speakerName}
            speakerRole={scene.speakerRole}
            speakerArt={scene.speakerArt}
            dialogue={scene.dialogue}
            direction={sceneDirection}
            contextLabel={scene.location}
          />

          <section className="origin-decision" aria-labelledby="origin-question">
            <div className="origin-question-heading">
              <span><Footprints size={16} /> 라온으로서 선택</span>
              <h2 id="origin-question">{scene.question}</h2>
              <p>정답은 없습니다. 선택은 라온의 성향·관계·입단 기록으로 남습니다.</p>
            </div>

            <div className="origin-choice-grid">
              {scene.choices.map((choice, index) => {
                const meta = pathMeta[choice.path];
                const chosen = selectedChoiceId === choice.id;
                return (
                  <button
                    key={choice.id}
                    className={`origin-choice ${choice.path} ${chosen ? 'selected' : ''}`}
                    onClick={() => !selectedChoice && onChoose(scene.id, choice.id)}
                    disabled={Boolean(selectedChoice) && !chosen}
                  >
                    <span className="origin-choice-number">{index + 1}</span>
                    <span className="origin-choice-icon"><ChoiceIcon choice={choice} /></span>
                    <span className="origin-choice-copy">
                      <small>{meta.label} · 평가 +{choice.score}</small>
                      <strong>{choice.title}</strong>
                      <em>“{choice.line}”</em>
                    </span>
                    {chosen && <ShieldCheck className="origin-choice-check" size={20} />}
                  </button>
                );
              })}
            </div>

            {selectedChoice && (
              <div className="origin-consequence" role="status" aria-live="polite">
                <div>
                  <span>선택의 흔적</span>
                  <strong>{selectedChoice.result}</strong>
                  <p>{pathMeta[selectedChoice.path].description}의 길이 한 단계 깊어졌습니다.</p>
                </div>
                <button className="origin-advance" onClick={onAdvance}>
                  {scene.nextSceneId ? '다음 장면' : '프시케 제7기로'}
                  <ChevronRight size={18} />
                  <kbd>Enter</kbd>
                </button>
              </div>
            )}
          </section>
        </article>

        <aside className="origin-journal">
          <div className="origin-journal-title">
            <BookOpenText size={19} />
            <div><small>PLAYER JOURNAL</small><strong>라온의 수첩</strong></div>
          </div>

          <div className="origin-route">
            <span className={scene.sequence >= 1 ? 'reached' : ''}>변방 마을</span>
            <i />
            <span className={scene.sequence >= 6 ? 'reached' : ''}>제국 수도</span>
            <i />
            <span className={scene.sequence >= 7 ? 'reached' : ''}>선발 시험</span>
            <i />
            <span className={scene.sequence >= 10 ? 'reached' : ''}>마루의 검</span>
            <i />
            <span className={scene.sequence >= 15 ? 'reached' : ''}>프시케</span>
          </div>

          <div className="origin-paths">
            {(Object.entries(pathMeta) as Array<[RaonStoryChoiceId, typeof pathMeta.compassion]>).map(([path, meta]) => {
              const Icon = meta.icon;
              const value = profile.raonPath[path];
              return (
                <div key={path} className={path}>
                  <span><Icon size={15} /></span>
                  <div><small>{meta.label}</small><i><b style={{ width: `${Math.min(100, value * 13)}%` }} /></i></div>
                  <strong>{value}</strong>
                </div>
              );
            })}
          </div>

          <div className="origin-evaluation">
            <small>프시케 선발 평가</small>
            <strong>{profile.originStory.selectionScore}<span> pt</span></strong>
            <p>{getSelectionRemark(profile.originStory.selectionScore)}</p>
          </div>

          <div className="origin-memory-list">
            <small>최근 남은 기억</small>
            {recentChoices.length === 0 && <p>아직 기록된 선택이 없습니다.</p>}
            {recentChoices.map((entry) => {
              const choice = entry.choices.find((item) => item.id === profile.originStory.choices[entry.id]);
              if (!choice) return null;
              return <div key={entry.id}><span>{entry.sequence}</span><p><strong>{entry.title}</strong>{choice.result}</p></div>;
            })}
          </div>

          <p className="origin-save-note"><ShieldCheck size={14} /> 모든 선택은 즉시 자동 저장됩니다.</p>
        </aside>
      </section>
    </main>
  );
}

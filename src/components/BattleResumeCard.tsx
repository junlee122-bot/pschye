import { ArrowRight, BookmarkCheck, Shield } from 'lucide-react';
import { getKnownMissions } from '../game/storyAccess';
import type { CampaignProfile } from '../types';
import './BattleResumeCard.css';

interface BattleResumeCardProps {
  profile: CampaignProfile;
  onResume?: () => void;
  onDiscard?: () => void;
  compact?: boolean;
}

const modeLabels = { select: '방식 선택 전', tactical: '전술 지휘', action: '라온 액션' };
const difficultyLabels = { story: '기록', standard: '정규', veteran: '생환' };

export function BattleResumeCard({ profile, onResume, onDiscard, compact = false }: BattleResumeCardProps) {
  const attempt = profile.battleAttempt;
  const mission = profile.originStory.completed && attempt
    ? getKnownMissions(profile).find((entry) => entry.id === attempt.missionId) : undefined;
  if (!attempt || !mission) return null;
  const outcome = attempt.battle.outcome;
  const status = outcome === 'victory' ? (attempt.settled ? '승리 · 보상 반영 완료' : '승리 · 결과 확인 대기')
    : outcome === 'defeat' ? '실패 · 재도전 가능'
      : attempt.mode === 'select' ? '전투 방식 선택 대기' : '전투 진행 중';

  return <section className={`battle-resume-card ${compact ? 'compact' : ''}`} aria-label="저장된 작전">
    <div className="battle-resume-heading">
      <div><span className="battle-resume-eyebrow"><BookmarkCheck size={14} /> 저장된 작전</span><h3>{mission.title}</h3></div>
      <span className={`battle-resume-status ${outcome}`}>{status}</span>
    </div>
    <dl className="battle-resume-stats">
      <div><dt>전투 방식</dt><dd>{modeLabels[attempt.mode]} · {difficultyLabels[attempt.difficulty]}</dd></div>
      <div><dt>라운드</dt><dd>{attempt.battle.round} / {mission.roundLimit}</dd></div>
      <div><dt>{mission.objectiveLabel}</dt><dd>체력 {attempt.battle.carriageHp} · 방벽 {attempt.battle.carriageShield}</dd></div>
    </dl>
    <p className="battle-resume-fixed"><Shield size={14} /><span>출전 당시 {attempt.heroes.length}인 편성·성장·장비·선택·교리·난이도를 유지합니다.</span></p>
    {outcome === 'defeat' && <p className="battle-resume-help">저장된 결과를 확인하고 같은 출전 조건으로 다시 도전할 수 있습니다.</p>}
    {(onResume || onDiscard) && <div className="battle-resume-actions">
      {onResume && <button className="battle-resume-primary" onClick={onResume}>{outcome === 'active' ? '저장된 작전 이어하기' : '저장된 결과 보기'}<ArrowRight size={16} /></button>}
      {onDiscard && <button className="battle-resume-discard" onClick={onDiscard}>진행 정리</button>}
    </div>}
  </section>;
}

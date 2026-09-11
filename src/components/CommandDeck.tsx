import { ArrowRight, Boxes, CalendarDays, Crosshair, FileSearch, Gem, Gift, Sparkles } from 'lucide-react';
import { missions } from '../data/campaign';
import { strategicOrders } from '../data/systems';
import { canClaimStrategicOrder, getMissionStatus } from '../game/progression';
import type { CampaignProfile, NavigationSection } from '../types';

interface CommandDeckProps {
  profile: CampaignProfile;
  current: NavigationSection;
  onNavigate: (section: NavigationSection) => void;
}

export function CommandDeck({ profile, current, onNavigate }: CommandDeckProps) {
  const nextMission = missions.find((mission) => getMissionStatus(profile, mission) === 'available');
  const dailyProgress = [
    profile.dailyCommandStats.training > 0,
    profile.dailyCommandStats.bond > 0,
    profile.dailyCommandStats.field > 0,
  ].filter(Boolean).length;
  const dailyPending = profile.commandActions > 0 && dailyProgress < 3;
  const claimableOrder = strategicOrders.find((order) => canClaimStrategicOrder(profile, order));
  const targetSection: NavigationSection = claimableOrder ? 'campaign' : dailyPending ? 'activities' : 'campaign';
  const targetLabel = claimableOrder ? `${claimableOrder.title} 보상 수령` : dailyPending ? `일일 목표 ${dailyProgress}/3` : nextMission?.title ?? '작전 기록 확인';

  return (
    <aside className="command-deck" aria-label="지휘 현황">
      <div className="command-deck-day">
        <CalendarDays size={15} />
        <span>DAY</span><strong>{String(profile.day).padStart(2, '0')}</strong>
        <div className="command-deck-actions" aria-label={`지휘 행동 ${profile.commandActions}개`}>
          {[0, 1, 2].map((index) => <i key={index} className={index < profile.commandActions ? 'filled' : ''} />)}
        </div>
      </div>
      <div className="command-deck-resources">
        <span><Boxes size={14} /> 보급 <strong>{profile.supplies}</strong></span>
        <span><FileSearch size={14} /> 정보 <strong>{profile.intel}</strong></span>
        <span><Gem size={14} /> 유물 <strong>{profile.relics}</strong></span>
        <span><Sparkles size={14} /> 명성 <strong>{profile.renown}</strong></span>
      </div>
      <button className={current === targetSection ? 'current' : ''} onClick={() => onNavigate(targetSection)}>
        {claimableOrder ? <Gift size={15} /> : <Crosshair size={15} />}
        <span><small>NEXT RECOMMENDATION</small><strong>{targetLabel}</strong></span>
        <ArrowRight size={16} />
      </button>
    </aside>
  );
}

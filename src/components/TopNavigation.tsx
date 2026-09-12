import { Archive, BookOpenText, CalendarDays, Castle, Footprints, Map, Swords, UsersRound } from 'lucide-react';
import type { NavigationSection } from '../types';

interface TopNavigationProps {
  current: NavigationSection;
  onNavigate: (section: NavigationSection) => void;
  campaignUnlocked: boolean;
}

const navigationItems = [
  { id: 'campaign' as const, label: '라온의 여정', icon: Footprints },
  { id: 'world' as const, label: '내가 본 세계', icon: Map },
  { id: 'activities' as const, label: '오늘의 선택', icon: CalendarDays },
  { id: 'roster' as const, label: '동료', icon: UsersRound },
  { id: 'headquarters' as const, label: '프시케', icon: Castle },
  { id: 'chronicle' as const, label: '지나온 기억', icon: BookOpenText },
  { id: 'codex' as const, label: '만난 사람', icon: Swords },
  { id: 'archive' as const, label: '여정 화첩', icon: Archive },
];

export function TopNavigation({ current, onNavigate, campaignUnlocked }: TopNavigationProps) {
  return (
    <header className="top-navigation">
      <button className="brand-button" onClick={() => onNavigate('title')} aria-label="라온제나 타이틀로 이동">
        <Castle size={18} />
        <span>RAONJENA</span>
        <small>RAON'S STORY</small>
      </button>
      <nav aria-label="주요 메뉴">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const locked = !campaignUnlocked && ['world', 'roster', 'headquarters', 'activities'].includes(item.id);
          return (
            <button
              key={item.id}
              className={current === item.id ? 'active' : ''}
              onClick={() => onNavigate(item.id)}
              disabled={locked}
              aria-current={current === item.id ? 'page' : undefined}
              aria-label={item.label}
              title={locked ? `${item.label} · 입단 후 열림` : item.label}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="nav-era">
        <span>RAON</span>
        <strong>VII</strong>
      </div>
    </header>
  );
}

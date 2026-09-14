import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { heroDefinitions } from '../data/battle';
import { missions } from '../data/campaign';
import { createInitialBattleState } from '../game/battleEngine';
import { createNewCampaignProfile } from '../game/progression';
import type { CampaignBattleMode, CampaignProfile } from '../types';
import { BattleResumeCard } from './BattleResumeCard';
import { CampaignHub } from './CampaignHub';
import { TitleScreen } from './TitleScreen';

const noop = () => {};
const mission = missions[0];

function savedProfile(mode: CampaignBattleMode = 'tactical') {
  const profile = createNewCampaignProfile();
  profile.originStory.completed = true;
  profile.storyChoices[mission.id] = 'compassion';
  const heroes = heroDefinitions.filter((hero) => ['raon', 'kain', 'leo', 'chris'].includes(hero.id));
  profile.battleAttempt = {
    id: 'resume-ui', missionId: mission.id, doctrine: 'shelter', difficulty: 'standard',
    raonStance: 'compassion', warPressure: 20, bondSupport: 8, heroes, mode, settled: false,
    battle: { ...createInitialBattleState('shelter', mission, heroes), round: 3, carriageHp: 42, carriageShield: 11 },
  };
  return profile;
}

function card(profile: CampaignProfile) {
  return renderToStaticMarkup(<BattleResumeCard profile={profile} onResume={noop} onDiscard={noop} />);
}
function hub(profile: CampaignProfile, focusMissionId = mission.id) {
  return renderToStaticMarkup(<CampaignHub profile={profile} focusMissionId={focusMissionId} onLaunch={noop} onNavigate={noop} onToggleHero={noop} onChooseStory={noop} onResumeBattle={noop} onDiscardBattle={noop} />);
}
function buttons(markup: string) { return Array.from(markup.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g), (match) => match[0]); }
function launchButton(markup: string) { return buttons(markup).find((button) => button.includes('class="story-launch-button"'))!; }

describe('saved battle resume UI', () => {
  it('does not reveal an attempt before induction or an unknown mission after profile regression', () => {
    const profile = savedProfile();
    profile.originStory.completed = false;
    expect(card(profile)).toBe('');
    profile.originStory.completed = true;
    profile.battleAttempt!.missionId = missions.at(-1)!.id;
    expect(card(profile)).toBe('');
    expect(card(createNewCampaignProfile())).toBe('');
  });

  it.each([['select', '방식 선택 전'], ['tactical', '전술 지휘'], ['action', '라온 액션']] as const)('shows saved %s state and frozen deployment, independent of the current roster', (mode, label) => {
    const profile = savedProfile(mode);
    profile.activeSquad = heroDefinitions.map((hero) => hero.id);
    const markup = card(profile);
    expect(markup).toContain(mission.title);
    expect(markup).toContain(label);
    expect(markup).toContain('<dd>3 / 6</dd>');
    expect(markup).toContain('체력 42 · 방벽 11');
    expect(markup).toContain('출전 당시 4인');
    expect(markup).toContain('저장된 작전 이어하기');
    expect(markup).toContain('진행 정리');
  });

  it.each(['victory', 'defeat'] as const)('opens a saved %s as a result instead of claiming the fight is active', (outcome) => {
    const profile = savedProfile();
    profile.battleAttempt!.battle.outcome = outcome;
    profile.battleAttempt!.settled = outcome === 'victory';
    const markup = card(profile);
    expect(markup).toContain('저장된 결과 보기');
    expect(markup).not.toContain('저장된 작전 이어하기');
    expect(markup).toContain(outcome === 'victory' ? '보상 반영 완료' : '같은 출전 조건으로 다시 도전');
  });

  it('uses one prominent title resume action and hides it for a fresh profile', () => {
    const render = (profile: CampaignProfile) => renderToStaticMarkup(<TitleScreen profile={profile} activeSlot={1} slots={[]} onNavigate={noop} onReset={noop} onSelectSlot={noop} onResumeBattle={noop} />);
    const markup = render(savedProfile());
    expect(buttons(markup).filter((button) => button.includes('저장된 작전 이어하기'))).toHaveLength(1);
    expect(markup).toContain('출전 당시 4인');
    const fresh = render(createNewCampaignProfile());
    expect(fresh).not.toContain('저장된 작전');
    expect(fresh).not.toContain(mission.title);
    expect(fresh).toContain('변방 마을에서 시작');
  });

  it('blocks a new launch and the pending mission choice while retaining next-deployment preparation', () => {
    const markup = hub(savedProfile());
    expect(launchButton(markup)).toContain('disabled=""');
    const choices = buttons(markup).filter((button) => button.includes('class="story-choice-card'));
    expect(choices).toHaveLength(3);
    expect(choices.every((button) => button.includes('disabled=""'))).toBe(true);
    expect(markup).toContain('변경은 다음 새 출전에 적용됩니다');
    expect(buttons(markup).find((button) => button.includes('생환'))).not.toContain('disabled=""');
  });

  it('allows another known mission choice to be prepared without replacing the pending battle', () => {
    const profile = savedProfile();
    profile.completedMissions = [mission.id];
    profile.storyChoices[missions[1].id] = 'compassion';
    const markup = hub(profile, missions[1].id);
    const choices = buttons(markup).filter((button) => button.includes('class="story-choice-card'));
    expect(choices).toHaveLength(3);
    expect(choices.every((button) => !button.includes('disabled=""'))).toBe(true);
    expect(launchButton(markup)).toContain('disabled=""');
  });

  it('permits a new deployment after settled victory while retaining the result card', () => {
    const profile = savedProfile();
    profile.battleAttempt!.settled = true;
    profile.battleAttempt!.battle.outcome = 'victory';
    profile.completedMissions = [mission.id];
    const markup = hub(profile);
    expect(markup).toContain('저장된 결과 보기');
    expect(launchButton(markup)).not.toContain('disabled=""');
    expect(buttons(markup).filter((button) => button.includes('class="story-choice-card')).every((button) => !button.includes('disabled=""'))).toBe(true);
  });

  it('blocks a Raon-less squad and provides a usable add-Raon control', () => {
    const profile = savedProfile();
    delete profile.battleAttempt;
    profile.activeSquad = ['hadori', 'kazrin', 'kain', 'leo'];
    const markup = hub(profile);
    expect(launchButton(markup)).toContain('disabled=""');
    expect(launchButton(markup)).toContain('aria-describedby="battle-launch-reason"');
    expect(markup).toContain('출격조에 라온을 추가하세요');
    const addRaon = buttons(markup).find((button) => button.includes('주인공 · 편성 필요'));
    expect(addRaon).toBeDefined();
    expect(addRaon).not.toContain('disabled=""');
  });
});

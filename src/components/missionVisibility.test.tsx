import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { missions } from '../data/campaign';
import { regions } from '../data/lore';
import { createNewCampaignProfile } from '../game/progression';
import type { CampaignProfile } from '../types';
import { CampaignHub } from './CampaignHub';
import { WorldMap } from './WorldMap';

function campaignMarkup(profile: CampaignProfile, focusMissionId?: string) {
  return renderToStaticMarkup(<CampaignHub profile={profile} focusMissionId={focusMissionId} onLaunch={() => {}} onNavigate={() => {}} onToggleHero={() => {}} onChooseStory={() => {}} />);
}
function worldMarkup(profile: CampaignProfile) {
  return renderToStaticMarkup(<WorldMap profile={profile} onOpenMission={() => {}} />);
}
function escaped(value: string) { return renderToStaticMarkup(<>{value}</>); }
function inductedProfile() {
  const profile = createNewCampaignProfile();
  profile.originStory.completed = true;
  return profile;
}

describe('player-facing mission visibility', () => {
  it('renders neither component for a fresh pre-induction profile, even with a late mission focus', () => {
    const fresh = createNewCampaignProfile();
    expect(worldMarkup(fresh)).toBe('');
    expect(campaignMarkup(fresh, missions.at(-1)!.id)).toBe('');
  });

  it.each(['world', 'campaign'] as const)('keeps unreached titles out of visible and accessible %s markup', (screen) => {
    const profile = inductedProfile();
    const markup = screen === 'world' ? worldMarkup(profile) : campaignMarkup(profile);
    expect(markup).toContain(escaped(missions[0]!.title));
    for (const mission of missions.slice(1)) {
      expect(markup).not.toContain(escaped(mission.title));
      expect(markup).not.toContain(escaped(mission.subtitle));
      expect(markup).not.toContain(escaped(mission.summary));
      expect(markup).toContain(`${mission.operation} · 미공개 작전`);
    }
  });

  it('ignores a locked focus mission and selects an actually known briefing', () => {
    const profile = inductedProfile();
    const hidden = missions.at(-1)!;
    const markup = campaignMarkup(profile, hidden.id);
    expect(markup).toContain(escaped(missions[0]!.title));
    expect(markup).not.toContain(escaped(hidden.title));
    expect(markup).not.toContain(escaped(hidden.summary));
    expect(markup).not.toContain(escaped(hidden.objectives[0]!));
  });

  it('exposes completed and newly available missions while later missions remain generic', () => {
    const profile = inductedProfile();
    profile.completedMissions = [missions[0]!.id];
    const campaign = campaignMarkup(profile, missions[1]!.id);
    const world = worldMarkup(profile);
    for (const markup of [campaign, world]) {
      expect(markup).toContain(escaped(missions[0]!.title));
      expect(markup).toContain(escaped(missions[1]!.title));
      expect(markup).not.toContain(escaped(missions[2]!.title));
    }
  });

  it('does not carry a late focus into a regressed profile or empty new journey', () => {
    const advanced = inductedProfile();
    advanced.completedMissions = missions.map((mission) => mission.id);
    const late = missions.at(-1)!;
    expect(campaignMarkup(advanced, late.id)).toContain(escaped(late.title));
    expect(campaignMarkup(inductedProfile(), late.id)).not.toContain(escaped(late.title));
    expect(campaignMarkup(createNewCampaignProfile(), late.id)).toBe('');
  });

  it('uses the known mission brief and region name without author-facing region subtitles', () => {
    const mission = missions[0]!;
    const region = regions.find((entry) => entry.id === mission.regionId)!;
    const markup = worldMarkup(inductedProfile());
    expect(markup).toContain(escaped(mission.summary));
    expect(markup).toContain(escaped(region.name));
    expect(markup).not.toContain(escaped(region.subtitle));
  });
});

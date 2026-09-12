import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Chronicle } from '../components/Chronicle';
import { Codex } from '../components/Codex';
import { PlayerArchive } from '../components/PlayerArchive';
import { TopNavigation } from '../components/TopNavigation';
import { characters } from '../data/lore';
import { missions } from '../data/campaign';
import { originStoryScenes } from '../data/originStory';
import { createNewCampaignProfile } from './progression';
import { getKnownMissions, getPlayerCharacters, getPlayerMemories, getPlayerTestimonies, hasMissionWitness, isAuthorWorkspace } from './storyAccess';

function graduated() {
  const profile = createNewCampaignProfile();
  profile.originStory.completed = true;
  return profile;
}

describe('player record disclosure', () => {
  it('starts with Raon, no future scene images or mission names in player pages', () => {
    const profile = createNewCampaignProfile();
    expect(getPlayerCharacters(profile).map((character) => character.id)).toEqual(['raon']);
    expect(getPlayerMemories(profile)).toEqual([]);
    const html = renderToStaticMarkup(<><Chronicle profile={profile} /><Codex profile={profile} /><PlayerArchive profile={profile} /></>);
    for (const text of ['멸종', '진훤이 죽고', '선대의 결론', '지워진 구원자', '516개', '제작자', '미정 결말', ...missions.map((mission) => mission.title)]) expect(html).not.toContain(text);
    expect(html).toContain('/art/portraits/raon-v1.webp');
    expect(html).not.toContain('/art/story/');
  });

  it('unlocks only a completed scene, its speaker and the choice actually made', () => {
    const profile = createNewCampaignProfile();
    const scene = originStoryScenes[0];
    profile.originStory.completedSceneIds = [scene.id, 'unknown-future-scene'];
    profile.originStory.choices[scene.id] = scene.choices[0].id;
    // A prepared choice in an unfinished scene is not a viewed memory.
    profile.originStory.choices[originStoryScenes[1].id] = originStoryScenes[1].choices[0].id;
    const memories = getPlayerMemories(profile);
    expect(memories.map((entry) => entry.title)).toEqual([scene.title]);
    expect(memories[0].choice).toContain(scene.choices[0].result);
    expect(memories[0].choice).not.toContain(scene.choices[1].result);
    expect(getPlayerCharacters(profile).map((character) => character.id)).toEqual(['raon', 'kazrin']);
  });

  it('reveals the next briefing only after graduation and prerequisites', () => {
    const profile = createNewCampaignProfile();
    expect(getKnownMissions(profile)).toEqual([]);
    profile.originStory.completed = true;
    expect(getKnownMissions(profile).map((mission) => mission.id)).toEqual([missions[0].id]);
    profile.completedMissions.push(missions[0].id);
    expect(getKnownMissions(profile).map((mission) => mission.id)).toEqual([missions[0].id, missions[1].id]);
    expect(getPlayerMemories(profile).filter((entry) => entry.id.startsWith('mission-')).map((entry) => entry.title)).toEqual([missions[0].title]);
  });

  it('does not turn legacy blanket truth tokens or character levels into witnessed testimony', () => {
    const profile = graduated();
    profile.completedMissions = missions.map((mission) => mission.id);
    profile.unlockedRecords = missions.map((mission) => `truth-${mission.id}`);
    profile.heroProgress.raon.level = 99;
    profile.facilities.archive = 5;
    expect(getPlayerTestimonies(profile)).toEqual([]);
    expect(getPlayerCharacters(profile).every((character) => character.hiddenTruth === '')).toBe(true);
  });

  it('requires a known completed mission as well as a witness token', () => {
    const profile = graduated();
    profile.unlockedRecords = [`witness-${missions[0].id}`, 'witness-unknown'];
    expect(hasMissionWitness(profile, missions[0].id)).toBe(false);
    expect(hasMissionWitness(profile, 'unknown')).toBe(false);
    profile.completedMissions.push(missions[0].id);
    expect(getPlayerTestimonies(profile).map((entry) => entry.text)).toEqual([missions[0].revelation!.line]);
    const people = getPlayerCharacters(profile);
    expect(people.find((character) => character.id === 'raon')?.hiddenTruth).toContain(missions[0].revelation!.line);
    expect(people.find((character) => character.id === 'leo')?.hiddenTruth).toBe('');
  });

  it('keeps final truths and author character journeys absent even after every current mission', () => {
    const profile = graduated();
    profile.completedMissions = missions.map((mission) => mission.id);
    profile.unlockedRecords = missions.map((mission) => `witness-${mission.id}`);
    const data = JSON.stringify(getPlayerCharacters(profile));
    for (const character of characters) {
      expect(data).not.toContain(character.hiddenTruth);
      expect(data).not.toContain(character.readerJourney.at(-1));
    }
    expect(data).not.toContain('테나 엘리온');
    expect(data).not.toContain('진훤이 죽고');
    expect(getPlayerTestimonies(profile)).toHaveLength(missions.length);
  });

  it('recomputes visible data after switching to a fresh slot without carrying unlocked records', () => {
    const advanced = graduated();
    advanced.completedMissions = missions.map((mission) => mission.id);
    advanced.unlockedRecords = missions.map((mission) => `witness-${mission.id}`);
    expect(getPlayerMemories(advanced)).toHaveLength(originStoryScenes.length + missions.length);
    const fresh = createNewCampaignProfile();
    expect(getPlayerMemories(fresh)).toEqual([]);
    expect(getPlayerTestimonies(fresh)).toEqual([]);
    expect(getPlayerCharacters(fresh)).toHaveLength(1);
  });

  it('blocks author URL parameters in production and requires explicit development entry', () => {
    for (const query of ['?workspace=author', '?section=archive&archive=models&workspace=author', '?workspace=%61uthor']) expect(isAuthorWorkspace(false, query)).toBe(false);
    expect(isAuthorWorkspace(true, '?workspace=author')).toBe(true);
    expect(isAuthorWorkspace(true, '?section=archive&archive=models')).toBe(false);
  });

  it('disables campaign systems before graduation while retaining safe records', () => {
    const html = renderToStaticMarkup(<TopNavigation current="codex" campaignUnlocked={false} onNavigate={() => {}} />);
    expect((html.match(/disabled=""/g) ?? []).length).toBe(4);
    expect(html).toContain('만난 사람');
    expect(html).toContain('여정 화첩');
  });
});

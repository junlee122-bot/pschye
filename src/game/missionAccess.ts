import { heroDefinitions } from '../data/battle';
import { getMission } from '../data/campaign';
import { getRaonStoryBeat } from '../data/story';
import type { CampaignProfile, RaonStoryChoiceId } from '../types';

export function isMissionStoryChoice(missionId: string, choiceId: unknown): choiceId is RaonStoryChoiceId {
  return getRaonStoryBeat(missionId)?.choices.some((choice) => choice.id === choiceId) === true;
}

export function canChooseMissionStory(profile: CampaignProfile, missionId: string): boolean {
  const mission = getMission(missionId);
  return Boolean(mission && profile.originStory.completed
    && mission.prerequisites.every((id) => profile.completedMissions.includes(id)));
}

export function hasValidCampaignSquad(profile: CampaignProfile): boolean {
  const ids = profile.activeSquad;
  return ids.length >= 4 && ids.length <= heroDefinitions.length && ids.includes('raon')
    && new Set(ids).size === ids.length
    && ids.every((id) => heroDefinitions.some((hero) => hero.id === id) && Boolean(profile.heroProgress[id]));
}

export function canLaunchMission(profile: CampaignProfile, missionId: string): boolean {
  return canChooseMissionStory(profile, missionId)
    && isMissionStoryChoice(missionId, profile.storyChoices[missionId])
    && hasValidCampaignSquad(profile);
}

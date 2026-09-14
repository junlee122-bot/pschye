import { missions } from '../data/campaign';
import type { BattleState, CampaignProfile, MissionDefinition } from '../types';
import { createInitialBattleState } from './battleEngine';
import { buildProgressedHeroes, createNewCampaignProfile } from './progression';

export function missionReadyProfile(mission: MissionDefinition = missions[0]!): CampaignProfile {
  const profile = createNewCampaignProfile();
  return {
    ...profile, originStory: { ...profile.originStory, completed: true },
    completedMissions: [...mission.prerequisites], storyChoices: { [mission.id]: 'resolve' },
  };
}

export function victoriousBattle(profile: CampaignProfile, mission: MissionDefinition = missions[0]!, changes: Partial<BattleState> = {}): BattleState {
  const state = createInitialBattleState('shelter', mission,
    buildProgressedHeroes(profile).filter((hero) => profile.activeSquad.includes(hero.id)),
    'standard', profile.storyChoices[mission.id] ?? 'resolve');
  return { ...state, outcome: 'victory', round: mission.roundLimit, enemies: state.enemies.map((enemy) => ({ ...enemy, hp: 0 })), ...changes };
}

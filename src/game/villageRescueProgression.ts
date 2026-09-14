import { getOriginStoryScene } from '../data/originStory';
import type { CampaignProfile, VillageRescueAction, VillageRescueState } from '../types';
import { executeGameCommand } from './simulation';
import { createVillageRescue, isVillageRescueChoiceId, resolveVillageRescueAction, villageRescueReturnPoint } from './villageRescue';

export const villageRescueSceneId = 'river-incident';

function isPendingRiverScene(profile: CampaignProfile) {
  return !profile.originStory.completed && profile.originStory.currentSceneId === villageRescueSceneId
    && !profile.originStory.completedSceneIds.includes(villageRescueSceneId);
}

export function getVillageRescue(profile: CampaignProfile): VillageRescueState | undefined {
  if (!isPendingRiverScene(profile)) return undefined;
  const choiceId = profile.originStory.choices[villageRescueSceneId];
  if (!isVillageRescueChoiceId(choiceId)) return undefined;
  const saved = profile.originStory.villageRescue;
  return saved?.choiceId === choiceId ? saved : createVillageRescue(choiceId);
}

function withRescue(profile: CampaignProfile, rescue: VillageRescueState): CampaignProfile {
  return { ...profile, originStory: { ...profile.originStory, villageRescue: rescue } };
}

// v10 saved a choice's outcome immediately. Only a still-pending river scene
// becomes playable; later scenes and completed saves keep their history intact.
// Choice scores and affinity remain granted once, while premature outcome facts
// are withheld until the new rescue has been played and confirmed in the village.
export function migrateVillageRescue(profile: CampaignProfile): CampaignProfile {
  if (profile.originStory.villageRescue || !isPendingRiverScene(profile)) return profile;
  const rescue = getVillageRescue(profile);
  if (!rescue) return profile;
  const scene = getOriginStoryScene(villageRescueSceneId);
  const flags = new Set(scene.choices.map((choice) => choice.flag));
  const facts = new Set(scene.choices.map((choice) => choice.result));
  const previous = profile.world.npcMemories[scene.speakerId];
  return {
    ...withRescue(profile, rescue),
    originStory: {
      ...profile.originStory,
      villageRescue: rescue,
      flags: profile.originStory.flags.filter((flag) => !flags.has(flag)),
    },
    world: previous ? {
      ...profile.world,
      npcMemories: {
        ...profile.world.npcMemories,
        [scene.speakerId]: { ...previous, rememberedFacts: previous.rememberedFacts.filter((fact) => !facts.has(fact)) },
      },
    } : profile.world,
  };
}

export function startVillageRescue(profile: CampaignProfile): CampaignProfile {
  const rescue = getVillageRescue(profile);
  if (rescue?.phase !== 'ready') return profile;
  return withRescue(migrateVillageRescue(profile), createVillageRescue(rescue.choiceId, 1));
}

export function applyVillageRescueAction(profile: CampaignProfile, action: VillageRescueAction): CampaignProfile {
  const rescue = getVillageRescue(profile);
  if (!rescue) return profile;
  const next = resolveVillageRescueAction(rescue, action);
  return next === rescue ? profile : withRescue(profile, next);
}

export function retryVillageRescue(profile: CampaignProfile): CampaignProfile {
  const rescue = getVillageRescue(profile);
  return rescue?.phase === 'failed' ? withRescue(profile, createVillageRescue(rescue.choiceId, rescue.attempt + 1)) : profile;
}

export function completeVillageRescueReturn(profile: CampaignProfile): CampaignProfile {
  const rescue = getVillageRescue(profile);
  if (rescue?.phase !== 'return') return profile;
  const { playerX, playerY } = profile.world.village;
  const point = villageRescueReturnPoint;
  if (!Number.isFinite(playerX) || !Number.isFinite(playerY) || Math.hypot(playerX - point.x, playerY - point.y) > point.radius) return profile;
  const scene = getOriginStoryScene(villageRescueSceneId);
  const choice = scene.choices.find((entry) => entry.id === rescue.choiceId);
  if (!choice) return profile;
  const world = executeGameCommand(profile.world, {
    type: 'choose-dialogue', npcId: scene.speakerId, choiceId: choice.id, affinity: 0, fact: choice.result,
  }).state;
  return {
    ...profile,
    originStory: {
      ...profile.originStory,
      villageRescue: { ...rescue, phase: 'complete', log: ['카즈린과 모두의 귀환을 확인했다.', ...rescue.log].slice(0, 16) },
      flags: [...new Set([...profile.originStory.flags, choice.flag])],
    },
    world,
    activityLog: [`수로 구출 완료 · ${choice.result}`, ...profile.activityLog].slice(0, 16),
  };
}

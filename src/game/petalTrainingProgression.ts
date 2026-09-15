import { getOriginStoryScene } from '../data/originStory';
import type { CampaignProfile, PetalTrainingAction, PetalTrainingState } from '../types';
import { createPetalTraining, isPetalTrainingChoiceId, isPetalTrainingState, resolvePetalTrainingAction } from './petalTraining';
import { executeGameCommand } from './simulation';

export const petalTrainingSceneId = 'sixteen-petals';

function isPendingPetalTraining(profile: CampaignProfile) {
  return !profile.originStory.completed && profile.originStory.currentSceneId === petalTrainingSceneId
    && !profile.originStory.completedSceneIds.includes(petalTrainingSceneId);
}

export function getPetalTraining(profile: CampaignProfile): PetalTrainingState | undefined {
  if (!isPendingPetalTraining(profile)) return undefined;
  const choiceId = profile.originStory.choices[petalTrainingSceneId];
  if (!isPetalTrainingChoiceId(choiceId)) return undefined;
  const saved = profile.originStory.petalTraining;
  if (saved !== undefined) return isPetalTrainingState(saved) && saved.choiceId === choiceId ? saved : undefined;
  return createPetalTraining(choiceId);
}

function withTraining(profile: CampaignProfile, petalTraining: PetalTrainingState): CampaignProfile {
  return { ...profile, originStory: { ...profile.originStory, petalTraining } };
}

// Existing choice-only saves keep their score and affinity. Defer only the
// outcome of the current unfinished scene, never a later or completed history.
export function migratePetalTraining(profile: CampaignProfile): CampaignProfile {
  if (profile.originStory.petalTraining !== undefined || !isPendingPetalTraining(profile)) return profile;
  const petalTraining = getPetalTraining(profile);
  if (!petalTraining) return profile;
  const scene = getOriginStoryScene(petalTrainingSceneId);
  const flags = new Set(scene.choices.map((choice) => choice.flag));
  const facts = new Set(scene.choices.map((choice) => choice.result));
  const previous = profile.world.npcMemories[scene.speakerId];
  return {
    ...profile,
    originStory: { ...profile.originStory, petalTraining, flags: profile.originStory.flags.filter((flag) => !flags.has(flag)) },
    world: previous ? {
      ...profile.world,
      npcMemories: { ...profile.world.npcMemories, [scene.speakerId]: {
        ...previous, rememberedFacts: previous.rememberedFacts.filter((fact) => !facts.has(fact)),
      } },
    } : profile.world,
  };
}

export function startPetalTraining(profile: CampaignProfile): CampaignProfile {
  const training = getPetalTraining(profile);
  return training?.phase === 'ready' ? withTraining(migratePetalTraining(profile), createPetalTraining(training.choiceId, 1)) : profile;
}

export function applyPetalTrainingAction(profile: CampaignProfile, attempt: number, turn: number, action: PetalTrainingAction): CampaignProfile {
  const training = getPetalTraining(profile);
  if (!training || training.attempt !== attempt || training.turn !== turn) return profile;
  const next = resolvePetalTrainingAction(training, action);
  return next === training ? profile : withTraining(profile, next);
}

export function retryPetalTraining(profile: CampaignProfile): CampaignProfile {
  const training = getPetalTraining(profile);
  return training?.phase === 'failed' && training.attempt < Number.MAX_SAFE_INTEGER
    ? withTraining(profile, createPetalTraining(training.choiceId, training.attempt + 1)) : profile;
}

export function completePetalTraining(profile: CampaignProfile, attempt: number): CampaignProfile {
  const training = getPetalTraining(profile);
  if (training?.phase !== 'review' || training.attempt !== attempt) return profile;
  const scene = getOriginStoryScene(petalTrainingSceneId);
  const choice = scene.choices.find((entry) => entry.id === training.choiceId);
  if (!choice) return profile;
  const world = executeGameCommand(profile.world, {
    type: 'choose-dialogue', npcId: scene.speakerId, choiceId: choice.id, affinity: 0, fact: choice.result,
  }).state;
  return {
    ...profile,
    originStory: {
      ...profile.originStory,
      petalTraining: { ...training, phase: 'complete', log: ['마루 앞에서 이번 수련을 마무리했다.', ...training.log].slice(0, 16) },
      flags: [...new Set([...profile.originStory.flags, choice.flag])],
    },
    world,
    activityLog: [`열여섯 꽃잎 수련 완료 · ${choice.result}`, ...profile.activityLog].slice(0, 16),
  };
}

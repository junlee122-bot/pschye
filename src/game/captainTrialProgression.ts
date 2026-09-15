import { getOriginStoryScene } from '../data/originStory';
import type { CampaignProfile, CaptainTrialAction, CaptainTrialSceneId, CaptainTrialState } from '../types';
import { createCaptainTrial, isCaptainTrialChoiceForScene, isCaptainTrialSceneId, isCaptainTrialState, resolveCaptainTrialAction } from './captainTrial';
import { executeGameCommand } from './simulation';

export function getCaptainTrial(profile: CampaignProfile): CaptainTrialState | undefined {
  const sceneId = profile.originStory.currentSceneId;
  if (!isCaptainTrialSceneId(sceneId) || profile.originStory.completed || profile.originStory.completedSceneIds.includes(sceneId)) return undefined;
  const choiceId = profile.originStory.choices[sceneId];
  const saved = profile.originStory.captainTrials?.[sceneId];
  if (sceneId === 'hadori-wall') {
    // A legacy reaction already took place after the scripted loss.
    if (saved !== undefined) return isCaptainTrialState(saved) && saved.sceneId === sceneId
      && (!choiceId || saved.phase === 'complete') ? saved : undefined;
    return choiceId ? undefined : createCaptainTrial(sceneId);
  }
  if (!isCaptainTrialChoiceForScene(sceneId, choiceId)) return undefined;
  if (saved !== undefined) return isCaptainTrialState(saved) && saved.sceneId === sceneId && saved.choiceId === choiceId ? saved : undefined;
  return createCaptainTrial(sceneId, choiceId);
}

function withTrial(profile: CampaignProfile, state: CaptainTrialState): CampaignProfile {
  return { ...profile, originStory: { ...profile.originStory, captainTrials: { ...profile.originStory.captainTrials, [state.sceneId]: state } } };
}

export function migrateCaptainTrials(profile: CampaignProfile): CampaignProfile {
  const trial = getCaptainTrial(profile);
  if (!trial || profile.originStory.captainTrials?.[trial.sceneId] !== undefined) return profile;
  const next = withTrial(profile, trial);
  if (trial.sceneId === 'hadori-wall') return next;
  const scene = getOriginStoryScene(trial.sceneId);
  const flags = new Set(scene.choices.map((choice) => choice.flag));
  const facts = new Set(scene.choices.map((choice) => choice.result));
  const previous = profile.world.npcMemories[scene.speakerId];
  return {
    ...next,
    originStory: { ...next.originStory, flags: profile.originStory.flags.filter((flag) => !flags.has(flag)) },
    world: previous ? {
      ...profile.world,
      npcMemories: { ...profile.world.npcMemories, [scene.speakerId]: {
        ...previous, rememberedFacts: previous.rememberedFacts.filter((fact) => !facts.has(fact)),
      } },
    } : profile.world,
  };
}

export function startCaptainTrial(profile: CampaignProfile, sceneId: CaptainTrialSceneId): CampaignProfile {
  if (profile.originStory.currentSceneId !== sceneId) return profile;
  const trial = getCaptainTrial(profile);
  return trial?.phase === 'ready' ? withTrial(migrateCaptainTrials(profile), createCaptainTrial(sceneId, trial.choiceId, 1)) : profile;
}

export function applyCaptainTrialAction(profile: CampaignProfile, sceneId: CaptainTrialSceneId, attempt: number, turn: number, action: CaptainTrialAction): CampaignProfile {
  if (profile.originStory.currentSceneId !== sceneId) return profile;
  const trial = getCaptainTrial(profile);
  if (!trial || trial.attempt !== attempt || trial.turn !== turn) return profile;
  const next = resolveCaptainTrialAction(trial, action);
  return next === trial ? profile : withTrial(profile, next);
}

export function retryCaptainTrial(profile: CampaignProfile, sceneId: CaptainTrialSceneId, attempt: number): CampaignProfile {
  if (profile.originStory.currentSceneId !== sceneId || sceneId === 'hadori-wall') return profile;
  const trial = getCaptainTrial(profile);
  return trial?.phase === 'failed' && trial.attempt === attempt && trial.attempt < Number.MAX_SAFE_INTEGER
    ? withTrial(profile, createCaptainTrial(sceneId, trial.choiceId, trial.attempt + 1)) : profile;
}

export function completeCaptainTrial(profile: CampaignProfile, sceneId: CaptainTrialSceneId, attempt: number): CampaignProfile {
  if (profile.originStory.currentSceneId !== sceneId) return profile;
  const trial = getCaptainTrial(profile);
  if (trial?.phase !== 'resolved' || trial.attempt !== attempt) return profile;
  const next = withTrial(profile, { ...trial, phase: 'complete', log: [
    sceneId === 'hadori-wall' ? '하도리와의 대결이 끝났음을 확인했다. 이제 패배 뒤의 말을 고를 차례다.' : '대결의 결과를 확인했다.',
    ...trial.log,
  ].slice(0, 16) });
  if (sceneId === 'hadori-wall') return next;
  const scene = getOriginStoryScene(sceneId);
  const choice = scene.choices.find((entry) => entry.id === trial.choiceId);
  if (!choice) return profile;
  const world = executeGameCommand(profile.world, {
    type: 'choose-dialogue', npcId: scene.speakerId, choiceId: choice.id, affinity: 0, fact: choice.result,
  }).state;
  return {
    ...next,
    originStory: { ...next.originStory, flags: [...new Set([...profile.originStory.flags, choice.flag])] },
    world,
    activityLog: [`조장 선발 대결 · ${choice.result}`, ...profile.activityLog].slice(0, 16),
  };
}

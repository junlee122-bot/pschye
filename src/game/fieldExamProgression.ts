import { getOriginStoryScene } from '../data/originStory';
import type { CampaignProfile, FieldExamPlan, FieldExamState } from '../types';
import { createFieldExam, isFieldExamChoiceId, isFieldExamState, resolveFieldExamPlan } from './fieldExam';
import { executeGameCommand } from './simulation';

export const fieldExamSceneId = 'field-exam';

function isPendingFieldExam(profile: CampaignProfile) {
  return !profile.originStory.completed && profile.originStory.currentSceneId === fieldExamSceneId
    && !profile.originStory.completedSceneIds.includes(fieldExamSceneId);
}

export function getFieldExam(profile: CampaignProfile): FieldExamState | undefined {
  if (!isPendingFieldExam(profile)) return undefined;
  const choiceId = profile.originStory.choices[fieldExamSceneId];
  if (!isFieldExamChoiceId(choiceId)) return undefined;
  const saved = profile.originStory.fieldExam;
  if (saved !== undefined) return isFieldExamState(saved) && saved.choiceId === choiceId ? saved : undefined;
  return createFieldExam(choiceId);
}

function withExam(profile: CampaignProfile, fieldExam: FieldExamState): CampaignProfile {
  return { ...profile, originStory: { ...profile.originStory, fieldExam } };
}

// Preserve old choice scores and relationships. Only still-pending choice-only
// saves gain the playable exam; its prematurely recorded outcome is deferred.
export function migrateFieldExam(profile: CampaignProfile): CampaignProfile {
  if (profile.originStory.fieldExam !== undefined || !isPendingFieldExam(profile)) return profile;
  const fieldExam = getFieldExam(profile);
  if (!fieldExam) return profile;
  const scene = getOriginStoryScene(fieldExamSceneId);
  const flags = new Set(scene.choices.map((choice) => choice.flag));
  const facts = new Set(scene.choices.map((choice) => choice.result));
  const previous = profile.world.npcMemories[scene.speakerId];
  return {
    ...profile,
    originStory: { ...profile.originStory, fieldExam, flags: profile.originStory.flags.filter((flag) => !flags.has(flag)) },
    world: previous ? {
      ...profile.world,
      npcMemories: { ...profile.world.npcMemories, [scene.speakerId]: {
        ...previous, rememberedFacts: previous.rememberedFacts.filter((fact) => !facts.has(fact)),
      } },
    } : profile.world,
  };
}

export function startFieldExam(profile: CampaignProfile): CampaignProfile {
  const exam = getFieldExam(profile);
  return exam?.phase === 'ready' ? withExam(migrateFieldExam(profile), createFieldExam(exam.choiceId, 1)) : profile;
}

export function applyFieldExamPlan(profile: CampaignProfile, attempt: number, turn: number, plan: FieldExamPlan): CampaignProfile {
  const exam = getFieldExam(profile);
  if (!exam || exam.attempt !== attempt || exam.turn !== turn) return profile;
  const next = resolveFieldExamPlan(exam, plan);
  return next === exam ? profile : withExam(profile, next);
}

export function retryFieldExam(profile: CampaignProfile): CampaignProfile {
  const exam = getFieldExam(profile);
  return exam?.phase === 'failed' && exam.attempt < Number.MAX_SAFE_INTEGER
    ? withExam(profile, createFieldExam(exam.choiceId, exam.attempt + 1)) : profile;
}

export function completeFieldExamReturn(profile: CampaignProfile, attempt: number): CampaignProfile {
  const exam = getFieldExam(profile);
  if (exam?.phase !== 'return' || exam.attempt !== attempt) return profile;
  const scene = getOriginStoryScene(fieldExamSceneId);
  const choice = scene.choices.find((entry) => entry.id === exam.choiceId);
  if (!choice) return profile;
  const world = executeGameCommand(profile.world, {
    type: 'choose-dialogue', npcId: scene.speakerId, choiceId: choice.id, affinity: 0, fact: choice.result,
  }).state;
  return {
    ...profile,
    originStory: {
      ...profile.originStory,
      fieldExam: { ...exam, phase: 'complete', log: ['지원자들과 모두 함께 폐광에서 철수했다.', ...exam.log].slice(0, 16) },
      flags: [...new Set([...profile.originStory.flags, choice.flag])],
    },
    world,
    activityLog: [`폐광 구조 완료 · ${choice.result}`, ...profile.activityLog].slice(0, 16),
  };
}

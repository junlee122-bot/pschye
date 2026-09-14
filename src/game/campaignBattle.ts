import { getMission } from '../data/campaign';
import { getRaonStoryBeat } from '../data/story';
import type { BattleState, CampaignBattleAttempt, CampaignBattleCheckpointPatch, CampaignBattleMode, CampaignProfile, MissionDifficulty } from '../types';
import { createInitialBattleState, type BattleDoctrine } from './battleEngine';
import { isCampaignBattleAttempt, sameBattleCheckpoint } from './battleCheckpointValidation';
import { canLaunchMission } from './missionAccess';
import { buildProgressedHeroes, completeMission, getBondKey, getWarPressure } from './progression';

function initialAttempt(snapshot: Omit<CampaignBattleAttempt, 'battle' | 'mode' | 'settled' | 'tactical' | 'action'>, mode: CampaignBattleMode): CampaignBattleAttempt {
  const mission = getMission(snapshot.missionId)!;
  const hero = snapshot.heroes.find((entry) => entry.id === 'raon')!;
  return {
    ...snapshot, mode, settled: false,
    battle: createInitialBattleState(snapshot.doctrine, mission, snapshot.heroes, snapshot.difficulty, snapshot.raonStance, snapshot),
    ...(mode === 'tactical' ? { tactical: { history: [], selectedHeroId: hero.id, selectedSkillId: hero.skills[0].id } } : {}),
  };
}

export function beginCampaignBattle(profile: CampaignProfile, missionId: string, doctrine: BattleDoctrine, difficulty: MissionDifficulty, id: string): CampaignProfile {
  if ((profile.battleAttempt && !profile.battleAttempt.settled) || !canLaunchMission(profile, missionId)) return profile;
  if (!id || id === profile.battleAttempt?.id || !['shelter', 'counterfire'].includes(doctrine) || !['story', 'standard', 'veteran'].includes(difficulty)) return profile;
  const companionId = getRaonStoryBeat(missionId)!.companionId;
  const attempt = initialAttempt({
    id, missionId, doctrine, difficulty, raonStance: profile.storyChoices[missionId],
    warPressure: getWarPressure(profile).value, bondSupport: profile.bondLevels[getBondKey('raon', companionId)] ?? 0,
    heroes: structuredClone(buildProgressedHeroes(profile).filter((hero) => profile.activeSquad.includes(hero.id))),
  }, 'select');
  return isCampaignBattleAttempt(attempt) ? { ...profile, battleAttempt: attempt } : profile;
}

export function saveCampaignBattleCheckpoint(profile: CampaignProfile, attemptId: string, patch: CampaignBattleCheckpointPatch): CampaignProfile {
  const attempt = profile.battleAttempt;
  if (!attempt || attempt.id !== attemptId || attempt.settled) return profile;
  const mode = patch.mode ?? attempt.mode;
  if (mode !== attempt.mode && attempt.mode !== 'select') return profile;
  // A terminal result cannot be replaced by an older render or a stale action tick.
  if (attempt.battle.outcome !== 'active' && patch.battle && !sameBattleCheckpoint(attempt.battle, patch.battle)) return profile;
  const next: CampaignBattleAttempt = {
    ...attempt, mode,
    battle: patch.battle ?? attempt.battle,
    ...(patch.tactical ? { tactical: patch.tactical } : {}),
    ...(patch.action ? { action: patch.action } : {}),
  };
  if (!isCampaignBattleAttempt(next)) return profile;
  return sameBattleCheckpoint(attempt, next) ? profile : { ...profile, battleAttempt: structuredClone(next) };
}

export function restartCampaignBattle(profile: CampaignProfile, attemptId: string, nextAttemptId: string, mode?: CampaignBattleMode): CampaignProfile {
  const attempt = profile.battleAttempt;
  if (!attempt || attempt.id !== attemptId || !nextAttemptId || nextAttemptId === attemptId) return profile;
  const next = initialAttempt({
    id: nextAttemptId, missionId: attempt.missionId, doctrine: attempt.doctrine, difficulty: attempt.difficulty,
    raonStance: attempt.raonStance, warPressure: attempt.warPressure, bondSupport: attempt.bondSupport, heroes: attempt.heroes,
  }, mode ?? attempt.mode);
  return isCampaignBattleAttempt(next) ? { ...profile, battleAttempt: next } : profile;
}

export function settleCampaignBattle(profile: CampaignProfile, attemptId: string, state: BattleState): CampaignProfile {
  const attempt = profile.battleAttempt;
  if (!attempt || attempt.id !== attemptId || attempt.settled || state.outcome !== 'victory'
    || !sameBattleCheckpoint(attempt.battle, state) || !isCampaignBattleAttempt(attempt)) return profile;
  const mission = getMission(attempt.missionId)!;
  // Rewards and XP belong to the deployment that fought, even if the player
  // changed equipment or the waiting roster while this attempt was suspended.
  const deployedProfile = { ...profile, activeSquad: attempt.heroes.map((hero) => hero.id) };
  if (!canLaunchMission(deployedProfile, mission.id)) return profile;
  const completed = completeMission(deployedProfile, mission, state);
  if (!completed.profile.completedMissions.includes(mission.id)) return profile;
  return { ...completed.profile, activeSquad: profile.activeSquad, battleAttempt: { ...attempt, settled: true } };
}

export function abandonCampaignBattle(profile: CampaignProfile, attemptId: string): CampaignProfile {
  if (profile.battleAttempt?.id !== attemptId) return profile;
  const rest = { ...profile };
  delete rest.battleAttempt;
  return rest;
}

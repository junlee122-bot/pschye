import { describe, expect, it } from 'vitest';
import { missions } from '../data/campaign';
import type { BattleState, MissionDefinition } from '../types';
import { completeMission } from './progression';
import { missionReadyProfile, victoriousBattle } from './campaignTestFixtures';

const mission = missions[0]!;
const witnessId = `witness-${mission.id}`;
const legacyTruthId = `truth-${mission.id}`;

function witnessedVictory(changes: Partial<BattleState> = {}): BattleState {
  return {
    ...victoriousBattle(missionReadyProfile(), mission, { round: 1 }),
    revelationTriggered: true,
    ...changes,
  };
}

describe('verified mission witness records', () => {
  it('records a matching victorious revelation alongside normal first-clear progression', () => {
    const fresh = missionReadyProfile();
    const result = completeMission(fresh, mission, witnessedVictory());
    expect(result.firstClear).toBe(true);
    expect(result.profile.completedMissions).toContain(mission.id);
    expect(result.profile.unlockedRecords).toContain(`mission-${mission.id}`);
    expect(result.profile.unlockedRecords).toContain(witnessId);
    expect(result.profile.unlockedRecords).not.toContain(legacyTruthId);
    expect(result.profile.supplies).toBe(fresh.supplies + mission.reward.supplies);
    expect(result.profile.careerStats.missions).toBe(1);
  });

  const unverifiedResults: Array<[string, BattleState | undefined]> = [
    ['no battle state', undefined],
    ['ongoing battle', witnessedVictory({ outcome: 'active' })],
    ['defeated battle', witnessedVictory({ outcome: 'defeat' })],
    ['different mission', witnessedVictory({ missionId: missions[1]!.id })],
    ['no actual revelation', witnessedVictory({ revelationTriggered: false })],
  ];
  it.each(unverifiedResults)('does not issue a witness for %s', (_label, state) => {
    const result = completeMission(missionReadyProfile(), mission, state);
    expect(result.profile.unlockedRecords).not.toContain(witnessId);
    expect(result.profile.unlockedRecords).not.toContain(legacyTruthId);
    expect(result.firstClear).toBe(_label === 'no actual revelation');
    expect(result.profile.completedMissions.includes(mission.id)).toBe(_label === 'no actual revelation');
  });

  it('requires an official mission before issuing any witness', () => {
    const unknownMission: MissionDefinition = { ...mission, id: 'unknown-mission' };
    const result = completeMission(missionReadyProfile(), unknownMission, witnessedVictory());
    expect(result.profile.unlockedRecords).not.toContain(witnessId);
  });

  it('preserves legacy truth records without treating them as verified witnesses', () => {
    const legacy = missionReadyProfile();
    legacy.unlockedRecords.push(legacyTruthId);
    const cleared = completeMission(legacy, mission, witnessedVictory({ revelationTriggered: false })).profile;
    expect(cleared.unlockedRecords).toContain(legacyTruthId);
    expect(cleared.unlockedRecords).not.toContain(witnessId);
    const witnessed = completeMission(cleared, mission, witnessedVictory()).profile;
    expect(witnessed.unlockedRecords).toContain(legacyTruthId);
    expect(witnessed.unlockedRecords).toContain(witnessId);
  });

  it('allows a lower-grade replay to add the missing witness without repeating rewards', () => {
    const cleared = completeMission(missionReadyProfile(), mission, witnessedVictory({ revelationTriggered: false })).profile;
    expect(cleared.missionGrades[mission.id]).toBe('S');
    const replay = completeMission(cleared, mission, witnessedVictory({ round: mission.roundLimit }));
    expect(replay.firstClear).toBe(false);
    expect(replay.grade).toBe('S');
    expect(replay.profile.unlockedRecords).toContain(witnessId);
    expect(replay.profile.activityLog[0]).toContain('현장 증언 확보');
    expect({
      ...replay.profile,
      unlockedRecords: cleared.unlockedRecords,
      activityLog: cleared.activityLog,
    }).toEqual(cleared);
  });

  it('does not add witnesses on a failed, unverified, or mismatched replay', () => {
    const cleared = completeMission(missionReadyProfile(), mission, witnessedVictory({ revelationTriggered: false })).profile;
    for (const [, state] of unverifiedResults) {
      const replay = completeMission(cleared, mission, state);
      expect(replay.profile).toBe(cleared);
      expect(replay.profile.unlockedRecords).not.toContain(witnessId);
    }
  });

  it('records a grade improvement and new witness together without another first-clear reward', () => {
    const cleared = completeMission(missionReadyProfile(), mission, victoriousBattle(missionReadyProfile())).profile;
    expect(cleared.missionGrades[mission.id]).toBe('B');
    const replay = completeMission(cleared, mission, witnessedVictory());
    expect(replay.firstClear).toBe(false);
    expect(replay.grade).toBe('S');
    expect(replay.profile.missionGrades[mission.id]).toBe('S');
    expect(replay.profile.unlockedRecords).toContain(witnessId);
    expect(replay.profile.supplies).toBe(cleared.supplies);
    expect(replay.profile.heroProgress).toBe(cleared.heroProgress);
    expect(replay.profile.careerStats).toBe(cleared.careerStats);
  });

  it('does not duplicate a previously acquired witness or replay log', () => {
    const cleared = completeMission(missionReadyProfile(), mission, witnessedVictory()).profile;
    const replay = completeMission(cleared, mission, witnessedVictory());
    expect(replay.profile).toBe(cleared);
    expect(replay.profile.unlockedRecords.filter((id) => id === witnessId)).toHaveLength(1);
    expect(replay.firstClear).toBe(false);
  });
});

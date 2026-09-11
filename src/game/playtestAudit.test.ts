import { describe, expect, it } from 'vitest';
import { runPlaytestAudit } from './playtestAudit';

describe('200+ deterministic playtest audit', () => {
  it('executes more than 200 complete campaign paths', () => {
    const result = runPlaytestAudit(204);

    expect(result.campaignRuns).toBeGreaterThanOrEqual(200);
    expect(result.battleRuns).toBe(204 * 8);
    expect(result.records.every((record) => record.outcome !== 'active')).toBe(true);
    expect(result.byStyle.guided.battles).toBeGreaterThan(0);
    expect(result.byStyle.novice.battles).toBeGreaterThan(0);
    expect(result.uxCapabilities).toEqual({
      combatModeChoiceBeforeBattle: true,
      touchMovement: true,
      actionOnboarding: true,
      earlyTurnEndFeedback: true,
      recommendationExecutesAction: true,
      hiddenTargetAssist: true,
    });
    expect(result.aggregate.invalidActions).toBe(0);
  });
});

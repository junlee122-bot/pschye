export interface CombatUxCapabilities {
  combatModeChoiceBeforeBattle: boolean;
  touchMovement: boolean;
  actionOnboarding: boolean;
  earlyTurnEndFeedback: boolean;
  recommendationExecutesAction: boolean;
  hiddenTargetAssist: boolean;
}

export const combatUxCapabilities: CombatUxCapabilities = {
  combatModeChoiceBeforeBattle: true,
  touchMovement: true,
  actionOnboarding: true,
  earlyTurnEndFeedback: true,
  recommendationExecutesAction: true,
  hiddenTargetAssist: true,
};

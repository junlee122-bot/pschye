import { describe, expect, it } from 'vitest';
import { facilities, missions } from '../data/campaign';
import { originStoryScenes } from '../data/originStory';
import { strategicOrders } from '../data/systems';
import { applyVillageRescueAction, completeVillageRescueReturn, startVillageRescue } from './villageRescueProgression';
import { villageRescueReturnPoint } from './villageRescue';
import { missionReadyProfile, victoriousBattle } from './campaignTestFixtures';
import {
  advanceDay,
  advanceOriginStory,
  buildProgressedHeroes,
  canAdvanceDay,
  canClaimDailyOrders,
  canClaimStrategicOrder,
  claimDailyOrders,
  claimStrategicOrder,
  chooseRaonStoryPath,
  chooseOriginStoryPath,
  completeMission,
  createNewCampaignProfile,
  craftEquipment,
  equipHeroItem,
  getBondKey,
  getAdjustedMissionReward,
  getMissionStatus,
  getNarrativeCheckChance,
  getStrategicOrderProgress,
  getWarPressure,
  performBondActivity,
  performDailyActivity,
  performTraining,
  resolveDispatch,
  toggleSquadMember,
  unlockHeroNode,
  upgradeFacility,
} from './progression';

function completeOriginStory() {
  let profile = createNewCampaignProfile();
  for (const scene of originStoryScenes) {
    profile = chooseOriginStoryPath(profile, scene.id, scene.choices[0].id);
    if (scene.id === 'river-incident') {
      profile = startVillageRescue(profile);
      for (let step = 0; step < 3; step += 1) profile = applyVillageRescueAction(profile, { type: 'move', dx: 1, dy: 0 });
      for (let step = 0; step < 3; step += 1) profile = applyVillageRescueAction(profile, { type: 'assist' });
      for (let step = 0; step < 3; step += 1) profile = applyVillageRescueAction(profile, { type: 'move', dx: -1, dy: 0 });
      profile = completeVillageRescueReturn({ ...profile, world: { ...profile.world, village: {
        ...profile.world.village, playerX: villageRescueReturnPoint.x, playerY: villageRescueReturnPoint.y,
      } } });
    }
    profile = advanceOriginStory(profile);
  }
  return profile;
}

describe('campaign progression', () => {
  it('starts Raon in the village and keeps operations locked before induction', () => {
    const profile = createNewCampaignProfile();
    expect(profile.originStory.currentSceneId).toBe('village-dawn');
    expect(profile.originStory.completed).toBe(false);
    expect(getMissionStatus(profile, missions[0]!)).toBe('locked');
    expect(getWarPressure(profile).label).toBe('마을의 평온');
  });

  it('carries fifteen origin choices into Raon’s Psyche induction record', () => {
    const profile = completeOriginStory();
    expect(originStoryScenes).toHaveLength(15);
    expect(profile.originStory.completed).toBe(true);
    expect(profile.originStory.completedSceneIds).toHaveLength(15);
    expect(Object.keys(profile.originStory.choices)).toHaveLength(15);
    expect(profile.originStory.flags).toHaveLength(15);
    expect(profile.originStory.selectionScore).toBeGreaterThan(0);
    expect(profile.unlockedRecords).toContain('psyche-generation-07');
    expect(getMissionStatus(profile, missions[0]!)).toBe('available');
  });

  it('does not allow an origin choice to be revised after it becomes memory', () => {
    const profile = createNewCampaignProfile();
    const scene = originStoryScenes[0]!;
    const first = chooseOriginStoryPath(profile, scene.id, scene.choices[0].id);
    const revised = chooseOriginStoryPath(first, scene.id, scene.choices[1].id);
    expect(revised).toBe(first);
    expect(first.raonPath.compassion).toBe(1);
    expect(first.raonPath.insight).toBe(0);
  });

  it('tracks Raon story choices without double-counting revisions', () => {
    const profile = { ...missionReadyProfile(), storyChoices: {} };
    const compassionate = chooseRaonStoryPath(profile, 'grey-bridge-escort', 'compassion');
    const revised = chooseRaonStoryPath(compassionate, 'grey-bridge-escort', 'insight');
    const unchanged = chooseRaonStoryPath(revised, 'grey-bridge-escort', 'insight');

    expect(compassionate.raonPath.compassion).toBe(1);
    expect(revised.raonPath.compassion).toBe(0);
    expect(revised.raonPath.insight).toBe(1);
    expect(unchanged).toBe(revised);
  });

  it('turns a story choice into a deterministic check and remembered relationship beat', () => {
    const profile = { ...missionReadyProfile(), storyChoices: {} };
    const chance = getNarrativeCheckChance(profile, 'compassion', 'hadori');
    const decided = chooseRaonStoryPath(profile, 'grey-bridge-escort', 'compassion');
    const repeated = chooseRaonStoryPath(profile, 'grey-bridge-escort', 'compassion');
    const memory = decided.relationshipMemories['grey-bridge-escort'];

    expect(decided.narrativeChecks['grey-bridge-escort']?.chance).toBe(chance);
    expect(decided.narrativeChecks['grey-bridge-escort']?.roll).toBe(repeated.narrativeChecks['grey-bridge-escort']?.roll);
    expect(['clear', 'costly']).toContain(memory?.outcome);
    expect(memory?.companionId).toBe('hadori');
    expect(decided.bondLevels[getBondKey('raon', 'hadori')]).toBeGreaterThan(0);
  });

  it('raises war pressure when Raon delays and relieves it through completed missions', () => {
    const fresh = completeOriginStory();
    const delayed = { ...fresh, day: 8 };
    const relieved = { ...delayed, completedMissions: missions.slice(0, 3).map((mission) => mission.id) };

    expect(getWarPressure(delayed).value).toBeGreaterThan(getWarPressure(fresh).value);
    expect(getWarPressure(relieved).value).toBeLessThan(getWarPressure(delayed).value);
  });

  it('unlocks operations in prerequisite order', () => {
    const profile = completeOriginStory();
    const firstMission = missions[0];
    const secondMission = missions[1];
    expect(firstMission).toBeDefined();
    expect(secondMission).toBeDefined();
    if (!firstMission || !secondMission) return;

    expect(getMissionStatus(profile, firstMission)).toBe('available');
    expect(getMissionStatus(profile, secondMission)).toBe('locked');

    const decided = chooseRaonStoryPath(profile, firstMission.id, 'resolve');
    const cleared = completeMission(decided, firstMission, victoriousBattle(decided, firstMission)).profile;
    expect(getMissionStatus(cleared, secondMission)).toBe('available');
    expect(cleared.supplies).toBe(profile.supplies + firstMission.reward.supplies);
    expect(cleared.completedMissions).toContain(firstMission.id);
  });

  it('does not duplicate first-clear rewards', () => {
    const profile = missionReadyProfile();
    const mission = missions[0];
    expect(mission).toBeDefined();
    if (!mission) return;

    const first = completeMission(profile, mission, victoriousBattle(profile, mission));
    const replay = completeMission(first.profile, mission, victoriousBattle(first.profile, mission));
    expect(first.firstClear).toBe(true);
    expect(replay.firstClear).toBe(false);
    expect(replay.profile.supplies).toBe(first.profile.supplies);
  });

  it('improves replay grades without duplicating rewards', () => {
    const profile = missionReadyProfile();
    const mission = missions[0]!;
    const first = completeMission(profile, mission, victoriousBattle(profile, mission)).profile;
    const replayState = victoriousBattle(first, mission, { round: 1 });
    const replay = completeMission(first, mission, replayState);
    expect(replay.profile.missionGrades[mission.id]).toBe('S');
    expect(replay.profile.supplies).toBe(first.supplies);
  });

  it('spends supplies for headquarters upgrades', () => {
    const profile = createNewCampaignProfile();
    const training = facilities.find((facility) => facility.id === 'training');
    expect(training).toBeDefined();
    if (!training) return;
    const expectedCost = training.baseCost * (profile.facilities.training + 1);
    const upgraded = upgradeFacility(profile, 'training');
    expect(upgraded.facilities.training).toBe(profile.facilities.training + 1);
    expect(upgraded.supplies).toBe(profile.supplies - expectedCost);
  });

  it('spends a skill point when a hero node is unlocked', () => {
    const profile = createNewCampaignProfile();
    const before = profile.heroProgress.raon;
    expect(before).toBeDefined();
    if (!before) return;
    const upgraded = unlockHeroNode(profile, 'raon', 'fieldcraft');
    expect(upgraded.heroProgress.raon?.unlockedNodes).toContain('fieldcraft');
    expect(upgraded.heroProgress.raon?.skillPoints).toBe(before.skillPoints - 1);
  });

  it('ships eight fully playable operations', () => {
    expect(missions).toHaveLength(8);
    expect(missions.every((mission) => mission.enemies.length >= 4)).toBe(true);
    expect(new Set(missions.map((mission) => mission.battlefieldRule.id)).size).toBeGreaterThanOrEqual(5);
  });

  it('keeps at least four captains in the active squad', () => {
    let profile = createNewCampaignProfile();
    profile = toggleSquadMember(profile, 'kain');
    profile = toggleSquadMember(profile, 'chris');
    expect(profile.activeSquad).toHaveLength(4);
    const rejected = toggleSquadMember(profile, 'leo');
    expect(rejected.activeSquad).toHaveLength(4);
  });

  it('equips recovered items and applies their combat bonuses', () => {
    const profile = createNewCampaignProfile();
    const basePower = buildProgressedHeroes(profile).find((hero) => hero.id === 'raon')?.skills[0]?.power ?? 0;
    const withRelic = {
      ...profile,
      inventory: [...profile.inventory, 'stopped-petal'],
    };
    const equipped = equipHeroItem(withRelic, 'raon', 'stopped-petal');
    const upgradedPower = buildProgressedHeroes(equipped).find((hero) => hero.id === 'raon')?.skills[0]?.power ?? 0;
    expect(equipped.heroProgress.raon?.equipment[0]).toBe('stopped-petal');
    expect(upgradedPower).toBeGreaterThan(basePower);
  });

  it('resolves dispatch rewards only once', () => {
    const profile = missionReadyProfile();
    const firstMission = missions[0]!;
    const cleared = completeMission(profile, firstMission, victoriousBattle(profile, firstMission)).profile;
    const dispatched = resolveDispatch(cleared, 'bridge-salvage');
    const repeated = resolveDispatch(dispatched, 'bridge-salvage');
    expect(dispatched.completedDispatches).toContain('bridge-salvage');
    expect(dispatched.day).toBe(cleared.day + 1);
    expect(repeated.supplies).toBe(dispatched.supplies);
  });

  it('changes faction standings when a mission is cleared', () => {
    const profile = missionReadyProfile();
    const cleared = completeMission(profile, missions[0]!, victoriousBattle(profile)).profile;
    expect(cleared.factions.civilians).toBeGreaterThan(profile.factions.civilians);
    expect(cleared.factions.cheshi).toBeLessThan(profile.factions.cheshi);
  });

  it('spends daily actions on training and restores them next day', () => {
    const profile = createNewCampaignProfile();
    const trained = performTraining(profile, 'raon', 'foundation');
    expect(trained.commandActions).toBe(2);
    expect(trained.supplies).toBe(profile.supplies - 20);
    expect(trained.heroProgress.raon?.xp).toBeGreaterThan(profile.heroProgress.raon?.xp ?? 0);
    const nextDay = advanceDay(trained);
    expect(nextDay.commandActions).toBe(3);
    expect(nextDay.day).toBe(trained.day + 1);
  });

  it('prevents free day skipping before any command action', () => {
    const profile = createNewCampaignProfile();
    expect(advanceDay(profile)).toBe(profile);
  });

  it('rewards a balanced daily command plan once per day', () => {
    let profile = createNewCampaignProfile();
    profile = performTraining(profile, 'raon', 'foundation');
    profile = performBondActivity(profile, 'raon', 'hadori');
    profile = performDailyActivity(profile, 'city-watch');
    expect(canClaimDailyOrders(profile)).toBe(true);
    const claimed = claimDailyOrders(profile);
    expect(claimed.dailyRewardClaimed).toBe(true);
    expect(claimed.relics).toBe(profile.relics + 1);
    expect(claimDailyOrders(claimed)).toBe(claimed);
  });

  it('keeps a completed daily plan in place until its reward is claimed', () => {
    let profile = createNewCampaignProfile();
    profile = performTraining(profile, 'raon', 'foundation');
    profile = performBondActivity(profile, 'raon', 'hadori');
    profile = performDailyActivity(profile, 'city-watch');
    expect(canClaimDailyOrders(profile)).toBe(true);
    expect(canAdvanceDay(profile)).toBe(false);
    expect(canAdvanceDay(claimDailyOrders(profile))).toBe(true);
  });

  it('scales veteran first-clear rewards without changing story rewards', () => {
    const mission = missions[0]!;
    const story = getAdjustedMissionReward(mission, 'story');
    const veteran = getAdjustedMissionReward(mission, 'veteran');
    expect(story).toEqual(mission.reward);
    expect(veteran.supplies).toBeGreaterThan(mission.reward.supplies);
    expect(veteran.relics).toBe(mission.reward.relics + 1);
  });

  it('tracks and claims strategic orders exactly once', () => {
    const profile = createNewCampaignProfile();
    const trained = performTraining(profile, 'raon', 'foundation');
    const firstDrill = strategicOrders.find((order) => order.id === 'first-drill')!;
    expect(getStrategicOrderProgress(trained, firstDrill)).toBe(1);
    expect(canClaimStrategicOrder(trained, firstDrill)).toBe(true);
    const claimed = claimStrategicOrder(trained, 'first-drill');
    expect(claimed.claimedStrategicOrders).toContain('first-drill');
    expect(claimed.supplies).toBeGreaterThan(trained.supplies);
    expect(claimStrategicOrder(claimed, 'first-drill')).toBe(claimed);
  });

  it('builds repeatable pair bonds and unlocks relationship records', () => {
    let profile = createNewCampaignProfile();
    profile = performBondActivity(profile, 'raon', 'hadori');
    profile = advanceDay(profile);
    profile = performBondActivity(profile, 'raon', 'hadori');
    profile = advanceDay(profile);
    profile = performBondActivity(profile, 'raon', 'hadori');
    const key = getBondKey('raon', 'hadori');
    expect(profile.bondLevels[key]).toBe(36);
    expect(profile.unlockedRecords).toContain(`bond-${key}-trust`);
  });

  it('runs field activities repeatedly and tracks their completion count', () => {
    let profile = createNewCampaignProfile();
    profile = performDailyActivity(profile, 'city-watch');
    profile = advanceDay(profile);
    profile = performDailyActivity(profile, 'city-watch');
    expect(profile.activityCounts['city-watch']).toBe(2);
    expect(profile.factions.civilians).toBeGreaterThan(10);
  });

  it('crafts legacy equipment when the forge and resources are ready', () => {
    const profile = {
      ...createNewCampaignProfile(),
      supplies: 500,
      relics: 10,
      facilities: { ...createNewCampaignProfile().facilities, forge: 3 },
    };
    const crafted = craftEquipment(profile, 'nia-thread-map');
    expect(crafted.inventory).toContain('nia-thread-map');
    expect(crafted.relics).toBe(profile.relics - 4);
  });
});

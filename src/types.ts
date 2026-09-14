export type NavigationSection =
  | 'title'
  | 'campaign'
  | 'world'
  | 'headquarters'
  | 'activities'
  | 'roster'
  | 'chronicle'
  | 'codex'
  | 'archive';

export type CharacterEra = '7기' | '대전쟁' | '전후' | '5기';

export interface CharacterRecord {
  id: string;
  name: string;
  romanized: string;
  epithet: string;
  era: CharacterEra;
  generation: string;
  affiliation: string;
  role: string;
  weapon: string;
  style: string;
  quote: string;
  officialSummary: string;
  hiddenTruth: string;
  readerJourney: string[];
  keywords: string[];
  art: string;
  accent: string;
}

export interface GenerationRecord {
  id: number;
  name: string;
  title: string;
  period: string;
  thesis: string;
  description: string;
  keyFigures: string[];
  values: string[];
  art: string;
  status: 'active' | 'scarred' | 'legendary' | 'fractured';
}

export interface TimelineEvent {
  year: string;
  title: string;
  publicRecord: string;
  trueRecord: string;
  tone: 'gold' | 'red' | 'blue';
}

export interface WorldRegion {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  danger: number;
  coordinates: string;
  tags: string[];
  art: string;
}

export interface ArchiveAsset {
  id: string;
  title: string;
  subtitle: string;
  source: 'provided' | 'generated';
  image: string;
  orientation: 'portrait' | 'landscape';
  category: 'character' | 'generation' | 'history' | 'mission';
  tags: string[];
}

export type SkillKind =
  | 'damage'
  | 'guard'
  | 'support'
  | 'reveal'
  | 'area';

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  kind: SkillKind;
  power: number;
  morale: number;
  target: 'enemy' | 'ally' | 'all-enemies' | 'carriage';
  cooldown?: number;
}

export interface HeroDefinition {
  id: string;
  name: string;
  title: string;
  maxHp: number;
  armor: number;
  art: string;
  accent: string;
  position: { x: number; y: number };
  skills: SkillDefinition[];
}

export interface EnemyDefinition {
  id: string;
  name: string;
  title: string;
  maxHp: number;
  armor: number;
  damage: number;
  hidden?: boolean;
  elite?: boolean;
  boss?: boolean;
  targetPreference?: 'objective' | 'hero' | 'mixed';
  position: { x: number; y: number };
}

export interface BattleUnitState {
  id: string;
  hp: number;
  shield: number;
  acted: boolean;
  exposed: number;
  stunned: number;
  revealed: boolean;
}

export interface BattleLogEntry {
  id: number;
  round: number;
  speaker: string;
  message: string;
  tone: 'system' | 'hero' | 'enemy' | 'story';
}

export interface BattleState {
  missionId: string;
  difficulty: MissionDifficulty;
  round: number;
  roundLimit: number;
  commandPoints: number;
  morale: number;
  carriageHp: number;
  carriageShield: number;
  heroes: BattleUnitState[];
  enemies: BattleUnitState[];
  log: BattleLogEntry[];
  outcome: 'active' | 'victory' | 'defeat';
  finisherUsed: boolean;
  revelationTriggered: boolean;
  focusTargetId?: string;
  focusChain: string[];
  breakCount: number;
  raonStance: RaonStoryChoiceId;
  warPressure?: number;
  bondSupport?: number;
}

export type RaonStoryChoiceId = 'compassion' | 'insight' | 'resolve';

export interface RaonPathStats {
  compassion: number;
  insight: number;
  resolve: number;
}

export interface RaonStoryChoice {
  id: RaonStoryChoiceId;
  title: string;
  line: string;
  effect: string;
  doctrine: 'shelter' | 'counterfire';
}

export interface RaonStoryBeat {
  missionId: string;
  scene: string;
  narration: string;
  monologue: string;
  companionId: string;
  companionLine: string;
  question: string;
  choices: RaonStoryChoice[];
  victoryReflection: string;
  defeatReflection: string;
}

export type NarrativeCheckOutcome = 'clear' | 'costly';

export interface NarrativeCheckResult {
  choiceId: RaonStoryChoiceId;
  chance: number;
  roll: number;
  outcome: NarrativeCheckOutcome;
}

export interface RaonRelationshipMemory {
  missionId: string;
  companionId: string;
  choiceId: RaonStoryChoiceId;
  text: string;
  reaction: string;
  outcome: NarrativeCheckOutcome;
}

export interface OriginStoryChoice {
  id: string;
  title: string;
  line: string;
  path: RaonStoryChoiceId;
  flag: string;
  score: number;
  result: string;
}

export interface OriginStoryScene {
  id: string;
  sequence: number;
  chapter: string;
  time: string;
  location: string;
  title: string;
  subtitle: string;
  background: string;
  speakerId: string;
  speakerName: string;
  speakerRole: string;
  speakerArt: string;
  dialogue: string;
  narration: string[];
  monologue: string;
  question: string;
  choices: OriginStoryChoice[];
  nextSceneId?: string;
}

export interface OriginStoryProgress {
  currentSceneId: string;
  completed: boolean;
  completedSceneIds: string[];
  choices: Record<string, string>;
  flags: string[];
  selectionScore: number;
  villageRescue?: VillageRescueState;
}

export type VillageRescueChoiceId = 'save-child' | 'mark-safe-route' | 'draw-the-beast';
export type VillageRescueAction = { type: 'move'; dx: number; dy: number } | { type: 'assist' } | { type: 'guard' };
export interface VillageRescueState {
  phase: 'ready' | 'active' | 'failed' | 'return' | 'complete';
  choiceId: VillageRescueChoiceId;
  attempt: number;
  turn: number;
  hp: number;
  x: number;
  y: number;
  threatRow: number;
  progress: number;
  markedColumns: number[];
  log: string[];
}

export type WorldTimePhase = 'dawn' | 'day' | 'dusk' | 'night';

export interface NpcMemoryRecord {
  affinity: number;
  lastChoice?: string;
  rememberedFacts: string[];
  lastSeenDay: number;
}

export interface VillageWorldState {
  playerX: number;
  playerY: number;
  visitedLandmarks: string[];
  completedErrands: string[];
}

export interface HeadquartersRoomSlot {
  slot: number;
  facilityId: FacilityId;
}

export interface WorldSimulationState {
  minutes: number;
  phase: WorldTimePhase;
  weather: 'clear' | 'wind' | 'rain' | 'ash';
  currentRegion: string;
  discoveredLocations: string[];
  npcMemories: Record<string, NpcMemoryRecord>;
  village: VillageWorldState;
  headquartersLayout: HeadquartersRoomSlot[];
  eventJournal: string[];
}

export type MissionDifficulty = 'story' | 'standard' | 'veteran';

export type MissionType = 'escort' | 'investigation' | 'defense' | 'rescue' | 'assault';

export type BattlefieldRuleId = 'standard' | 'aerial-barrage' | 'archive-seal' | 'fractured-truce' | 'temporal-echo';

export interface BattlefieldRule {
  id: BattlefieldRuleId;
  name: string;
  description: string;
}

export type FactionId = 'empire' | 'civilians' | 'cursed' | 'cheshi';

export interface MissionReward {
  xp: number;
  supplies: number;
  intel: number;
  relics: number;
  renown: number;
  equipmentId?: string;
  factions?: Partial<Record<FactionId, number>>;
}

export interface MissionDoctrineOption {
  id: 'shelter' | 'counterfire';
  title: string;
  author: string;
  description: string;
}

export interface MissionDefinition {
  id: string;
  operation: string;
  title: string;
  subtitle: string;
  act: number;
  chapter: string;
  regionId: string;
  type: MissionType;
  threat: number;
  recommendedLevel: number;
  summary: string;
  objectives: string[];
  intel: string[];
  background: string;
  prerequisites: string[];
  reward: MissionReward;
  roundLimit: number;
  objectiveLabel: string;
  objectiveBaseHp: number;
  battlefieldRule: BattlefieldRule;
  enemies: EnemyDefinition[];
  doctrines: MissionDoctrineOption[];
  revelation?: {
    enemyId: string;
    heroId: string;
    skillId: string;
    line: string;
  };
  victoryText: string;
  defeatText: string;
}

export interface HeroProgress {
  level: number;
  xp: number;
  bond: number;
  skillPoints: number;
  unlockedNodes: string[];
  equipment: [string, string];
}

export type EquipmentSlot = 'weapon' | 'support';

export interface EquipmentDefinition {
  id: string;
  name: string;
  slot: EquipmentSlot;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  description: string;
  hp: number;
  armor: number;
  power: number;
  art: string;
}

export interface FactionDefinition {
  id: FactionId;
  name: string;
  subtitle: string;
  description: string;
  accent: string;
}

export interface DispatchDefinition {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  requiredMission?: string;
  cost: number;
  days: number;
  reward: {
    supplies: number;
    intel: number;
    relics: number;
    faction?: Partial<Record<FactionId, number>>;
    equipmentId?: string;
  };
}

export type DailyActivityId =
  | 'city-watch'
  | 'rail-salvage'
  | 'archive-decoding'
  | 'border-mediation'
  | 'field-triage'
  | 'cheshi-signal-hunt';

export interface DailyActivityDefinition {
  id: DailyActivityId;
  title: string;
  subtitle: string;
  description: string;
  art: string;
  actionCost: number;
  suppliesCost: number;
  intelCost: number;
  requiredMission?: string;
  reward: {
    supplies: number;
    intel: number;
    relics: number;
    renown: number;
    faction?: Partial<Record<FactionId, number>>;
  };
}

export type TrainingFocus = 'foundation' | 'survival' | 'command';

export interface DailyCommandStats {
  training: number;
  bond: number;
  field: number;
}

export interface CareerStats {
  missions: number;
  trainings: number;
  bonds: number;
  fieldActivities: number;
  crafts: number;
  dispatches: number;
  perfectDays: number;
}

export type StrategicOrderId =
  | 'first-drill'
  | 'balanced-command'
  | 'first-return'
  | 'field-doctrine'
  | 'trusted-pair'
  | 'legacy-forge';

export interface StrategicOrderDefinition {
  id: StrategicOrderId;
  title: string;
  subtitle: string;
  description: string;
  stat: keyof CareerStats;
  goal: number;
  targetSection: NavigationSection;
  reward: {
    supplies: number;
    intel: number;
    relics: number;
    renown: number;
  };
}

export interface CraftRecipe {
  equipmentId: string;
  forgeLevel: number;
  supplies: number;
  relics: number;
}

export type FacilityId = 'training' | 'archive' | 'infirmary' | 'forge' | 'violet';

export interface CampaignProfile {
  version: number;
  commanderName: string;
  day: number;
  commandLevel: number;
  renown: number;
  supplies: number;
  intel: number;
  relics: number;
  commandActions: number;
  activeSquad: string[];
  inventory: string[];
  factions: Record<FactionId, number>;
  completedDispatches: string[];
  activityCounts: Record<string, number>;
  bondLevels: Record<string, number>;
  dailyCommandStats: DailyCommandStats;
  dailyRewardClaimed: boolean;
  careerStats: CareerStats;
  claimedStrategicOrders: StrategicOrderId[];
  completedMissions: string[];
  missionGrades: Record<string, 'S' | 'A' | 'B' | 'C'>;
  heroProgress: Record<string, HeroProgress>;
  facilities: Record<FacilityId, number>;
  unlockedRecords: string[];
  activityLog: string[];
  raonPath: RaonPathStats;
  storyChoices: Record<string, RaonStoryChoiceId>;
  narrativeChecks: Record<string, NarrativeCheckResult>;
  relationshipMemories: Record<string, RaonRelationshipMemory>;
  originStory: OriginStoryProgress;
  world: WorldSimulationState;
}

export interface FacilityDefinition {
  id: FacilityId;
  name: string;
  subtitle: string;
  description: string;
  benefit: string[];
  maxLevel: number;
  baseCost: number;
  art: string;
}

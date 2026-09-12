import type { CampaignProfile } from '../types';

const databaseName = 'raonjena-saves';
const storeName = 'campaign-slots';
const databaseVersion = 1;
const storageTimeoutMs = 4000;
const lastSaveTimes = new Map<number, number>();

export function nextCampaignSaveTimestamp(slot: number, previous = 0) {
  const timestamp = Math.max(Date.now(), previous + 1, (lastSaveTimes.get(slot) ?? 0) + 1);
  lastSaveTimes.set(slot, timestamp);
  return new Date(timestamp).toISOString();
}

export interface CampaignSlotSummary {
  slot: number;
  exists: boolean;
  day: number;
  originCompleted: boolean;
  sceneTitle: string;
  missions: number;
  updatedAt?: string;
}

interface StoredCampaignSlot {
  slot: number;
  profile: CampaignProfile;
  updatedAt: string;
}

export type MirroredCampaignRead =
  | { status: 'found'; record: unknown }
  | { status: 'missing' }
  | { status: 'unavailable' };

export type CampaignLoadResult =
  | { status: 'ready'; profile: CampaignProfile; source: 'local' | 'backup' | 'new' }
  | { status: 'blocked'; message: string };

// Keep hydration ownership separate from React render timing. A slot switch or
// explicit new game invalidates any older read before it can enable autosave.
export class CampaignSlotSession {
  private revision = 0;
  private hydratedSlot: number | null = null;

  invalidate() {
    this.revision += 1;
    this.hydratedSlot = null;
  }

  startNew(slot: number) {
    this.invalidate();
    this.hydratedSlot = slot;
  }

  canSave(slot: number) {
    return this.hydratedSlot === slot;
  }

  async load(slot: number, read: (slot: number) => Promise<CampaignLoadResult>) {
    this.invalidate();
    const request = this.revision;
    let result: CampaignLoadResult;
    try {
      result = await read(slot);
    } catch {
      result = { status: 'blocked', message: '여정을 읽는 중 오류가 발생했습니다. 기존 기록을 보존했습니다.' };
    }
    if (request !== this.revision) return undefined;
    if (result.status === 'ready') this.hydratedSlot = slot;
    return result;
  }
}

type Validator = (value: unknown) => boolean;
export function isSaveObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
const text: Validator = (value) => typeof value === 'string';
const boolean: Validator = (value) => typeof value === 'boolean';
const number = (minimum = 0, maximum = Infinity, integer = false): Validator => (value) => (
  typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
  && (!integer || Number.isSafeInteger(value))
);
const oneOf = (...values: string[]): Validator => (value) => typeof value === 'string' && values.includes(value);
const arrayOf = (validate: Validator): Validator => (value) => Array.isArray(value) && value.every(validate);
const recordOf = (validate: Validator): Validator => (value) => isSaveObject(value) && Object.values(value).every(validate);
const objectWith = (fields: Record<string, Validator>, partial = true): Validator => (value) => (
  isSaveObject(value) && Object.entries(fields).every(([key, validate]) => (
    key in value ? validate(value[key]) : partial
  ))
);
const strings = arrayOf(text);
const count = number(0, Infinity, true);
const stance = oneOf('compassion', 'insight', 'resolve');
const outcome = oneOf('clear', 'costly');

// Old versions may omit fields introduced later. Present fields still need a
// valid shape: spreading malformed data over defaults is not a migration.
const campaignShape = objectWith({
  version: number(1, 10, true), commanderName: text, day: number(1, Infinity, true),
  commandLevel: number(1, Infinity, true), renown: count, supplies: count, intel: count, relics: count,
  commandActions: number(0, 3, true), activeSquad: strings, inventory: strings,
  factions: recordOf(number(-100, 100)), completedDispatches: strings,
  activityCounts: recordOf(count), bondLevels: recordOf(number(0, 100)),
  dailyCommandStats: objectWith({ training: count, bond: count, field: count }), dailyRewardClaimed: boolean,
  careerStats: objectWith({ missions: count, trainings: count, bonds: count, fieldActivities: count, crafts: count, dispatches: count, perfectDays: count }),
  claimedStrategicOrders: strings, completedMissions: strings,
  missionGrades: recordOf(oneOf('S', 'A', 'B', 'C')),
  heroProgress: recordOf(objectWith({
    level: number(1, Infinity, true), xp: count, bond: number(0, 100), skillPoints: count,
    unlockedNodes: strings, equipment: (value) => strings(value) && (value as string[]).length <= 2,
  })),
  facilities: recordOf(count), unlockedRecords: strings, activityLog: strings,
  raonPath: objectWith({ compassion: count, insight: count, resolve: count }),
  storyChoices: recordOf(stance),
  narrativeChecks: recordOf(objectWith({ choiceId: stance, chance: number(0, 100), roll: number(1, 100), outcome }, false)),
  relationshipMemories: recordOf(objectWith({ missionId: text, companionId: text, choiceId: stance, text, reaction: text, outcome }, false)),
  originStory: objectWith({ currentSceneId: text, completed: boolean, completedSceneIds: strings, choices: recordOf(text), flags: strings, selectionScore: count }),
  world: objectWith({
    minutes: number(), phase: oneOf('dawn', 'day', 'dusk', 'night'), weather: oneOf('clear', 'wind', 'rain', 'ash'), currentRegion: text,
    discoveredLocations: strings, eventJournal: strings,
    npcMemories: recordOf((value) => objectWith({ affinity: number(-100, 100), rememberedFacts: strings, lastSeenDay: number(1, Infinity, true) }, false)(value)
      && objectWith({ lastChoice: text })(value)),
    village: objectWith({ playerX: number(), playerY: number(), visitedLandmarks: strings, completedErrands: strings }),
    headquartersLayout: arrayOf(objectWith({ slot: number(0, 4, true), facilityId: oneOf('training', 'archive', 'infirmary', 'forge', 'violet') }, false)),
  }),
});

export function isCampaignProfileCandidate(value: unknown): value is Partial<CampaignProfile> {
  return isSaveObject(value) && number(1, Infinity, true)(value.day)
    && isSaveObject(value.heroProgress) && strings(value.completedMissions)
    && campaignShape(value);
}

// A slow database open must not let an older snapshot overwrite a newer save.
// Reads join the same queue so switching back to a slot also sees pending saves.
const pendingSlots = new Map<number, Promise<void>>();

function runSlotOperation<T>(slot: number, operation: () => Promise<T>): Promise<T> {
  const previous = pendingSlots.get(slot) ?? Promise.resolve();
  const result = previous.then(operation);
  const settled = result.then(() => undefined, () => undefined);
  pendingSlots.set(slot, settled);
  void settled.then(() => {
    if (pendingSlots.get(slot) === settled) pendingSlots.delete(slot);
  });
  return result;
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    let settled = false;
    const fail = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(new Error('Failed to open save database'));
    };
    const timeout = setTimeout(fail, storageTimeoutMs);
    let request: IDBOpenDBRequest;
    try {
      request = window.indexedDB.open(databaseName, databaseVersion);
    } catch {
      fail();
      return;
    }
    request.onupgradeneeded = () => {
      if (settled) {
        request.transaction?.abort();
        return;
      }
      const database = request.result;
      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName, { keyPath: 'slot' });
      }
    };
    request.onsuccess = () => {
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      clearTimeout(timeout);
      resolve(request.result);
    };
    request.onerror = fail;
    request.onblocked = fail;
  });
}

async function withTransaction<T>(
  mode: IDBTransactionMode,
  execute: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      let result: T;
      const timeout = setTimeout(() => {
        try { transaction.abort(); } catch { /* The transaction may already have closed. */ }
        reject(new Error('Save transaction timed out'));
      }, storageTimeoutMs);
      const fail = () => {
        clearTimeout(timeout);
        reject(transaction.error ?? new Error('Save transaction failed'));
      };
      transaction.oncomplete = () => {
        clearTimeout(timeout);
        resolve(result);
      };
      transaction.onerror = fail;
      transaction.onabort = fail;
      try {
        const request = execute(transaction.objectStore(storeName));
        request.onsuccess = () => { result = request.result; };
        request.onerror = fail;
      } catch (error) {
        clearTimeout(timeout);
        transaction.abort();
        reject(error);
      }
    });
  } finally {
    database.close();
  }
}

export function mirrorCampaignSlot(slot: number, profile: CampaignProfile, updatedAt = nextCampaignSaveTimestamp(slot)): Promise<boolean> {
  // Capture the data now, before waiting for any earlier write to finish.
  const record: StoredCampaignSlot = { slot, profile: structuredClone(profile), updatedAt };
  return runSlotOperation(slot, async () => {
    try {
      await withTransaction('readwrite', (store) => store.put(record));
      return true;
    } catch {
      return false;
    }
  });
}

export function restoreMirroredCampaignSlot(slot: number): Promise<MirroredCampaignRead> {
  return runSlotOperation(slot, async (): Promise<MirroredCampaignRead> => {
    try {
      const record: unknown = await withTransaction('readonly', (store) => store.get(slot));
      if (isSaveObject(record) && record.slot === slot && isCampaignProfileCandidate(record.profile) && typeof record.updatedAt === 'string') {
        const timestamp = Date.parse(record.updatedAt) || 0;
        lastSaveTimes.set(slot, Math.max(lastSaveTimes.get(slot) ?? 0, timestamp));
      }
      return record === undefined ? { status: 'missing' } : { status: 'found', record };
    } catch {
      return { status: 'unavailable' };
    }
  });
}

export function deleteMirroredCampaignSlot(slot: number): Promise<boolean> {
  return runSlotOperation(slot, async () => {
    try {
      await withTransaction('readwrite', (store) => store.delete(slot));
      return true;
    } catch {
      return false;
    }
  });
}

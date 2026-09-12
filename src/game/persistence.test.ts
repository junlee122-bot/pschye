import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CampaignProfile } from '../types';
import { CampaignSlotSession, mirrorCampaignSlot, restoreMirroredCampaignSlot, type CampaignLoadResult } from './persistence';
import { campaignStorageKey, createNewCampaignProfile, getActiveCampaignSlot, listCampaignSlots, loadCampaignProfile, saveCampaignProfile, setActiveCampaignSlot } from './progression';

interface RequestStub {
  result?: unknown;
  onsuccess?: () => void;
  onerror?: () => void;
}

// Async requests and transaction completion are separate from the caller. The
// harness also lets a test hold database opens or fail a read without treating
// either condition as an empty slot.
function createStorageHarness() {
  const local = new Map<string, string>();
  const records = new Map<number, unknown>();
  const writes: number[] = [];
  const heldOpens: Array<() => void> = [];
  const controls = { holdOpen: false, failOpen: false, failRead: false, denyLocal: false, denyLocalWrite: false, denyTimestampWrite: false };
  const storage = {
    getItem: vi.fn((key: string) => {
      if (controls.denyLocal) throw new Error('Storage denied');
      return local.get(key) ?? null;
    }),
    setItem: vi.fn((key: string, value: string) => {
      if (controls.denyLocal || controls.denyLocalWrite) throw new Error('Storage denied');
      if (controls.denyTimestampWrite && key.endsWith('-updated')) throw new Error('Metadata quota exceeded');
      local.set(key, value);
    }),
    removeItem: vi.fn((key: string) => { local.delete(key); }),
  };
  const database = {
    close: vi.fn(),
    transaction: () => {
      let aborted = false;
      const transaction = {
        oncomplete: undefined as (() => void) | undefined,
        onerror: undefined as (() => void) | undefined,
        onabort: undefined as (() => void) | undefined,
        error: null,
        abort: () => { aborted = true; transaction.onabort?.(); },
        objectStore: () => ({
          get: (slot: number) => request(() => records.get(slot), true),
          put: (record: { slot: number }) => request(() => {
            records.set(record.slot, structuredClone(record));
            writes.push(record.slot);
            return record.slot;
          }),
          delete: (slot: number) => request(() => { records.delete(slot); }),
        }),
      };
      const request = (operation: () => unknown, reading = false) => {
        const pending: RequestStub = {};
        queueMicrotask(() => {
          if (aborted) return;
          if (reading && controls.failRead) {
            pending.onerror?.();
            transaction.onabort?.();
            return;
          }
          pending.result = operation();
          pending.onsuccess?.();
          transaction.oncomplete?.();
        });
        return pending;
      };
      return transaction;
    },
  };
  const indexedDB = {
    open: vi.fn(() => {
      const pending: RequestStub = {};
      const finish = () => {
        if (controls.failOpen) pending.onerror?.();
        else { pending.result = database; pending.onsuccess?.(); }
      };
      if (controls.holdOpen) heldOpens.push(finish);
      else queueMicrotask(finish);
      return pending;
    }),
  };
  vi.stubGlobal('window', { localStorage: storage, indexedDB });
  return {
    local, records, writes, storage, controls, indexedDB,
    release: () => { controls.holdOpen = false; heldOpens.splice(0).forEach((finish) => finish()); },
  };
}

function slotKey(slot = 1) { return `${campaignStorageKey}-slot-${slot}`; }
function rememberedProfile(day = 20) {
  const profile = createNewCampaignProfile();
  profile.day = day;
  profile.originStory.choices['village-dawn'] = 'first-memory';
  return profile;
}
function ready(profile: CampaignProfile): CampaignLoadResult { return { status: 'ready', profile, source: 'backup' }; }
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}

let storage: ReturnType<typeof createStorageHarness>;
beforeEach(() => { storage = createStorageHarness(); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('campaign save recovery', () => {
  it.each([undefined, '{broken JSON', 'null', '[]', '{"day":20}'])(
    'recovers a missing or malformed local save (%s) from IndexedDB', async (local) => {
      const profile = rememberedProfile();
      storage.records.set(1, { slot: 1, profile, updatedAt: '2026-09-10' });
      if (local !== undefined) storage.local.set(slotKey(), local);
      const result = await loadCampaignProfile(1);
      expect(result).toMatchObject({ status: 'ready', source: 'backup', profile });
      expect(storage.writes).toEqual([]);
      expect(storage.local.get(slotKey())).toBe(local);
      if (result.status === 'ready') await saveCampaignProfile(result.profile, 1);
      expect(JSON.parse(storage.local.get(slotKey())!)).toMatchObject(profile);
      expect(storage.records.get(1)).toMatchObject({ profile });
    },
  );

  it.each([
    (profile: Record<string, unknown>) => { profile.day = '20'; },
    (profile: Record<string, unknown>) => { profile.activeSquad = {}; },
    (profile: Record<string, unknown>) => { profile.heroProgress = { raon: { level: -1 } }; },
    (profile: Record<string, unknown>) => { profile.world = { npcMemories: { kazrin: { rememberedFacts: 'broken' } } }; },
    (profile: Record<string, unknown>) => { profile.originStory = { currentSceneId: 'missing-scene' }; },
  ])('rejects structurally invalid local data before migration', async (corrupt) => {
    const profile = rememberedProfile();
    const damaged = structuredClone(profile) as unknown as Record<string, unknown>;
    corrupt(damaged);
    storage.local.set(slotKey(), JSON.stringify(damaged));
    storage.records.set(1, { slot: 1, profile });
    expect(await loadCampaignProfile(1)).toMatchObject({ status: 'ready', source: 'backup', profile });
    expect(storage.writes).toEqual([]);
  });

  it('keeps a valid local save playable when IndexedDB is unavailable', async () => {
    const profile = rememberedProfile();
    storage.local.set(slotKey(), JSON.stringify(profile));
    storage.controls.failOpen = true;
    expect(await loadCampaignProfile(1)).toMatchObject({ status: 'ready', source: 'local', profile });
    expect(storage.indexedDB.open).toHaveBeenCalledTimes(1);
  });

  it.each(['failOpen', 'failRead'] as const)('preserves local data and backup when %s prevents recovery', async (failure) => {
    const record = { slot: 1, profile: rememberedProfile() };
    storage.records.set(1, record);
    storage.local.set(slotKey(), '{broken');
    storage.controls[failure] = true;
    const session = new CampaignSlotSession();
    expect(await session.load(1, loadCampaignProfile)).toMatchObject({ status: 'blocked' });
    expect(session.canSave(1)).toBe(false);
    expect(storage.records.get(1)).toEqual(record);
    expect(storage.local.get(slotKey())).toBe('{broken');
    expect(storage.writes).toEqual([]);
  });

  it('does not replace corrupt copies with a fresh profile', async () => {
    storage.local.set(slotKey(), '{broken');
    storage.records.set(1, { slot: 1, profile: { day: 'broken' } });
    expect(await loadCampaignProfile(1)).toMatchObject({ status: 'blocked' });
    expect(storage.records.get(1)).toEqual({ slot: 1, profile: { day: 'broken' } });
    expect(storage.writes).toEqual([]);
  });

  it('checks the backup before treating an absent local key as a new game', async () => {
    storage.controls.holdOpen = true;
    const session = new CampaignSlotSession();
    const loading = session.load(2, loadCampaignProfile);
    await Promise.resolve();
    expect(session.canSave(2)).toBe(false);
    expect(storage.storage.setItem).not.toHaveBeenCalled();
    storage.release();
    expect(await loading).toMatchObject({ status: 'ready', source: 'new' });
    expect(session.canSave(2)).toBe(true);
    expect(storage.writes).toEqual([]);
  });

  it('migrates legacy fields without losing progress or copying the old flag into other slots', async () => {
    const old = rememberedProfile(12) as Partial<CampaignProfile>;
    old.version = 9;
    delete old.world;
    delete old.originStory;
    storage.local.set('raonjena-campaign-v9', JSON.stringify(old));
    storage.local.set('raonjena-grey-bridge-complete', 'true');
    expect(await loadCampaignProfile(1)).toMatchObject({ status: 'ready', profile: { day: 12, version: 10, world: createNewCampaignProfile().world } });
    expect(await loadCampaignProfile(2)).toMatchObject({ status: 'ready', source: 'new', profile: { day: 1, completedMissions: [] } });
  });

  it('prefers the current backup over a stale legacy local save', async () => {
    storage.local.set('raonjena-campaign-v9', JSON.stringify({ ...rememberedProfile(4), version: 9 }));
    storage.records.set(1, { slot: 1, profile: rememberedProfile(20) });
    expect(await loadCampaignProfile(1)).toMatchObject({ status: 'ready', source: 'backup', profile: { day: 20 } });
  });

  it('can recover and continue saving when localStorage throws', async () => {
    storage.controls.denyLocal = true;
    storage.records.set(1, { slot: 1, profile: rememberedProfile() });
    expect(getActiveCampaignSlot()).toBe(1);
    expect(() => setActiveCampaignSlot(2)).not.toThrow();
    expect(() => listCampaignSlots()).not.toThrow();
    expect(await loadCampaignProfile(1)).toMatchObject({ status: 'ready', source: 'backup' });
    expect(await saveCampaignProfile(rememberedProfile(21), 1)).toBe(true);
    expect(storage.records.get(1)).toMatchObject({ profile: { day: 21 } });
  });

  it('loads the newer backup after local writes fail but an older local save remains readable', async () => {
    storage.local.set(slotKey(), JSON.stringify(rememberedProfile(10)));
    storage.local.set(`${slotKey()}-updated`, '2020-01-01T00:00:00.000Z');
    storage.controls.denyLocalWrite = true;
    expect(await saveCampaignProfile(rememberedProfile(11), 1)).toBe(true);
    expect(JSON.parse(storage.local.get(slotKey())!)).toMatchObject({ day: 10 });
    expect(await loadCampaignProfile(1)).toMatchObject({ status: 'ready', source: 'backup', profile: { day: 11 } });
  });

  it.each(['local', 'backup'] as const)('orders saves in the same millisecond when the %s store rejects the second save', async (failedStore) => {
    vi.spyOn(Date, 'now').mockReturnValue(2_000_000_000_000);
    await saveCampaignProfile(rememberedProfile(10), 1);
    const firstTimestamp = storage.local.get(`${slotKey()}-updated`);
    if (failedStore === 'local') storage.controls.denyLocalWrite = true;
    else storage.controls.failOpen = true;
    expect(await saveCampaignProfile(rememberedProfile(11), 1)).toBe(true);
    storage.controls.failOpen = false;
    const result = await loadCampaignProfile(1);
    expect(result).toMatchObject({ status: 'ready', profile: { day: 11 }, source: failedStore === 'local' ? 'backup' : 'local' });
    if (failedStore === 'backup') expect(storage.local.get(`${slotKey()}-updated`)).not.toBe(firstTimestamp);
  });

  it('keeps data and timestamp atomic when only the separate metadata key and backup fail to write', async () => {
    await saveCampaignProfile(rememberedProfile(10), 1);
    const previousTimestamp = storage.local.get(`${slotKey()}-updated`);
    storage.controls.denyTimestampWrite = true;
    storage.controls.failOpen = true;
    expect(await saveCampaignProfile(rememberedProfile(11), 1)).toBe(true);
    expect(storage.local.get(`${slotKey()}-updated`)).toBe(previousTimestamp);
    expect(JSON.parse(storage.local.get(slotKey())!)).toMatchObject({ day: 11, _savedAt: expect.any(String) });
    storage.controls.failOpen = false;
    const loaded = await loadCampaignProfile(1);
    expect(loaded).toMatchObject({ status: 'ready', source: 'local', profile: { day: 11 } });
    if (loaded.status === 'ready') expect(loaded.profile).not.toHaveProperty('_savedAt');
  });

  it('retains the newer local save when the backup is older or structurally invalid', async () => {
    storage.local.set(slotKey(), JSON.stringify(rememberedProfile(12)));
    storage.local.set(`${slotKey()}-updated`, '2026-09-11T00:00:00.000Z');
    storage.records.set(1, { slot: 1, profile: rememberedProfile(8), updatedAt: '2026-09-10T00:00:00.000Z' });
    expect(await loadCampaignProfile(1)).toMatchObject({ status: 'ready', source: 'local', profile: { day: 12 } });
    storage.records.set(1, { slot: 1, profile: { day: 'broken' } });
    expect(await loadCampaignProfile(1)).toMatchObject({ status: 'ready', source: 'local', profile: { day: 12 } });
  });

  it('compares the timestamp belonging to the local snapshot read before async recovery', async () => {
    storage.local.set(slotKey(), JSON.stringify(rememberedProfile(10)));
    storage.local.set(`${slotKey()}-updated`, '2020-01-01T00:00:00.000Z');
    storage.records.set(1, { slot: 1, profile: rememberedProfile(11), updatedAt: '2026-09-11T00:00:00.000Z' });
    storage.controls.holdOpen = true;
    const loading = loadCampaignProfile(1);
    await Promise.resolve();
    storage.local.set(slotKey(), JSON.stringify(rememberedProfile(11)));
    storage.local.set(`${slotKey()}-updated`, '2026-09-11T00:00:00.000Z');
    storage.release();
    expect(await loading).toMatchObject({ status: 'ready', source: 'backup', profile: { day: 11 } });
  });

  it('reports a failed save without claiming persistence when both stores reject writes', async () => {
    storage.controls.denyLocalWrite = true;
    storage.controls.failOpen = true;
    expect(await saveCampaignProfile(rememberedProfile(), 1)).toBe(false);
    expect(storage.writes).toEqual([]);
  });

  it('times out an unavailable database without authorizing a new save', async () => {
    vi.useFakeTimers();
    storage.controls.holdOpen = true;
    const loading = loadCampaignProfile(1);
    await vi.advanceTimersByTimeAsync(4001);
    expect(await loading).toMatchObject({ status: 'blocked' });
    storage.release();
    expect(storage.writes).toEqual([]);
  });
});

describe('hydration ownership and ordered save writes', () => {
  it('keeps autosave disabled when a loader unexpectedly throws', async () => {
    const session = new CampaignSlotSession();
    expect(await session.load(1, () => { throw new Error('Unavailable'); })).toMatchObject({ status: 'blocked' });
    expect(session.canSave(1)).toBe(false);
  });

  it('ignores a previous slot load that finishes after the selected slot', async () => {
    const first = deferred<CampaignLoadResult>();
    const second = deferred<CampaignLoadResult>();
    const session = new CampaignSlotSession();
    const older = session.load(1, () => first.promise);
    const newer = session.load(2, () => second.promise);
    second.resolve(ready(rememberedProfile(8)));
    expect(await newer).toMatchObject({ profile: { day: 8 } });
    first.resolve(ready(rememberedProfile(30)));
    expect(await older).toBeUndefined();
    expect(session.canSave(1)).toBe(false);
    expect(session.canSave(2)).toBe(true);
  });

  it('ignores the first mount read after StrictMode cleanup and reloading the same slot', async () => {
    const first = deferred<CampaignLoadResult>();
    const session = new CampaignSlotSession();
    const stale = session.load(1, () => first.promise);
    session.invalidate();
    expect(session.canSave(1)).toBe(false);
    expect(await session.load(1, async () => ready(rememberedProfile(9)))).toMatchObject({ profile: { day: 9 } });
    first.resolve(ready(rememberedProfile(2)));
    expect(await stale).toBeUndefined();
    expect(session.canSave(1)).toBe(true);
  });

  it('honors an explicit new game even when an older recovery finishes afterward', async () => {
    const pending = deferred<CampaignLoadResult>();
    const session = new CampaignSlotSession();
    const stale = session.load(1, () => pending.promise);
    session.startNew(1);
    expect(session.canSave(1)).toBe(true);
    const fresh = createNewCampaignProfile();
    await saveCampaignProfile(fresh, 1);
    pending.resolve(ready(rememberedProfile(80)));
    expect(await stale).toBeUndefined();
    expect(storage.records.get(1)).toMatchObject({ profile: fresh });
    expect(await loadCampaignProfile(1)).toMatchObject({ profile: fresh });
  });

  it('serializes delayed writes and reads so an older snapshot cannot win', async () => {
    storage.controls.holdOpen = true;
    const first = mirrorCampaignSlot(1, rememberedProfile(10));
    const second = mirrorCampaignSlot(1, rememberedProfile(11));
    const restored = restoreMirroredCampaignSlot(1);
    await Promise.resolve();
    expect(storage.indexedDB.open).toHaveBeenCalledTimes(1);
    storage.release();
    expect(await first).toBe(true);
    expect(await second).toBe(true);
    expect(await restored).toMatchObject({ status: 'found', record: { profile: { day: 11 } } });
    expect(storage.writes).toEqual([1, 1]);
  });
});

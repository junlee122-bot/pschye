import type { CampaignProfile } from '../types';

const databaseName = 'raonjena-saves';
const storeName = 'campaign-slots';
const databaseVersion = 1;

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

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const request = window.indexedDB.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName, { keyPath: 'slot' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open save database'));
  });
}

export async function mirrorCampaignSlot(slot: number, profile: CampaignProfile) {
  try {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite');
      transaction.objectStore(storeName).put({ slot, profile, updatedAt: new Date().toISOString() } satisfies StoredCampaignSlot);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Failed to mirror campaign slot'));
    });
    database.close();
  } catch {
    // LocalStorage remains the immediate source of truth when IndexedDB is unavailable.
  }
}

export async function restoreMirroredCampaignSlot(slot: number) {
  try {
    const database = await openDatabase();
    const result = await new Promise<StoredCampaignSlot | undefined>((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readonly');
      const request = transaction.objectStore(storeName).get(slot);
      request.onsuccess = () => resolve(request.result as StoredCampaignSlot | undefined);
      request.onerror = () => reject(request.error ?? new Error('Failed to restore campaign slot'));
    });
    database.close();
    return result;
  } catch {
    return undefined;
  }
}

export async function deleteMirroredCampaignSlot(slot: number) {
  try {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite');
      transaction.objectStore(storeName).delete(slot);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Failed to delete campaign slot'));
    });
    database.close();
  } catch {
    // The synchronous LocalStorage slot is already removed by the caller.
  }
}

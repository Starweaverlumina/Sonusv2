import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { type Sound, CONFIG } from '@/types';

interface SoundDeckDB extends DBSchema {
  metadata: {
    key: string;
    value: Sound;
  };
  audioblobs: {
    key: string;
    value: { id: string; blob: Blob };
  };
  banks: {
    key: string;
    value: { name: string };
  };
}

let db: IDBPDatabase<SoundDeckDB> | null = null;

export async function openDatabase(): Promise<IDBPDatabase<SoundDeckDB>> {
  if (db) return db;
  
  db = await openDB<SoundDeckDB>(CONFIG.DB_NAME, CONFIG.DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(CONFIG.STORE_META)) {
        database.createObjectStore(CONFIG.STORE_META, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(CONFIG.STORE_AUDIO)) {
        database.createObjectStore(CONFIG.STORE_AUDIO, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(CONFIG.STORE_BANKS)) {
        database.createObjectStore(CONFIG.STORE_BANKS, { keyPath: 'name' });
      }
    },
  });
  
  db.onversionchange = () => {
    db?.close();
    db = null;
  };
  
  return db;
}

export async function loadAllMeta(): Promise<Sound[]> {
  const database = await openDatabase();
  return database.getAll(CONFIG.STORE_META);
}

export async function saveMeta(sound: Sound): Promise<void> {
  const database = await openDatabase();
  await database.put(CONFIG.STORE_META, sound);
}

export async function deleteMeta(id: string): Promise<void> {
  const database = await openDatabase();
  await database.delete(CONFIG.STORE_META, id);
}

export async function saveAudio(id: string, blob: Blob): Promise<void> {
  const database = await openDatabase();
  await database.put(CONFIG.STORE_AUDIO, { id, blob });
}

export async function loadAudio(id: string): Promise<Blob | null> {
  const database = await openDatabase();
  const result = await database.get(CONFIG.STORE_AUDIO, id);
  return result?.blob || null;
}

export async function deleteAudio(id: string): Promise<void> {
  const database = await openDatabase();
  await database.delete(CONFIG.STORE_AUDIO, id);
}

export async function clearAll(): Promise<void> {
  const database = await openDatabase();
  await database.clear(CONFIG.STORE_META);
  await database.clear(CONFIG.STORE_AUDIO);
}

export async function loadBanks(): Promise<string[]> {
  const database = await openDatabase();
  const banks = await database.getAll(CONFIG.STORE_BANKS);
  return banks.map(b => b.name);
}

export async function saveBank(name: string): Promise<void> {
  const database = await openDatabase();
  await database.put(CONFIG.STORE_BANKS, { name });
}

export async function deleteBank(name: string): Promise<void> {
  const database = await openDatabase();
  await database.delete(CONFIG.STORE_BANKS, name);
}

export async function getStorageEstimate(): Promise<{ usage: number; quota: number }> {
  if (navigator.storage?.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
    };
  }
  return { usage: 0, quota: 0 };
}

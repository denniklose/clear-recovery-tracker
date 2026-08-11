import { normalizeAppState, type AppState } from "./recovery";

const DATABASE_NAME = "clear-recovery-cache-v1";
const DATABASE_VERSION = 2;
const STATE_STORE = "state";
const OPERATIONS_STORE = "operations";
const PUSH_STORE = "push";
const CURRENT_KEY = "current";
const PENDING_KEY = "pending-state";
const PUSH_DEVICE_KEY = "device";

export type CachedState = {
  state: AppState;
  ownerId: string | null;
  updatedAt: number;
};

export type PushPreferencesRecord = {
  key: "device";
  deviceId: string;
  deviceToken: string;
  dailyEnabled: boolean;
  levelUpEnabled: boolean;
  timezone: string;
  updatedAt: number;
};

export type QueuedPushEventRecord = {
  key: string;
  deviceId: string;
  eventKey: string;
  kind: "level-up";
  streak: number;
  milestone: boolean;
  queuedAt: number;
};

function openDatabase(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.reject(new Error("IndexedDB ist in diesem Browser nicht verfügbar."));
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB konnte nicht geöffnet werden."));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STATE_STORE)) {
        database.createObjectStore(STATE_STORE, { keyPath: "key" });
      }
      if (!database.objectStoreNames.contains(OPERATIONS_STORE)) {
        database.createObjectStore(OPERATIONS_STORE, { keyPath: "key" });
      }
      if (!database.objectStoreNames.contains(PUSH_STORE)) {
        database.createObjectStore(PUSH_STORE, { keyPath: "key" });
      }
    };
  });
}

function readRecord<T>(storeName: string, key: string): Promise<T | undefined> {
  return openDatabase().then((database) => new Promise<T | undefined>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).get(key);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB konnte nicht gelesen werden."));
    request.onsuccess = () => resolve(request.result as T | undefined);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB-Lesevorgang fehlgeschlagen."));
  }));
}

function writeRecord(storeName: string, record: object): Promise<void> {
  return openDatabase().then((database) => new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(record);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("IndexedDB-Schreibvorgang fehlgeschlagen."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("IndexedDB-Schreibvorgang abgebrochen."));
    };
  }));
}

function readRecords<T>(storeName: string): Promise<T[]> {
  return openDatabase().then((database) => new Promise<T[]>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();
    request.onerror = () => reject(request.error ?? new Error("IndexedDB konnte nicht gelesen werden."));
    request.onsuccess = () => resolve((request.result ?? []) as T[]);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB-Lesevorgang fehlgeschlagen."));
  }));
}

function deleteRecord(storeName: string, key: string): Promise<void> {
  return openDatabase().then((database) => new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(key);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("IndexedDB-Datensatz konnte nicht gelöscht werden."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("IndexedDB-Datensatz konnte nicht gelöscht werden."));
    };
  }));
}

export async function loadCachedState(): Promise<CachedState | null> {
  try {
    const record = await readRecord<Partial<CachedState> & { key?: string }>(STATE_STORE, CURRENT_KEY);
    if (!record?.state) return null;
    return {
      state: normalizeAppState(record.state),
      ownerId: typeof record.ownerId === "string" ? record.ownerId : null,
      updatedAt: typeof record.updatedAt === "number" ? record.updatedAt : 0,
    };
  } catch {
    return null;
  }
}

export async function saveCachedState(state: AppState, ownerId: string | null): Promise<void> {
  try {
    await writeRecord(STATE_STORE, {
      key: CURRENT_KEY,
      state: normalizeAppState(state),
      ownerId,
      updatedAt: Date.now(),
    });
  } catch {
    // Private browsing modes can disable IndexedDB; the active screen still remains usable.
  }
}

export async function loadPushPreferences(): Promise<PushPreferencesRecord | null> {
  try {
    return await readRecord<PushPreferencesRecord>(PUSH_STORE, PUSH_DEVICE_KEY) ?? null;
  } catch {
    return null;
  }
}

export async function savePushPreferences(preferences: Omit<PushPreferencesRecord, "key" | "updatedAt">): Promise<void> {
  await writeRecord(PUSH_STORE, {
    key: PUSH_DEVICE_KEY,
    ...preferences,
    updatedAt: Date.now(),
  });
}

export async function enqueuePushEvent(event: QueuedPushEventRecord): Promise<void> {
  await writeRecord(PUSH_STORE, event);
}

export async function loadQueuedPushEvents(deviceId: string): Promise<QueuedPushEventRecord[]> {
  try {
    const records = await readRecords<QueuedPushEventRecord>(PUSH_STORE);
    return records
      .filter((record) => record.key !== PUSH_DEVICE_KEY && record.deviceId === deviceId)
      .sort((left, right) => left.queuedAt - right.queuedAt);
  } catch {
    return [];
  }
}

export async function removeQueuedPushEvent(key: string): Promise<void> {
  try {
    await deleteRecord(PUSH_STORE, key);
  } catch {
    // A later online flush can safely retry the same event.
  }
}

export async function enqueueSyncState(state: AppState, ownerId: string): Promise<void> {
  await writeRecord(OPERATIONS_STORE, {
    key: PENDING_KEY,
    state: normalizeAppState(state),
    ownerId,
    queuedAt: Date.now(),
  });
}

export async function loadPendingSyncState(ownerId: string): Promise<AppState | null> {
  try {
    const record = await readRecord<{ state?: unknown; ownerId?: string }>(OPERATIONS_STORE, PENDING_KEY);
    if (record?.ownerId !== ownerId) return null;
    return record?.state ? normalizeAppState(record.state) : null;
  } catch {
    return null;
  }
}

export async function clearPendingSyncState(): Promise<void> {
  try {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(OPERATIONS_STORE, "readwrite");
      transaction.objectStore(OPERATIONS_STORE).delete(PENDING_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Sync-Queue konnte nicht geleert werden."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Sync-Queue konnte nicht geleert werden."));
    });
    database.close();
  } catch {
    // A later online/visibility sync can retry a queue cleanup safely.
  }
}

export async function clearCachedState(): Promise<void> {
  try {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction([STATE_STORE, OPERATIONS_STORE], "readwrite");
      transaction.objectStore(STATE_STORE).delete(CURRENT_KEY);
      transaction.objectStore(OPERATIONS_STORE).delete(PENDING_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Lokaler Cache konnte nicht gelöscht werden."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Lokaler Cache konnte nicht gelöscht werden."));
    });
    database.close();
  } catch {
    // Explicit reset remains safe even if a browser blocks IndexedDB.
  }
}

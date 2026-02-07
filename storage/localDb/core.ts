const DB_NAME = 'novel-offline-db';
const DB_VERSION = 5;

export const STORES = {
  users: 'users',
  novels: 'novels',
  annotations: 'annotations',
  tagDefinitions: 'tagDefinitions',
  tagPlacements: 'tagPlacements',
  referenceEntries: 'referenceEntries',
  tagNotes: 'tagNotes',
  referenceLinks: 'referenceLinks',
  noteFolders: 'noteFolders',
  notes: 'notes',
} as const;

let dbInstance: IDBDatabase | null = null;
let dbOpenPromise: Promise<IDBDatabase> | null = null;
let schemaEnsured = false;

type IndexSchema = {
  name: string;
  keyPath: string | string[];
  options?: IDBIndexParameters;
};

type StoreSchema = {
  createOptions: IDBObjectStoreParameters;
  indexes: IndexSchema[];
};

const STORE_SCHEMAS: Record<(typeof STORES)[keyof typeof STORES], StoreSchema> = {
  [STORES.users]: {
    createOptions: { keyPath: 'id' },
    indexes: [{ name: 'username', keyPath: 'username', options: { unique: true } }],
  },
  [STORES.novels]: {
    createOptions: { keyPath: 'id' },
    indexes: [
      { name: 'userId', keyPath: 'userId' },
      { name: 'updatedAt', keyPath: 'updatedAt' },
    ],
  },
  [STORES.annotations]: {
    createOptions: { keyPath: 'id' },
    indexes: [
      { name: 'userId', keyPath: 'userId' },
      { name: 'novelId', keyPath: 'novelId' },
    ],
  },
  [STORES.tagDefinitions]: {
    createOptions: { keyPath: 'id' },
    indexes: [{ name: 'userId', keyPath: 'userId' }],
  },
  [STORES.tagPlacements]: {
    createOptions: { keyPath: 'id' },
    indexes: [
      { name: 'userId', keyPath: 'userId' },
      { name: 'novelId', keyPath: 'novelId' },
      { name: 'tagId', keyPath: 'tagId' },
      { name: 'parentPlacementId', keyPath: 'parentPlacementId' },
    ],
  },
  [STORES.referenceEntries]: {
    createOptions: { keyPath: 'id' },
    indexes: [
      { name: 'userId', keyPath: 'userId' },
      { name: 'novelId', keyPath: 'novelId' },
      { name: 'scope', keyPath: 'scope' },
      { name: 'updatedAt', keyPath: 'updatedAt' },
    ],
  },
  [STORES.tagNotes]: {
    createOptions: { keyPath: 'id' },
    indexes: [
      { name: 'userId', keyPath: 'userId' },
      { name: 'tagKey', keyPath: 'tagKey' },
      { name: 'tagId', keyPath: 'tagId' },
      { name: 'updatedAt', keyPath: 'updatedAt' },
    ],
  },
  [STORES.referenceLinks]: {
    createOptions: { keyPath: 'id' },
    indexes: [
      { name: 'userId', keyPath: 'userId' },
      { name: 'bySource', keyPath: ['userId', 'sourceType', 'sourceKey'] },
      { name: 'byEntry', keyPath: ['userId', 'referenceEntryId'] },
      { name: 'createdAt', keyPath: 'createdAt' },
    ],
  },
  [STORES.noteFolders]: {
    createOptions: { keyPath: 'id' },
    indexes: [
      { name: 'userId', keyPath: 'userId' },
      { name: 'parentId', keyPath: 'parentId' },
      { name: 'updatedAt', keyPath: 'updatedAt' },
    ],
  },
  [STORES.notes]: {
    createOptions: { keyPath: 'id' },
    indexes: [
      { name: 'userId', keyPath: 'userId' },
      { name: 'titleKey', keyPath: 'titleKey' },
      { name: 'folderId', keyPath: 'folderId' },
      { name: 'updatedAt', keyPath: 'updatedAt' },
    ],
  },
};

export const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error);
  });

const applySchemaToDb = (db: IDBDatabase, tx: IDBTransaction | null): void => {
  const ensureIndexes = (store: IDBObjectStore, indexes: IndexSchema[]) => {
    indexes.forEach((index) => {
      if (!store.indexNames.contains(index.name)) {
        store.createIndex(index.name, index.keyPath, index.options);
      }
    });
  };

  (Object.values(STORES) as Array<(typeof STORES)[keyof typeof STORES]>).forEach((storeName) => {
    const schema = STORE_SCHEMAS[storeName];
    if (!schema) return;

    let store: IDBObjectStore;
    if (!db.objectStoreNames.contains(storeName)) {
      store = db.createObjectStore(storeName, schema.createOptions);
    } else if (tx) {
      store = tx.objectStore(storeName);
    } else {
      return;
    }

    ensureIndexes(store, schema.indexes);
  });
};

const openDbOnce = (version?: number): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = version === undefined ? indexedDB.open(DB_NAME) : indexedDB.open(DB_NAME, version);
    let blockedTimeout: ReturnType<typeof setTimeout> | null = null;
    let settled = false;

    const cleanup = () => {
      if (blockedTimeout) {
        clearTimeout(blockedTimeout);
        blockedTimeout = null;
      }
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      applySchemaToDb(db, request.transaction);
    };

    request.onblocked = () => {
      const message = `[IndexedDB] 打开/升级数据库被阻塞：${DB_NAME}。请关闭其他打开该站点的标签页/窗口后重试。`;
      console.warn(message);
      if (blockedTimeout) return;
      blockedTimeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error(message));
      }, 8000);
    };

    request.onsuccess = () => {
      if (settled) {
        cleanup();
        try {
          request.result.close();
        } catch {
          // ignore
        }
        return;
      }
      settled = true;
      cleanup();
      resolve(request.result);
    };
    request.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(request.error);
    };
  });

const getSchemaIssues = (db: IDBDatabase): { missingStores: string[]; missingIndexes: Array<{ storeName: string; indexName: string }> } => {
  const storeNames = Object.values(STORES) as Array<(typeof STORES)[keyof typeof STORES]>;
  const missingStores = storeNames.filter((name) => !db.objectStoreNames.contains(name));

  const missingIndexes: Array<{ storeName: string; indexName: string }> = [];
  const existingStores = storeNames.filter((name) => db.objectStoreNames.contains(name));
  if (existingStores.length === 0) return { missingStores, missingIndexes };

  const tx = db.transaction(existingStores, 'readonly');
  existingStores.forEach((storeName) => {
    const schema = STORE_SCHEMAS[storeName];
    if (!schema) return;
    const store = tx.objectStore(storeName);
    schema.indexes.forEach((index) => {
      if (!store.indexNames.contains(index.name)) {
        missingIndexes.push({ storeName, indexName: index.name });
      }
    });
  });

  return { missingStores, missingIndexes };
};

const ensureDbSchema = async (db: IDBDatabase): Promise<IDBDatabase> => {
  let current = db;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const issues = getSchemaIssues(current);
    const needsUpgrade = issues.missingStores.length > 0 || issues.missingIndexes.length > 0;
    if (!needsUpgrade) return current;

    const targetVersion = Math.max(current.version + 1, DB_VERSION);
    console.warn(
      `[IndexedDB] 检测到本地库结构落后，准备升级到 v${targetVersion}。缺少 stores: ${issues.missingStores.join(', ') || '无'}；缺少 indexes: ${
        issues.missingIndexes.map((i) => `${i.storeName}.${i.indexName}`).join(', ') || '无'
      }`
    );

    current.close();
    if (dbInstance === current) dbInstance = null;
    schemaEnsured = false;

    current = await openDbOnce(targetVersion);
  }

  const finalIssues = getSchemaIssues(current);
  throw new Error(
    `[IndexedDB] 数据库升级后仍缺少结构：stores=${finalIssues.missingStores.join(', ') || '无'} indexes=${
      finalIssues.missingIndexes.map((i) => `${i.storeName}.${i.indexName}`).join(', ') || '无'
    }`
  );
};

const attachDbLifecycleHandlers = (db: IDBDatabase) => {
  db.onversionchange = () => {
    db.close();
    if (dbInstance === db) dbInstance = null;
    schemaEnsured = false;
  };
};

const openDb = (): Promise<IDBDatabase> => {
  if (dbOpenPromise) return dbOpenPromise;
  if (dbInstance && schemaEnsured) return Promise.resolve(dbInstance);

  dbOpenPromise = (async () => {
    let db = dbInstance ?? (await openDbOnce());

    if (db.version < DB_VERSION) {
      db.close();
      if (dbInstance === db) dbInstance = null;
      db = await openDbOnce(DB_VERSION);
    }

    db = await ensureDbSchema(db);

    dbInstance = db;
    schemaEnsured = true;
    attachDbLifecycleHandlers(db);
    return db;
  })().finally(() => {
    dbOpenPromise = null;
  });

  return dbOpenPromise;
};

export const withStore = async <T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore, tx: IDBTransaction) => Promise<T>
): Promise<T> => {
  const isNotFoundError = (err: unknown): boolean =>
    !!err && typeof err === 'object' && 'name' in err && (err as { name?: unknown }).name === 'NotFoundError';

  const runOnce = async (db: IDBDatabase): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);

      run(store, tx)
        .then(resolve)
        .catch((err) => {
          tx.abort();
          reject(err);
        });

      tx.onerror = () => reject(tx.error);
    });

  const attempt = async (didRetry: boolean): Promise<T> => {
    const db = await openDb();

    try {
      return await runOnce(db);
    } catch (err) {
      if (!didRetry && isNotFoundError(err)) {
        console.warn(`[IndexedDB] 发现 store/index 缺失，尝试自动升级修复后重试：${storeName}`);
        db.close();
        if (dbInstance === db) dbInstance = null;
        schemaEnsured = false;
        return attempt(true);
      }
      throw err;
    }
  };

  return attempt(false);
};


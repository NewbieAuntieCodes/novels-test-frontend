import { generateId, normalizeTagKey } from '../../utils';
import type { ReferenceLink, TagNote } from '../../types';
import type { TagPlacement } from '../../api/tagPlacements';
import { STORES, requestToPromise, withStore } from './core';
import type { BackupPayload } from './types';
import { getUserById, saveUser } from './users';
import { getNovel, listNovels } from './novels';
import { listAnnotations, listAnnotationsByNovel } from './annotations';
import { listTagDefinitions, listTagPlacements } from './tags';
import { listReferenceEntries } from './referenceEntries';
import { listTagNotes } from './tagNotes';
import { listReferenceLinks } from './referenceLinks';
import { listNoteFolders } from './noteFolders';
import { listNotes } from './notes';

// --- Backup helpers ---
export const exportUserData = async (userId: string): Promise<BackupPayload> => {
  const [user, novels, annotations, tagDefinitions, tagPlacements, referenceEntries, tagNotes, referenceLinks, noteFolders, notes] =
    await Promise.all([
      getUserById(userId),
      listNovels(userId),
      listAnnotations(userId),
      listTagDefinitions(userId),
      listTagPlacements(userId),
      listReferenceEntries(userId),
      listTagNotes(userId),
      listReferenceLinks(userId),
      listNoteFolders(userId),
      listNotes(userId),
    ]);

  if (!user) {
    throw new Error('未找到用户，无法导出数据');
  }

  return {
    version: 5,
    exportedAt: new Date().toISOString(),
    exportScope: 'user',
    user: { id: user.id, username: user.username },
    novels,
    annotations,
    tagDefinitions,
    tagPlacements,
    referenceEntries,
    tagNotes,
    referenceLinks,
    noteFolders,
    notes,
  };
};

export const exportNovelData = async (userId: string, novelId: string): Promise<BackupPayload> => {
  const [user, novel, annotations, tagDefinitionsAll, tagPlacementsAll, referenceEntriesAll, tagNotesAll, referenceLinksAll] =
    await Promise.all([
      getUserById(userId),
      getNovel(novelId),
      listAnnotationsByNovel(userId, novelId),
      listTagDefinitions(userId),
      listTagPlacements(userId),
      listReferenceEntries(userId),
      listTagNotes(userId),
      listReferenceLinks(userId),
    ]);

  if (!user) {
    throw new Error('未找到用户，无法导出数据');
  }

  if (!novel || novel.userId !== userId) {
    throw new Error('未找到小说，无法导出数据');
  }

  const referencedPlacementIds = new Set<string>();
  for (const ann of annotations) {
    (ann.tagIds || []).forEach((id) => referencedPlacementIds.add(id));
  }

  const placementById = new Map(tagPlacementsAll.map((p) => [p.id, p] as const));
  const includedPlacementIds = new Set<string>();

  const includePlacementWithAncestors = (placementId: string) => {
    let currentId: string | null | undefined = placementId;
    const visited = new Set<string>();
    while (currentId) {
      if (visited.has(currentId)) break;
      visited.add(currentId);
      if (includedPlacementIds.has(currentId)) break;
      includedPlacementIds.add(currentId);
      currentId = placementById.get(currentId)?.parentPlacementId ?? null;
    }
  };

  // Include all placements from this novel (full tree) and any placements referenced by annotations (e.g. global tags).
  for (const placement of tagPlacementsAll) {
    if (placement.novelId === novelId) includePlacementWithAncestors(placement.id);
  }
  referencedPlacementIds.forEach(includePlacementWithAncestors);

  const tagPlacements = Array.from(includedPlacementIds)
    .map((id) => placementById.get(id))
    .filter((p): p is TagPlacement => Boolean(p));

  const definitionIdSet = new Set(tagPlacements.map((p) => p.tagId));
  const tagDefinitions = tagDefinitionsAll.filter((def) => definitionIdSet.has(def.id));
  const defById = new Map(tagDefinitions.map((def) => [def.id, def] as const));

  const tagKeysForNovel = new Set<string>();
  for (const placement of tagPlacements) {
    const tagName = defById.get(placement.tagId)?.name || placement.tag?.name || '';
    const tagKey = normalizeTagKey(tagName);
    if (tagKey) tagKeysForNovel.add(tagKey);
  }

  const tagNotes = tagNotesAll.filter((note) => {
    if (note.tagId && includedPlacementIds.has(note.tagId)) return true;
    // Legacy notes (tagKey-based) are shared by name; include if they match this novel's tag keys.
    const key = note.tagKey || normalizeTagKey(note.tagName || '');
    return Boolean(key && tagKeysForNovel.has(key));
  });

  const referenceLinks = referenceLinksAll.filter((link) => {
    if (link.sourceType === 'novel') return link.sourceKey === novelId;
    if (link.sourceType === 'tag') return tagKeysForNovel.has(link.sourceKey);
    return false;
  });

  const includedReferenceEntryIds = new Set<string>(referenceLinks.map((link) => link.referenceEntryId));
  for (const entry of referenceEntriesAll) {
    if (entry.novelId === novelId) includedReferenceEntryIds.add(entry.id);
    if (entry.tagIds?.some((tagId) => includedPlacementIds.has(tagId))) includedReferenceEntryIds.add(entry.id);
  }

  const referenceEntries = referenceEntriesAll.filter((entry) => includedReferenceEntryIds.has(entry.id));

  return {
    version: 5,
    exportedAt: new Date().toISOString(),
    exportScope: 'novel',
    exportedNovelId: novelId,
    user: { id: user.id, username: user.username },
    novels: [novel],
    annotations,
    tagDefinitions,
    tagPlacements,
    referenceEntries,
    tagNotes,
    referenceLinks,
    noteFolders: [],
    notes: [],
  };
};

export const importNovelData = async (userId: string, payload: BackupPayload): Promise<{ importedNovelId: string }> => {
  if (payload.exportScope && payload.exportScope !== 'novel') {
    throw new Error('该文件不是“单本小说导出”，无法用单本导入。');
  }

  const originalNovelId = payload.exportedNovelId || payload.novels?.[0]?.id;
  if (!originalNovelId) {
    throw new Error('备份文件缺少小说ID（exportedNovelId）。');
  }

  const novelFromPayload = payload.novels?.find((n) => n.id === originalNovelId) || payload.novels?.[0];
  if (!novelFromPayload) {
    throw new Error('备份文件中未找到小说数据。');
  }

  const normalizedUserId = userId;

  // If the same novelId already exists but belongs to another user, avoid overwriting by generating a new id.
  let importedNovelId = originalNovelId;
  const existingNovel = await withStore<any | undefined>(STORES.novels, 'readonly', async (store) =>
    requestToPromise<any | undefined>(store.get(originalNovelId))
  );
  if (existingNovel && existingNovel.userId && existingNovel.userId !== normalizedUserId) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = `import-${generateId()}`;
      const collision = await withStore<any | undefined>(STORES.novels, 'readonly', async (store) =>
        requestToPromise<any | undefined>(store.get(candidate))
      );
      if (!collision) {
        importedNovelId = candidate;
        break;
      }
    }
    if (importedNovelId === originalNovelId) {
      throw new Error('检测到小说ID冲突，且无法生成新的小说ID，请重试。');
    }
  }

  const rewriteUserId = (items: any[]) =>
    items.map((item) => ({
      ...item,
      userId: normalizedUserId,
    }));

  const rewriteNovelId = <T extends { novelId?: string | null }>(items: T[]): T[] =>
    items.map((item) => {
      if (item && item.novelId === originalNovelId) {
        return { ...item, novelId: importedNovelId };
      }
      return item;
    });

  const novel = {
    ...novelFromPayload,
    id: importedNovelId,
    userId: normalizedUserId,
  };

  const annotations = rewriteNovelId(rewriteUserId(payload.annotations || [])).filter((ann: any) => ann.novelId === importedNovelId);
  const tagDefinitions = rewriteUserId(payload.tagDefinitions || []);
  const tagPlacements = rewriteNovelId(rewriteUserId(payload.tagPlacements || []));
  const referenceEntries = rewriteNovelId(rewriteUserId(payload.referenceEntries || []));

  const tagNotes: TagNote[] = (payload.tagNotes || []).map((note) => {
    const rawKey = note.tagKey || normalizeTagKey(note.tagName || '');
    const id = note.tagId ? `${normalizedUserId}:tag:${note.tagId}` : `${normalizedUserId}:${rawKey}`;
    return {
      ...note,
      id,
      tagKey: rawKey,
      userId: normalizedUserId,
    };
  });

  const referenceLinks: ReferenceLink[] = (payload.referenceLinks || []).map((link) => {
    const sourceKey =
      link.sourceType === 'novel' && link.sourceKey === originalNovelId ? importedNovelId : link.sourceKey;
    return {
      ...link,
      sourceKey,
      id: `${normalizedUserId}:${link.sourceType}:${sourceKey}:${link.referenceEntryId}`,
      userId: normalizedUserId,
    };
  });

  // Update username if needed
  const existingUser = await getUserById(userId);
  if (existingUser) {
    await saveUser({
      ...existingUser,
      username: payload.user?.username || existingUser.username,
      updatedAt: new Date().toISOString(),
    });
  }

  // Remove existing data for this novel only (do NOT wipe everything).
  await Promise.all([
    withStore<void>(STORES.novels, 'readwrite', async (store, tx) => {
      const existing = await requestToPromise<any | undefined>(store.get(importedNovelId));
      if (existing && existing.userId === normalizedUserId) {
        store.delete(importedNovelId);
      }
      return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }),
    withStore<void>(STORES.annotations, 'readwrite', async (store, tx) => {
      const index = store.index('novelId');
      const req = index.getAll(importedNovelId);
      const items = await requestToPromise<any[]>(req);
      items.filter((item) => item?.userId === normalizedUserId).forEach((item) => store.delete(item.id));
      return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }),
    withStore<void>(STORES.tagPlacements, 'readwrite', async (store, tx) => {
      const index = store.index('novelId');
      const req = index.getAll(importedNovelId);
      const items = await requestToPromise<any[]>(req);
      items.filter((item) => item?.userId === normalizedUserId).forEach((item) => store.delete(item.id));
      return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }),
    withStore<void>(STORES.referenceEntries, 'readwrite', async (store, tx) => {
      const index = store.index('novelId');
      const req = index.getAll(importedNovelId);
      const items = await requestToPromise<any[]>(req);
      items.filter((item) => item?.userId === normalizedUserId).forEach((item) => store.delete(item.id));
      return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }),
    withStore<void>(STORES.referenceLinks, 'readwrite', async (store, tx) => {
      const index = store.index('bySource');
      const req = index.getAllKeys([normalizedUserId, 'novel', importedNovelId]);
      const keys = await requestToPromise<IDBValidKey[]>(req);
      keys.forEach((key) => store.delete(key));
      return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }),
  ]);

  // Upsert imported data.
  await Promise.all([
    withStore<void>(STORES.novels, 'readwrite', async (store) => {
      store.put(novel);
      return requestToPromise(store.get(novel.id));
    }),
    withStore<void>(STORES.annotations, 'readwrite', async (store) => {
      annotations.forEach((annotation) => store.put(annotation));
      return requestToPromise(store.get(annotations[0]?.id || ''));
    }),
    withStore<void>(STORES.tagDefinitions, 'readwrite', async (store) => {
      tagDefinitions.forEach((def) => store.put(def));
      return requestToPromise(store.get(tagDefinitions[0]?.id || ''));
    }),
    withStore<void>(STORES.tagPlacements, 'readwrite', async (store) => {
      tagPlacements.forEach((tp) => store.put(tp));
      return requestToPromise(store.get(tagPlacements[0]?.id || ''));
    }),
    withStore<void>(STORES.referenceEntries, 'readwrite', async (store) => {
      referenceEntries.forEach((entry) => store.put(entry));
      return requestToPromise(store.get(referenceEntries[0]?.id || ''));
    }),
    withStore<void>(STORES.tagNotes, 'readwrite', async (store) => {
      tagNotes.forEach((note) => store.put(note));
      return requestToPromise(store.get(tagNotes[0]?.id || ''));
    }),
    withStore<void>(STORES.referenceLinks, 'readwrite', async (store) => {
      referenceLinks.forEach((link) => store.put(link));
      return requestToPromise(store.get(referenceLinks[0]?.id || ''));
    }),
  ]);

  return { importedNovelId };
};

export const importUserData = async (userId: string, payload: BackupPayload): Promise<void> => {
  if (payload.exportScope && payload.exportScope !== 'user') {
    throw new Error('该文件是“单本小说导出”，暂不支持直接导入。请使用“导出数据”生成的全量备份进行导入。');
  }

  const normalizedUserId = userId;
  const rewriteIds = (items: any[]) =>
    items.map((item) => ({
      ...item,
      userId: normalizedUserId,
    }));

  const novels = rewriteIds(payload.novels);
  const annotations = rewriteIds(payload.annotations);
  const tagDefinitions = rewriteIds(payload.tagDefinitions);
  const tagPlacements = rewriteIds(payload.tagPlacements);
  const referenceEntries = rewriteIds(payload.referenceEntries || []);
  const noteFolders = rewriteIds(payload.noteFolders || []);
  const notes = rewriteIds(payload.notes || []);

  const tagNotes: TagNote[] = (payload.tagNotes || []).map((note) => {
    const rawKey = note.tagKey || normalizeTagKey(note.tagName || '');
    const id = note.tagId ? `${normalizedUserId}:tag:${note.tagId}` : `${normalizedUserId}:${rawKey}`;
    return {
      ...note,
      id,
      tagKey: rawKey,
      userId: normalizedUserId,
    };
  });

  const referenceLinks: ReferenceLink[] = (payload.referenceLinks || []).map((link) => ({
    ...link,
    id: `${normalizedUserId}:${link.sourceType}:${link.sourceKey}:${link.referenceEntryId}`,
    userId: normalizedUserId,
  }));

  // Update username if needed
  const existingUser = await getUserById(userId);
  if (existingUser) {
    await saveUser({
      ...existingUser,
      username: payload.user?.username || existingUser.username,
      updatedAt: new Date().toISOString(),
    });
  }

  // Clear existing data for the user
  await Promise.all([
    withStore<void>(STORES.novels, 'readwrite', async (store, tx) => {
      const index = store.index('userId');
      const req = index.getAllKeys(userId);
      const keys = await requestToPromise<IDBValidKey[]>(req);
      keys.forEach((key) => store.delete(key));
      return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }),
    withStore<void>(STORES.annotations, 'readwrite', async (store, tx) => {
      const index = store.index('userId');
      const req = index.getAllKeys(userId);
      const keys = await requestToPromise<IDBValidKey[]>(req);
      keys.forEach((key) => store.delete(key));
      return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }),
    withStore<void>(STORES.tagDefinitions, 'readwrite', async (store, tx) => {
      const index = store.index('userId');
      const req = index.getAllKeys(userId);
      const keys = await requestToPromise<IDBValidKey[]>(req);
      keys.forEach((key) => store.delete(key));
      return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }),
    withStore<void>(STORES.tagPlacements, 'readwrite', async (store, tx) => {
      const index = store.index('userId');
      const req = index.getAllKeys(userId);
      const keys = await requestToPromise<IDBValidKey[]>(req);
      keys.forEach((key) => store.delete(key));
      return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }),
    withStore<void>(STORES.referenceEntries, 'readwrite', async (store, tx) => {
      const index = store.index('userId');
      const req = index.getAllKeys(userId);
      const keys = await requestToPromise<IDBValidKey[]>(req);
      keys.forEach((key) => store.delete(key));
      return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }),
    withStore<void>(STORES.tagNotes, 'readwrite', async (store, tx) => {
      const index = store.index('userId');
      const req = index.getAllKeys(userId);
      const keys = await requestToPromise<IDBValidKey[]>(req);
      keys.forEach((key) => store.delete(key));
      return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }),
    withStore<void>(STORES.referenceLinks, 'readwrite', async (store, tx) => {
      const index = store.index('userId');
      const req = index.getAllKeys(userId);
      const keys = await requestToPromise<IDBValidKey[]>(req);
      keys.forEach((key) => store.delete(key));
      return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }),
    withStore<void>(STORES.noteFolders, 'readwrite', async (store, tx) => {
      const index = store.index('userId');
      const req = index.getAllKeys(userId);
      const keys = await requestToPromise<IDBValidKey[]>(req);
      keys.forEach((key) => store.delete(key));
      return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }),
    withStore<void>(STORES.notes, 'readwrite', async (store, tx) => {
      const index = store.index('userId');
      const req = index.getAllKeys(userId);
      const keys = await requestToPromise<IDBValidKey[]>(req);
      keys.forEach((key) => store.delete(key));
      return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }),
  ]);

  // Insert new data
  await Promise.all([
    withStore<void>(STORES.novels, 'readwrite', async (store) => {
      novels.forEach((novel) => store.put(novel));
      return requestToPromise(store.get(novels[0]?.id || '')); // dummy to ensure completion
    }),
    withStore<void>(STORES.annotations, 'readwrite', async (store) => {
      annotations.forEach((annotation) => store.put(annotation));
      return requestToPromise(store.get(annotations[0]?.id || ''));
    }),
    withStore<void>(STORES.tagDefinitions, 'readwrite', async (store) => {
      tagDefinitions.forEach((def) => store.put(def));
      return requestToPromise(store.get(tagDefinitions[0]?.id || ''));
    }),
    withStore<void>(STORES.tagPlacements, 'readwrite', async (store) => {
      tagPlacements.forEach((tp) => store.put(tp));
      return requestToPromise(store.get(tagPlacements[0]?.id || ''));
    }),
    withStore<void>(STORES.referenceEntries, 'readwrite', async (store) => {
      referenceEntries.forEach((entry) => store.put(entry));
      return requestToPromise(store.get(referenceEntries[0]?.id || ''));
    }),
    withStore<void>(STORES.tagNotes, 'readwrite', async (store) => {
      tagNotes.forEach((note) => store.put(note));
      return requestToPromise(store.get(tagNotes[0]?.id || ''));
    }),
    withStore<void>(STORES.referenceLinks, 'readwrite', async (store) => {
      referenceLinks.forEach((link) => store.put(link));
      return requestToPromise(store.get(referenceLinks[0]?.id || ''));
    }),
    withStore<void>(STORES.noteFolders, 'readwrite', async (store) => {
      noteFolders.forEach((folder) => store.put(folder));
      return requestToPromise(store.get(noteFolders[0]?.id || ''));
    }),
    withStore<void>(STORES.notes, 'readwrite', async (store) => {
      notes.forEach((note) => store.put(note));
      return requestToPromise(store.get(notes[0]?.id || ''));
    }),
  ]);
};

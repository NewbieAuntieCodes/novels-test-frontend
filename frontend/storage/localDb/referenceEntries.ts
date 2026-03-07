import { STORES, requestToPromise, withStore } from './core';
import type { ReferenceEntry } from '../../types';

// --- Reference entries helpers ---
export const listReferenceEntries = async (userId: string, novelId?: string | null): Promise<ReferenceEntry[]> =>
  withStore<ReferenceEntry[]>(STORES.referenceEntries, 'readonly', async (store) => {
    if (novelId !== undefined) {
      if (store.indexNames.contains('novelId')) {
        const index = store.index('novelId');
        const req = index.getAll(novelId);
        const result = await requestToPromise<ReferenceEntry[]>(req);
        return (result || [])
          .filter((e) => e.userId === userId)
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      }

      const candidateReq = store.indexNames.contains('userId') ? store.index('userId').getAll(userId) : store.getAll();
      const candidates = await requestToPromise<ReferenceEntry[]>(candidateReq as IDBRequest<ReferenceEntry[]>);
      return (candidates || [])
        .filter((e) => e.userId === userId && e.novelId === novelId)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    if (store.indexNames.contains('userId')) {
      const index = store.index('userId');
      const req = index.getAll(userId);
      const result = await requestToPromise<ReferenceEntry[]>(req);
      return (result || []).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    const result = await requestToPromise<ReferenceEntry[]>(store.getAll());
    return (result || [])
      .filter((e) => e.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  });

export const saveReferenceEntry = async (entry: ReferenceEntry): Promise<ReferenceEntry> =>
  withStore<ReferenceEntry>(STORES.referenceEntries, 'readwrite', async (store) => {
    await requestToPromise(store.put(entry));
    return entry;
  });

export const deleteReferenceEntry = async (id: string): Promise<void> =>
  withStore<void>(STORES.referenceEntries, 'readwrite', async (store) => {
    await requestToPromise(store.delete(id));
  });


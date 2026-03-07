import { STORES, requestToPromise, withStore } from './core';
import type { Novel } from '../../types';

// --- Novel helpers ---
export const listNovels = async (userId: string): Promise<Novel[]> =>
  withStore<Novel[]>(STORES.novels, 'readonly', async (store) => {
    const index = store.index('userId');
    const req = index.getAll(userId);
    const result = await requestToPromise<Novel[]>(req);
    return (result || []).sort(
      (a, b) => (b.updatedAt ? new Date(b.updatedAt).getTime() : 0) - (a.updatedAt ? new Date(a.updatedAt).getTime() : 0)
    );
  });

export const getNovel = async (id: string): Promise<Novel | undefined> =>
  withStore<Novel | undefined>(STORES.novels, 'readonly', async (store) => {
    const req = store.get(id);
    const result = await requestToPromise<Novel | undefined>(req);
    return result ?? undefined;
  });

export const saveNovel = async (novel: Novel): Promise<Novel> =>
  withStore<Novel>(STORES.novels, 'readwrite', async (store) => {
    const withTimestamps = {
      ...novel,
      updatedAt: novel.updatedAt || new Date().toISOString(),
      createdAt: (novel as any).createdAt || new Date().toISOString(),
    };
    await requestToPromise(store.put(withTimestamps));
    return withTimestamps;
  });

export const deleteNovel = async (id: string): Promise<void> =>
  withStore<void>(STORES.novels, 'readwrite', async (store) => {
    await requestToPromise(store.delete(id));
  });


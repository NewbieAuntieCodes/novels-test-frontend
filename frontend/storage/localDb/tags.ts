import { STORES, requestToPromise, withStore } from './core';
import type { TagDefinition } from './types';
import type { TagPlacement } from '../../api/tagPlacements';

// --- Tag definition & placement helpers ---
export const listTagDefinitions = async (userId: string): Promise<TagDefinition[]> =>
  withStore<TagDefinition[]>(STORES.tagDefinitions, 'readonly', async (store) => {
    const index = store.index('userId');
    const req = index.getAll(userId);
    return requestToPromise<TagDefinition[]>(req);
  });

export const saveTagDefinition = async (definition: TagDefinition): Promise<TagDefinition> =>
  withStore<TagDefinition>(STORES.tagDefinitions, 'readwrite', async (store) => {
    await requestToPromise(store.put(definition));
    return definition;
  });

export const deleteTagDefinition = async (tagId: string): Promise<void> =>
  withStore<void>(STORES.tagDefinitions, 'readwrite', async (store) => {
    await requestToPromise(store.delete(tagId));
  });

export const listTagPlacements = async (userId: string, novelId?: string | null): Promise<TagPlacement[]> =>
  withStore<TagPlacement[]>(STORES.tagPlacements, 'readonly', async (store) => {
    if (novelId !== undefined) {
      if (store.indexNames.contains('novelId')) {
        const index = store.index('novelId');
        const req = index.getAll(novelId);
        const result = await requestToPromise<TagPlacement[]>(req);
        return (result || []).filter((p) => p.userId === userId);
      }

      const candidateReq = store.indexNames.contains('userId') ? store.index('userId').getAll(userId) : store.getAll();
      const candidates = await requestToPromise<TagPlacement[]>(candidateReq as IDBRequest<TagPlacement[]>);
      return (candidates || []).filter((p) => p.userId === userId && p.novelId === novelId);
    }
    if (store.indexNames.contains('userId')) {
      const index = store.index('userId');
      const req = index.getAll(userId);
      return requestToPromise<TagPlacement[]>(req);
    }
    const result = await requestToPromise<TagPlacement[]>(store.getAll());
    return (result || []).filter((p) => p.userId === userId);
  });

export const saveTagPlacement = async (placement: TagPlacement): Promise<TagPlacement> =>
  withStore<TagPlacement>(STORES.tagPlacements, 'readwrite', async (store) => {
    await requestToPromise(store.put(placement));
    return placement;
  });

export const deleteTagPlacement = async (placementId: string): Promise<void> =>
  withStore<void>(STORES.tagPlacements, 'readwrite', async (store) => {
    await requestToPromise(store.delete(placementId));
  });

export const deletePlacementsByNovel = async (novelId: string): Promise<void> =>
  withStore<void>(STORES.tagPlacements, 'readwrite', async (store, tx) => {
    let keys: IDBValidKey[] = [];
    if (store.indexNames.contains('novelId')) {
      const index = store.index('novelId');
      const req = index.getAllKeys(novelId);
      keys = await requestToPromise<IDBValidKey[]>(req);
    } else {
      const all = await requestToPromise<TagPlacement[]>(store.getAll());
      keys = (all || []).filter((p) => p.novelId === novelId).map((p) => p.id);
    }
    keys.forEach((key) => store.delete(key));
    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });


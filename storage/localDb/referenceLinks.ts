import { STORES, requestToPromise, withStore } from './core';
import type { ReferenceLink } from '../../types';

// --- Reference links helpers ---
export const listReferenceLinks = async (userId: string): Promise<ReferenceLink[]> =>
  withStore<ReferenceLink[]>(STORES.referenceLinks, 'readonly', async (store) => {
    const index = store.index('userId');
    const req = index.getAll(userId);
    const result = await requestToPromise<ReferenceLink[]>(req);
    return (result || []).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  });

export const listReferenceLinksBySource = async (
  userId: string,
  sourceType: ReferenceLink['sourceType'],
  sourceKey: string
): Promise<ReferenceLink[]> =>
  withStore<ReferenceLink[]>(STORES.referenceLinks, 'readonly', async (store) => {
    const index = store.index('bySource');
    const req = index.getAll([userId, sourceType, sourceKey]);
    const result = await requestToPromise<ReferenceLink[]>(req);
    return (result || []).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  });

export const listReferenceLinksByEntry = async (userId: string, referenceEntryId: string): Promise<ReferenceLink[]> =>
  withStore<ReferenceLink[]>(STORES.referenceLinks, 'readonly', async (store) => {
    const index = store.index('byEntry');
    const req = index.getAll([userId, referenceEntryId]);
    const result = await requestToPromise<ReferenceLink[]>(req);
    return result || [];
  });

export const saveReferenceLink = async (link: ReferenceLink): Promise<ReferenceLink> =>
  withStore<ReferenceLink>(STORES.referenceLinks, 'readwrite', async (store) => {
    await requestToPromise(store.put(link));
    return link;
  });

export const deleteReferenceLink = async (id: string): Promise<void> =>
  withStore<void>(STORES.referenceLinks, 'readwrite', async (store) => {
    await requestToPromise(store.delete(id));
  });


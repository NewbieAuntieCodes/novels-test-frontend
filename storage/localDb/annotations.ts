import { STORES, requestToPromise, withStore } from './core';
import type { Annotation } from '../../types';

// --- Annotation helpers ---
export const listAnnotations = async (userId: string): Promise<Annotation[]> =>
  withStore<Annotation[]>(STORES.annotations, 'readonly', async (store) => {
    const index = store.index('userId');
    const req = index.getAll(userId);
    return requestToPromise<Annotation[]>(req);
  });

export const listAnnotationsByNovel = async (userId: string, novelId: string): Promise<Annotation[]> =>
  withStore<Annotation[]>(STORES.annotations, 'readonly', async (store) => {
    if (store.indexNames.contains('novelId')) {
      const index = store.index('novelId');
      const req = index.getAll(novelId);
      const annotations = await requestToPromise<Annotation[]>(req);
      return (annotations || []).filter((a) => a.userId === userId);
    }

    // Fallback for older schemas: query by userId (if present) then filter by novelId.
    const candidateReq = store.indexNames.contains('userId') ? store.index('userId').getAll(userId) : store.getAll();
    const candidates = await requestToPromise<Annotation[]>(candidateReq as IDBRequest<Annotation[]>);
    return (candidates || []).filter((a) => a.userId === userId && a.novelId === novelId);
  });

export const saveAnnotation = async (annotation: Annotation): Promise<Annotation> =>
  withStore<Annotation>(STORES.annotations, 'readwrite', async (store) => {
    await requestToPromise(store.put(annotation));
    return annotation;
  });

export const deleteAnnotation = async (id: string): Promise<void> =>
  withStore<void>(STORES.annotations, 'readwrite', async (store) => {
    await requestToPromise(store.delete(id));
  });

export const deleteAnnotationsByNovel = async (novelId: string): Promise<void> =>
  withStore<void>(STORES.annotations, 'readwrite', async (store, tx) => {
    let keys: IDBValidKey[] = [];
    if (store.indexNames.contains('novelId')) {
      const index = store.index('novelId');
      const req = index.getAllKeys(novelId);
      keys = await requestToPromise<IDBValidKey[]>(req);
    } else {
      const all = await requestToPromise<Annotation[]>(store.getAll());
      keys = (all || []).filter((a) => a.novelId === novelId).map((a) => a.id);
    }
    keys.forEach((key) => store.delete(key));
    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });


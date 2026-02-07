import { STORES, requestToPromise, withStore } from './core';
import type { NoteFolder } from '../../types';

// --- Note folder helpers ---
export const listNoteFolders = async (userId: string): Promise<NoteFolder[]> =>
  withStore<NoteFolder[]>(STORES.noteFolders, 'readonly', async (store) => {
    const req = store.indexNames.contains('userId') ? store.index('userId').getAll(userId) : store.getAll();
    const result = await requestToPromise<NoteFolder[]>(req as IDBRequest<NoteFolder[]>);
    return (result || [])
      .filter((folder) => folder.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  });

export const getNoteFolderById = async (id: string): Promise<NoteFolder | undefined> =>
  withStore<NoteFolder | undefined>(STORES.noteFolders, 'readonly', async (store) => {
    const req = store.get(id);
    const result = await requestToPromise<NoteFolder | undefined>(req);
    return result ?? undefined;
  });

export const saveNoteFolder = async (folder: NoteFolder): Promise<NoteFolder> =>
  withStore<NoteFolder>(STORES.noteFolders, 'readwrite', async (store) => {
    const now = new Date().toISOString();
    const withTimestamps: NoteFolder = {
      ...folder,
      createdAt: folder.createdAt || now,
      updatedAt: folder.updatedAt || now,
    };
    await requestToPromise(store.put(withTimestamps));
    return withTimestamps;
  });

export const deleteNoteFolder = async (id: string): Promise<void> =>
  withStore<void>(STORES.noteFolders, 'readwrite', async (store) => {
    await requestToPromise(store.delete(id));
  });


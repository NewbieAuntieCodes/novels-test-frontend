import { STORES, requestToPromise, withStore } from './core';
import type { Note } from '../../types';

// --- Note helpers ---
export const listNotes = async (userId: string): Promise<Note[]> =>
  withStore<Note[]>(STORES.notes, 'readonly', async (store) => {
    const req = store.indexNames.contains('userId') ? store.index('userId').getAll(userId) : store.getAll();
    const result = await requestToPromise<Note[]>(req as IDBRequest<Note[]>);
    return (result || [])
      .filter((note) => note.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  });

export const getNoteById = async (id: string): Promise<Note | undefined> =>
  withStore<Note | undefined>(STORES.notes, 'readonly', async (store) => {
    const req = store.get(id);
    const result = await requestToPromise<Note | undefined>(req);
    return result ?? undefined;
  });

export const saveNote = async (note: Note): Promise<Note> =>
  withStore<Note>(STORES.notes, 'readwrite', async (store) => {
    const now = new Date().toISOString();
    const withTimestamps: Note = {
      ...note,
      createdAt: note.createdAt || now,
      updatedAt: note.updatedAt || now,
    };
    await requestToPromise(store.put(withTimestamps));
    return withTimestamps;
  });

export const deleteNote = async (id: string): Promise<void> =>
  withStore<void>(STORES.notes, 'readwrite', async (store) => {
    await requestToPromise(store.delete(id));
  });


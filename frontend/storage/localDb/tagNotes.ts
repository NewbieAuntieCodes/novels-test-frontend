import { STORES, requestToPromise, withStore } from './core';
import type { TagNote } from '../../types';

// --- Tag notes helpers ---
export const listTagNotes = async (userId: string): Promise<TagNote[]> =>
  withStore<TagNote[]>(STORES.tagNotes, 'readonly', async (store) => {
    const index = store.index('userId');
    const req = index.getAll(userId);
    const result = await requestToPromise<TagNote[]>(req);
    return (result || []).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  });

export const getTagNoteById = async (id: string): Promise<TagNote | undefined> =>
  withStore<TagNote | undefined>(STORES.tagNotes, 'readonly', async (store) => {
    const req = store.get(id);
    const result = await requestToPromise<TagNote | undefined>(req);
    return result ?? undefined;
  });

export const saveTagNote = async (note: TagNote): Promise<TagNote> =>
  withStore<TagNote>(STORES.tagNotes, 'readwrite', async (store) => {
    await requestToPromise(store.put(note));
    return note;
  });

export const deleteTagNote = async (id: string): Promise<void> =>
  withStore<void>(STORES.tagNotes, 'readwrite', async (store) => {
    await requestToPromise(store.delete(id));
  });


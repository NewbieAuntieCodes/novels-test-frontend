import { STORES, requestToPromise, withStore } from './core';
import type { UserRecord } from './types';

// --- User helpers ---
export const getUserByUsername = async (username: string): Promise<UserRecord | undefined> =>
  withStore<UserRecord | undefined>(STORES.users, 'readonly', async (store) => {
    const index = store.index('username');
    const req = index.get(username);
    const result = await requestToPromise<UserRecord | undefined>(req);
    return result ?? undefined;
  });

export const getUserById = async (id: string): Promise<UserRecord | undefined> =>
  withStore<UserRecord | undefined>(STORES.users, 'readonly', async (store) => {
    const req = store.get(id);
    const result = await requestToPromise<UserRecord | undefined>(req);
    return result ?? undefined;
  });

export const saveUser = async (user: UserRecord): Promise<UserRecord> =>
  withStore<UserRecord>(STORES.users, 'readwrite', async (store) => {
    await requestToPromise(store.put(user));
    return user;
  });


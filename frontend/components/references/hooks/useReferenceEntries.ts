import { useCallback, useEffect, useState } from 'react';
import type { ReferenceEntry } from '../../../types';
import { referenceEntriesApi } from '../../../api';

export const useReferenceEntries = (novelId?: string | null) => {
  const [entries, setEntries] = useState<ReferenceEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await referenceEntriesApi.getAll({ novelId });
      setEntries(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载资料失败';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [novelId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const createEntry = useCallback(async (draft: Omit<ReferenceEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    const created = await referenceEntriesApi.create(draft);
    setEntries(prev => [created, ...prev]);
    return created;
  }, []);

  const updateEntry = useCallback(async (id: string, patch: Partial<Omit<ReferenceEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>) => {
    const updated = await referenceEntriesApi.update(id, patch);
    setEntries(prev => prev.map(e => (e.id === id ? updated : e)));
    return updated;
  }, []);

  const deleteEntry = useCallback(async (id: string) => {
    await referenceEntriesApi.delete(id);
    setEntries(prev => prev.filter(e => e.id !== id));
  }, []);

  return {
    entries,
    isLoading,
    error,
    reload,
    createEntry,
    updateEntry,
    deleteEntry,
  };
};

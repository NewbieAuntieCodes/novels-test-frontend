// 资料/参考条目相关（本地 IndexedDB）
import type { ReferenceEntry, ReferenceScope, ReferenceSourceType } from '../types';
import { TokenManager } from './config';
import { generateId } from '../utils';
import {
  listReferenceEntries,
  saveReferenceEntry,
  deleteReferenceEntry as deleteReferenceEntryRecord,
} from '../storage/localDb';
import { referenceLinksApi } from './referenceLinks';
import { listReferenceLinksByEntry, listTagPlacements } from '../storage/localDb';
import { normalizeTagKey } from '../utils';
import { markNovelModified } from '../utils/novelBackupMeta';

interface ReferenceEntryCreateRequest {
  title: string;
  content: string;
  scope: ReferenceScope;
  tagIds: string[];
  novelId: string | null;
  sourceType?: ReferenceSourceType;
  sourceUrl?: string;
}

const requireUserId = (): string => {
  const userId = TokenManager.getUserId();
  if (!userId) throw new Error('请先登录');
  return userId;
};

export const referenceEntriesApi = {
  async getAll(params?: { novelId?: string | null }): Promise<ReferenceEntry[]> {
    const userId = requireUserId();
    return listReferenceEntries(userId, params?.novelId);
  },

  async create(data: ReferenceEntryCreateRequest): Promise<ReferenceEntry> {
    const userId = requireUserId();
    const now = new Date().toISOString();
    const entry: ReferenceEntry = {
      ...data,
      id: generateId(),
      userId,
      createdAt: now,
      updatedAt: now,
    };
    await saveReferenceEntry(entry);
    if (entry.novelId) markNovelModified(userId, entry.novelId);
    return entry;
  },

  async update(id: string, data: Partial<ReferenceEntryCreateRequest>): Promise<ReferenceEntry> {
    const userId = requireUserId();
    const existingEntries = await listReferenceEntries(userId);
    const existing = existingEntries.find(e => e.id === id);
    if (!existing) throw new Error('资料不存在');

    const updated: ReferenceEntry = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    await saveReferenceEntry(updated);

    const affectedNovelIds = new Set<string>();
    if (updated.novelId) affectedNovelIds.add(updated.novelId);

    const links = await listReferenceLinksByEntry(userId, id);
    if (links.length > 0) {
      const placements = await listTagPlacements(userId);
      for (const link of links) {
        if (link.sourceType === 'novel') {
          affectedNovelIds.add(link.sourceKey);
          continue;
        }
        if (link.sourceType !== 'tag') continue;
        const key = link.sourceKey;
        for (const placement of placements) {
          if (!placement.novelId) continue;
          if (normalizeTagKey(placement.tag?.name || '') === key) {
            affectedNovelIds.add(placement.novelId);
          }
        }
      }
    }

    affectedNovelIds.forEach((novelId) => markNovelModified(userId, novelId));
    return updated;
  },

  async delete(id: string): Promise<{ message: string }> {
    const userId = requireUserId();
    const existingEntries = await listReferenceEntries(userId);
    const existing = existingEntries.find(e => e.id === id);
    await deleteReferenceEntryRecord(id);
    await referenceLinksApi.unlinkAllForReferenceEntry(id);
    if (existing?.novelId) markNovelModified(userId, existing.novelId);
    return { message: 'deleted' };
  },
};

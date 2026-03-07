import type { ReferenceLink, ReferenceLinkSourceType } from '../types';
import { TokenManager } from './config';
import { normalizeTagKey } from '../utils';
import {
  deleteReferenceLink,
  listReferenceLinksByEntry,
  listReferenceLinksBySource,
  saveReferenceLink,
} from '../storage/localDb';
import { listTagPlacements } from '../storage/localDb';
import { markNovelModified } from '../utils/novelBackupMeta';

const requireUserId = (): string => {
  const userId = TokenManager.getUserId();
  if (!userId) throw new Error('请先登录');
  return userId;
};

const makeReferenceLinkId = (
  userId: string,
  sourceType: ReferenceLinkSourceType,
  sourceKey: string,
  referenceEntryId: string
): string => `${userId}:${sourceType}:${sourceKey}:${referenceEntryId}`;

const resolveAffectedNovelIdsForLinkSource = async (
  userId: string,
  sourceType: ReferenceLinkSourceType,
  sourceKey: string
): Promise<string[]> => {
  if (sourceType === 'novel') return [sourceKey];
  if (sourceType !== 'tag') return [];

  const placements = await listTagPlacements(userId);
  const result = new Set<string>();
  for (const placement of placements) {
    if (!placement.novelId) continue;
    const key = normalizeTagKey(placement.tag?.name || '');
    if (key === sourceKey) result.add(placement.novelId);
  }
  return Array.from(result);
};

export const referenceLinksApi = {
  async getBySource(params: { sourceType: ReferenceLinkSourceType; sourceKey: string }): Promise<ReferenceLink[]> {
    const userId = requireUserId();
    return listReferenceLinksBySource(userId, params.sourceType, params.sourceKey);
  },

  async link(params: { sourceType: ReferenceLinkSourceType; sourceKey: string; referenceEntryId: string }): Promise<ReferenceLink> {
    const userId = requireUserId();
    const link: ReferenceLink = {
      id: makeReferenceLinkId(userId, params.sourceType, params.sourceKey, params.referenceEntryId),
      userId,
      sourceType: params.sourceType,
      sourceKey: params.sourceKey,
      referenceEntryId: params.referenceEntryId,
      createdAt: new Date().toISOString(),
    };
    await saveReferenceLink(link);

    const affectedNovelIds = await resolveAffectedNovelIdsForLinkSource(userId, params.sourceType, params.sourceKey);
    affectedNovelIds.forEach(novelId => markNovelModified(userId, novelId));
    return link;
  },

  async unlink(params: { sourceType: ReferenceLinkSourceType; sourceKey: string; referenceEntryId: string }): Promise<void> {
    const userId = requireUserId();
    await deleteReferenceLink(makeReferenceLinkId(userId, params.sourceType, params.sourceKey, params.referenceEntryId));

    const affectedNovelIds = await resolveAffectedNovelIdsForLinkSource(userId, params.sourceType, params.sourceKey);
    affectedNovelIds.forEach(novelId => markNovelModified(userId, novelId));
  },

  async unlinkAllForReferenceEntry(referenceEntryId: string): Promise<void> {
    const userId = requireUserId();
    const links = await listReferenceLinksByEntry(userId, referenceEntryId);
    await Promise.all(links.map((link) => deleteReferenceLink(link.id)));

    const novelIds = await Promise.all(
      links.map(link => resolveAffectedNovelIdsForLinkSource(userId, link.sourceType, link.sourceKey))
    );
    Array.from(new Set(novelIds.flat())).forEach(novelId => markNovelModified(userId, novelId));
  },
};

// 标签挂载相关（本地 IndexedDB）
import { TokenManager } from './config';
import { generateId } from '../utils';
import {
  listTagPlacements,
  saveTagPlacement,
  deleteTagPlacement as deletePlacementRecord,
  listTagDefinitions,
  saveTagDefinition,
} from '../storage/localDb';
import { markNovelModified } from '../utils/novelBackupMeta';

export interface TagPlacement {
  id: string;
  tagId: string;
  parentPlacementId: string | null;
  novelId: string | null;
  userId: string;
  placementType?: 'tag' | 'term';
  displayOrder: number;
  createdAt: string;
  tag: {
    id: string;
    name: string;
    color: string;
    userId: string;
    createdAt: string;
  };
}

interface TagPlacementCreateRequest {
  tagId: string;
  parentPlacementId?: string | null;
  novelId?: string | null;
  displayOrder?: number;
  placementType?: 'tag' | 'term';
}

interface TagWithPlacementCreateRequest {
  name: string;
  color: string;
  parentPlacementId?: string | null;
  novelId?: string | null;
  displayOrder?: number;
  placementType?: 'tag' | 'term';
}

const requireUserId = (): string => {
  const userId = TokenManager.getUserId();
  if (!userId) throw new Error('请先登录');
  return userId;
};

const assemblePlacement = (placement: TagPlacement, tagName: string, tagColor: string): TagPlacement => ({
  ...placement,
  tag: {
    id: placement.tagId,
    name: tagName,
    color: tagColor,
    userId: placement.userId,
    createdAt: placement.createdAt,
  },
});

export const tagPlacementsApi = {
  // 获取所有标签挂载（可按小说ID筛选，支持 novelId='global' 只获取全局标签）
  async getAll(params?: { novelId?: string | 'global'; placementType?: 'tag' | 'term' }): Promise<TagPlacement[]> {
    const userId = requireUserId();
    const definitions = await listTagDefinitions(userId);
    const novelIdFilter = params?.novelId === 'global' ? null : params?.novelId;
    const typeFilter = params?.placementType ?? 'tag';
    const placements = (await listTagPlacements(userId, novelIdFilter)).filter(p => (p.placementType ?? 'tag') === typeFilter);
    return placements.map(p => {
      const def = definitions.find(d => d.id === p.tagId);
      return assemblePlacement(p, def?.name || '未命名标签', def?.color || '#666');
    });
  },

  // 创建标签挂载（引用现有标签）
  async create(data: TagPlacementCreateRequest): Promise<TagPlacement> {
    const userId = requireUserId();
    const definitions = await listTagDefinitions(userId);
    const tag = definitions.find(d => d.id === data.tagId);
    if (!tag) throw new Error('标签定义不存在');

    const placement: TagPlacement = {
      id: generateId(),
      tagId: data.tagId,
      parentPlacementId: data.parentPlacementId ?? null,
      novelId: data.novelId ?? null,
      userId,
      placementType: data.placementType ?? 'tag',
      displayOrder: data.displayOrder ?? 0,
      createdAt: new Date().toISOString(),
      tag: {
        id: tag.id,
        name: tag.name,
        color: tag.color,
        userId,
        createdAt: tag.createdAt,
      },
    };
    await saveTagPlacement(placement);
    if (placement.novelId) markNovelModified(userId, placement.novelId);
    return placement;
  },

  // 创建新标签并立即挂载
  async createWithTag(data: TagWithPlacementCreateRequest): Promise<TagPlacement> {
    const userId = requireUserId();
    const tagId = generateId();
    const tagDefinition = await saveTagDefinition({
      id: tagId,
      name: data.name,
      color: data.color,
      userId,
      createdAt: new Date().toISOString(),
    });

    const placement: TagPlacement = {
      id: generateId(),
      tagId: tagDefinition.id,
      parentPlacementId: data.parentPlacementId ?? null,
      novelId: data.novelId ?? null,
      userId,
      placementType: data.placementType ?? 'tag',
      displayOrder: data.displayOrder ?? 0,
      createdAt: new Date().toISOString(),
      tag: {
        id: tagDefinition.id,
        name: tagDefinition.name,
        color: tagDefinition.color,
        userId,
        createdAt: tagDefinition.createdAt,
      },
    };

    await saveTagPlacement(placement);
    if (placement.novelId) markNovelModified(userId, placement.novelId);
    return placement;
  },

  // 更新标签挂载
  async update(
    id: string,
    data: { parentPlacementId?: string | null; displayOrder?: number; placementType?: 'tag' | 'term' }
  ): Promise<TagPlacement> {
    const userId = requireUserId();
    const placements = await listTagPlacements(userId);
    const target = placements.find(p => p.id === id);
    if (!target) throw new Error('标签挂载不存在');

    const definitions = await listTagDefinitions(userId);
    const def = definitions.find(d => d.id === target.tagId);

    const updatedPlacement: TagPlacement = {
      ...target,
      parentPlacementId: data.parentPlacementId !== undefined ? data.parentPlacementId : target.parentPlacementId,
      displayOrder: data.displayOrder !== undefined ? data.displayOrder : target.displayOrder,
      placementType: data.placementType !== undefined ? data.placementType : (target.placementType ?? 'tag'),
      tag: {
        ...(target.tag || {
          id: def?.id || target.tagId,
          name: def?.name || '未命名标签',
          color: def?.color || '#666',
          userId,
          createdAt: def?.createdAt || target.createdAt,
        }),
      },
    };

    await saveTagPlacement(updatedPlacement);
    if (updatedPlacement.novelId) markNovelModified(userId, updatedPlacement.novelId);
    return updatedPlacement;
  },

  // 删除标签挂载
  async delete(id: string): Promise<{ message: string }> {
    const userId = requireUserId();
    const placements = await listTagPlacements(userId);
    const target = placements.find(p => p.id === id);
    await deletePlacementRecord(id);
    if (target?.novelId) markNovelModified(userId, target.novelId);
    return { message: 'deleted' };
  },

  // 获取标签的所有子孙挂载ID
  async getDescendants(placementId: string, params?: { placementType?: 'tag' | 'term' }): Promise<{ placementId: string; descendantIds: string[] }> {
    const userId = requireUserId();
    const typeFilter = params?.placementType ?? 'tag';
    const placements = (await listTagPlacements(userId)).filter(p => (p.placementType ?? 'tag') === typeFilter);
    const descendants: string[] = [];

    const walk = (parentId: string) => {
      placements
        .filter(p => p.parentPlacementId === parentId)
        .forEach(child => {
          descendants.push(child.id);
          walk(child.id);
        });
    };

    walk(placementId);
    return { placementId, descendantIds: descendants };
  },
};

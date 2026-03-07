// 标签定义（本地 IndexedDB）
import type { Tag } from '../types';
import { TokenManager } from './config';
import {
  listTagDefinitions,
  saveTagDefinition,
  deleteTagDefinition,
  listTagPlacements,
  saveTagPlacement,
} from '../storage/localDb';
import { generateId } from '../utils';
import { markNovelModified } from '../utils/novelBackupMeta';

interface TagCreateRequest {
  name: string;
  color: string;
  parentId?: string | null;
  novelId?: string | null; // 🆕 标签所属小说ID
}

const requireUserId = (): string => {
  const userId = TokenManager.getUserId();
  if (!userId) throw new Error('请先登录');
  return userId;
};

export const tagsApi = {
  // 获取所有标签（可按小说ID筛选）
  async getAll(params?: { novelId?: string }): Promise<Tag[]> {
    const userId = requireUserId();
    const effectiveNovelId = params?.novelId === 'global' ? null : params?.novelId;
    const [definitions, placements] = await Promise.all([
      listTagDefinitions(userId),
      listTagPlacements(userId, effectiveNovelId),
    ]);

    const definitionById = new Map(definitions.map(def => [def.id, def]));
    return placements.map(p => {
      const def = definitionById.get(p.tagId);
      return {
        id: p.id,
        name: def?.name || '未命名标签',
        color: def?.color || '#666',
        parentId: p.parentPlacementId || null,
        novelId: p.novelId || null,
        userId: p.userId,
      };
    });
  },

  // 创建标签
  async create(data: TagCreateRequest): Promise<Tag> {
    const userId = requireUserId();
    const tagId = generateId();
    const definition = await saveTagDefinition({
      id: tagId,
      name: data.name,
      color: data.color,
      userId,
      createdAt: new Date().toISOString(),
    });

    // 每个标签定义至少有一个挂载
    const placement = await saveTagPlacement({
      id: generateId(),
      tagId: definition.id,
      parentPlacementId: data.parentId ?? null,
      novelId: data.novelId ?? null,
      userId,
      displayOrder: 0,
      createdAt: new Date().toISOString(),
      tag: {
        id: definition.id,
        name: definition.name,
        color: definition.color,
        userId,
        createdAt: definition.createdAt,
      },
    });

    if (placement.novelId) {
      markNovelModified(userId, placement.novelId);
    }

    return {
      id: placement.id,
      name: definition.name,
      color: definition.color,
      parentId: placement.parentPlacementId,
      novelId: placement.novelId,
      userId,
    };
  },

  // 更新标签
  async update(id: string, data: Partial<TagCreateRequest>): Promise<Tag> {
    const userId = requireUserId();
    const definitions = await listTagDefinitions(userId);
    const placements = await listTagPlacements(userId);
    const definition = definitions.find(d => d.id === id);
    if (!definition) throw new Error('标签定义不存在');

    const updatedDefinition = await saveTagDefinition({
      ...definition,
      name: data.name ?? definition.name,
      color: data.color ?? definition.color,
    });

    // 更新所有引用该 tagId 的挂载（颜色/名称在挂载的 tag 信息里也要同步）
    const affectedPlacements = placements.filter(p => p.tagId === id);
    const affectedNovelIds = Array.from(
      new Set(affectedPlacements.map(p => p.novelId).filter((nid): nid is string => Boolean(nid)))
    );

    await Promise.all(
      affectedPlacements.map(p =>
        saveTagPlacement({
          ...p,
          parentPlacementId: data.parentId !== undefined ? data.parentId : p.parentPlacementId,
          tag: {
            ...p.tag,
            name: updatedDefinition.name,
            color: updatedDefinition.color,
          },
        })
      )
    );

    affectedNovelIds.forEach(novelId => markNovelModified(userId, novelId));

    const firstPlacement = placements.find(p => p.tagId === id);
    return {
      id: firstPlacement?.id || id,
      name: updatedDefinition.name,
      color: updatedDefinition.color,
      parentId: data.parentId ?? firstPlacement?.parentPlacementId ?? null,
      novelId: firstPlacement?.novelId ?? null,
      userId,
    };
  },

  // 删除标签
  async delete(id: string): Promise<{ message: string }> {
    const userId = requireUserId();
    const placements = await listTagPlacements(userId);
    const affectedNovelIds = Array.from(
      new Set(
        placements
          .filter(p => p.tagId === id)
          .map(p => p.novelId)
          .filter((nid): nid is string => Boolean(nid))
      )
    );

    await deleteTagDefinition(id);
    affectedNovelIds.forEach(novelId => markNovelModified(userId, novelId));
    return { message: 'deleted' };
  },
};

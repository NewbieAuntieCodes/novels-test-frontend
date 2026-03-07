/**
 * 词条（项目内笔记树）兼容层
 * 复用 tagPlacements/tagDefinitions 的存储，但用 placementType='term' 区分于标签树。
 */

import { tagPlacementsApi, TagPlacement } from './tagPlacements';
import { tagsApi } from './tags';
import type { Tag } from '../types';

function placementToTerm(placement: TagPlacement): Tag {
  return {
    id: placement.id,
    name: placement.tag.name,
    color: placement.tag.color,
    parentId: placement.parentPlacementId,
    userId: placement.userId,
    novelId: placement.novelId,
    placementType: 'term',
    createdAt: placement.createdAt,
  };
}

export const termCompatApi = {
  async getAll(params?: { novelId?: string }): Promise<Tag[]> {
    const placements = await tagPlacementsApi.getAll({ novelId: params?.novelId, placementType: 'term' });
    return placements.map(placementToTerm);
  },

  async create(data: { name: string; color: string; parentId?: string | null; novelId?: string | null }): Promise<Tag> {
    const placement = await tagPlacementsApi.createWithTag({
      name: data.name,
      color: data.color,
      parentPlacementId: data.parentId,
      novelId: data.novelId,
      placementType: 'term',
    });
    return placementToTerm(placement);
  },

  async update(id: string, data: { name?: string; color?: string; parentId?: string | null }): Promise<Tag> {
    const placements = await tagPlacementsApi.getAll({ placementType: 'term' });
    const currentPlacement = placements.find(p => p.id === id);

    if (!currentPlacement) {
      throw new Error('词条挂载不存在');
    }

    if (data.name !== undefined || data.color !== undefined) {
      await tagsApi.update(currentPlacement.tagId, {
        name: data.name,
        color: data.color,
      });
    }

    if (data.parentId !== undefined) {
      const updatedPlacement = await tagPlacementsApi.update(id, {
        parentPlacementId: data.parentId,
      });
      return placementToTerm(updatedPlacement);
    }

    const updatedPlacements = await tagPlacementsApi.getAll({ placementType: 'term' });
    const updated = updatedPlacements.find(p => p.id === id);
    if (!updated) {
      throw new Error('更新后未找到词条');
    }
    return placementToTerm(updated);
  },

  async delete(id: string): Promise<{ message: string }> {
    return tagPlacementsApi.delete(id);
  },
};


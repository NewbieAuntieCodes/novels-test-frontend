/**
 * 标签兼容层
 * 将 TagPlacement 数据结构转换为前端原有的 Tag 结构
 * 用于过渡期间保持前端代码兼容性
 */

import { tagPlacementsApi, TagPlacement } from './tagPlacements';
import { tagsApi } from './tags';
import type { Tag } from '../types';

// 将 TagPlacement 转换为 Tag 格式
function placementToTag(placement: TagPlacement): Tag {
  return {
    id: placement.id, // 使用 placementId 作为前端的 tagId
    name: placement.tag.name,
    color: placement.tag.color,
    parentId: placement.parentPlacementId,
    userId: placement.userId,
    novelId: placement.novelId,
    placementType: placement.placementType ?? 'tag',
    createdAt: placement.createdAt,
  };
}

/**
 * 兼容层 API - 提供与原 tagsApi 相同的接口
 */
export const tagCompatApi = {
  // 获取所有标签（按小说ID筛选，返回该小说的所有挂载）
  async getAll(params?: { novelId?: string }): Promise<Tag[]> {
    const placements = await tagPlacementsApi.getAll(params);
    return placements.map(placementToTag);
  },

  // 创建标签（同时创建定义和挂载）
  async create(data: { name: string; color: string; parentId?: string | null; novelId?: string | null }): Promise<Tag> {
    const placement = await tagPlacementsApi.createWithTag({
      name: data.name,
      color: data.color,
      parentPlacementId: data.parentId,
      novelId: data.novelId,
    });
    return placementToTag(placement);
  },

  // 更新标签
  async update(id: string, data: { name?: string; color?: string; parentId?: string | null }): Promise<Tag> {
    // id 是 placementId
    const placement = await tagPlacementsApi.getAll({});
    const currentPlacement = placement.find(p => p.id === id);

    if (!currentPlacement) {
      throw new Error('标签挂载不存在');
    }

    // 如果需要更新名称或颜色，更新标签定义
    if (data.name !== undefined || data.color !== undefined) {
      await tagsApi.update(currentPlacement.tagId, {
        name: data.name,
        color: data.color,
      });
    }

    // 如果需要更新父级，更新挂载
    if (data.parentId !== undefined) {
      const updatedPlacement = await tagPlacementsApi.update(id, {
        parentPlacementId: data.parentId,
      });
      return placementToTag(updatedPlacement);
    }

    // 重新获取更新后的数据
    const updatedPlacements = await tagPlacementsApi.getAll({});
    const updated = updatedPlacements.find(p => p.id === id);
    if (!updated) {
      throw new Error('更新后未找到标签');
    }
    return placementToTag(updated);
  },

  // 删除标签（删除挂载）
  async delete(id: string): Promise<{ message: string }> {
    return tagPlacementsApi.delete(id);
  },
};

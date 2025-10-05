// 标签挂载相关 API
import { apiRequest } from './config';

export interface TagPlacement {
  id: string;
  tagId: string;
  parentPlacementId: string | null;
  novelId: string | null;
  userId: string;
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
}

interface TagWithPlacementCreateRequest {
  name: string;
  color: string;
  parentPlacementId?: string | null;
  novelId?: string | null;
  displayOrder?: number;
}

export const tagPlacementsApi = {
  // 获取所有标签挂载（可按小说ID筛选）
  async getAll(params?: { novelId?: string }): Promise<TagPlacement[]> {
    const queryString = params?.novelId ? `?novelId=${params.novelId}` : '';
    return apiRequest<TagPlacement[]>(`/tag-placements${queryString}`);
  },

  // 创建标签挂载（引用现有标签）
  async create(data: TagPlacementCreateRequest): Promise<TagPlacement> {
    return apiRequest<TagPlacement>('/tag-placements', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 创建新标签并立即挂载
  async createWithTag(data: TagWithPlacementCreateRequest): Promise<TagPlacement> {
    return apiRequest<TagPlacement>('/tag-placements/with-tag', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 更新标签挂载
  async update(id: string, data: { parentPlacementId?: string | null; displayOrder?: number }): Promise<TagPlacement> {
    return apiRequest<TagPlacement>(`/tag-placements/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // 删除标签挂载
  async delete(id: string): Promise<{ message: string }> {
    return apiRequest<{ message: string }>(`/tag-placements/${id}`, {
      method: 'DELETE',
    });
  },

  // 获取标签的所有子孙挂载ID
  async getDescendants(placementId: string): Promise<{ placementId: string; descendantIds: string[] }> {
    return apiRequest<{ placementId: string; descendantIds: string[] }>(`/tag-placements/${placementId}/descendants`);
  },
};

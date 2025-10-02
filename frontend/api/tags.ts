// 标签相关 API
import { apiRequest } from './config';
import type { Tag } from '../types';

interface TagCreateRequest {
  name: string;
  color: string;
  parentId?: string | null;
  novelId?: string | null; // 🆕 标签所属小说ID
}

export const tagsApi = {
  // 获取所有标签（可按小说ID筛选）
  async getAll(params?: { novelId?: string }): Promise<Tag[]> {
    const queryString = params?.novelId ? `?novelId=${params.novelId}` : '';
    return apiRequest<Tag[]>(`/tags${queryString}`);
  },

  // 创建标签
  async create(data: TagCreateRequest): Promise<Tag> {
    return apiRequest<Tag>('/tags', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 更新标签
  async update(id: string, data: Partial<TagCreateRequest>): Promise<Tag> {
    return apiRequest<Tag>(`/tags/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // 删除标签
  async delete(id: string): Promise<{ message: string }> {
    return apiRequest<{ message: string }>(`/tags/${id}`, {
      method: 'DELETE',
    });
  },
};

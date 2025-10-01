// 标注相关 API
import { apiRequest } from './config';
import type { Annotation } from '../types';

interface AnnotationCreateRequest {
  text: string;
  startIndex: number;
  endIndex: number;
  novelId: string;
  tagIds: string[];
  isPotentiallyMisaligned?: boolean;
}

export const annotationsApi = {
  // 获取标注列表（可按 novelId 和 tagId 过滤）
  async getAll(params?: { novelId?: string; tagId?: string }): Promise<Annotation[]> {
    const query = new URLSearchParams();
    if (params?.novelId) query.append('novelId', params.novelId);
    if (params?.tagId) query.append('tagId', params.tagId);

    const queryString = query.toString();
    return apiRequest<Annotation[]>(`/annotations${queryString ? `?${queryString}` : ''}`);
  },

  // 全局搜索标注
  async search(keyword: string): Promise<Annotation[]> {
    return apiRequest<Annotation[]>(`/annotations/search?keyword=${encodeURIComponent(keyword)}`);
  },

  // 创建标注
  async create(data: AnnotationCreateRequest): Promise<Annotation> {
    return apiRequest<Annotation>('/annotations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 更新标注
  async update(id: string, data: Partial<AnnotationCreateRequest>): Promise<Annotation> {
    return apiRequest<Annotation>(`/annotations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // 删除标注
  async delete(id: string): Promise<{ message: string }> {
    return apiRequest<{ message: string }>(`/annotations/${id}`, {
      method: 'DELETE',
    });
  },
};

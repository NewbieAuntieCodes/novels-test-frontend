// 小说相关 API
import { apiRequest } from './config';
import type { Novel } from '../types';

interface NovelCreateRequest {
  title: string;
  text: string;
  chapters?: any[];
  storylines?: any[];
  plotAnchors?: any[];
}

export const novelsApi = {
  // 获取所有小说
  async getAll(): Promise<Novel[]> {
    return apiRequest<Novel[]>('/novels');
  },

  // 获取单个小说
  async getById(id: string): Promise<Novel> {
    return apiRequest<Novel>(`/novels/${id}`);
  },

  // 创建小说
  async create(data: NovelCreateRequest): Promise<Novel> {
    return apiRequest<Novel>('/novels', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 更新小说
  async update(id: string, data: Partial<NovelCreateRequest>): Promise<Novel> {
    return apiRequest<Novel>(`/novels/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // 删除小说
  async delete(id: string): Promise<{ message: string }> {
    return apiRequest<{ message: string }>(`/novels/${id}`, {
      method: 'DELETE',
    });
  },
};

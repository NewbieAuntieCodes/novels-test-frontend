// 小说相关 API
import { apiRequest } from './config';
import type { Novel, Chapter, Annotation } from '../types';

interface NovelCreateRequest {
  title: string;
  text: string;
  chapters?: any[];
  storylines?: any[];
  plotAnchors?: any[];
  category?: string;
  subcategory?: string;
}

interface ChapterContentResponse {
  chapter: Chapter & { content: string };
  annotations: Annotation[];
}

export const novelsApi = {
  // 获取所有小说（不含全文）
  async getAll(): Promise<Novel[]> {
    return apiRequest<Novel[]>('/novels');
  },

  // 获取单个小说
  async getById(id: string): Promise<Novel> {
    return apiRequest<Novel>(`/novels/${id}`);
  },

  // 🆕 获取章节内容和标注
  async getChapterContent(novelId: string, chapterId: string): Promise<ChapterContentResponse> {
    return apiRequest<ChapterContentResponse>(`/novels/${novelId}/chapters/${chapterId}`);
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

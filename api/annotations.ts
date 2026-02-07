// 标注相关（本地 IndexedDB）
import type { Annotation } from '../types';
import { TokenManager } from './config';
import { generateId } from '../utils';
import {
  listAnnotations,
  listAnnotationsByNovel,
  saveAnnotation,
  deleteAnnotation as deleteAnnotationRecord,
} from '../storage/localDb';
import { markNovelModified } from '../utils/novelBackupMeta';

interface AnnotationCreateRequest {
  text: string;
  startIndex: number;
  endIndex: number;
  novelId: string;
  tagIds: string[];
  isPotentiallyMisaligned?: boolean;
}

const requireUserId = (): string => {
  const userId = TokenManager.getUserId();
  if (!userId) throw new Error('请先登录');
  return userId;
};

export const annotationsApi = {
  // 获取标注列表（可按 novelId 和 tagId 过滤）
  async getAll(params?: { novelId?: string; tagId?: string }): Promise<Annotation[]> {
    const userId = requireUserId();
    let annotations: Annotation[] = [];
    if (params?.novelId) {
      annotations = await listAnnotationsByNovel(userId, params.novelId);
    } else {
      annotations = await listAnnotations(userId);
    }
    if (params?.tagId) {
      annotations = annotations.filter(a => a.tagIds?.includes(params.tagId!));
    }
    return annotations;
  },

  // 全局搜索标注
  async search(keyword: string): Promise<Annotation[]> {
    const userId = requireUserId();
    const annotations = await listAnnotations(userId);
    const normalizedKeyword = keyword.trim().toLowerCase();
    return annotations.filter(ann =>
      (ann.text || '').toLowerCase().includes(normalizedKeyword)
    );
  },

  // 创建标注
  async create(data: AnnotationCreateRequest): Promise<Annotation> {
    const userId = requireUserId();
    const annotation: Annotation = {
      ...data,
      id: generateId(),
      userId,
    };
    await saveAnnotation(annotation);
    markNovelModified(userId, annotation.novelId);
    return annotation;
  },

  // 更新标注
  async update(id: string, data: Partial<AnnotationCreateRequest>): Promise<Annotation> {
    const userId = requireUserId();
    const annotations = await listAnnotations(userId);
    const existing = annotations.find(a => a.id === id);
    if (!existing) throw new Error('标注不存在');
    const updated = { ...existing, ...data };
    await saveAnnotation(updated);
    markNovelModified(userId, updated.novelId);
    return updated;
  },

  // 删除标注
  async delete(id: string): Promise<{ message: string }> {
    const userId = requireUserId();
    const annotations = await listAnnotations(userId);
    const existing = annotations.find(a => a.id === id);
    await deleteAnnotationRecord(id);
    if (existing?.novelId) markNovelModified(userId, existing.novelId);
    return { message: 'deleted' };
  },
};

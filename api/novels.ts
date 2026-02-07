// 小说相关（本地 IndexedDB）
import type { Novel, Chapter, Annotation } from '../types';
import { generateId } from '../utils';
import { TokenManager } from './config';
import {
  listNovels,
  getNovel,
  saveNovel,
  deleteNovel as deleteNovelRecord,
  splitChaptersForAppend,
  truncateNovelAfterChapter,
  listAnnotationsByNovel,
  deleteAnnotationsByNovel,
  deletePlacementsByNovel,
} from '../storage/localDb';
import { splitTextIntoChapters } from '../utils';
import { listTagPlacements } from '../storage/localDb';
import { clearNovelBackupMeta, markNovelModified } from '../utils/novelBackupMeta';

interface NovelCreateRequest {
  id?: string;
  title: string;
  text: string;
  chapters?: any[];
  noteChapters?: any[];
  storylines?: any[];
  plotAnchors?: any[];
  category?: string;
  subcategory?: string;
  projectMode?: 'tag' | 'note';
}

interface ChapterContentResponse {
  chapter: Chapter & { content: string };
  annotations: Annotation[];
}

const requireUserId = (): string => {
  const userId = TokenManager.getUserId();
  if (!userId) throw new Error('请先登录');
  return userId;
};

export const novelsApi = {
  // 获取所有小说（不含全文）
  async getAll(): Promise<Novel[]> {
    const userId = requireUserId();
    const novels = await listNovels(userId);
    return novels.map(novel => ({
      ...novel,
      text: novel.text || '',
      chapters: (novel.chapters || []).map(ch => ({
        id: ch.id,
        title: ch.title,
        originalStartIndex: ch.originalStartIndex,
        originalEndIndex: ch.originalEndIndex,
        content: ch.content,
        htmlContent: ch.htmlContent,
        level: ch.level,
      })),
      noteChapters: (novel.noteChapters || []).map(ch => ({
        id: ch.id,
        title: ch.title,
        originalStartIndex: ch.originalStartIndex,
        originalEndIndex: ch.originalEndIndex,
        content: ch.content,
        htmlContent: ch.htmlContent,
        level: ch.level,
      })),
    }));
  },

  // 获取单个小说
  async getById(id: string): Promise<Novel> {
    const userId = requireUserId();
    const novel = await getNovel(id);
    if (!novel || novel.userId !== userId) {
      throw new Error('未找到小说');
    }
    return novel;
  },

  // 🆕 获取章节内容和标注
  async getChapterContent(novelId: string, chapterId: string): Promise<ChapterContentResponse> {
    const userId = requireUserId();
    const novel = await this.getById(novelId);
    const annotations = await listAnnotationsByNovel(userId, novelId);
    const chapter = (novel.chapters || []).find(ch => ch.id === chapterId);
    if (!chapter) {
      throw new Error('章节不存在');
    }
    return { chapter: { ...chapter, content: chapter.content }, annotations };
  },

  // 创建小说
  async create(data: NovelCreateRequest): Promise<Novel> {
    const userId = requireUserId();
    const normalizedText = (data.text || '').replace(/\r\n|\r/g, '\n');
    const chapters = splitTextIntoChapters(normalizedText);

    const novel: Novel = {
      id: (data as any).id || (crypto.randomUUID?.() ?? generateId()),
      title: data.title,
      text: normalizedText,
      userId,
      chapters,
      noteChapters: (data.noteChapters as any) || [],
      storylines: data.storylines || [],
      plotAnchors: data.plotAnchors || [],
      category: data.category,
      subcategory: data.subcategory,
      projectMode: data.projectMode ?? 'tag',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveNovel(novel);
    markNovelModified(userId, novel.id, novel.updatedAt || new Date().toISOString());
    return novel;
  },

  // 更新小说
  async update(id: string, data: Partial<NovelCreateRequest>): Promise<Novel> {
    const userId = requireUserId();
    const existing = await this.getById(id);
    if (existing.userId !== userId) throw new Error('无权更新此小说');

    const updated: Novel = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };

    await saveNovel(updated);
    markNovelModified(userId, id, updated.updatedAt || new Date().toISOString());
    return updated;
  },

  async updateFromCache(existing: Novel, data: Partial<NovelCreateRequest>): Promise<Novel> {
    const userId = requireUserId();
    if (existing.userId !== userId) throw new Error('无权更新此小说');

    const updated: Novel = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };

    await saveNovel(updated);
    markNovelModified(userId, existing.id, updated.updatedAt || new Date().toISOString());
    return updated;
  },

  // 删除小说
  async delete(id: string): Promise<{ message: string }> {
    const userId = requireUserId();
    const existing = await this.getById(id);
    if (existing.userId !== userId) throw new Error('无权删除此小说');

    await Promise.all([
      deleteNovelRecord(id),
      deleteAnnotationsByNovel(id),
      deletePlacementsByNovel(id),
    ]);
    clearNovelBackupMeta(userId, id);
    return { message: 'deleted' };
  },

  // 🆕 追加内容到小说
  async appendContent(id: string, text: string, chapters?: any[]): Promise<{ novel: Novel; appendedChaptersCount: number }> {
    const userId = requireUserId();
    const existing = await this.getById(id);
    if (existing.userId !== userId) throw new Error('无权修改此小说');

    const { text: mergedText, chapters: newChapters } = splitChaptersForAppend(existing, text);
    const updatedNovel = {
      ...existing,
      text: mergedText,
      chapters: newChapters,
      updatedAt: new Date().toISOString(),
    };

    await saveNovel(updatedNovel);
    markNovelModified(userId, id, updatedNovel.updatedAt || new Date().toISOString());
    return { novel: updatedNovel, appendedChaptersCount: newChapters.length - (existing.chapters?.length || 0) };
  },

  // 🆕 删除指定章节之后的所有内容（保留前N章）
  async deleteChaptersAfter(id: string, keepChapterCount: number): Promise<{
    novel: Novel;
    deletedChaptersCount: number;
    deletedAnnotationsCount: number;
    truncatedAnnotationsCount: number;
    deletedPlotAnchorsCount: number;
  }> {
    const userId = requireUserId();
    const novel = await this.getById(id);
    if (novel.userId !== userId) throw new Error('无权修改此小说');

    const annotations = await listAnnotationsByNovel(userId, id);
    const placements = await listTagPlacements(userId, id);

    if (!novel.chapters || keepChapterCount < 1 || keepChapterCount >= novel.chapters.length) {
      throw new Error('保留章节数量不合法');
    }

    const result = await truncateNovelAfterChapter(novel, keepChapterCount, annotations, placements);
    markNovelModified(userId, id, result.novel.updatedAt || new Date().toISOString());
    return {
      novel: result.novel,
      deletedChaptersCount: (novel.chapters?.length || 0) - keepChapterCount,
      deletedAnnotationsCount: result.deletedAnnotationsCount,
      truncatedAnnotationsCount: result.truncatedAnnotationsCount,
      deletedPlotAnchorsCount: result.deletedPlotAnchorsCount,
    };
  },
};

import { splitTextIntoChapters } from '../../utils';
import type { Annotation, Chapter, Novel } from '../../types';
import type { TagPlacement } from '../../api/tagPlacements';
import { STORES, requestToPromise, withStore } from './core';
import { saveNovel } from './novels';

// --- Utility helpers for novels/chapter operations used by API ---
export const splitChaptersForAppend = (existing: Novel, appendText: string): { text: string; chapters: Chapter[] } => {
  const normalizedAppend = appendText.replace(/\r\n|\r/g, '\n');
  const baseText = existing.text || '';
  const baseLength = baseText.length;
  const newChapters = splitTextIntoChapters(normalizedAppend).map((ch) => ({
    ...ch,
    originalStartIndex: ch.originalStartIndex + baseLength,
    originalEndIndex: ch.originalEndIndex + baseLength,
  }));

  return {
    text: baseText + normalizedAppend,
    chapters: [...(existing.chapters || []), ...newChapters],
  };
};

export const truncateNovelAfterChapter = async (
  novel: Novel,
  keepChapterCount: number,
  annotations: Annotation[],
  tagPlacements: TagPlacement[]
): Promise<{
  novel: Novel;
  deletedAnnotationsCount: number;
  truncatedAnnotationsCount: number;
  deletedPlotAnchorsCount: number;
}> => {
  const chapters = novel.chapters || [];
  const chaptersToKeep = chapters.slice(0, keepChapterCount);
  const lastChapter = chaptersToKeep[chaptersToKeep.length - 1];
  const cutoffIndex = lastChapter.originalEndIndex;

  const truncatedText = (novel.text || '').substring(0, cutoffIndex);

  // Remove annotations beyond cutoff
  const annotationsToDelete = annotations.filter((a) => a.startIndex >= cutoffIndex);
  const partiallyOverlapping = annotations.filter((a) => a.startIndex < cutoffIndex && a.endIndex > cutoffIndex);

  // Truncate overlapping annotations
  const updatedAnnotations = annotations
    .filter((a) => !annotationsToDelete.some((del) => del.id === a.id))
    .map((a) => {
      if (partiallyOverlapping.some((p) => p.id === a.id)) {
        return {
          ...a,
          endIndex: cutoffIndex,
          text: truncatedText.substring(a.startIndex, cutoffIndex),
        };
      }
      return a;
    });

  const updatedPlacements = tagPlacements;
  const filteredPlotAnchors = (novel.plotAnchors || []).filter((anchor) => anchor.position < cutoffIndex);

  const updatedNovel: Novel = {
    ...novel,
    text: truncatedText,
    chapters: chaptersToKeep,
    plotAnchors: filteredPlotAnchors,
    updatedAt: new Date().toISOString(),
  };

  // Persist changes
  await saveNovel(updatedNovel);
  await Promise.all([
    withStore<void>(STORES.annotations, 'readwrite', async (store) => {
      annotationsToDelete.forEach((ann) => store.delete(ann.id));
      partiallyOverlapping.forEach((ann) => {
        const updated = updatedAnnotations.find((a) => a.id === ann.id);
        if (updated) store.put(updated);
      });
      return requestToPromise(store.get(updatedAnnotations[0]?.id || ''));
    }),
    withStore<void>(STORES.tagPlacements, 'readwrite', async (store) => {
      updatedPlacements.forEach((tp) => store.put(tp));
      return requestToPromise(store.get(updatedPlacements[0]?.id || ''));
    }),
  ]);

  return {
    novel: updatedNovel,
    deletedAnnotationsCount: annotationsToDelete.length,
    truncatedAnnotationsCount: partiallyOverlapping.length,
    deletedPlotAnchorsCount: (novel.plotAnchors || []).length - filteredPlotAnchors.length,
  };
};

export const createChapterContentResponse = (novel: Novel, chapterId: string, annotations: Annotation[]) => {
  const targetChapter = (novel.chapters || []).find((ch) => ch.id === chapterId);
  if (!targetChapter) {
    throw new Error('未找到章节');
  }
  return {
    chapter: targetChapter,
    annotations: annotations.filter((a) => a.novelId === novel.id),
  };
};


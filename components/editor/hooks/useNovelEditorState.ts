// FIX: Import Dispatch and SetStateAction to resolve React namespace errors.
import { useState, useEffect, useCallback, useMemo, Dispatch, SetStateAction, useRef } from 'react';
import type { Novel, Tag, Annotation, SelectionDetails, Chapter, User, Storyline, PlotAnchor, TagTemplate, TagTemplateDefinition } from '../../../types';
import { generateId, getAllAncestorTagIds, getAllDescendantTagIds, splitTextIntoChapters, PENDING_ANNOTATION_TAG_NAME } from '../../../utils';
import type { EditorMode } from '../NovelEditorPage';
import { annotationsApi, novelsApi } from '../../../api';
import { tagCompatApi as tagsApi } from '../../../api/tagCompat';
import { getNovelReadingPosition } from '../../../utils/novelReadingPosition';

interface UseNovelEditorStateProps {
  novel: Novel;
  allUserTags: Tag[]; // Renamed from allTags
  allUserAnnotations: Annotation[]; // Renamed from allAnnotations
  // FIX: Use Dispatch and SetStateAction directly.
  setNovels: Dispatch<SetStateAction<Novel[]>>;
  setAllUserTags: Dispatch<SetStateAction<Tag[]>>; // Renamed from setAllTags
  setAllUserAnnotations: Dispatch<SetStateAction<Annotation[]>>; // Renamed from setAllAnnotations
  currentUser: User;
  editorMode: EditorMode;
}

export const useNovelEditorState = ({
  novel,
  allUserTags, // Renamed
  allUserAnnotations, // Renamed
  setNovels,
  setAllUserTags, // Renamed
  setAllUserAnnotations, // Renamed
  currentUser,
  editorMode,
}: UseNovelEditorStateProps) => {
  const [activeTagId, setActiveTagIdInternal] = useState<string | null>(null);
  const [currentSelection, setCurrentSelection] = useState<SelectionDetails | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(() => {
    const savedPosition = getNovelReadingPosition(currentUser.id, novel.id);
    if (savedPosition?.chapterId && novel.chapters?.some(ch => ch.id === savedPosition.chapterId)) {
      return savedPosition.chapterId;
    }
    if (novel.chapters && novel.chapters.length > 0) {
      const sortedChapters = [...novel.chapters].sort((a, b) => a.originalStartIndex - b.originalStartIndex);
      return sortedChapters[0]?.id ?? null;
    }
    return null;
  });
  const [globalFilterTagName, setGlobalFilterTagNameInternal] = useState<string | null>(null);
  const [includeChildTagsInReadMode, setIncludeChildTagsInReadMode] = useState<boolean>(true);

  // Storyline state
  const [activeStorylineId, setActiveStorylineId] = useState<string | null>(null);
  const [scrollToAnchorId, setScrollToAnchorId] = useState<string | null>(null);

  // 🆕 Track pending annotation creation promises to prevent deletion of temporary IDs
  const pendingCreationPromises = useRef<Map<string, Promise<string>>>(new Map()); // tempId -> Promise<realId>


  // 🆕 只显示当前小说的标签（不包含全局标签）
  const currentUserTags = useMemo(
    () => allUserTags.filter(t =>
      t.userId === currentUser.id &&
      t.novelId === novel.id &&
      (t.placementType ?? 'tag') === 'tag'
    ),
    [allUserTags, currentUser.id, novel.id]
  );

  const pendingTag = useMemo(() =>
    allUserTags.find(t =>
      t.userId === currentUser.id &&
      t.name === PENDING_ANNOTATION_TAG_NAME &&
      t.novelId === novel.id &&
      (t.placementType ?? 'tag') === 'tag'
    ),
    [allUserTags, currentUser.id, novel.id]
  );

  const annotationsForCurrentNovel = useMemo(
    () => allUserAnnotations.filter(a => a.novelId === novel.id && a.userId === currentUser.id).sort((a, b) => a.startIndex - b.startIndex),
    [allUserAnnotations, novel.id, currentUser.id]
  );
  
  const currentChapterDetails = useMemo(() => {
    if (!novel.chapters || !selectedChapterId) return null;
    return novel.chapters.find(c => c.id === selectedChapterId);
  }, [novel.chapters, selectedChapterId]);

  const getTagById = useCallback(
    (tagId: string): Tag | undefined => currentUserTags.find(t => t.id === tagId),
    [currentUserTags]
  );
  
  useEffect(() => {
    if (editorMode === 'read') {
      // 不再清空章节选择,保留用户的章节选择状态
      // if (activeTagId) {
      //   setSelectedChapterId(null);
      //   setCurrentSelection(null);
      // }
      setCurrentSelection(null);
    }
     if (editorMode !== 'storyline') {
      setActiveStorylineId(null);
      setScrollToAnchorId(null);
    }
  }, [editorMode, activeTagId]);


  useEffect(() => {
    if (novel.chapters && novel.chapters.length > 0) {
      // ✅ 修复：如果没有选中章节，默认选中第一章（避免渲染整本小说）
      if (!selectedChapterId) {
        const sortedChapters = [...novel.chapters].sort((a, b) => a.originalStartIndex - b.originalStartIndex);
        setSelectedChapterId(sortedChapters[0].id);
      } else if (!novel.chapters.find(c => c.id === selectedChapterId)) {
        setSelectedChapterId(null);
      }
    } else if (selectedChapterId) {
       setSelectedChapterId(null);
    }
  }, [novel.chapters, selectedChapterId]);


  const updateFullNovelTextAndAlignAnnotations = useCallback(async (newFullText: string, selectionHint?: { originalTitle: string; originalStartIndex: number }) => {
    const normalizedNewFullText = newFullText.replace(/\r\n|\r/g, '\n');

    const updatedAnnotations = allUserAnnotations.map(ann => { // Operate on allUserAnnotations
      if (ann.novelId !== novel.id || ann.userId !== currentUser.id) return ann;

      let newStartIndex = -1;
      const searchWindowStart = Math.max(0, ann.startIndex - Math.min(ann.startIndex, 200));
      const searchWindowEnd = Math.min(normalizedNewFullText.length, ann.startIndex + ann.text.length + 200);
      const textToSearchIn = normalizedNewFullText.substring(searchWindowStart, searchWindowEnd);

      let localIndex = textToSearchIn.indexOf(ann.text);
      if (localIndex !== -1) {
          newStartIndex = searchWindowStart + localIndex;
      } else {
          newStartIndex = normalizedNewFullText.indexOf(ann.text);
      }

      if (newStartIndex !== -1) {
        return {
          ...ann,
          startIndex: newStartIndex,
          endIndex: newStartIndex + ann.text.length,
          isPotentiallyMisaligned: undefined,
        };
      } else {
        return { ...ann, isPotentiallyMisaligned: true };
      }
    });
    setAllUserAnnotations(updatedAnnotations); // Update global annotations

    const newChapters = splitTextIntoChapters(normalizedNewFullText);

    setNovels(prevNovels => prevNovels.map(n =>
      n.id === novel.id ? { ...n, text: normalizedNewFullText, chapters: newChapters } : n
    ));

    if (selectionHint) {
        let chapterToSelect = newChapters.find(c =>
            c.originalStartIndex <= selectionHint.originalStartIndex && c.originalEndIndex > selectionHint.originalStartIndex
        );

        if (!chapterToSelect) {
            chapterToSelect = newChapters.find(c => c.title === selectionHint.originalTitle);
        }
        setSelectedChapterId(chapterToSelect ? chapterToSelect.id : null);
    } else {
        setSelectedChapterId(null);
    }

    // 🆕 保存小说文本到数据库
    try {
      await novelsApi.update(novel.id, {
        text: normalizedNewFullText,
        chapters: newChapters,
      });

      // 🆕 保存所有修改后的标注位置到数据库
      const annotationsToUpdate = updatedAnnotations.filter(
        ann => ann.novelId === novel.id && ann.userId === currentUser.id
      );
      for (const ann of annotationsToUpdate) {
        await annotationsApi.update(ann.id, {
          startIndex: ann.startIndex,
          endIndex: ann.endIndex,
        });
      }

      console.log('[保存] 小说文本和标注位置已保存到数据库');
    } catch (error) {
      console.error('[保存] 保存到数据库失败:', error);
      alert('保存失败，请重试');
    }

  }, [allUserAnnotations, novel.id, currentUser.id, setAllUserAnnotations, setNovels]);
  
  const handleNovelTextChange = (text: string) => {
    updateFullNovelTextAndAlignAnnotations(text);
  };
  
  const handleChapterTextChange = async (chapterId: string, newContent: string) => {
    if (!novel.chapters) return;
    const chapterToUpdate = novel.chapters.find(c => c.id === chapterId);
    if (!chapterToUpdate) return;

    const normalizedNewContent = newContent.replace(/\r\n|\r/g, '\n');

    const textBefore = novel.text.substring(0, chapterToUpdate.originalStartIndex);
    const textAfter = novel.text.substring(chapterToUpdate.originalEndIndex);
    const newFullText = textBefore + normalizedNewContent + textAfter;

    const lengthDifference = normalizedNewContent.length - chapterToUpdate.content.length;

    let foundChapter = false;
    const updatedChapters = novel.chapters.map(c => {
      if (c.id === chapterId) {
        foundChapter = true;
        return {
          ...c,
          content: normalizedNewContent,
          originalEndIndex: c.originalEndIndex + lengthDifference,
        };
      }
      if (foundChapter) {
        return {
          ...c,
          originalStartIndex: c.originalStartIndex + lengthDifference,
          originalEndIndex: c.originalEndIndex + lengthDifference,
        };
      }
      return c;
    });

    const updatedAnnotations = allUserAnnotations.map(ann => {
      if (ann.novelId !== novel.id || ann.userId !== currentUser.id) return ann;

      let newStartIndex = -1;
      const searchWindowStart = Math.max(0, ann.startIndex - 200);
      const searchWindowEnd = Math.min(newFullText.length, ann.endIndex + 200);
      const textToSearchIn = newFullText.substring(searchWindowStart, searchWindowEnd);

      let localIndex = textToSearchIn.indexOf(ann.text);
      if (localIndex !== -1) {
          newStartIndex = searchWindowStart + localIndex;
      } else {
          newStartIndex = newFullText.indexOf(ann.text);
      }

      if (newStartIndex !== -1) {
        return {
          ...ann,
          startIndex: newStartIndex,
          endIndex: newStartIndex + ann.text.length,
          isPotentiallyMisaligned: undefined,
        };
      } else {
        return { ...ann, isPotentiallyMisaligned: true };
      }
    });
    setAllUserAnnotations(updatedAnnotations);

    setNovels(prevNovels => prevNovels.map(n =>
      n.id === novel.id ? { ...n, text: newFullText, chapters: updatedChapters } : n
    ));

    setSelectedChapterId(chapterId);

    // 🆕 保存章节修改到数据库
    try {
      await novelsApi.update(novel.id, {
        text: newFullText,
        chapters: updatedChapters,
      });

      // 🆕 保存所有修改后的标注位置到数据库
      const annotationsToUpdate = updatedAnnotations.filter(
        ann => ann.novelId === novel.id && ann.userId === currentUser.id
      );
      for (const ann of annotationsToUpdate) {
        await annotationsApi.update(ann.id, {
          startIndex: ann.startIndex,
          endIndex: ann.endIndex,
        });
      }

      console.log('[保存] 章节文本和标注位置已保存到数据库');
    } catch (error) {
      console.error('[保存] 保存到数据库失败:', error);
      alert('保存失败，请重试');
    }
  };

  const handleDeleteChapter = async (chapterId: string) => {
    if (!novel.chapters) return;

    const chapterToDelete = novel.chapters.find(c => c.id === chapterId);
    if (!chapterToDelete) return;

    // 从小说文本中删除该章节
    const textBefore = novel.text.substring(0, chapterToDelete.originalStartIndex);
    const textAfter = novel.text.substring(chapterToDelete.originalEndIndex);
    const newFullText = textBefore + textAfter;

    const deletedLength = chapterToDelete.originalEndIndex - chapterToDelete.originalStartIndex;

    // 删除章节并更新后续章节的索引
    const updatedChapters = novel.chapters
      .filter(c => c.id !== chapterId)
      .map(c => {
        if (c.originalStartIndex > chapterToDelete.originalStartIndex) {
          return {
            ...c,
            originalStartIndex: c.originalStartIndex - deletedLength,
            originalEndIndex: c.originalEndIndex - deletedLength,
          };
        }
        return c;
      });

    // 更新标注位置
    const updatedAnnotations = allUserAnnotations.map(ann => {
      if (ann.novelId !== novel.id || ann.userId !== currentUser.id) return ann;

      // 如果标注在被删除的章节中，标记为失效
      if (ann.startIndex >= chapterToDelete.originalStartIndex &&
          ann.endIndex <= chapterToDelete.originalEndIndex) {
        return { ...ann, isPotentiallyMisaligned: true };
      }

      // 如果标注在删除章节之后，更新位置
      if (ann.startIndex >= chapterToDelete.originalEndIndex) {
        return {
          ...ann,
          startIndex: ann.startIndex - deletedLength,
          endIndex: ann.endIndex - deletedLength,
        };
      }

      return ann;
    });

    setAllUserAnnotations(updatedAnnotations);

    setNovels(prevNovels => prevNovels.map(n =>
      n.id === novel.id ? { ...n, text: newFullText, chapters: updatedChapters } : n
    ));

    // 如果删除的是当前选中的章节，清空选择
    if (selectedChapterId === chapterId) {
      setSelectedChapterId(null);
    }

    // 保存到数据库
    try {
      await novelsApi.update(novel.id, {
        text: newFullText,
        chapters: updatedChapters,
      });

      // 保存所有修改后的标注位置到数据库
      const annotationsToUpdate = updatedAnnotations.filter(
        ann => ann.novelId === novel.id && ann.userId === currentUser.id
      );
      for (const ann of annotationsToUpdate) {
        await annotationsApi.update(ann.id, {
          startIndex: ann.startIndex,
          endIndex: ann.endIndex,
        });
      }

      console.log('[删除] 章节已删除并保存到数据库');
    } catch (error) {
      console.error('[删除] 保存到数据库失败:', error);
      alert('删除章节失败，请重试');
    }
  };

  const handleRenameChapter = async (chapterId: string, newTitle: string) => {
    if (!novel.chapters) return;

    const updatedChapters = novel.chapters.map(c =>
      c.id === chapterId ? { ...c, title: newTitle } : c
    );

    setNovels(prevNovels => prevNovels.map(n =>
      n.id === novel.id ? { ...n, chapters: updatedChapters } : n
    ));

    // 保存到数据库
    try {
      await novelsApi.updateFromCache(novel, {
        chapters: updatedChapters,
      });

      console.log('[重命名] 章节已重命名并保存到数据库');
    } catch (error) {
      console.error('[重命名] 保存到数据库失败:', error);
      alert('重命名章节失败，请重试');
    }
  };

  const handleUpdateChapterLevel = async (chapterId: string, newLevel: number) => {
    if (!novel.chapters) return;

    const updatedChapters = novel.chapters.map(c =>
      c.id === chapterId ? { ...c, level: newLevel } : c
    );

    setNovels(prevNovels => prevNovels.map(n =>
      n.id === novel.id ? { ...n, chapters: updatedChapters } : n
    ));

    // 保存到数据库
    try {
      await novelsApi.updateFromCache(novel, {
        chapters: updatedChapters,
      });

      console.log('[章节级别] 章节级别已更新并保存到数据库');
    } catch (error) {
      console.error('[章节级别] 保存到数据库失败:', error);
      alert('更新章节级别失败，请重试');
    }
  };

  const handleCreateChapter = async () => {
    const chapterCount = novel.chapters?.length ?? 0;
    const title = `新章节 ${chapterCount + 1}`;

    const chapters = novel.chapters || [];
    const selectedIndex = selectedChapterId ? chapters.findIndex(c => c.id === selectedChapterId) : -1;
    const insertIndex = selectedIndex >= 0 ? selectedIndex : chapters.length;

    // Insert before the selected chapter by default. Keep indices stable by using the selected chapter's start index.
    // The new chapter is created with empty content so the range is zero-length until the user edits it.
    const startIndex = selectedIndex >= 0 ? chapters[selectedIndex].originalStartIndex : (novel.text || '').length;

    const newChapter: Chapter = {
      id: generateId(),
      title,
      content: '',
      htmlContent: '',
      originalStartIndex: startIndex,
      originalEndIndex: startIndex,
      level: 5,
    };

    const updatedChapters = [
      ...chapters.slice(0, insertIndex),
      newChapter,
      ...chapters.slice(insertIndex),
    ];

    setNovels(prevNovels => prevNovels.map(n =>
      n.id === novel.id ? { ...n, chapters: updatedChapters } : n
    ));

    setSelectedChapterId(newChapter.id);
    setActiveTagIdInternal(null);
    setGlobalFilterTagNameInternal(null);
    setCurrentSelection(null);

    try {
      await novelsApi.updateFromCache(novel, {
        chapters: updatedChapters,
      });

      console.log('[新建章节] 章节已创建并保存到数据库');
    } catch (error) {
      console.error('[新建章节] 保存到数据库失败:', error);
      alert('新建章节失败，请重试');
    }
  };

  const handleMergeChapterWithPrevious = async (chapterId: string) => {
    if (!novel.chapters) return;

    const chapters = novel.chapters;
    const idx = chapters.findIndex(c => c.id === chapterId);
    if (idx <= 0) return;

    const prev = chapters[idx - 1];
    const current = chapters[idx];

    const fullText = novel.text || '';
    const mergedStart = Math.max(0, prev.originalStartIndex);
    const mergedEnd = Math.max(mergedStart, current.originalEndIndex);
    const mergedContent = fullText.substring(mergedStart, mergedEnd);

    const mergedChapter: Chapter = {
      ...prev,
      content: mergedContent,
      originalEndIndex: mergedEnd,
      // Any rich text representation is now stale; keep it unset so we don't accidentally show old content.
      htmlContent: undefined,
    };

    const updatedChapters = [
      ...chapters.slice(0, idx - 1),
      mergedChapter,
      ...chapters.slice(idx + 1),
    ];

    setNovels(prevNovels => prevNovels.map(n =>
      n.id === novel.id ? { ...n, chapters: updatedChapters } : n
    ));

    setSelectedChapterId(mergedChapter.id);
    setActiveTagIdInternal(null);
    setGlobalFilterTagNameInternal(null);
    setCurrentSelection(null);

    try {
      await novelsApi.updateFromCache(novel, {
        chapters: updatedChapters,
      });

      console.log('[合并章节] 章节已合并并保存到数据库');
    } catch (error) {
      console.error('[合并章节] 保存到数据库失败:', error);
      alert('合并章节失败，请重试');
    }
  };

  const handleMergeChapterRange = async (chapterIds: string[]) => {
    if (!novel.chapters) return;
    const chapters = novel.chapters;
    if (!chapterIds || chapterIds.length < 2) return;

    const ids = chapterIds.filter(Boolean);
    const idSet = new Set(ids);

    const indices = ids
      .map((id) => chapters.findIndex((c) => c.id === id))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b);

    if (indices.length < 2) return;

    const startIdx = indices[0];
    const endIdx = indices[indices.length - 1];

    // Ensure all chapters in [startIdx, endIdx] are included in the selection (range merge safety).
    for (let i = startIdx; i <= endIdx; i += 1) {
      if (!idSet.has(chapters[i].id)) {
        alert('合并失败：请选择一个连续范围的章节后再合并。');
        return;
      }
    }

    const top = chapters[startIdx];
    const bottom = chapters[endIdx];

    const fullText = novel.text || '';
    const mergedStart = Math.max(0, top.originalStartIndex);
    const mergedEnd = Math.max(mergedStart, bottom.originalEndIndex);
    const mergedContent = fullText.substring(mergedStart, mergedEnd);

    const mergedChapter: Chapter = {
      ...top,
      content: mergedContent,
      originalEndIndex: mergedEnd,
      // Any rich text representation is now stale; keep it unset so we don't accidentally show old content.
      htmlContent: undefined,
    };

    const updatedChapters = [
      ...chapters.slice(0, startIdx),
      mergedChapter,
      ...chapters.slice(endIdx + 1),
    ];

    setNovels(prevNovels => prevNovels.map(n =>
      n.id === novel.id ? { ...n, chapters: updatedChapters } : n
    ));

    setSelectedChapterId(mergedChapter.id);
    setActiveTagIdInternal(null);
    setGlobalFilterTagNameInternal(null);
    setCurrentSelection(null);

    try {
      await novelsApi.updateFromCache(novel, {
        chapters: updatedChapters,
      });

      console.log('[合并章节] 范围合并已完成并保存到数据库');
    } catch (error) {
      console.error('[合并章节] 保存到数据库失败:', error);
      alert('合并章节失败，请重试');
    }
  };

  const handleSelectChapter = (chapterId: string | null) => {
    setSelectedChapterId(chapterId);
    setActiveTagIdInternal(null); 
    setGlobalFilterTagNameInternal(null); 
    setCurrentSelection(null);
  };

  const handleAddTag = async (name: string, color: string, parentId: string | null) => {
    if (name.trim() === '' || !currentUser) return;

    // 创建临时标签用于立即显示
    const tempTag: Tag = {
      id: generateId(),
      name: name.trim(),
      color,
      parentId,
      userId: currentUser.id,
      novelId: novel.id, // 🆕 关联当前小说
    };

    // 先更新本地状态,提供即时反馈
    setAllUserTags(prevTags => [...prevTags, tempTag]);

    // 然后保存到后端
    try {
      const savedTag = await tagsApi.create({
        name: name.trim(),
        color,
        parentId,
        novelId: novel.id, // 🆕 关联当前小说
      });

      // 用后端返回的标签替换临时标签(ID可能不同)
      setAllUserTags(prevTags =>
        prevTags.map(t => (t.id === tempTag.id ? savedTag : t))
      );
    } catch (error) {
      console.error('保存标签到后端失败:', error);
      // 如果保存失败,移除临时标签
      setAllUserTags(prevTags => prevTags.filter(t => t.id !== tempTag.id));
      alert('创建标签失败,请稍后重试');
    }
  };

  const handleImportTagTemplate = useCallback(async (template: TagTemplate) => {
    if (!currentUser) return;
    if (!template || !Array.isArray(template.tags)) return;

    const rawDefs = template.tags.filter((def) => def?.name && def.name !== PENDING_ANNOTATION_TAG_NAME);
    if (rawDefs.length === 0) {
      alert('模板为空，无法导入');
      return;
    }

    // Template format references parents by name, so we assume names are unique within a template.
    const defMap = new Map<string, TagTemplateDefinition>();
    for (const def of rawDefs) {
      if (!defMap.has(def.name)) defMap.set(def.name, def);
    }

    const depthMemo = new Map<string, number>();
    const visiting = new Set<string>();
    const getDepth = (name: string): number => {
      const cached = depthMemo.get(name);
      if (cached !== undefined) return cached;
      if (visiting.has(name)) return 0; // Cycle guard

      visiting.add(name);
      const def = defMap.get(name);
      let depth = 0;
      if (def?.parentName && defMap.has(def.parentName)) {
        depth = getDepth(def.parentName) + 1;
      }
      visiting.delete(name);
      depthMemo.set(name, depth);
      return depth;
    };

    const orderedDefs = Array.from(defMap.values())
      .map((def) => ({ def, depth: getDepth(def.name) }))
      .sort((a, b) => a.depth - b.depth || a.def.name.localeCompare(b.def.name));

    // Merge common prefixes: reuse existing tags with the same (parentId, name).
    const existingByKey = new Map<string, Tag>();
    for (const tag of currentUserTags) {
      if (tag.name === PENDING_ANNOTATION_TAG_NAME) continue;
      const key = `${tag.parentId ?? 'root'}||${tag.name}`;
      if (!existingByKey.has(key)) existingByKey.set(key, tag);
    }

    const nameToPlacementId = new Map<string, string>();
    const createdTags: Tag[] = [];

    for (const { def } of orderedDefs) {
      const parentId = def.parentName ? (nameToPlacementId.get(def.parentName) ?? null) : null;
      const key = `${parentId ?? 'root'}||${def.name}`;
      const existing = existingByKey.get(key);
      if (existing) {
        nameToPlacementId.set(def.name, existing.id);
        continue;
      }

      try {
        const created = await tagsApi.create({
          name: def.name,
          color: def.color,
          parentId,
          novelId: novel.id,
        });
        createdTags.push(created);
        existingByKey.set(key, created);
        nameToPlacementId.set(def.name, created.id);
      } catch (error) {
        console.error('[模板导入] 创建标签失败:', def.name, error);
        alert(`导入失败：创建标签 "${def.name}" 时出错`);
        break;
      }
    }

    if (createdTags.length > 0) {
      setAllUserTags((prev) => [...prev, ...createdTags]);
    }
  }, [currentUser, currentUserTags, novel.id, setAllUserTags]);

  const handleUpdateTagParent = async (tagId: string, newParentId: string | null) => {
    const userTagsBeforeUpdate = allUserTags.filter(t => t.userId === currentUser.id);

    // 获取被移动标签及其所有后代
    const affectedTagIds = new Set([tagId, ...getAllDescendantTagIds(tagId, userTagsBeforeUpdate)]);

    // 先更新本地状态
    const updatedGlobalTags = allUserTags.map(tag =>
      (tag.id === tagId && tag.userId === currentUser.id)
        ? { ...tag, parentId: newParentId }
        : tag
    );

    const userTagsAfterUpdate = updatedGlobalTags.filter(
      t => t.userId === currentUser.id
    );

    // 收集需要更新到后端的标注
    const annotationsToUpdate: Array<{ id: string; tagIds: string[] }> = [];

    const updatedAnnotations = allUserAnnotations.map(ann => {
      if (ann.novelId !== novel.id || ann.userId !== currentUser.id) {
        return ann;
      }

      // 检查此标注是否包含受影响的标签
      const hasAffectedTag = ann.tagIds.some(tid => affectedTagIds.has(tid));
      if (!hasAffectedTag) {
        return ann;
      }

      // 提取叶子标签（在旧的标签树中）
      const currentAnnotationLeafTagIds: string[] = ann.tagIds.filter(currentTagIdInAnnotation => {
        const isOriginalTagValid = userTagsBeforeUpdate.some(t => t.id === currentTagIdInAnnotation);
        if (!isOriginalTagValid) return false;

        const isAncestorToAnotherInAnnotation = ann.tagIds.some(otherTagIdInAnnotation => {
          if (currentTagIdInAnnotation === otherTagIdInAnnotation) return false;
          const ancestorsOfOther = getAllAncestorTagIds(otherTagIdInAnnotation, userTagsBeforeUpdate);
          return ancestorsOfOther.includes(currentTagIdInAnnotation);
        });
        return !isAncestorToAnotherInAnnotation;
      });

      // 使用新的标签树重新计算完整的 tagIds（叶子 + 新祖先）
      let newCombinedTagIdsForAnnotation = new Set<string>();
      currentAnnotationLeafTagIds.forEach(leafTagId => {
        const leafTagExistsInNew = userTagsAfterUpdate.find(t => t.id === leafTagId);
        if (leafTagExistsInNew) {
            newCombinedTagIdsForAnnotation.add(leafTagId);
            const newAncestors = getAllAncestorTagIds(leafTagId, userTagsAfterUpdate);
            newAncestors.forEach(ancestorId => newCombinedTagIdsForAnnotation.add(ancestorId));
        }
      });

      const finalTagIds = Array.from(newCombinedTagIdsForAnnotation)
                               .filter(tid => userTagsAfterUpdate.some(t => t.id === tid));

      // 只有 tagIds 真正变化时才记录需要更新
      if (JSON.stringify(ann.tagIds.sort()) !== JSON.stringify(finalTagIds.sort())) {
        annotationsToUpdate.push({ id: ann.id, tagIds: finalTagIds });
      }

      return { ...ann, tagIds: finalTagIds };
    });

    // 先更新本地状态，提供即时反馈
    setAllUserTags(updatedGlobalTags);
    setAllUserAnnotations(updatedAnnotations);

    // 然后保存到后端
    try {
      // 1. 更新标签的 parentId
      await tagsApi.update(tagId, { parentId: newParentId });

      // 2. 批量更新所有受影响的标注
      if (annotationsToUpdate.length > 0) {
        await Promise.all(
          annotationsToUpdate.map(({ id, tagIds }) =>
            annotationsApi.update(id, { tagIds })
          )
        );
      }
    } catch (error) {
      console.error('更新标签层级到后端失败:', error);
      alert('更新标签层级失败,请稍后重试');
      // 失败时回滚本地状态
      setAllUserTags(allUserTags);
      setAllUserAnnotations(allUserAnnotations);
    }
  };

  const handleUpdateTagColor = async (tagId: string, newColor: string) => {
    // 先更新本地状态,提供即时反馈
    setAllUserTags(prevTags =>
      prevTags.map(tag =>
        (tag.id === tagId && tag.userId === currentUser.id)
        ? { ...tag, color: newColor }
        : tag
      )
    );

    // 然后保存到后端
    try {
      await tagsApi.update(tagId, { color: newColor });
    } catch (error) {
      console.error('更新标签颜色到后端失败:', error);
      alert('更新标签颜色失败,请稍后重试');
    }
  };

  const handleTextSelection = useCallback(() => {
    // 支持标注模式和阅读模式的文本选择
    if (editorMode !== 'annotation' && editorMode !== 'read') {
      setCurrentSelection(null);
      return;
    }

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rawSelectedText = range.toString();

      if (rawSelectedText.trim() === '') {
        setCurrentSelection(null);
        return;
      }

      const contentDisplayElement = document.getElementById('content-display-area');
      if (contentDisplayElement && contentDisplayElement.contains(range.commonAncestorContainer)) {

        // ✅ 检查选区是否在 snippet 节点内
        let snippetNode = range.commonAncestorContainer as HTMLElement;
        // 向上查找 snippet container
        while (snippetNode && snippetNode !== contentDisplayElement) {
          if (snippetNode.nodeType === Node.ELEMENT_NODE && (snippetNode as HTMLElement).hasAttribute('data-annotation-id')) {
            // 找到 snippet 节点，直接读取精确索引
            const annotationId = (snippetNode as HTMLElement).getAttribute('data-annotation-id');
            const startIndex = parseInt((snippetNode as HTMLElement).getAttribute('data-start-index') || '0', 10);
            const endIndex = parseInt((snippetNode as HTMLElement).getAttribute('data-end-index') || '0', 10);

            console.log('[handleTextSelection] 检测到 snippet 选区:', {
              annotationId,
              startIndex,
              endIndex,
              text: rawSelectedText
            });

            setCurrentSelection({
              text: rawSelectedText,
              startIndex,
              endIndex,
              annotationId: annotationId || undefined
            });
            return;
          }
          snippetNode = snippetNode.parentElement as HTMLElement;
        }

        // ✅ 不在 snippet 内，使用原有逻辑计算全文位置
        const preSelectionRange = document.createRange();
        preSelectionRange.selectNodeContents(contentDisplayElement);
        preSelectionRange.setEnd(range.startContainer, range.startOffset);

        const rawRelativeStartIndex = preSelectionRange.toString().length;

        const currentDisplayedText = currentChapterDetails ? currentChapterDetails.content : novel.text;
        const baseOffset = currentChapterDetails ? currentChapterDetails.originalStartIndex : 0;

        if (rawRelativeStartIndex >= 0 && (rawRelativeStartIndex + rawSelectedText.length) <= currentDisplayedText.length) {
            const finalStartIndex = baseOffset + rawRelativeStartIndex;
            const finalEndIndex = finalStartIndex + rawSelectedText.length;

            if (finalStartIndex >=0 && finalEndIndex <= novel.text.length) {
                 setCurrentSelection({ text: rawSelectedText, startIndex: finalStartIndex, endIndex: finalEndIndex });
            } else { setCurrentSelection(null); }
        } else { setCurrentSelection(null); }
      } else { setCurrentSelection(null); }
    } else { setCurrentSelection(null); }
  }, [novel.text, currentChapterDetails, editorMode]);

  const _applyTagsToSegment = useCallback(async (selectionToAnnotate: SelectionDetails, tagIdsToApply: string[]) => {
    if (!currentUser) return;

    const allRelevantTagIds = new Set<string>();
    tagIdsToApply.forEach(tagId => {
        allRelevantTagIds.add(tagId);
        const ancestorTagIds = getAllAncestorTagIds(tagId, currentUserTags);
        ancestorTagIds.forEach(id => allRelevantTagIds.add(id));
    });
    const finalTagIdsArray = Array.from(allRelevantTagIds);

    const newAnnotations: Annotation[] = [];
    const updatesToExistingAnnotations = new Map<string, string[]>();

    const paragraphRegex = /[^\n]+/g;
    let match;

    while ((match = paragraphRegex.exec(selectionToAnnotate.text)) !== null) {
      const paraText = match[0];
      const trimmedPara = paraText.trim();
      if (trimmedPara === '') continue;

      const paraStartIndexInSelection = match.index;
      const trimOffsetInPara = paraText.indexOf(trimmedPara);

      const finalStartIndex = selectionToAnnotate.startIndex + paraStartIndexInSelection + trimOffsetInPara;
      const finalEndIndex = finalStartIndex + trimmedPara.length;

      const existingAnnotation = allUserAnnotations.find(
          ann => ann.novelId === novel.id &&
                 ann.userId === currentUser.id &&
                 ann.startIndex === finalStartIndex &&
                 ann.endIndex === finalEndIndex
      );

      if (existingAnnotation) {
        const hasPendingTag = pendingTag ? existingAnnotation.tagIds.includes(pendingTag.id) : false;
        const isApplyingPendingTag = pendingTag ? tagIdsToApply.includes(pendingTag.id) : false;

        let finalExistingTags = [...existingAnnotation.tagIds];

        // SMART REPLACEMENT LOGIC: If a normal tag is applied to a pending annotation, remove the pending tag.
        if (hasPendingTag && !isApplyingPendingTag) {
            finalExistingTags = finalExistingTags.filter(id => id !== pendingTag!.id);
        }

        const mergedTagIds = Array.from(new Set([...finalExistingTags, ...finalTagIdsArray]));
        updatesToExistingAnnotations.set(existingAnnotation.id, mergedTagIds);
      } else {
        newAnnotations.push({
          id: generateId(),
          tagIds: finalTagIdsArray,
          text: trimmedPara,
          startIndex: finalStartIndex,
          endIndex: finalEndIndex,
          novelId: novel.id,
          userId: currentUser.id,
        });
      }
    }

    if (newAnnotations.length > 0 || updatesToExistingAnnotations.size > 0) {
        // First update local state for immediate UI feedback
        setAllUserAnnotations(prevAnnotations => {
            const updatedAnnotations = prevAnnotations.map(ann => {
                if (updatesToExistingAnnotations.has(ann.id)) {
                    return { ...ann, tagIds: updatesToExistingAnnotations.get(ann.id)! };
                }
                return ann;
            });
            return [...updatedAnnotations, ...newAnnotations];
        });

        // Then persist to backend
        try {
            // Create new annotations in backend and replace temporary IDs with real IDs
            const idMapping = new Map<string, string>(); // tempId -> realId
            for (const annotation of newAnnotations) {
                // 🆕 Create promise and track it
                const creationPromise = (async () => {
                    const savedAnnotation = await annotationsApi.create({
                        text: annotation.text,
                        startIndex: annotation.startIndex,
                        endIndex: annotation.endIndex,
                        novelId: annotation.novelId,
                        tagIds: annotation.tagIds,
                        isPotentiallyMisaligned: annotation.isPotentiallyMisaligned,
                    });
                    // Clean up promise tracking when done
                    pendingCreationPromises.current.delete(annotation.id);
                    return savedAnnotation.id;
                })();

                // Store promise for this temporary ID
                pendingCreationPromises.current.set(annotation.id, creationPromise);

                // Wait for the real ID
                const realId = await creationPromise;
                idMapping.set(annotation.id, realId);
            }

            // Replace temporary IDs with real IDs from backend
            if (idMapping.size > 0) {
                setAllUserAnnotations(prevAnnotations =>
                    prevAnnotations.map(ann =>
                        idMapping.has(ann.id) ? { ...ann, id: idMapping.get(ann.id)! } : ann
                    )
                );
            }

            // Update existing annotations in backend
            for (const [annotationId, newTagIds] of updatesToExistingAnnotations.entries()) {
                const annotation = allUserAnnotations.find(a => a.id === annotationId);
                if (annotation) {
                    await annotationsApi.update(annotationId, {
                        tagIds: newTagIds,
                    });
                }
            }
        } catch (error) {
            console.error('Failed to save annotations to backend:', error);
            alert('保存标注失败,请稍后重试');
        }
    }
  }, [currentUser, currentUserTags, novel.id, allUserAnnotations, setAllUserAnnotations, pendingTag]);
  
  const applyTagToSelection = (tagId: string) => {
    setGlobalFilterTagNameInternal(null);

    if (editorMode === 'read') {
        setActiveTagIdInternal(tagId);
        // 不再清空章节选择,保留用户的章节选择状态
        setCurrentSelection(null);
        return;
    }

    if (currentSelection) {
      _applyTagsToSegment(currentSelection, [tagId]);
      setCurrentSelection(null);
    }

    setActiveTagIdInternal(tagId);
  };
  
  const handleCreatePendingAnnotation = useCallback(() => {
      if (currentSelection && pendingTag) {
          _applyTagsToSegment(currentSelection, [pendingTag.id]);
          setCurrentSelection(null);
      }
  }, [currentSelection, pendingTag, _applyTagsToSegment]);

  const selectTagForReadMode = (tagId: string | null) => {
    setGlobalFilterTagNameInternal(null);
    if (editorMode !== 'read') return;
    setActiveTagIdInternal(tagId);
    // 不再清空章节选择,保留用户的章节选择状态
    setCurrentSelection(null);
  };

  const handleTagGlobalSearch = (tagName: string) => {
    setGlobalFilterTagNameInternal(tagName);
    setActiveTagIdInternal(null);
    // ✅ 全局搜索时不清空章节选择,因为snippet视图不依赖章节,保留章节可以避免不必要的重新渲染和状态更新
    setCurrentSelection(null);
  };

  const handleDeleteAnnotation = useCallback(async (annotationId: string) => {
    if (!currentUser?.id) return;

    // First update local state for immediate UI feedback
    setAllUserAnnotations(prev =>
      prev.filter(ann => ann.id !== annotationId || ann.userId !== currentUser.id)
    );
    setCurrentSelection(null);

    // Then delete from backend
    try {
      await annotationsApi.delete(annotationId);
    } catch (error) {
      console.error('Failed to delete annotation from backend:', error);
      alert('删除标注失败,请稍后重试');
    }
  }, [currentUser, setAllUserAnnotations]);

  // 🆕 批量删除选区内的所有标注
  const handleDeleteAnnotationsInSelection = useCallback(async () => {
    console.log('[删除标记] 函数被调用');
    console.log('[删除标记] currentUser:', currentUser);
    console.log('[删除标记] currentSelection:', currentSelection);

    if (!currentUser?.id || !currentSelection || !currentSelection.text.trim()) {
      console.log('[删除标记] 提前返回：缺少必要条件');
      return;
    }

    const { startIndex, endIndex } = currentSelection;
    console.log('[删除标记] 选区范围:', { startIndex, endIndex });

    // 找出选区范围内的所有标注（完全包含或有交集的标注）
    const annotationsToDelete = annotationsForCurrentNovel.filter(ann => {
      // 标注与选区有交集：标注结束位置 > 选区开始 && 标注开始位置 < 选区结束
      return ann.endIndex > startIndex && ann.startIndex < endIndex;
    });

    console.log('[删除标记] 找到的标注数量:', annotationsToDelete.length);
    console.log('[删除标记] 要删除的标注:', annotationsToDelete);

    if (annotationsToDelete.length === 0) {
      console.log('[删除标记] 没有找到需要删除的标注');
      return; // 无标注需要删除
    }

    // 🆕 Wait for any pending creation promises to complete and get real IDs
    const annotationsWithRealIds = await Promise.all(
      annotationsToDelete.map(async (ann) => {
        const pendingPromise = pendingCreationPromises.current.get(ann.id);
        if (pendingPromise) {
          console.log(`[删除标记] 等待标注 ${ann.id} 的创建完成...`);
          try {
            const realId = await pendingPromise;
            console.log(`[删除标记] 标注 ${ann.id} 的真实ID是 ${realId}`);
            return { ...ann, id: realId };
          } catch (error) {
            console.error(`[删除标记] 标注 ${ann.id} 创建失败:`, error);
            // If creation failed, just remove from local state, don't try to delete from backend
            return null;
          }
        }
        return ann;
      })
    );

    // Filter out failed creations
    const validAnnotationsToDelete = annotationsWithRealIds.filter((ann): ann is Annotation => ann !== null);

    console.log('[删除标记] 实际要删除的标注（包含真实ID）:', validAnnotationsToDelete);

    // 立即更新本地状态
    const annotationIdsToDelete = new Set(validAnnotationsToDelete.map(ann => ann.id));
    setAllUserAnnotations(prev =>
      prev.filter(ann => !annotationIdsToDelete.has(ann.id) || ann.userId !== currentUser.id)
    );
    setCurrentSelection(null);

    console.log('[删除标记] 本地状态已更新，开始后端删除');

    // 后端批量删除
    try {
      await Promise.all(
        validAnnotationsToDelete.map(ann => annotationsApi.delete(ann.id))
      );
      console.log('[删除标记] 后端删除成功');
    } catch (error) {
      console.error('[删除标记] 后端删除失败:', error);
      alert('删除标注失败,请稍后重试');
    }
  }, [currentUser, currentSelection, annotationsForCurrentNovel, setAllUserAnnotations]);

  // Batch create annotations for drag-and-drop tagging
  const handleBatchCreateAnnotations = useCallback(async (
    tagId: string,
    textSegments: Array<{ text: string; startIndex: number; endIndex: number }>
  ) => {
    if (!currentUser?.id || textSegments.length === 0) return;

    // ✅ 添加祖先标签
    const allRelevantTagIds = new Set<string>();
    allRelevantTagIds.add(tagId);
    const ancestorTagIds = getAllAncestorTagIds(tagId, currentUserTags);
    ancestorTagIds.forEach(id => allRelevantTagIds.add(id));
    const finalTagIdsArray = Array.from(allRelevantTagIds);

    // ? 同根替换：仅替换同一根标签体系下的旧标签，保留其他体系标签
    const rootId = ancestorTagIds.length > 0 ? ancestorTagIds[ancestorTagIds.length - 1] : tagId;
    const sameRootTagIds = new Set([rootId, ...getAllDescendantTagIds(rootId, currentUserTags)]);

    const newAnnotations: Annotation[] = [];
    const updatesToExistingAnnotations = new Map<string, string[]>();

    for (const segment of textSegments) {
      const existingAnnotation = allUserAnnotations.find(
        ann => ann.novelId === novel.id &&
               ann.userId === currentUser.id &&
               ann.startIndex === segment.startIndex &&
               ann.endIndex === segment.endIndex
      );

      if (existingAnnotation) {
        // ✅ 智能替换逻辑：如果已有标注包含"待标注"标签，且当前不是在应用"待标注"，则移除"待标注"
        const hasPendingTag = pendingTag ? existingAnnotation.tagIds.includes(pendingTag.id) : false;
        const isApplyingPendingTag = pendingTag ? tagId === pendingTag.id : false;

        let finalExistingTags = [...existingAnnotation.tagIds];

        if (hasPendingTag && !isApplyingPendingTag) {
          // 移除待标注标签
          finalExistingTags = finalExistingTags.filter(id => id !== pendingTag!.id);
        }

        // ? 同根替换（不对“待标注”生效，避免误删其他标签）
        if (!isApplyingPendingTag) {
          finalExistingTags = finalExistingTags.filter(id => !sameRootTagIds.has(id));
        }

        // 合并新标签（替换后再追加新标签+祖先）
        const mergedTagIds = Array.from(new Set([...finalExistingTags, ...finalTagIdsArray]));
        updatesToExistingAnnotations.set(existingAnnotation.id, mergedTagIds);
      } else {
        // Create new annotation
        newAnnotations.push({
          id: generateId(),
          tagIds: finalTagIdsArray,
          text: segment.text,
          startIndex: segment.startIndex,
          endIndex: segment.endIndex,
          novelId: novel.id,
          userId: currentUser.id,
        });
      }
    }

    // Update local state first
    setAllUserAnnotations(prevAnnotations => {
      const updatedAnnotations = prevAnnotations.map(ann => {
        if (updatesToExistingAnnotations.has(ann.id)) {
          return { ...ann, tagIds: updatesToExistingAnnotations.get(ann.id)! };
        }
        return ann;
      });
      return [...updatedAnnotations, ...newAnnotations];
    });

    // Then persist to backend
    try {
      // Create new annotations and replace temporary IDs
      const idMapping = new Map<string, string>();
      for (const annotation of newAnnotations) {
        const savedAnnotation = await annotationsApi.create({
          text: annotation.text,
          startIndex: annotation.startIndex,
          endIndex: annotation.endIndex,
          novelId: annotation.novelId,
          tagIds: annotation.tagIds,
        });
        idMapping.set(annotation.id, savedAnnotation.id);
      }

      // Replace temporary IDs with real IDs
      if (idMapping.size > 0) {
        setAllUserAnnotations(prevAnnotations =>
          prevAnnotations.map(ann =>
            idMapping.has(ann.id) ? { ...ann, id: idMapping.get(ann.id)! } : ann
          )
        );
      }

      // Update existing annotations
      for (const [annotationId, newTagIds] of updatesToExistingAnnotations.entries()) {
        await annotationsApi.update(annotationId, { tagIds: newTagIds });
      }
    } catch (error) {
      console.error('Failed to batch create annotations:', error);
      alert('批量创建标注失败，请稍后重试');
    }
  }, [currentUser, novel.id, allUserAnnotations, setAllUserAnnotations, currentUserTags, pendingTag]);

  // --- Storyline Handlers ---

  const handleSelectStoryline = (storylineId: string | null) => {
    setActiveStorylineId(storylineId);
    setScrollToAnchorId(null);
  };

  const handleAddStoryline = async (name: string, color: string, parentId: string | null) => {
    const newStoryline: Storyline = { id: generateId(), name, color, parentId };
    const updatedStorylines = [...(novel.storylines || []), newStoryline];

    // 先更新本地状态
    setNovels(novels => novels.map(n =>
      n.id === novel.id
        ? { ...n, storylines: updatedStorylines }
        : n
    ));

    // 然后保存到后端
    try {
      await novelsApi.update(novel.id, { storylines: updatedStorylines });
    } catch (error) {
      console.error('保存剧情线到后端失败:', error);
      alert('创建剧情线失败,请稍后重试');
    }
  };

  const handleUpdateStoryline = async (storylineId: string, updates: Partial<Storyline>) => {
    const updatedStorylines = (novel.storylines || []).map(s =>
      s.id === storylineId ? { ...s, ...updates } : s
    );

    // 先更新本地状态
    setNovels(novels => novels.map(n =>
      n.id === novel.id
        ? { ...n, storylines: updatedStorylines }
        : n
    ));

    // 然后保存到后端
    try {
      await novelsApi.update(novel.id, { storylines: updatedStorylines });
    } catch (error) {
      console.error('更新剧情线到后端失败:', error);
      alert('更新剧情线失败,请稍后重试');
    }
  };

  const handleDeleteStoryline = async (storylineId: string) => {
    const currentStorylines = novel.storylines || [];
    const storylineToDelete = currentStorylines.find(s => s.id === storylineId);
    if (!storylineToDelete) return;

    const newParentId = storylineToDelete.parentId;

    const updatedStorylines = currentStorylines
      .filter(s => s.id !== storylineId)
      .map(s => {
        if (s.parentId === storylineId) {
          return { ...s, parentId: newParentId };
        }
        return s;
      });

    const updatedPlotAnchors = (novel.plotAnchors || []).map(anchor => ({
      ...anchor,
      storylineIds: anchor.storylineIds.filter(id => id !== storylineId)
    })).filter(anchor => anchor.storylineIds.length > 0);

    // 先更新本地状态
    setNovels(novels => novels.map(n =>
      n.id === novel.id
        ? { ...n, storylines: updatedStorylines, plotAnchors: updatedPlotAnchors }
        : n
    ));

    // 然后保存到后端
    try {
      await novelsApi.update(novel.id, {
        storylines: updatedStorylines,
        plotAnchors: updatedPlotAnchors
      });
    } catch (error) {
      console.error('删除剧情线到后端失败:', error);
      alert('删除剧情线失败,请稍后重试');
    }
  };
  
  const handleAddPlotAnchor = async (description: string, position: number, storylineIds: string[]) => {
    const newAnchor: PlotAnchor = { id: generateId(), description, position, storylineIds };
    const updatedPlotAnchors = [...(novel.plotAnchors || []), newAnchor];

    // 先更新本地状态
    setNovels(novels => novels.map(n =>
      n.id === novel.id
        ? { ...n, plotAnchors: updatedPlotAnchors }
        : n
    ));

    // 然后保存到后端
    try {
      await novelsApi.update(novel.id, { plotAnchors: updatedPlotAnchors });
    } catch (error) {
      console.error('保存剧情锚点到后端失败:', error);
      alert('创建剧情锚点失败,请稍后重试');
    }
  };

  const handleUpdatePlotAnchor = async (anchorId: string, updates: Partial<PlotAnchor>) => {
    const updatedPlotAnchors = (novel.plotAnchors || []).map(a =>
      a.id === anchorId ? { ...a, ...updates } : a
    );

    // 先更新本地状态
    setNovels(novels => novels.map(n =>
      n.id === novel.id
        ? { ...n, plotAnchors: updatedPlotAnchors }
        : n
    ));

    // 然后保存到后端
    try {
      await novelsApi.update(novel.id, { plotAnchors: updatedPlotAnchors });
    } catch (error) {
      console.error('更新剧情锚点到后端失败:', error);
      alert('更新剧情锚点失败,请稍后重试');
    }
  };

  const handleDeletePlotAnchor = async (anchorId: string) => {
    const updatedPlotAnchors = (novel.plotAnchors || []).filter(a => a.id !== anchorId);

    // 先更新本地状态
    setNovels(novels => novels.map(n =>
      n.id === novel.id
        ? { ...n, plotAnchors: updatedPlotAnchors }
        : n
    ));

    // 然后保存到后端
    try {
      await novelsApi.update(novel.id, { plotAnchors: updatedPlotAnchors });
    } catch (error) {
      console.error('删除剧情锚点到后端失败:', error);
      alert('删除剧情锚点失败,请稍后重试');
    }
  };


  const activeTagDetails = useMemo(
    () => activeTagId ? getTagById(activeTagId) : null,
    [activeTagId, getTagById]
  );

  const toggleIncludeChildTagsInReadMode = useCallback(() => {
    setIncludeChildTagsInReadMode(prev => !prev);
  }, []);

  const annotationsToDisplayOrFilter = useMemo(() => {
    if (globalFilterTagName) {
      const lowerGlobalFilterTagName = globalFilterTagName.toLowerCase();
      const matchingTagIds = currentUserTags
        .filter(tag => tag.name.toLowerCase() === lowerGlobalFilterTagName)
        .map(tag => tag.id);

      if (matchingTagIds.length === 0) return []; 
      
      return annotationsForCurrentNovel.filter(ann =>
        ann.tagIds.some(tid => matchingTagIds.includes(tid))
      );
    }

    if (!activeTagDetails) { 
        return annotationsForCurrentNovel;
    }

    const descendantIds = getAllDescendantTagIds(activeTagDetails.id, currentUserTags);
    const descendantIdSet = new Set(descendantIds);

    if (editorMode === 'read' && !includeChildTagsInReadMode) {
      return annotationsForCurrentNovel.filter(ann => (
        ann.tagIds.includes(activeTagDetails.id) &&
        !ann.tagIds.some(tid => descendantIdSet.has(tid))
      ));
    }

    const relevantTagIdsSet = new Set([activeTagDetails.id, ...descendantIds]);
    return annotationsForCurrentNovel.filter(ann => ann.tagIds.some(tid => relevantTagIdsSet.has(tid)));
  }, [globalFilterTagName, activeTagDetails, annotationsForCurrentNovel, currentUserTags, editorMode, includeChildTagsInReadMode]);


  return {
    activeTagId,
    currentSelection,
    selectedChapterId,
    currentUserTags,
    annotationsForCurrentNovel,
    currentChapterDetails,
    getTagById,
    handleNovelTextChange,
    handleChapterTextChange,
    handleDeleteChapter,
    handleRenameChapter,
    handleCreateChapter,
    handleMergeChapterWithPrevious,
    handleMergeChapterRange,
    handleUpdateChapterLevel,
    handleSelectChapter,
    handleAddTag,
    handleImportTagTemplate,
    handleUpdateTagParent,
    handleUpdateTagColor,
    handleTextSelection,
    applyTagToSelection,
    selectTagForReadMode,
    activeTagDetails,
    annotationsToDisplayOrFilter,
    globalFilterTagName,
    handleTagGlobalSearch,
    includeChildTagsInReadMode,
    toggleIncludeChildTagsInReadMode,
    handleDeleteAnnotation,
    handleDeleteAnnotationsInSelection,
    handleCreatePendingAnnotation,
    handleBatchCreateAnnotations,
    // Storyline exports
    activeStorylineId,
    scrollToAnchorId,
    setScrollToAnchorId,
    handleSelectStoryline,
    handleAddStoryline,
    handleUpdateStoryline,
    handleDeleteStoryline,
    handleAddPlotAnchor,
    handleUpdatePlotAnchor,
    handleDeletePlotAnchor,
  };
};

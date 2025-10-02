// FIX: Import Dispatch and SetStateAction to resolve React namespace errors.
import { useState, useEffect, useCallback, useMemo, Dispatch, SetStateAction } from 'react';
import type { Novel, Tag, Annotation, SelectionDetails, Chapter, User, Storyline, PlotAnchor } from '../../../types';
import { generateId, getAllAncestorTagIds, getAllDescendantTagIds, splitTextIntoChapters, PENDING_ANNOTATION_TAG_NAME } from '../../../utils';
import type { EditorMode } from '../NovelEditorPage';
import { annotationsApi, tagsApi } from '../../../api';

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
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [globalFilterTagName, setGlobalFilterTagNameInternal] = useState<string | null>(null);

  // Storyline state
  const [activeStorylineId, setActiveStorylineId] = useState<string | null>(null);
  const [scrollToAnchorId, setScrollToAnchorId] = useState<string | null>(null);


  // Tags are global to the user, not specific to the novel.
  // This list represents all tags available to the current user.
  const currentUserTags = useMemo(
    () => allUserTags.filter(t => t.userId === currentUser.id),
    [allUserTags, currentUser.id]
  );
  
  const pendingTag = useMemo(() => 
    currentUserTags.find(t => t.name === PENDING_ANNOTATION_TAG_NAME),
    [currentUserTags]
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


  const updateFullNovelTextAndAlignAnnotations = useCallback((newFullText: string, selectionHint?: { originalTitle: string; originalStartIndex: number }) => {
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
    
  }, [allUserAnnotations, novel.id, currentUser.id, setAllUserAnnotations, setNovels]);
  
  const handleNovelTextChange = (text: string) => {
    updateFullNovelTextAndAlignAnnotations(text);
  };
  
  const handleChapterTextChange = (chapterId: string, newContent: string) => {
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
    };

    // 先更新本地状态,提供即时反馈
    setAllUserTags(prevTags => [...prevTags, tempTag]);

    // 然后保存到后端
    try {
      const savedTag = await tagsApi.create({
        name: name.trim(),
        color,
        parentId,
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

  const handleUpdateTagParent = async (tagId: string, newParentId: string | null) => {
    // 先更新本地状态
    setAllUserTags(prevGlobalTags => {
      const userTagsBeforeUpdate = prevGlobalTags.filter(
        t => t.userId === currentUser.id
      );

      const updatedGlobalTags = prevGlobalTags.map(tag =>
        (tag.id === tagId && tag.userId === currentUser.id)
          ? { ...tag, parentId: newParentId }
          : tag
      );

      const userTagsAfterUpdate = updatedGlobalTags.filter(
        t => t.userId === currentUser.id
      );

      setAllUserAnnotations(prevGlobalAnnotations => {
        return prevGlobalAnnotations.map(ann => {
          if (ann.novelId !== novel.id || ann.userId !== currentUser.id) {
            return ann;
          }

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

          return { ...ann, tagIds: finalTagIds };
        });
      });

      return updatedGlobalTags;
    });

    // 然后保存到后端
    try {
      await tagsApi.update(tagId, { parentId: newParentId });
    } catch (error) {
      console.error('更新标签层级到后端失败:', error);
      alert('更新标签层级失败,请稍后重试');
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
    if (editorMode !== 'annotation') {
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
            // Create new annotations in backend
            for (const annotation of newAnnotations) {
                await annotationsApi.create({
                    text: annotation.text,
                    startIndex: annotation.startIndex,
                    endIndex: annotation.endIndex,
                    novelId: annotation.novelId,
                    tagIds: annotation.tagIds,
                    isPotentiallyMisaligned: annotation.isPotentiallyMisaligned,
                });
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
    // 全局搜索时清空章节选择是合理的,因为要显示全文搜索结果
    setSelectedChapterId(null);
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

  // --- Storyline Handlers ---

  const handleSelectStoryline = (storylineId: string | null) => {
    setActiveStorylineId(storylineId);
    setScrollToAnchorId(null);
  };

  const handleAddStoryline = (name: string, color: string, parentId: string | null) => {
    const newStoryline: Storyline = { id: generateId(), name, color, parentId };
    setNovels(novels => novels.map(n => 
      n.id === novel.id 
        ? { ...n, storylines: [...(n.storylines || []), newStoryline] } 
        : n
    ));
  };
  
  const handleUpdateStoryline = (storylineId: string, updates: Partial<Storyline>) => {
    setNovels(novels => novels.map(n => 
      n.id === novel.id 
        ? { ...n, storylines: (n.storylines || []).map(s => s.id === storylineId ? { ...s, ...updates } : s) }
        : n
    ));
  };

  const handleDeleteStoryline = (storylineId: string) => {
    setNovels(novels => novels.map(n => {
      if (n.id !== novel.id) return n;
      
      const currentStorylines = n.storylines || [];
      const storylineToDelete = currentStorylines.find(s => s.id === storylineId);
      if (!storylineToDelete) return n;

      const newParentId = storylineToDelete.parentId;

      let updatedStorylines = currentStorylines
        .filter(s => s.id !== storylineId) // Remove the storyline
        .map(s => {
          if (s.parentId === storylineId) { // Find children
            return { ...s, parentId: newParentId }; // Re-parent them
          }
          return s;
        });

      const updatedPlotAnchors = (n.plotAnchors || []).map(anchor => ({
        ...anchor,
        storylineIds: anchor.storylineIds.filter(id => id !== storylineId)
      })).filter(anchor => anchor.storylineIds.length > 0);

      return { ...n, storylines: updatedStorylines, plotAnchors: updatedPlotAnchors };
    }));
  };
  
  const handleAddPlotAnchor = (description: string, position: number, storylineIds: string[]) => {
    const newAnchor: PlotAnchor = { id: generateId(), description, position, storylineIds };
    setNovels(novels => novels.map(n => 
      n.id === novel.id 
        ? { ...n, plotAnchors: [...(n.plotAnchors || []), newAnchor] } 
        : n
    ));
  };

  const handleUpdatePlotAnchor = (anchorId: string, updates: Partial<PlotAnchor>) => {
    setNovels(novels => novels.map(n => 
      n.id === novel.id 
        ? { ...n, plotAnchors: (n.plotAnchors || []).map(a => a.id === anchorId ? { ...a, ...updates } : a) }
        : n
    ));
  };
  
  const handleDeletePlotAnchor = (anchorId: string) => {
    setNovels(novels => novels.map(n => 
      n.id === novel.id 
        ? { ...n, plotAnchors: (n.plotAnchors || []).filter(a => a.id !== anchorId) } 
        : n
    ));
  };


  const activeTagDetails = useMemo(
    () => activeTagId ? getTagById(activeTagId) : null,
    [activeTagId, getTagById]
  );

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
    
    const relevantTagIdsSet = new Set([
      activeTagDetails.id,
      ...getAllDescendantTagIds(activeTagDetails.id, currentUserTags)
    ]);
    return annotationsForCurrentNovel.filter(ann => ann.tagIds.some(tid => relevantTagIdsSet.has(tid)));
  }, [globalFilterTagName, activeTagDetails, annotationsForCurrentNovel, currentUserTags]);


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
    handleSelectChapter,
    handleAddTag,
    handleUpdateTagParent,
    handleUpdateTagColor,
    handleTextSelection,
    applyTagToSelection,
    selectTagForReadMode,
    activeTagDetails,
    annotationsToDisplayOrFilter,
    globalFilterTagName, 
    handleTagGlobalSearch, 
    handleDeleteAnnotation,
    handleCreatePendingAnnotation,
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
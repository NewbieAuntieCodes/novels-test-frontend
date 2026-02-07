import { useCallback, useEffect, useMemo, useState, Dispatch, SetStateAction } from 'react';
import type { Chapter, Novel, Tag, User } from '../../../types';
import { generateId, getAllDescendantTagIds } from '../../../utils';
import { novelsApi } from '../../../api';
import { termCompatApi } from '../../../api/termCompat';

interface UseNoteWorkspaceStateProps {
  novel: Novel;
  allUserTags: Tag[];
  setNovels: Dispatch<SetStateAction<Novel[]>>;
  setAllUserTags: Dispatch<SetStateAction<Tag[]>>;
  currentUser: User;
}

const extractPlainTextFromHtml = (html: string) => {
  try {
    if (typeof document === 'undefined') return html;
    const div = document.createElement('div');
    div.innerHTML = html;
    return (div.innerText || div.textContent || '').replace(/\r\n|\r/g, '\n');
  } catch (e) {
    console.warn('[笔记工作区] 提取纯文本失败，回退为原始字符串', e);
    return html;
  }
};

export const useNoteWorkspaceState = ({
  novel,
  allUserTags,
  setNovels,
  setAllUserTags,
  currentUser,
}: UseNoteWorkspaceStateProps) => {
  const noteChapters = novel.noteChapters || [];

  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(() => {
    if (noteChapters.length > 0) return noteChapters[0].id;
    return null;
  });

  useEffect(() => {
    if (!noteChapters.length) {
      if (selectedChapterId) setSelectedChapterId(null);
      return;
    }
    if (!selectedChapterId || !noteChapters.some(ch => ch.id === selectedChapterId)) {
      setSelectedChapterId(noteChapters[0].id);
    }
  }, [noteChapters, selectedChapterId]);

  const selectedChapter = useMemo(() => {
    if (!selectedChapterId) return null;
    return noteChapters.find(ch => ch.id === selectedChapterId) || null;
  }, [noteChapters, selectedChapterId]);

  const persistNoteChapters = useCallback(async (updated: Chapter[]) => {
    setNovels(prev => prev.map(n => (n.id === novel.id ? { ...n, noteChapters: updated } : n)));
    try {
      await novelsApi.updateFromCache(novel, { noteChapters: updated });
    } catch (error) {
      console.error('[笔记工作区] 保存章节失败:', error);
      alert('保存失败，请重试');
    }
  }, [novel, setNovels]);

  const handleSelectChapter = (id: string | null) => {
    setSelectedChapterId(id);
  };

  const handleCreateChapter = async () => {
    const title = `新章节 ${noteChapters.length + 1}`;
    const newChapter: Chapter = {
      id: generateId(),
      title,
      content: '',
      htmlContent: '',
      originalStartIndex: 0,
      originalEndIndex: 0,
      level: 5,
    };

    const selectedIndex = selectedChapterId ? noteChapters.findIndex(ch => ch.id === selectedChapterId) : -1;
    const insertIndex = selectedIndex >= 0 ? selectedIndex : noteChapters.length;

    const updated = [
      ...noteChapters.slice(0, insertIndex),
      newChapter,
      ...noteChapters.slice(insertIndex),
    ];
    await persistNoteChapters(updated);
    setSelectedChapterId(newChapter.id);
  };

  const handleDeleteChapter = async (chapterId: string) => {
    const updated = noteChapters.filter(ch => ch.id !== chapterId);
    await persistNoteChapters(updated);
    if (selectedChapterId === chapterId) {
      setSelectedChapterId(updated[0]?.id ?? null);
    }
  };

  const handleRenameChapter = async (chapterId: string, newTitle: string) => {
    const updated = noteChapters.map(ch => (ch.id === chapterId ? { ...ch, title: newTitle } : ch));
    await persistNoteChapters(updated);
  };

  const handleUpdateChapterLevel = async (chapterId: string, newLevel: number) => {
    const updated = noteChapters.map(ch => (ch.id === chapterId ? { ...ch, level: newLevel } : ch));
    await persistNoteChapters(updated);
  };

  const handleSaveChapterHtml = async (chapterId: string, html: string) => {
    const plain = extractPlainTextFromHtml(html);
    const updated = noteChapters.map(ch =>
      ch.id === chapterId ? { ...ch, htmlContent: html, content: plain } : ch
    );
    await persistNoteChapters(updated);
  };

  const currentUserTerms = useMemo(
    () => allUserTags.filter(t =>
      t.userId === currentUser.id &&
      t.novelId === novel.id &&
      (t.placementType ?? 'tag') === 'term'
    ),
    [allUserTags, currentUser.id, novel.id]
  );

  const [activeTermId, setActiveTermId] = useState<string | null>(null);

  const handleAddTerm = async (name: string, color: string, parentId: string | null) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const saved = await termCompatApi.create({
        name: trimmed,
        color,
        parentId,
        novelId: novel.id,
      });
      setAllUserTags(prev => [...prev, saved]);
      setActiveTermId(saved.id);
    } catch (error) {
      console.error('创建词条失败:', error);
      alert('创建词条失败，请稍后重试');
    }
  };

  const handleUpdateTermParent = async (termId: string, newParentId: string | null) => {
    setAllUserTags(prev => prev.map(t =>
      t.id === termId ? { ...t, parentId: newParentId } : t
    ));
    try {
      await termCompatApi.update(termId, { parentId: newParentId });
    } catch (error) {
      console.error('更新词条层级失败:', error);
      alert('更新词条层级失败，请稍后重试');
    }
  };

  const handleUpdateTermColor = async (termId: string, newColor: string) => {
    setAllUserTags(prev => prev.map(t =>
      t.id === termId ? { ...t, color: newColor } : t
    ));
    try {
      await termCompatApi.update(termId, { color: newColor });
    } catch (error) {
      console.error('更新词条颜色失败:', error);
      alert('更新词条颜色失败，请稍后重试');
    }
  };

  const handleUpdateTermName = async (termId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setAllUserTags(prev => prev.map(t =>
      t.id === termId ? { ...t, name: trimmed } : t
    ));
    try {
      await termCompatApi.update(termId, { name: trimmed });
    } catch (error) {
      console.error('更新词条名称失败:', error);
      alert('更新词条名称失败，请稍后重试');
    }
  };

  const handleDeleteTerm = async (termId: string) => {
    const termIdsToDelete = [termId, ...getAllDescendantTagIds(termId, currentUserTerms)];
    setAllUserTags(prev => prev.filter(t => !termIdsToDelete.includes(t.id)));
    if (activeTermId && termIdsToDelete.includes(activeTermId)) {
      setActiveTermId(null);
    }
    try {
      await Promise.all(termIdsToDelete.map(id => termCompatApi.delete(id)));
    } catch (error) {
      console.error('删除词条失败:', error);
      alert('删除词条失败，请稍后重试');
    }
  };

  const handleSelectTerm = (termId: string | null) => {
    setActiveTermId(termId);
  };

  return {
    // chapters
    noteChapters,
    selectedChapterId,
    selectedChapter,
    handleSelectChapter,
    handleCreateChapter,
    handleDeleteChapter,
    handleRenameChapter,
    handleUpdateChapterLevel,
    handleSaveChapterHtml,
    // terms
    currentUserTerms,
    activeTermId,
    handleSelectTerm,
    handleAddTerm,
    handleUpdateTermParent,
    handleUpdateTermColor,
    handleUpdateTermName,
    handleDeleteTerm,
  };
};

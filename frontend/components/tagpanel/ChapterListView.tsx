import React, { useState, useMemo, useEffect, useRef } from 'react';
import styled from '@emotion/styled';
import type { Chapter } from "../types";
import { COLORS, SPACING, FONTS, globalPlaceholderTextStyles, BORDERS } from '../../styles';
import { buildChapterTree, flattenChapterTree, getChapterLevel, type FlattenedChapter } from '../../utils/chapterHierarchy';

interface ChapterListViewProps {
  chapters: Chapter[];
  selectedChapterId: string | null;
  onSelectChapter: (id: string | null) => void;
  onCreateChapter?: () => void;
  onMergeChapterWithPrevious?: (chapterId: string) => void;
  onMergeChapterRange?: (chapterIds: string[]) => void;
  onDeleteChapter: (chapterId: string) => void;
  onRenameChapter: (chapterId: string, newTitle: string) => void;
  onUpdateChapterLevel?: (chapterId: string, newLevel: number) => void;
}

const CHAPTERS_PER_PAGE = 100;
const LEVEL_COLORS = {
  1: '#e74c3c', // H1 红色
  2: '#3498db', // H2 蓝色
  3: '#2ecc71', // H3 绿色
  4: '#f39c12', // H4 橙色
  5: '#95a5a6', // H5 灰色
};

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${SPACING.sm};
  margin-bottom: ${SPACING.lg};
`;

const Title = styled.h2`
  font-size: ${FONTS.sizeH3};
  color: ${COLORS.dark};
  margin: 0;
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${SPACING.sm};
`;

const CreateButton = styled.button`
  padding: ${SPACING.xs} ${SPACING.sm};
  font-size: ${FONTS.sizeSmall};
  background-color: ${COLORS.primary};
  color: ${COLORS.white};
  border: none;
  border-radius: ${BORDERS.radius};
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: ${COLORS.primaryHover};
  }
`;

const MergeButton = styled.button<{ disabled?: boolean }>`
  padding: ${SPACING.xs} ${SPACING.sm};
  font-size: ${FONTS.sizeSmall};
  background-color: ${props => (props.disabled ? COLORS.gray200 : COLORS.secondary)};
  color: ${props => (props.disabled ? COLORS.textLight : COLORS.white)};
  border: none;
  border-radius: ${BORDERS.radius};
  cursor: ${props => (props.disabled ? 'not-allowed' : 'pointer')};
  transition: background-color 0.2s;

  &:hover {
    background-color: ${props => (props.disabled ? COLORS.gray200 : COLORS.secondaryHover)};
  }
`;

const PaginationContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${SPACING.sm};
  margin-bottom: ${SPACING.md};
  padding: ${SPACING.xs} 0;
`;

const PaginationInfo = styled.span`
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.textLight};
`;

const PaginationButtons = styled.div`
  display: flex;
  gap: ${SPACING.xs};
`;

const PageButton = styled.button<{ disabled?: boolean }>`
  padding: ${SPACING.xs} ${SPACING.sm};
  font-size: ${FONTS.sizeSmall};
  background-color: ${props => props.disabled ? COLORS.gray200 : COLORS.primary};
  color: ${props => props.disabled ? COLORS.textLight : COLORS.white};
  border: none;
  border-radius: ${BORDERS.radius};
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  transition: background-color 0.2s;
  pointer-events: ${props => props.disabled ? 'none' : 'auto'};

  &:hover {
    background-color: ${props => props.disabled ? COLORS.gray200 : COLORS.primaryHover};
  }
`;

const BottomPaginationContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${SPACING.sm};
  padding: ${SPACING.sm} 0 0;
  flex-shrink: 0;
`;

const PageNumberGroup = styled.div`
  display: flex;
  align-items: center;
  gap: ${SPACING.xs};
`;

const PageNumberButton = styled.button<{ isActive: boolean }>`
  padding: ${SPACING.xs} ${SPACING.sm};
  border-radius: ${BORDERS.radius};
  border: 1px solid ${props => (props.isActive ? COLORS.primary : COLORS.gray300)};
  background-color: ${props => (props.isActive ? COLORS.primary : COLORS.gray200)};
  color: ${props => (props.isActive ? COLORS.white : COLORS.text)};
  cursor: pointer;
  font-size: ${FONTS.sizeSmall};
  min-width: 32px;
  transition: background-color 0.2s, border-color 0.2s;

  &:hover:not(:disabled) {
    background-color: ${props => (props.isActive ? COLORS.primaryHover : COLORS.gray100)};
    border-color: ${props => (props.isActive ? COLORS.primaryHover : COLORS.gray400)};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const PageEllipsis = styled.span`
  padding: 0 ${SPACING.xs};
  color: ${COLORS.textLight};
  font-size: ${FONTS.sizeSmall};
  user-select: none;
`;

const List = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  flex-grow: 1;
  overflow-y: auto;
`;

const ListItem = styled.li<{ isActive: boolean; depth: number }>`
  padding: ${SPACING.sm};
  padding-left: ${props => `calc(${SPACING.sm} + ${props.depth * 20}px)`};
  margin-bottom: ${SPACING.xs};
  border-radius: ${FONTS.sizeSmall};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${SPACING.sm};
  transition: background-color 0.1s, border-color 0.1s, color 0.1s;
  border: 1px solid ${props => (props.isActive ? COLORS.primary : COLORS.borderLight)};
  background-color: ${props => (props.isActive ? COLORS.highlightBackground : 'transparent')};
  color: ${props => (props.isActive ? COLORS.primary : COLORS.text)};
  font-weight: ${props => (props.isActive ? 'bold' : 'normal')};

  &:hover {
    background-color: ${props => (props.isActive ? COLORS.highlightBackground : COLORS.gray100)};
    border-color: ${props => (props.isActive ? COLORS.primary : COLORS.gray400)};
  }
`;

const ChapterTitleContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${SPACING.xs};
  flex-grow: 1;
  min-width: 0;
`;

const ExpandIcon = styled.span<{ hasChildren: boolean; isExpanded: boolean }>`
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: ${props => props.hasChildren ? 'pointer' : 'default'};
  user-select: none;
  color: ${props => props.hasChildren ? COLORS.primary : 'transparent'};
  font-size: 12px;
  transition: transform 0.2s;
  transform: ${props => props.isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'};

  &:hover {
    color: ${props => props.hasChildren ? COLORS.primaryHover : 'transparent'};
  }
`;

const LevelBadge = styled.span<{ level: number }>`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 20px;
  font-size: 11px;
  font-weight: bold;
  border-radius: 4px;
  background-color: ${props => LEVEL_COLORS[props.level as keyof typeof LEVEL_COLORS] || LEVEL_COLORS[5]};
  color: white;
  cursor: pointer;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.8;
  }
`;

const ChapterTitle = styled.span`
  cursor: pointer;
  flex-grow: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
`;

const ChapterActions = styled.div`
  display: flex;
  gap: ${SPACING.xs};
  align-items: center;
  flex-shrink: 0;
`;

const ActionButton = styled.button<{ variant?: 'edit' | 'delete' }>`
  background: none;
  border: none;
  cursor: pointer;
  padding: ${SPACING.xs};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${props => props.variant === 'delete' ? COLORS.danger : COLORS.primary};
  transition: opacity 0.2s;
  font-size: ${FONTS.sizeLarge};

  &:hover {
    opacity: 0.7;
  }
`;

const Placeholder = styled.p(globalPlaceholderTextStyles);

const LevelMenu = styled.div`
  position: absolute;
  background: white;
  border: 1px solid ${COLORS.gray300};
  border-radius: ${BORDERS.radius};
  box-shadow: ${COLORS.gray400} 0px 2px 8px;
  padding: ${SPACING.xs};
  z-index: 1000;
  min-width: 80px;
`;

const LevelMenuItem = styled.button<{ isSelected: boolean }>`
  display: block;
  width: 100%;
  padding: ${SPACING.xs} ${SPACING.sm};
  text-align: left;
  border: none;
  background: ${props => props.isSelected ? COLORS.highlightBackground : 'transparent'};
  color: ${props => props.isSelected ? COLORS.primary : COLORS.text};
  cursor: pointer;
  font-size: ${FONTS.sizeSmall};
  border-radius: 4px;
  transition: background-color 0.2s;

  &:hover {
    background-color: ${COLORS.gray100};
  }
`;

const ChapterListView: React.FC<ChapterListViewProps> = ({
  chapters, selectedChapterId, onSelectChapter, onCreateChapter, onMergeChapterWithPrevious, onMergeChapterRange, onDeleteChapter, onRenameChapter, onUpdateChapterLevel
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [expandedChapterIds, setExpandedChapterIds] = useState<Set<string>>(new Set());
  const [levelMenuChapterId, setLevelMenuChapterId] = useState<string | null>(null);
  const [levelMenuPosition, setLevelMenuPosition] = useState({ x: 0, y: 0 });

  const [selectedChapterIds, setSelectedChapterIds] = useState<Set<string>>(new Set());
  const selectionAnchorIdRef = useRef<string | null>(null);

  // 从 localStorage 恢复展开状态
  useEffect(() => {
    const stored = localStorage.getItem('chapterExpandedState');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setExpandedChapterIds(new Set(parsed));
      } catch (e) {
        console.error('Failed to parse stored chapter expanded state', e);
      }
    }
  }, []);

  // 保存展开状态到 localStorage
  useEffect(() => {
    localStorage.setItem('chapterExpandedState', JSON.stringify([...expandedChapterIds]));
  }, [expandedChapterIds]);

  // 构建树结构
  const chapterTree = useMemo(() => buildChapterTree(chapters), [chapters]);

  // 扁平化树结构，用于展示（考虑折叠状态）
  const flattenedChapters = useMemo(() => {
    const result: FlattenedChapter[] = [];

    const traverse = (nodes: ReturnType<typeof buildChapterTree>, depth: number = 0) => {
      nodes.forEach(node => {
        result.push({
          chapter: node.chapter,
          depth,
          hasChildren: node.children.length > 0,
          parent: node.parent?.chapter || null,
        });

        // 如果展开了，则递归添加子节点
        if (expandedChapterIds.has(node.chapter.id) && node.children.length > 0) {
          traverse(node.children, depth + 1);
        }
      });
    };

    traverse(chapterTree);
    return result;
  }, [chapterTree, expandedChapterIds]);

  const flattenedChapterIds = useMemo(() => flattenedChapters.map(item => item.chapter.id), [flattenedChapters]);

  // 总页数
  const totalPages = Math.ceil(flattenedChapters.length / CHAPTERS_PER_PAGE);

  useEffect(() => {
    if (totalPages <= 1) {
      if (currentPage !== 1) setCurrentPage(1);
      return;
    }
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  const selectedIdsInListOrder = useMemo(() => {
    if (selectedChapterIds.size === 0) return [];
    return flattenedChapterIds.filter(id => selectedChapterIds.has(id));
  }, [flattenedChapterIds, selectedChapterIds]);

  const mergeMode = useMemo<'none' | 'range' | 'previous'>(() => {
    if (selectedIdsInListOrder.length >= 2) return 'range';
    if (selectedIdsInListOrder.length === 1) return 'previous';
    return 'none';
  }, [selectedIdsInListOrder.length]);

  const canMergeRange = useMemo(() => {
    if (!onMergeChapterRange) return false;
    if (selectedIdsInListOrder.length < 2) return false;

    // Safety: ensure selection is a contiguous range in the visible list.
    const indices = selectedIdsInListOrder
      .map(id => flattenedChapterIds.indexOf(id))
      .filter(i => i >= 0);

    if (indices.length !== selectedIdsInListOrder.length) return false;
    const min = Math.min(...indices);
    const max = Math.max(...indices);
    return (max - min + 1) === selectedIdsInListOrder.length;
  }, [onMergeChapterRange, selectedIdsInListOrder, flattenedChapterIds]);

  const canMergeWithPrevious = useMemo(() => {
    if (!onMergeChapterWithPrevious) return false;
    if (selectedIdsInListOrder.length !== 1) return false;
    const id = selectedIdsInListOrder[0];
    const idx = chapters.findIndex(ch => ch.id === id);
    return idx > 0;
  }, [onMergeChapterWithPrevious, selectedIdsInListOrder, chapters]);

  const canMerge = mergeMode === 'range' ? canMergeRange : canMergeWithPrevious;

  // 当前页的章节
  const currentChapters = useMemo(() => {
    const startIndex = (currentPage - 1) * CHAPTERS_PER_PAGE;
    const endIndex = startIndex + CHAPTERS_PER_PAGE;
    return flattenedChapters.slice(startIndex, endIndex);
  }, [flattenedChapters, currentPage]);

  // 当选中的章节变化时，自动跳转到对应页
  useEffect(() => {
    if (selectedChapterId) {
      const selectedIndex = flattenedChapters.findIndex(ch => ch.chapter.id === selectedChapterId);
      if (selectedIndex !== -1) {
        const targetPage = Math.floor(selectedIndex / CHAPTERS_PER_PAGE) + 1;
        setCurrentPage(targetPage);
      }
    }
  }, [selectedChapterId, flattenedChapters]);

  // Keep the local multi-selection in sync with the externally-controlled active chapter.
  useEffect(() => {
    if (!selectedChapterId) {
      if (selectedChapterIds.size !== 0) setSelectedChapterIds(new Set());
      selectionAnchorIdRef.current = null;
      return;
    }

    setSelectedChapterIds(prev => {
      // If the active chapter is already part of a multi-selection, keep it.
      if (prev.has(selectedChapterId)) return prev;
      return new Set([selectedChapterId]);
    });

    if (!selectionAnchorIdRef.current) {
      selectionAnchorIdRef.current = selectedChapterId;
    }
  }, [selectedChapterId, selectedChapterIds.size]);

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  const handleSelectChapterFromList = (chapterId: string, e: React.MouseEvent | React.KeyboardEvent) => {
    const isShift = 'shiftKey' in e ? Boolean(e.shiftKey) : false;

    if (isShift && selectionAnchorIdRef.current) {
      const anchorId = selectionAnchorIdRef.current;
      const anchorIndex = flattenedChapterIds.indexOf(anchorId);
      const targetIndex = flattenedChapterIds.indexOf(chapterId);

      if (anchorIndex !== -1 && targetIndex !== -1) {
        const start = Math.min(anchorIndex, targetIndex);
        const end = Math.max(anchorIndex, targetIndex);
        const range = flattenedChapterIds.slice(start, end + 1);
        setSelectedChapterIds(new Set(range));
      } else {
        setSelectedChapterIds(new Set([chapterId]));
        selectionAnchorIdRef.current = chapterId;
      }

      onSelectChapter(chapterId);
      return;
    }

    // Normal click: replace selection with the clicked item.
    // Keep existing single-select toggle behavior (clicking again clears selection).
    if (selectedChapterId === chapterId && selectedChapterIds.size === 1 && selectedChapterIds.has(chapterId)) {
      setSelectedChapterIds(new Set());
      selectionAnchorIdRef.current = null;
      onSelectChapter(null);
      return;
    }

    setSelectedChapterIds(new Set([chapterId]));
    selectionAnchorIdRef.current = chapterId;
    onSelectChapter(chapterId);
  };

  const pageItems = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => ({ type: 'page' as const, page: i + 1 }));

    const items: Array<{ type: 'page'; page: number } | { type: 'ellipsis'; id: string }> = [];
    const addPage = (page: number) => items.push({ type: 'page', page });
    const addEllipsis = (id: string) => items.push({ type: 'ellipsis', id });

    addPage(1);

    if (currentPage <= 4) {
      for (let p = 2; p <= 5; p += 1) addPage(p);
      addEllipsis('right');
    } else if (currentPage >= totalPages - 3) {
      addEllipsis('left');
      for (let p = totalPages - 4; p <= totalPages - 1; p += 1) addPage(p);
    } else {
      addEllipsis('left');
      for (let p = currentPage - 1; p <= currentPage + 1; p += 1) addPage(p);
      addEllipsis('right');
    }

    addPage(totalPages);
    return items;
  }, [totalPages, currentPage]);

  const handleToggleExpand = (chapterId: string) => {
    setExpandedChapterIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(chapterId)) {
        newSet.delete(chapterId);
      } else {
        newSet.add(chapterId);
      }
      return newSet;
    });
  };

  const handleStartEdit = (chapter: Chapter) => {
    setEditingChapterId(chapter.id);
    setEditingTitle(chapter.title);
  };

  const handleSaveEdit = () => {
    if (editingChapterId && editingTitle.trim()) {
      onRenameChapter(editingChapterId, editingTitle.trim());
      setEditingChapterId(null);
      setEditingTitle('');
    }
  };

  const handleCancelEdit = () => {
    setEditingChapterId(null);
    setEditingTitle('');
  };

  const handleDelete = (chapter: Chapter) => {
    if (window.confirm(`确定要删除章节"${chapter.title}"吗？`)) {
      onDeleteChapter(chapter.id);
    }
  };

  const handleOpenLevelMenu = (chapterId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setLevelMenuPosition({ x: rect.left, y: rect.bottom + 5 });
    setLevelMenuChapterId(chapterId);
  };

  const handleCloseLevelMenu = () => {
    setLevelMenuChapterId(null);
  };

  const handleSelectLevel = (chapterId: string, newLevel: number) => {
    if (onUpdateChapterLevel) {
      onUpdateChapterLevel(chapterId, newLevel);
    }
    handleCloseLevelMenu();
  };

  // 点击外部关闭菜单
  useEffect(() => {
    if (levelMenuChapterId) {
      const handler = () => handleCloseLevelMenu();
      document.addEventListener('click', handler);
      return () => document.removeEventListener('click', handler);
    }
  }, [levelMenuChapterId]);

  const renderChapters = (): React.ReactElement[] => {
    return currentChapters.map(({ chapter, depth, hasChildren }) => {
      const isSelected = selectedChapterIds.has(chapter.id);
      const isEditing = editingChapterId === chapter.id;
      const isExpanded = expandedChapterIds.has(chapter.id);
      const level = getChapterLevel(chapter);

      return (
        <ListItem
          key={chapter.id}
          isActive={isSelected}
          depth={depth}
        >
          {isEditing ? (
            <>
              <input
                type="text"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit();
                  if (e.key === 'Escape') handleCancelEdit();
                }}
                autoFocus
                style={{
                  flexGrow: 1,
                  padding: '4px 8px',
                  border: `1px solid ${COLORS.primary}`,
                  borderRadius: '4px',
                  fontSize: FONTS.sizeBase,
                }}
              />
              <ChapterActions>
                <ActionButton
                  variant="edit"
                  onClick={handleSaveEdit}
                  title="保存"
                >
                  ✓
                </ActionButton>
                <ActionButton
                  variant="delete"
                  onClick={handleCancelEdit}
                  title="取消"
                >
                  ✕
                </ActionButton>
              </ChapterActions>
            </>
          ) : (
            <>
              <ChapterTitleContainer>
                <ExpandIcon
                  hasChildren={hasChildren}
                  isExpanded={isExpanded}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (hasChildren) handleToggleExpand(chapter.id);
                  }}
                >
                  {hasChildren ? '▶' : ''}
                </ExpandIcon>
                <LevelBadge
                  level={level}
                  onClick={(e) => handleOpenLevelMenu(chapter.id, e)}
                  title={`当前级别: H${level}，点击修改`}
                >
                  H{level}
                </LevelBadge>
                <ChapterTitle
                  onClick={(e) => handleSelectChapterFromList(chapter.id, e)}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectChapterFromList(chapter.id, e); }}
                  title={chapter.title}
                >
                  {chapter.title}
                </ChapterTitle>
              </ChapterTitleContainer>
              <ChapterActions>
                <ActionButton
                  variant="edit"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartEdit(chapter);
                  }}
                  title="重命名章节"
                >
                  ✏️
                </ActionButton>
                <ActionButton
                  variant="delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(chapter);
                  }}
                  title="删除章节"
                >
                  ✕
                </ActionButton>
              </ChapterActions>
            </>
          )}
        </ListItem>
      );
    });
  };

  return (
    <>
      <HeaderRow>
        <Title>章节列表</Title>
        <HeaderActions>
          {(onMergeChapterWithPrevious || onMergeChapterRange) && (
            <MergeButton
              type="button"
              disabled={!canMerge}
              title={
                mergeMode === 'range'
                  ? (canMergeRange ? `合并选中范围（${selectedIdsInListOrder.length}章）` : '请选择一个连续范围（至少2章）后合并')
                  : (canMergeWithPrevious ? '合并到上一章' : '请选择非第一章的章节后合并')
              }
              onClick={() => {
                if (!canMerge) return;

                if (mergeMode === 'range') {
                  if (!onMergeChapterRange || !canMergeRange) return;
                  const topId = selectedIdsInListOrder[0];
                  const topTitle = chapters.find(ch => ch.id === topId)?.title || '（未命名章节）';
                  if (!window.confirm(`确定要合并选中的 ${selectedIdsInListOrder.length} 章为 1 章吗？\\n\\n保留章节：${topTitle}\\n合并内容会包含中间每一章的“标题行 + 正文”。`)) {
                    return;
                  }
                  onMergeChapterRange(selectedIdsInListOrder);
                  return;
                }

                const id = selectedIdsInListOrder[0] ?? null;
                if (!id) return;
                if (!onMergeChapterWithPrevious) return;
                if (!window.confirm('确定要将当前章节合并到上一章吗？\\n\\n合并后：上一章内容会追加“当前章节标题 + 当前章节正文”，当前章节将从列表中移除。')) {
                  return;
                }
                onMergeChapterWithPrevious(id);
              }}
            >
              合并
            </MergeButton>
          )}
          {onCreateChapter && (
            <CreateButton onClick={onCreateChapter} type="button">
              新建章节
            </CreateButton>
          )}
        </HeaderActions>
      </HeaderRow>
      {(chapters && chapters.length > 0) ? (
        <>
          {totalPages > 1 && (
            <PaginationContainer>
              <PaginationInfo>
                第 {currentPage}/{totalPages} 页 (共 {chapters.length} 章)
              </PaginationInfo>
              <PaginationButtons>
                <PageButton onClick={handlePrevPage} disabled={currentPage === 1}>
                  上一页
                </PageButton>
                <PageButton onClick={handleNextPage} disabled={currentPage === totalPages}>
                  下一页
                </PageButton>
              </PaginationButtons>
            </PaginationContainer>
          )}
          <List role="listbox" aria-label="小说章节">
            {renderChapters()}
          </List>
          {totalPages > 1 && (
            <BottomPaginationContainer aria-label="章节分页导航">
              <PageButton onClick={handlePrevPage} disabled={currentPage === 1}>
                &lt; 上一页
              </PageButton>
              <PageNumberGroup>
                {pageItems.map((item) => {
                  if (item.type === 'ellipsis') {
                    return <PageEllipsis key={item.id}>…</PageEllipsis>;
                  }
                  const isActive = item.page === currentPage;
                  return (
                    <PageNumberButton
                      key={item.page}
                      isActive={isActive}
                      type="button"
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => setCurrentPage(item.page)}
                    >
                      {item.page}
                    </PageNumberButton>
                  );
                })}
              </PageNumberGroup>
              <PageButton onClick={handleNextPage} disabled={currentPage === totalPages}>
                下一页 &gt;
              </PageButton>
            </BottomPaginationContainer>
          )}
        </>
      ) : (
        <Placeholder>
          {onCreateChapter
            ? '暂无章节。点击“新建章节”开始。'
            : '当前小说未分章或无章节。请先在内容面板进行“自动分章”。'}
        </Placeholder>
      )}

      {/* 级别选择菜单 */}
      {levelMenuChapterId && (
        <LevelMenu
          style={{
            position: 'fixed',
            left: `${levelMenuPosition.x}px`,
            top: `${levelMenuPosition.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {[1, 2, 3, 4, 5].map(level => {
            const chapter = chapters.find(ch => ch.id === levelMenuChapterId);
            const currentLevel = chapter ? getChapterLevel(chapter) : 5;
            return (
              <LevelMenuItem
                key={level}
                isSelected={level === currentLevel}
                onClick={() => handleSelectLevel(levelMenuChapterId, level)}
              >
                H{level}
              </LevelMenuItem>
            );
          })}
        </LevelMenu>
      )}
    </>
  );
};

export default ChapterListView;

import React, { useMemo, useRef, useState } from 'react';
import styled from '@emotion/styled';
import type { Annotation, Novel, Tag } from '../../types';
import { COLORS, SPACING, FONTS, SHADOWS, BORDERS, globalPlaceholderTextStyles } from '../../styles';
import { getContrastingTextColor } from '../../utils';
import type { EditorMode } from '../editor/NovelEditorPage';

interface SnippetContentProps {
  novel: Novel;
  editorMode: EditorMode;
  annotations: Annotation[];
  allNovelTags: Tag[];
  activeFilterTagDetails: Tag | null;
  globalFilterTagName?: string | null;
  includeChildTagsInReadMode: boolean;
  tagDepthCache: Map<string, number>;
  tagHierarchyCache: Map<string, Set<string>>;
  onSelectChapter?: (chapterId: string | null) => void;
  onLocateToText?: (chapterId: string, absoluteIndex: number) => void;
  onDeleteAnnotation?: (annotationId: string) => void;
  onBatchCreateAnnotations?: (
    tagId: string,
    textSegments: Array<{ text: string; startIndex: number; endIndex: number }>
  ) => void;
  getTagById: (id: string) => Tag | undefined;
}

const SnippetContainer = styled.div<{
  isMisaligned?: boolean;
  bgColor?: string;
  isDragOver?: boolean;
  isSelected?: boolean;
}>`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.xs};
  margin-bottom: ${SPACING.md};
  position: relative;
  padding: ${SPACING.md};
  border: 2px solid ${props => {
    if (props.isSelected) return COLORS.primary;
    if (props.isDragOver) return COLORS.primary;
    if (props.isMisaligned) return COLORS.warning;
    return 'rgba(0,0,0,0.1)';
  }};
  border-radius: ${BORDERS.radius};
  background-color: ${props => {
    if (props.isSelected) return `${COLORS.primary}15`;
    if (props.isDragOver) return `${COLORS.primary}10`;
    if (props.isMisaligned) return `${COLORS.warning}20`;
    return props.bgColor || COLORS.white;
  }};
  box-shadow: ${props => {
    if (props.isSelected) return `0 0 12px ${COLORS.primary}60`;
    if (props.isDragOver) return `0 0 8px ${COLORS.primary}40`;
    return SHADOWS.small;
  }};
  transition: border-color 0.2s, background-color 0.2s, box-shadow 0.2s;
  cursor: ${props => (props.isDragOver ? 'copy' : 'pointer')};
`;

const SnippetParagraph = styled.p`
  flex-grow: 1;
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  line-height: 1.6;
  padding-right: calc(${SPACING.lg} + 96px); /* Make space for action buttons */
`;

const LocateSnippetButton = styled.button<{ effectiveColor?: string }>`
  background-color: transparent;
  color: ${props => props.effectiveColor || COLORS.text};
  padding: 0 ${SPACING.xs};
  font-size: ${FONTS.sizeSmall};
  line-height: 1;
  border-radius: 10px;
  height: 24px;
  min-width: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: none;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.2s, opacity 0.2s;
  opacity: 0.75;

  &:hover {
    opacity: 1;
    background-color: rgba(0, 0, 0, 0.1);
  }
`;

const DeleteSnippetButton = styled.button<{ effectiveColor?: string }>`
  position: absolute;
  top: ${SPACING.sm};
  right: ${SPACING.sm};
  background-color: transparent;
  color: ${props => props.effectiveColor || COLORS.danger};
  padding: 0 ${SPACING.xs};
  font-size: 1.2em;
  line-height: 1;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  min-width: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s, opacity 0.2s;
  opacity: 0.7;

  &:hover {
    opacity: 1;
    background-color: rgba(0, 0, 0, 0.1);
  }
`;

const SnippetActions = styled.div`
  position: absolute;
  top: ${SPACING.sm};
  right: calc(${SPACING.sm} + 24px + ${SPACING.xs});
  display: flex;
  align-items: center;
  gap: ${SPACING.xs};
`;

const SnippetChapterBadge = styled.span<{ effectiveColor?: string }>`
  height: 20px;
  min-width: 20px;
  padding: 0 ${SPACING.xs};
  border-radius: 10px;
  font-size: ${FONTS.sizeSmall};
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.12);
  color: ${props => props.effectiveColor || COLORS.text};
  opacity: 0.85;
  user-select: none;
`;

const SnippetSourceNovel = styled.p<{ effectiveColor?: string }>`
  font-size: ${FONTS.sizeSmall};
  color: ${props => props.effectiveColor || COLORS.textLighter};
  opacity: 0.8;
  margin: 0;
  font-style: italic;
`;

const Placeholder = styled.p(globalPlaceholderTextStyles);

const SelectionInfoBar = styled.div`
  position: sticky;
  top: 0;
  z-index: 10;
  background-color: ${COLORS.primary};
  color: ${COLORS.white};
  padding: ${SPACING.sm} ${SPACING.md};
  margin-bottom: ${SPACING.md};
  border-radius: ${BORDERS.radius};
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: ${SHADOWS.small};
`;

const SelectionInfoText = styled.span`
  font-size: ${FONTS.sizeSmall};
  font-weight: 600;
`;

const ClearSelectionButton = styled.button`
  background-color: transparent;
  border: 1px solid ${COLORS.white};
  color: ${COLORS.white};
  padding: ${SPACING.xs} ${SPACING.sm};
  border-radius: ${BORDERS.radius};
  cursor: pointer;
  font-size: ${FONTS.sizeSmall};
  transition: background-color 0.2s;

  &:hover {
    background-color: rgba(255, 255, 255, 0.2);
  }
`;

const BatchDeleteButton = styled.button`
  background-color: ${COLORS.danger};
  border: none;
  color: ${COLORS.white};
  padding: ${SPACING.xs} ${SPACING.sm};
  border-radius: ${BORDERS.radius};
  cursor: pointer;
  font-size: ${FONTS.sizeSmall};
  transition: background-color 0.2s, opacity 0.2s;
  display: flex;
  align-items: center;
  gap: ${SPACING.xs};
  margin-right: ${SPACING.sm};

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    background-color: ${COLORS.dangerHover};
  }
`;

const SnippetContent: React.FC<SnippetContentProps> = ({
  novel,
  editorMode,
  annotations,
  allNovelTags,
  activeFilterTagDetails,
  globalFilterTagName,
  includeChildTagsInReadMode,
  tagDepthCache,
  tagHierarchyCache,
  onSelectChapter,
  onLocateToText,
  onDeleteAnnotation,
  onBatchCreateAnnotations,
  getTagById,
}) => {
  const [dragOverSnippetId, setDragOverSnippetId] = useState<string | null>(null);
  const [selectedSnippetIds, setSelectedSnippetIds] = useState<Set<string>>(new Set());
  const [lastSelectedSnippetId, setLastSelectedSnippetId] = useState<string | null>(null);

  const snippetsDataRef = useRef<Array<{
    id: string;
    annotationIds: string[];
    segments: Array<{ text: string; startIndex: number; endIndex: number }>;
    startIndex: number;
    endIndex: number;
  }>>([]);

  const sortedChapters = useMemo(() => {
    return [...(novel.chapters || [])].sort((a, b) => a.originalStartIndex - b.originalStartIndex);
  }, [novel.chapters]);

  const content = useMemo(() => {
    if (editorMode === 'storyline') return null;

    type SnippetItem = {
      id: string;
      text: string;
      tags: Tag[];
      originalAnnotationId: string;
      annotationIds: string[];
      segments: Array<{ text: string; startIndex: number; endIndex: number }>;
      isPotentiallyMisaligned?: boolean;
      sourceNovelId?: string;
      sourceNovelTitle?: string;
      startIndex: number;
      endIndex: number;
    };

    const mergeContiguousSnippets = (items: SnippetItem[]): SnippetItem[] => {
      if (items.length <= 1) return items;

      const result: SnippetItem[] = [];

      for (const item of items) {
        const last = result[result.length - 1];
        if (!last) {
          result.push(item);
          continue;
        }

        const overlaps = item.startIndex <= last.endIndex;
        const canUseNovelTextForGap =
          Boolean(novel.text) &&
          item.startIndex >= 0 &&
          last.endIndex >= 0 &&
          item.startIndex <= novel.text.length &&
          last.endIndex <= novel.text.length;

        const gapIsWhitespace =
          !overlaps &&
          canUseNovelTextForGap &&
          novel.text.slice(last.endIndex, item.startIndex).trim() === '';

        if (!overlaps && !gapIsWhitespace) {
          result.push(item);
          continue;
        }

        const mergedStartIndex = Math.min(last.startIndex, item.startIndex);
        const mergedEndIndex = Math.max(last.endIndex, item.endIndex);

        const mergedTagMap = new Map<string, Tag>();
        last.tags.forEach(t => mergedTagMap.set(t.id, t));
        item.tags.forEach(t => mergedTagMap.set(t.id, t));

        const mergedAnnotationIds = Array.from(new Set([...last.annotationIds, ...item.annotationIds]));
        const mergedSegments = [...last.segments, ...item.segments].sort((a, b) => a.startIndex - b.startIndex);

        const mergedText =
          Boolean(novel.text) &&
          mergedStartIndex >= 0 &&
          mergedEndIndex >= mergedStartIndex &&
          mergedEndIndex <= novel.text.length
            ? novel.text.slice(mergedStartIndex, mergedEndIndex)
            : [last.text, item.text].filter(Boolean).join('\n');

        result[result.length - 1] = {
          ...last,
          startIndex: mergedStartIndex,
          endIndex: mergedEndIndex,
          text: mergedText,
          tags: Array.from(mergedTagMap.values()),
          annotationIds: mergedAnnotationIds,
          segments: mergedSegments,
          isPotentiallyMisaligned: Boolean(last.isPotentiallyMisaligned || item.isPotentiallyMisaligned),
        };
      }

      return result;
    };

    let snippets: SnippetItem[] = [];

    if (globalFilterTagName) {
      const lowerGlobalFilterTagName = globalFilterTagName.toLowerCase();
      const matchingGlobalTagIds = allNovelTags
        .filter(t => t.name.toLowerCase() === lowerGlobalFilterTagName)
        .map(t => t.id);
      if (matchingGlobalTagIds.length === 0) return <Placeholder>全局搜索: 未找到 "{globalFilterTagName}" 标签。</Placeholder>;

      snippets = annotations
        .filter(ann => ann.tagIds.some(tid => matchingGlobalTagIds.includes(tid)))
        .sort((a, b) => a.startIndex - b.startIndex)
        .map(ann => ({
          id: ann.id,
          text: ann.text,
          tags: ann.tagIds.map(tid => allNovelTags.find(t => t.id === tid)).filter(Boolean) as Tag[],
          originalAnnotationId: ann.id,
          annotationIds: [ann.id],
          segments: [{ text: ann.text, startIndex: ann.startIndex, endIndex: ann.endIndex }],
          isPotentiallyMisaligned: ann.isPotentiallyMisaligned,
          sourceNovelId: ann.novelId,
          // ✅ 阅读模式下在单本小说内搜索，不显示来源小说（因为就是当前小说）
          sourceNovelTitle: undefined,
          startIndex: ann.startIndex,
          endIndex: ann.endIndex,
        }));
      snippets = mergeContiguousSnippets(snippets);
      if (snippets.length === 0) return <Placeholder>在 "{novel.title}" 中未找到与 "{globalFilterTagName}" 相关的标注。</Placeholder>;
    } else if (activeFilterTagDetails) {
      const descendants = tagHierarchyCache.get(activeFilterTagDetails.id) || new Set<string>();
      const tagAndDescendantIds = new Set([activeFilterTagDetails.id, ...descendants]);

      snippets = annotations
        .filter(ann => {
          if (includeChildTagsInReadMode) {
            return ann.tagIds.some(tid => tagAndDescendantIds.has(tid));
          }

          return (
            ann.tagIds.includes(activeFilterTagDetails.id) &&
            !ann.tagIds.some(tid => descendants.has(tid))
          );
        })
        .sort((a, b) => a.startIndex - b.startIndex)
        .map(ann => ({
          id: ann.id,
          text: ann.text,
          tags: ann.tagIds.map(tid => allNovelTags.find(t => t.id === tid)).filter(Boolean) as Tag[],
          originalAnnotationId: ann.id,
          annotationIds: [ann.id],
          segments: [{ text: ann.text, startIndex: ann.startIndex, endIndex: ann.endIndex }],
          isPotentiallyMisaligned: ann.isPotentiallyMisaligned,
          sourceNovelId: ann.novelId,
          // ✅ 阅读模式下在单本小说内搜索，不显示来源小说（因为就是当前小说）
          sourceNovelTitle: undefined,
          startIndex: ann.startIndex,
          endIndex: ann.endIndex,
        }));
      snippets = mergeContiguousSnippets(snippets);
      if (snippets.length === 0) {
        return (
          <Placeholder>
            标签 "{activeFilterTagDetails.name}"
            {includeChildTagsInReadMode ? ' (含子标签)' : ''}
            在当前小说中无标注。
          </Placeholder>
        );
      }
    } else {
      return <Placeholder>阅读模式下请选择标签或全局搜索以查看片段。</Placeholder>;
    }

    // ✅ 保存 snippets 数据到 ref，供事件处理器使用
    snippetsDataRef.current = snippets.map(s => ({
      id: s.id,
      annotationIds: s.annotationIds,
      segments: s.segments,
      startIndex: s.startIndex,
      endIndex: s.endIndex,
    }));

    const getChapterInfoForIndex = (absoluteIndex: number): {
      chapterId: string;
      chapterNumber: number;
      chapterTitle: string;
      chapterStartIndex: number;
    } | null => {
      if (!sortedChapters.length) return null;

      let left = 0;
      let right = sortedChapters.length - 1;
      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const chapter = sortedChapters[mid];
        if (absoluteIndex < chapter.originalStartIndex) {
          right = mid - 1;
        } else if (absoluteIndex >= chapter.originalEndIndex) {
          left = mid + 1;
        } else {
          return {
            chapterId: chapter.id,
            chapterNumber: mid + 1,
            chapterTitle: chapter.title,
            chapterStartIndex: chapter.originalStartIndex,
          };
        }
      }

      return null;
    };

    return (
      <React.Fragment>
        {selectedSnippetIds.size > 0 && (
          <SelectionInfoBar>
            <SelectionInfoText>
              已选中 {selectedSnippetIds.size} 个标注片段{' '}
              {selectedSnippetIds.size > 1 && '（拖动标签到任意选中片段上即可批量添加标签）'}
            </SelectionInfoText>
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
              {onDeleteAnnotation && (
                <BatchDeleteButton
                  onClick={() => {
                    if (window.confirm(`确定删除选中的 ${selectedSnippetIds.size} 个标注吗？`)) {
                      const annotationIds = Array.from(
                        new Set(
                          Array.from(selectedSnippetIds).flatMap(snippetId => {
                            const snippet = snippetsDataRef.current.find(s => s.id === snippetId);
                            return snippet?.annotationIds ?? [];
                          })
                        )
                      );

                      annotationIds.forEach(id => onDeleteAnnotation(id));

                      // 清空选择
                      setSelectedSnippetIds(new Set());
                      setLastSelectedSnippetId(null);
                    }
                  }}
                  disabled={selectedSnippetIds.size === 0}
                  title={`删除选中的 ${selectedSnippetIds.size} 个标注`}
                >
                  🗑️ 删除
                </BatchDeleteButton>
              )}
              <ClearSelectionButton
                onClick={() => {
                  setSelectedSnippetIds(new Set());
                  setLastSelectedSnippetId(null);
                }}
              >
                清空选择
              </ClearSelectionButton>
            </div>
          </SelectionInfoBar>
        )}
        {snippets.map(snippet => {
          let primaryTagForSnippetColor: Tag | null = null;
          if (snippet.tags.length > 0) {
            // FIX: This logic was rewritten to be more robust and ensure the type remains `Tag | null`.
            // It correctly selects the deepest tag, sorting by name as a tie-breaker.
            let deepestLevel = -1;
            let candidateTags: Tag[] = [];

            for (const tag of snippet.tags) {
              const depth = tagDepthCache.get(tag.id) ?? 0;
              if (depth > deepestLevel) {
                deepestLevel = depth;
                candidateTags = [tag];
              } else if (depth === deepestLevel) {
                candidateTags.push(tag);
              }
            }

            primaryTagForSnippetColor =
              candidateTags.length > 0
                ? [...candidateTags].sort((a, b) => a.name.localeCompare(b.name))[0]
                : null;
          }
          const bgColor = primaryTagForSnippetColor ? primaryTagForSnippetColor.color : COLORS.white;
          const textColor = primaryTagForSnippetColor ? getContrastingTextColor(bgColor) : COLORS.text;
          const chapterInfo = getChapterInfoForIndex(snippet.startIndex);

          return (
            <SnippetContainer
              key={snippet.id}
              isMisaligned={snippet.isPotentiallyMisaligned}
              title={snippet.isPotentiallyMisaligned ? '此标注可能已错位' : undefined}
              bgColor={bgColor}
              isDragOver={dragOverSnippetId === snippet.id}
              isSelected={selectedSnippetIds.has(snippet.id)}
              data-annotation-id={snippet.originalAnnotationId}
              data-start-index={snippet.startIndex}
              data-end-index={snippet.endIndex}
              onClick={(e) => {
                if (editorMode !== 'read') return;
                e.stopPropagation();

                // Ctrl + Shift + Click 实现范围选择
                if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
                  if (lastSelectedSnippetId) {
                    // 找到上次选择的 snippet 在列表中的索引
                    const currentIndex = snippets.findIndex(s => s.id === snippet.id);
                    const lastIndex = snippets.findIndex(s => s.id === lastSelectedSnippetId);

                    if (currentIndex !== -1 && lastIndex !== -1) {
                      const start = Math.min(currentIndex, lastIndex);
                      const end = Math.max(currentIndex, lastIndex);
                      const rangeIds = snippets.slice(start, end + 1).map(s => s.id);

                      setSelectedSnippetIds(prev => {
                        const newSet = new Set(prev);
                        rangeIds.forEach(id => newSet.add(id));
                        return newSet;
                      });
                    }
                  } else {
                    // 如果没有上一次选中项，从第一项到当前项
                    const currentIndex = snippets.findIndex(s => s.id === snippet.id);
                    if (currentIndex !== -1) {
                      const rangeIds = snippets.slice(0, currentIndex + 1).map(s => s.id);
                      setSelectedSnippetIds(new Set(rangeIds));
                    }
                  }
                  setLastSelectedSnippetId(snippet.id);
                }
                // Ctrl/Cmd + Click 实现多选
                else if (e.ctrlKey || e.metaKey) {
                  setSelectedSnippetIds(prev => {
                    const newSet = new Set(prev);
                    if (newSet.has(snippet.id)) {
                      newSet.delete(snippet.id);
                    } else {
                      newSet.add(snippet.id);
                    }
                    return newSet;
                  });
                  setLastSelectedSnippetId(snippet.id);
                } else {
                  // 单击切换单选
                  setSelectedSnippetIds(prev => {
                    if (prev.size === 1 && prev.has(snippet.id)) {
                      return new Set(); // 取消选择
                    }
                    return new Set([snippet.id]); // 选择这一个
                  });
                  setLastSelectedSnippetId(snippet.id);
                }
              }}
              onDragOver={(e) => {
                if (editorMode === 'read' && onBatchCreateAnnotations) {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOverSnippetId(snippet.id);
                }
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOverSnippetId(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOverSnippetId(null);

                if (editorMode !== 'read' || !onBatchCreateAnnotations) return;

                const tagId = e.dataTransfer.getData('text/plain');
                if (!tagId) return;

                const tag = getTagById(tagId);
                if (!tag) {
                  alert('标签不存在');
                  return;
                }

                // ✅ 检查是否有多个选中的 snippet
                const targetSnippetIds =
                  selectedSnippetIds.size > 0 ? Array.from(selectedSnippetIds) : [snippet.id];

                console.log('[snippet 拖放] 为多个 snippet 添加标签:', {
                  targetSnippetIds,
                  tagName: tag.name,
                  count: targetSnippetIds.length,
                });

                // ✅ 从 ref 中查找所有目标片段的数据
                const textSegments = targetSnippetIds.flatMap(id => {
                  const foundSnippet = snippetsDataRef.current.find(s => s.id === id);
                  return foundSnippet?.segments ?? [];
                });

                if (textSegments.length === 0) {
                  alert('无法找到选中的片段数据');
                  return;
                }

                onBatchCreateAnnotations(tagId, textSegments);

                const snippetCountText =
                  textSegments.length > 1
                    ? `${textSegments.length} 个标注`
                    : `标注「${textSegments[0].text.substring(0, 20)}...」`;
                alert(`已为${snippetCountText}添加标签「${tag.name}」`);

                // 清空选择
                setSelectedSnippetIds(new Set());
              }}
            >
              {snippet.sourceNovelTitle && (
                <SnippetSourceNovel effectiveColor={textColor}>
                  来自: {snippet.sourceNovelTitle}
                </SnippetSourceNovel>
              )}
              <SnippetActions>
                {chapterInfo && (
                  <SnippetChapterBadge
                    effectiveColor={textColor}
                    title={`第${chapterInfo.chapterNumber}章：${chapterInfo.chapterTitle}`}
                    aria-label={`章节：第${chapterInfo.chapterNumber}章`}
                  >
                    {chapterInfo.chapterNumber}
                  </SnippetChapterBadge>
                )}
                {editorMode === 'read' && chapterInfo && (
                  <LocateSnippetButton
                    effectiveColor={textColor}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onLocateToText) {
                        onLocateToText(chapterInfo.chapterId, snippet.startIndex);
                        return;
                      }
                      onSelectChapter?.(chapterInfo.chapterId);
                    }}
                    aria-label={`定位到章节: ${chapterInfo.chapterTitle}`}
                    title="定位到正文"
                  >
                    定位
                  </LocateSnippetButton>
                )}
              </SnippetActions>
              <SnippetParagraph style={{ color: textColor }}>{snippet.text}</SnippetParagraph>
              {onDeleteAnnotation && (
                <DeleteSnippetButton
                  effectiveColor={textColor}
                  onClick={(e) => {
                    e.stopPropagation();
                    const count = snippet.annotationIds.length;
                    const message = count > 1 ? `确定删除此片段中的 ${count} 个标注吗？` : '确定删除此标注吗？';
                    if (!window.confirm(message)) return;

                    snippet.annotationIds.forEach(id => onDeleteAnnotation(id));
                    setSelectedSnippetIds(prev => {
                      const next = new Set(prev);
                      next.delete(snippet.id);
                      return next;
                    });
                    setLastSelectedSnippetId(prev => (prev === snippet.id ? null : prev));
                  }}
                  aria-label={`删除标注: ${snippet.text.substring(0, 20)}...`}
                  title={
                    snippet.annotationIds.length > 1
                      ? `删除此片段内的 ${snippet.annotationIds.length} 个标注`
                      : '删除此标注'
                  }
                >
                  ✕
                </DeleteSnippetButton>
              )}
            </SnippetContainer>
          );
        })}
      </React.Fragment>
    );
  }, [
    editorMode,
    globalFilterTagName,
    activeFilterTagDetails,
    annotations,
    allNovelTags,
    tagDepthCache,
    tagHierarchyCache,
    novel.title,
    novel.text,
    onDeleteAnnotation,
    dragOverSnippetId,
    selectedSnippetIds,
    onBatchCreateAnnotations,
    getTagById,
    includeChildTagsInReadMode,
    sortedChapters,
    onSelectChapter,
    lastSelectedSnippetId,
    onLocateToText,
  ]);

  return <>{content}</>;
};

export default SnippetContent;


import React, { CSSProperties, useMemo } from 'react';
import styled from '@emotion/styled';
import type { Annotation, Tag } from '../types';
import { getContrastingTextColor, getAllAncestorTagIds } from '../utils';
import { COLORS, SPACING, FONTS, globalPlaceholderTextStyles, panelStyles } from "../styles";

interface FilterResultsPanelProps {
  annotations: Annotation[];
  getTagById: (id: string) => Tag | undefined;
  activeFilterTag: Tag | null | undefined;
  novelText?: string;
  style?: CSSProperties;
  globalFilterTagName?: string | null;
  includeDescendantTags?: boolean;
  onTagClick?: (tagId: string) => void;
  onTagDoubleClick?: (tagName: string) => void;
  allUserTags: Tag[];
  onDeleteAnnotation?: (annotationId: string) => void;
}

const panelTitleId = "filter-results-panel-title";

const Panel = styled.div({
  ...panelStyles,
  minWidth: '220px',
  backgroundColor: COLORS.gray100,
});

const TitleContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${SPACING.lg};
  flex-shrink: 0;
`;

const Title = styled.h2`
  font-size: ${FONTS.sizeH3};
  color: ${COLORS.dark};
  margin: 0;
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  flex: 1;
`;

const TitleClarification = styled.span`
  font-size: 0.7em;
  color: ${COLORS.textLight};
  font-weight: normal;
  margin-left: ${SPACING.xs};
`;

const TitleGlobalClarification = styled.span`
  font-size: 0.7em;
  color: ${COLORS.info};
  font-weight: bold;
  margin-left: ${SPACING.xs};
`;

const AnnotationList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  flex-grow: 1; 
  overflow-y: auto; 
`;

const CopyButton = styled.button`
  background-color: ${COLORS.primary};
  color: ${COLORS.white};
  padding: ${SPACING.xs} ${SPACING.md};
  font-size: ${FONTS.sizeSmall};
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  white-space: nowrap;
  margin-left: ${SPACING.md};
  flex-shrink: 0;

  &:hover {
    background-color: ${COLORS.primaryHover};
  }

  &:active {
    transform: scale(0.98);
  }
`;

const DeleteButton = styled.button`
  background-color: transparent;
  color: ${COLORS.danger};
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
  position: absolute;
  top: ${SPACING.sm};
  right: ${SPACING.sm};
  transition: background-color 0.2s, color 0.2s;

  &:hover {
    background-color: ${COLORS.danger}20;
    color: ${COLORS.dangerHover};
  }
`;

const AnnotationItem = styled.li`
  background-color: ${COLORS.white};
  border: 1px solid ${COLORS.gray300};
  padding: ${SPACING.md};
  margin-bottom: ${SPACING.sm};
  border-radius: ${FONTS.sizeSmall};
  box-shadow: 0 1px 3px rgba(0,0,0,0.03); 
  position: relative;
`;

const AnnotationText = styled.p`
  margin: 0 0 ${SPACING.sm} 0;
  padding-right: ${SPACING.lg}; /* Make space for delete button */
  font-style: italic;
  color: ${COLORS.textLight};
  word-wrap: break-word;
  overflow-wrap: break-word;
  white-space: pre-wrap;
  line-height: 1.5;
`;

const AnnotationTagsContainer = styled.div`
  font-size: ${FONTS.sizeSmall};
  line-height: 1.8;
  margin-top: ${SPACING.sm};
`;

const TagGroupRow = styled.div`
  margin-bottom: ${SPACING.xs};

  &:last-of-type {
    margin-bottom: 0;
  }
`;

const TagPill = styled.span`
  padding: ${SPACING.xs} ${SPACING.sm};
  border-radius: 3px;
  font-size: 0.9em; 
  margin: 2px ${SPACING.xs} 2px 0; 
  display: inline-block;
  white-space: nowrap;
  border: 1px solid rgba(0,0,0,0.1); 
  cursor: pointer;
  transition: opacity 0.2s, box-shadow 0.2s;

  &:hover {
    opacity: 0.8;
    box-shadow: 0 0 3px ${COLORS.primary}80;
  }
`;

const Placeholder = styled.div(globalPlaceholderTextStyles);

const FilterResultsPanel: React.FC<FilterResultsPanelProps> = ({
  annotations, getTagById, activeFilterTag, style, globalFilterTagName,
  includeDescendantTags = true,
  onTagClick, onTagDoubleClick, allUserTags, onDeleteAnnotation, novelText
}) => {

  // ✅ 缓存根节点映射和深度映射，避免每次渲染重复计算
  const { rootIdCache, depthCache } = useMemo(() => {
    const rootCache = new Map<string, string>();
    const depthCacheMap = new Map<string, number>();

    const getRootId = (tagId: string): string => {
      if (rootCache.has(tagId)) return rootCache.get(tagId)!;

      let currentTag = allUserTags.find(t => t.id === tagId);
      if (!currentTag) return tagId;

      const path: string[] = [tagId];
      while (currentTag.parentId) {
        const parent = allUserTags.find(t => t.id === currentTag.parentId);
        if (!parent) break;
        path.push(parent.id);
        currentTag = parent;
      }

      const rootId = currentTag.id;
      // 缓存路径上的所有节点
      path.forEach(id => rootCache.set(id, rootId));

      return rootId;
    };

    // 预计算所有标签的根节点和深度
    allUserTags.forEach(tag => {
      getRootId(tag.id);
      depthCacheMap.set(tag.id, getAllAncestorTagIds(tag.id, allUserTags).length);
    });

    return { rootIdCache: rootCache, depthCache: depthCacheMap };
  }, [allUserTags]);

  // 将连续的标注（中间只有空白/标点）合并为一个片段，避免“一句一句”太碎
  const groupedAnnotations = useMemo(() => {
    type GroupedAnnotation = {
      id: string;
      annotationIds: string[];
      startIndex: number;
      endIndex: number;
      tagIds: string[];
      text: string;
    };

    if (annotations.length === 0) return [] as GroupedAnnotation[];

    const text = novelText ?? '';
    const hasText = text.length > 0;
    const sorted = [...annotations].sort((a, b) => a.startIndex - b.startIndex);

    const groups: Array<{
      id: string;
      annotationIds: string[];
      startIndex: number;
      endIndex: number;
      tagIdsSet: Set<string>;
      fallbackTexts: string[];
    }> = [];

    const gapIsMergeable = (gap: string): boolean => {
      const trimmed = gap.trim();
      if (trimmed === '') return true;
      // 标点符号/符号（比如用户没把句号选进标注）也视为“连续”
      return /^[\p{P}\p{S}]+$/u.test(trimmed);
    };

    for (const ann of sorted) {
      const last = groups[groups.length - 1];

      const annStart = ann.startIndex;
      const annEnd = ann.endIndex;
      const annText = ann.text || '';

      if (!last) {
        groups.push({
          id: ann.id,
          annotationIds: [ann.id],
          startIndex: annStart,
          endIndex: annEnd,
          tagIdsSet: new Set(ann.tagIds),
          fallbackTexts: [annText],
        });
        continue;
      }

      const overlaps = annStart <= last.endIndex;
      const canSliceGap =
        hasText &&
        annStart >= last.endIndex &&
        annStart <= text.length &&
        last.endIndex <= text.length &&
        last.endIndex >= 0;

      const shouldMerge =
        overlaps ||
        (canSliceGap && gapIsMergeable(text.slice(last.endIndex, annStart))) ||
        (!canSliceGap && annStart - last.endIndex <= 5);

      if (!shouldMerge) {
        groups.push({
          id: ann.id,
          annotationIds: [ann.id],
          startIndex: annStart,
          endIndex: annEnd,
          tagIdsSet: new Set(ann.tagIds),
          fallbackTexts: [annText],
        });
        continue;
      }

      last.annotationIds.push(ann.id);
      last.startIndex = Math.min(last.startIndex, annStart);
      last.endIndex = Math.max(last.endIndex, annEnd);
      ann.tagIds.forEach(tid => last.tagIdsSet.add(tid));
      if (annText) last.fallbackTexts.push(annText);
    }

    return groups.map(g => {
      const canSliceGroup =
        hasText &&
        g.startIndex >= 0 &&
        g.endIndex >= g.startIndex &&
        g.endIndex <= text.length;

      const mergedText = canSliceGroup
        ? text.slice(g.startIndex, g.endIndex)
        : g.fallbackTexts.filter(Boolean).join('\n');

      return {
        id: g.id,
        annotationIds: g.annotationIds,
        startIndex: g.startIndex,
        endIndex: g.endIndex,
        tagIds: Array.from(g.tagIdsSet),
        text: mergedText || '[无文本内容]',
      };
    });
  }, [annotations, novelText]);

  const panelTitleContent = () => {
    if (globalFilterTagName) {
      return (
        <>
          "{globalFilterTagName}" 的所有标注
          <TitleGlobalClarification>(当前小说内)</TitleGlobalClarification>
        </>
      );
    }
    if (activeFilterTag) {
      return (
        <>
          "{activeFilterTag.name}" 的标注
          <TitleClarification>
            ({includeDescendantTags ? '及其子标签, ' : ''}当前小说内)
          </TitleClarification>
        </>
      );
    }
    return "当前小说所有标注";
  };

  const handleCopyAnnotations = () => {
    if (groupedAnnotations.length === 0) {
      alert('没有可复制的标注内容');
      return;
    }

    const textToCopy = groupedAnnotations
      .map(ann => ann.text || '[无文本内容]')
      .join('\n\n');

    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        alert('已复制所有标注文本到剪贴板！');
      })
      .catch(err => {
        console.error('复制失败:', err);
        alert('复制失败，请重试');
      });
  };

  return (
    <Panel
      style={style}
      role="region"
      aria-labelledby={panelTitleId}
    >
      <TitleContainer>
        <Title id={panelTitleId}>
          {panelTitleContent()}
        </Title>
        {groupedAnnotations.length > 0 && (
          <CopyButton
            onClick={handleCopyAnnotations}
            title="复制当前标签下的所有标注文本"
          >
            📋 复制
          </CopyButton>
        )}
      </TitleContainer>
      {annotations.length === 0 ? (
        <Placeholder> 
            {globalFilterTagName ? `当前小说内没有找到名为 "${globalFilterTagName}" 的标签的任何标注。` 
             : activeFilterTag ? '此标签在当前小说下没有标注。' 
             : '当前小说还没有任何标注。'}
        </Placeholder>
      ) : (
        <AnnotationList role="list">
          {groupedAnnotations.map(ann => {
            const tagsForAnnotation = ann.tagIds
              .map(id => getTagById(id))
              .filter((t): t is Tag => !!t);

            // ✅ 使用缓存的根节点映射
            const tagsByRoot = new Map<string, Tag[]>();
            tagsForAnnotation.forEach(tag => {
              const rootId = rootIdCache.get(tag.id) || tag.id;
              if (!tagsByRoot.has(rootId)) {
                tagsByRoot.set(rootId, []);
              }
              tagsByRoot.get(rootId)!.push(tag);
            });

            const tagGroups = Array.from(tagsByRoot.values());

            // ✅ 使用缓存的根节点映射进行排序
            tagGroups.sort((groupA, groupB) => {
              const rootIdA = rootIdCache.get(groupA[0].id) || groupA[0].id;
              const rootIdB = rootIdCache.get(groupB[0].id) || groupB[0].id;
              const rootA = allUserTags.find(t => t.id === rootIdA);
              const rootB = allUserTags.find(t => t.id === rootIdB);
              return (rootA?.name || '').localeCompare(rootB?.name || '');
            });

            return (
              <AnnotationItem key={ann.id} role="listitem">
                <AnnotationText>{ann.text || '[无文本内容]'}</AnnotationText>
                <AnnotationTagsContainer>
                  {tagGroups.map((group, index) => {
                    // ✅ 使用缓存的深度映射
                    const sortedGroup = group
                      .map(tag => ({
                        ...tag,
                        depth: depthCache.get(tag.id) || 0
                      }))
                      .sort((a, b) => {
                        if (a.depth !== b.depth) {
                          return a.depth - b.depth;
                        }
                        return a.name.localeCompare(b.name);
                      });

                    return (
                      <TagGroupRow key={index}>
                        {sortedGroup.map(t => (
                          <TagPill
                            key={t.id}
                            style={{
                              backgroundColor: t.color,
                              color: getContrastingTextColor(t.color),
                            }}
                            onClick={() => onTagClick && onTagClick(t.id)}
                            onDoubleClick={() => onTagDoubleClick && onTagDoubleClick(t.name)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && onTagClick) onTagClick(t.id);
                              else if (e.key === ' ' && onTagClick) { e.preventDefault(); onTagClick(t.id); }
                            }}
                            title={`单击: 筛选此标签 | 双击: 全局搜索 "${t.name}"`}
                          >
                            {t.name}
                          </TagPill>
                        ))}
                      </TagGroupRow>
                    );
                  })}
                </AnnotationTagsContainer>
                {onDeleteAnnotation && (
                  <DeleteButton
                    onClick={() => {
                      const count = ann.annotationIds.length;
                      const confirmMessage =
                        count > 1
                          ? `您确定要删除该片段中的 ${count} 个标注吗？`
                          : `您确定要删除标注 "${ann.text.substring(0, 30)}..." 吗？`;

                      if (!window.confirm(confirmMessage)) return;

                      ann.annotationIds.forEach(id => onDeleteAnnotation(id));
                    }}
                    aria-label={`删除标注: ${ann.text.substring(0, 20)}...`}
                    title={ann.annotationIds.length > 1 ? `删除此片段内的 ${ann.annotationIds.length} 个标注` : '删除此标注'}
                  >
                    ✕
                  </DeleteButton>
                )}
              </AnnotationItem>
            );
          })}
        </AnnotationList>
      )}
    </Panel>
  );
};

export default FilterResultsPanel;

import React, { CSSProperties } from 'react';
import styled from '@emotion/styled';
import type { Annotation, Tag } from '../types';
import { getContrastingTextColor, getAllAncestorTagIds } from '../utils'; 
import { COLORS, SPACING, FONTS, globalPlaceholderTextStyles, panelStyles } from "../styles";

interface FilterResultsPanelProps {
  annotations: Annotation[];
  getTagById: (id: string) => Tag | undefined;
  activeFilterTag: Tag | null | undefined;
  style?: CSSProperties;
  globalFilterTagName?: string | null;
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

const Title = styled.h2`
  font-size: ${FONTS.sizeH3};
  color: ${COLORS.dark};
  margin-bottom: ${SPACING.lg};
  display: flex;
  align-items: baseline; 
  flex-wrap: wrap;
  flex-shrink: 0;
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
  word-break: break-word;
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
  onTagClick, onTagDoubleClick, allUserTags, onDeleteAnnotation
}) => {
  
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
          <TitleClarification>(及其子标签, 当前小说内)</TitleClarification>
        </>
      );
    }
    return "当前小说所有标注";
  };

  return (
    <Panel 
      style={style} 
      role="region" 
      aria-labelledby={panelTitleId}
    >
      <Title id={panelTitleId}>
        {panelTitleContent()}
      </Title>
      {annotations.length === 0 ? (
        <Placeholder> 
            {globalFilterTagName ? `当前小说内没有找到名为 "${globalFilterTagName}" 的标签的任何标注。` 
             : activeFilterTag ? '此标签在当前小说下没有标注。' 
             : '当前小说还没有任何标注。'}
        </Placeholder>
      ) : (
        <AnnotationList role="list">
          {annotations.map(ann => {
            const tagsForAnnotation = ann.tagIds
              .map(id => getTagById(id))
              .filter((t): t is Tag => !!t);

            const getRootId = (tagId: string): string => {
              let currentTag = allUserTags.find(t => t.id === tagId);
              if (!currentTag) return tagId;
              while (currentTag.parentId) {
                const parent = allUserTags.find(t => t.id === currentTag.parentId);
                if (!parent) break;
                currentTag = parent;
              }
              return currentTag.id;
            };

            const tagsByRoot = new Map<string, Tag[]>();
            tagsForAnnotation.forEach(tag => {
              const rootId = getRootId(tag.id);
              if (!tagsByRoot.has(rootId)) {
                tagsByRoot.set(rootId, []);
              }
              tagsByRoot.get(rootId)!.push(tag);
            });

            const tagGroups = Array.from(tagsByRoot.values());

            tagGroups.sort((groupA, groupB) => {
              const rootA = allUserTags.find(t => t.id === getRootId(groupA[0].id));
              const rootB = allUserTags.find(t => t.id === getRootId(groupB[0].id));
              return (rootA?.name || '').localeCompare(rootB?.name || '');
            });

            return (
              <AnnotationItem key={ann.id} role="listitem">
                <AnnotationText>"{ann.text}"</AnnotationText>
                <AnnotationTagsContainer>
                  {tagGroups.map((group, index) => {
                    const sortedGroup = group
                      .map(tag => ({
                        ...tag,
                        depth: getAllAncestorTagIds(tag.id, allUserTags).length
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
                        if (window.confirm(`您确定要删除标注 "${ann.text.substring(0, 30)}..." 吗？`)) {
                            onDeleteAnnotation(ann.id);
                        }
                    }}
                    aria-label={`删除标注: ${ann.text.substring(0, 20)}...`}
                    title="删除此标注"
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
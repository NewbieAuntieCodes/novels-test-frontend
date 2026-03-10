import React, { useState, useEffect, useRef, useMemo } from 'react';
import styled from '@emotion/styled';
import type { PlotAnchor, Storyline } from "../types";
import { COLORS, SPACING, FONTS, panelStyles, globalPlaceholderTextStyles, BORDERS } from '../../styles';

interface StorylineTrackerPanelProps {
  plotAnchors: PlotAnchor[];
  storylines: Storyline[];
  activeStorylineId: string | null;
  onSelectAnchor: (anchorId: string) => void;
  onUpdateAnchor: (anchorId: string, updates: Partial<PlotAnchor>) => void;
  onDeleteAnchor: (anchorId: string) => void;
  style?: React.CSSProperties;
}

const PanelContainer = styled.div`
  ${panelStyles as any};
  background-color: ${COLORS.gray100};
`;

const Title = styled.h2`
  font-size: ${FONTS.sizeH3};
  color: ${COLORS.dark};
  margin-bottom: ${SPACING.lg};
  word-break: break-word;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${SPACING.sm};
`;

const TitleText = styled.span`
  min-width: 0;
  overflow-wrap: anywhere;
`;

const CopyTreeButton = styled.button`
  flex-shrink: 0;
  padding: ${SPACING.xs} ${SPACING.sm};
  border: 1px solid ${COLORS.gray300};
  border-radius: ${BORDERS.radius};
  background-color: ${COLORS.white};
  color: ${COLORS.text};
  font-size: ${FONTS.sizeSmall};
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s;

  &:hover:not(:disabled) {
    background-color: ${COLORS.gray100};
    border-color: ${COLORS.gray400};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const AnchorList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  flex-grow: 1;
  overflow-y: auto;
`;

const StorylineTreeSection = styled.div`
  margin-bottom: ${SPACING.md};
  padding: ${SPACING.sm};
  border: 1px solid ${COLORS.gray300};
  border-radius: ${BORDERS.radius};
  background-color: ${COLORS.white};
`;

const StorylineTreeTitle = styled.div`
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.textLight};
  margin-bottom: ${SPACING.xs};
`;

const StorylineTreeList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
`;

const StorylineTreeItem = styled.li`
  margin: ${SPACING.xs} 0 ${SPACING.sm} 0;
  color: ${COLORS.text};
  font-size: ${FONTS.sizeSmall};
`;

const StorylineTreeRow = styled.div<{ level: number }>`
  display: flex;
  align-items: center;
  gap: ${SPACING.xs};
  padding-left: ${props => props.level * 16}px;
  min-width: 0;

  &:hover .storyline-anchor-inline-delete {
    opacity: 1;
  }
`;

const StorylineTreeName = styled.span`
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
`;

const StorylineTreeNameButton = styled.button`
  flex: 1;
  min-width: 0;
  padding: 0;
  border: none;
  background: none;
  color: ${COLORS.primary};
  font-size: ${FONTS.sizeSmall};
  line-height: 1.5;
  text-align: left;
  cursor: pointer;
  white-space: pre-wrap;
  word-break: break-word;
  text-decoration: underline;
  text-underline-offset: 0.2em;
  text-decoration-thickness: 1px;
  transition: color 0.2s, text-decoration-thickness 0.2s;

  &:hover {
    color: ${COLORS.primaryHover};
    text-decoration-thickness: 2px;
  }
`;

const StorylineColorDot = styled.span`
  width: 10px;
  height: 10px;
  border-radius: 2px;
  flex-shrink: 0;
  border: 1px solid rgba(0, 0, 0, 0.1);
`;

const StorylineAnchorCount = styled.span`
  color: ${COLORS.textLight};
  font-size: ${FONTS.sizeSmall};
`;

const StorylineTreeActions = styled.div`
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: ${SPACING.xs};
  flex-shrink: 0;
`;

const StorylineExpandButton = styled.button`
  padding: 0;
  border: none;
  background: none;
  color: ${COLORS.textLight};
  font-size: ${FONTS.sizeSmall};
  line-height: 1.4;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 0.15em;

  &:hover {
    color: ${COLORS.text};
  }
`;

const StorylineAnchorLinks = styled.div<{ level: number }>`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.xs};
  margin-top: ${SPACING.xs};
  padding-left: ${props => props.level * 16 + 18}px;
`;

const StorylineAnchorLinkRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${SPACING.xs};
  min-width: 0;

  &:hover .storyline-anchor-inline-delete {
    opacity: 1;
  }
`;

const StorylineAnchorLinkButton = styled.button`
  flex: 1;
  min-width: 0;
  padding: 0;
  border: none;
  background: none;
  color: ${COLORS.primary};
  font-size: ${FONTS.sizeSmall};
  line-height: 1.5;
  text-align: left;
  cursor: pointer;
  white-space: pre-wrap;
  word-break: break-word;
  text-decoration: underline;
  text-underline-offset: 0.2em;
  text-decoration-thickness: 1px;
  transition: color 0.2s, text-decoration-thickness 0.2s;

  &:hover {
    color: ${COLORS.primaryHover};
    text-decoration-thickness: 2px;
  }
`;

const InlineDeleteButton = styled.button`
  flex-shrink: 0;
  padding: 0;
  border: none;
  background: none;
  color: ${COLORS.danger};
  cursor: pointer;
  font-size: ${FONTS.sizeSmall};
  line-height: 1.5;
  opacity: 0;
  transition: opacity 0.2s, color 0.2s;

  &:hover {
    color: ${COLORS.dangerHover};
  }
`;

const StorylineTreeHint = styled.div`
  margin-top: ${SPACING.sm};
  color: ${COLORS.textLighter};
  font-size: ${FONTS.sizeSmall};
  padding-left: ${SPACING.xs};
`;

const AnchorItem = styled.li`
  background-color: ${COLORS.white};
  border: 1px solid ${COLORS.gray300};
  padding: ${SPACING.lg};
  margin-bottom: ${SPACING.md};
  border-radius: ${BORDERS.radius};
  box-shadow: 0 1px 3px rgba(0,0,0,0.03);
  cursor: pointer;
  transition: box-shadow 0.2s, border-color 0.2s;
  border-left: 4px solid ${props => props.color || COLORS.gray300};
  position: relative;

  &:hover {
    box-shadow: 0 2px 6px rgba(0,0,0,0.08);
    border-color: ${COLORS.primary};
  }

  &:hover button {
    opacity: 1;
  }
`;

const AnchorDescription = styled.p`
  margin: 0;
  color: ${COLORS.text};
  word-break: break-word;
  line-height: 1.8;
  white-space: pre-wrap;
  font-size: ${FONTS.sizeBase};
`;

const EditingTextarea = styled.textarea`
  width: 100%;
  padding: ${SPACING.sm};
  border: 1px solid ${COLORS.primary};
  border-radius: ${BORDERS.radius};
  box-sizing: border-box;
  font-family: inherit;
  font-size: inherit;
  line-height: 1.5;
  resize: vertical;
  background-color: ${COLORS.white};
  color: ${COLORS.text};
  box-shadow: 0 0 0 2px ${COLORS.primary}40;
  outline: none;
`;

const Placeholder = styled.div(globalPlaceholderTextStyles);

const DeleteButton = styled.button`
  position: absolute;
  top: ${SPACING.sm};
  right: ${SPACING.sm};
  background: none;
  border: none;
  cursor: pointer;
  color: ${COLORS.danger};
  font-size: 16px;
  padding: ${SPACING.xs};
  opacity: 0;
  transition: opacity 0.2s;

  &:hover {
    color: ${COLORS.dangerHover};
  }
`;

const buildChildrenByParentId = (allStorylines: Storyline[]): Map<string | null, Storyline[]> => {
  const map = new Map<string | null, Storyline[]>();
  allStorylines.forEach((storyline) => {
    const key = storyline.parentId ?? null;
    const children = map.get(key) || [];
    children.push(storyline);
    map.set(key, children);
  });
  return map;
};

const collectDescendantStorylineIds = (
  storylineId: string,
  childrenByParentId: Map<string | null, Storyline[]>
): string[] => {
  const descendants: string[] = [];
  const queue: string[] = [storylineId];
  const visited = new Set<string>([storylineId]);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = childrenByParentId.get(currentId) || [];
    for (const child of children) {
      if (!visited.has(child.id)) {
        visited.add(child.id);
        descendants.push(child.id);
        queue.push(child.id);
      }
    }
  }

  return descendants;
};

const buildStorylineSubtree = (
  rootId: string,
  storylineById: Map<string, Storyline>,
  childrenByParentId: Map<string | null, Storyline[]>
): Array<{ storyline: Storyline; level: number }> => {
  const root = storylineById.get(rootId);
  if (!root) return [];

  const result: Array<{ storyline: Storyline; level: number }> = [];
  const walk = (node: Storyline, level: number) => {
    result.push({ storyline: node, level });
    const children = childrenByParentId.get(node.id) || [];
    children.forEach((child) => walk(child, level + 1));
  };

  walk(root, 0);
  return result;
};

const StorylineTrackerPanel: React.FC<StorylineTrackerPanelProps> = ({
  plotAnchors,
  storylines,
  activeStorylineId,
  onSelectAnchor,
  onUpdateAnchor,
  onDeleteAnchor,
  style,
}) => {
  const [editingAnchor, setEditingAnchor] = useState<{
    id: string;
    description: string;
    storylineId: string | null;
  } | null>(null);
  const [expandedStorylineId, setExpandedStorylineId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editingAnchor && textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.focus();
      const length = textarea.value.length;
      textarea.setSelectionRange(length, length);
    }
  }, [editingAnchor]);

  useEffect(() => {
    setExpandedStorylineId(null);
  }, [activeStorylineId]);

  const storylineById = useMemo(() => {
    return new Map(storylines.map((storyline) => [storyline.id, storyline] as const));
  }, [storylines]);

  const childrenByParentId = useMemo(() => buildChildrenByParentId(storylines), [storylines]);

  const activeStoryline = useMemo(() => {
    if (!activeStorylineId) return undefined;
    return storylineById.get(activeStorylineId);
  }, [activeStorylineId, storylineById]);

  const activeStorylineTree = useMemo(() => {
    if (!activeStorylineId) return [];
    return buildStorylineSubtree(activeStorylineId, storylineById, childrenByParentId);
  }, [activeStorylineId, storylineById, childrenByParentId]);

  const filteredStorylineIds = useMemo(() => {
    if (!activeStorylineId) return null;
    return new Set<string>([
      activeStorylineId,
      ...collectDescendantStorylineIds(activeStorylineId, childrenByParentId),
    ]);
  }, [activeStorylineId, childrenByParentId]);

  const filteredAnchors = useMemo(() => {
    const base = filteredStorylineIds
      ? plotAnchors.filter((anchor) => anchor.storylineIds.some((id) => filteredStorylineIds.has(id)))
      : plotAnchors;
    return [...base].sort((a, b) => a.position - b.position);
  }, [plotAnchors, filteredStorylineIds]);

  const anchorCountByStorylineId = useMemo(() => {
    const anchorCount = new Map<string, number>();

    if (activeStorylineTree.length === 0) {
      return anchorCount;
    }

    activeStorylineTree.forEach(({ storyline }) => anchorCount.set(storyline.id, 0));
    const sortedAnchors = [...plotAnchors].sort((a, b) => a.position - b.position);
    sortedAnchors.forEach((anchor) => {
      anchor.storylineIds.forEach((storylineId) => {
        if (anchorCount.has(storylineId)) {
          anchorCount.set(storylineId, (anchorCount.get(storylineId) || 0) + 1);
        }
      });
    });

    return anchorCount;
  }, [activeStorylineTree, plotAnchors]);

  const anchorById = useMemo(() => {
    return new Map(plotAnchors.map((anchor) => [anchor.id, anchor] as const));
  }, [plotAnchors]);

  const anchorsByStorylineId = useMemo(() => {
    const grouped = new Map<string, PlotAnchor[]>();

    activeStorylineTree.forEach(({ storyline }) => grouped.set(storyline.id, []));
    filteredAnchors.forEach((anchor) => {
      anchor.storylineIds.forEach((storylineId) => {
        const anchors = grouped.get(storylineId);
        if (anchors) {
          anchors.push(anchor);
        }
      });
    });

    return grouped;
  }, [activeStorylineTree, filteredAnchors]);

  const hasActiveStorylineTree = activeStorylineTree.length > 0;

  const handleStartEditing = (anchor: PlotAnchor, storylineId: string | null) => {
    setEditingAnchor({ id: anchor.id, description: anchor.description, storylineId });
  };

  const toggleExpandedStoryline = (storylineId: string) => {
    setExpandedStorylineId((current) => (current === storylineId ? null : storylineId));
  };

  const handleCommitEdit = () => {
    if (!editingAnchor) return;
    const originalAnchor = anchorById.get(editingAnchor.id);
    const trimmedDescription = editingAnchor.description.trim();

    if (originalAnchor && trimmedDescription && originalAnchor.description !== trimmedDescription) {
        onUpdateAnchor(editingAnchor.id, { description: trimmedDescription });
    }
    setEditingAnchor(null);
  };

  const handleCopyStorylineTree = async () => {
    if (activeStorylineTree.length === 0) {
      alert('当前没有可复制的剧情树。');
      return;
    }

    const titleLine = activeStoryline
      ? `剧情追踪器: ${activeStoryline.name}（含子剧情）`
      : '剧情追踪器';
    const treeLines = activeStorylineTree.map(({ storyline, level }) => {
      const indent = '  '.repeat(level);
      const anchorCount = anchorCountByStorylineId.get(storyline.id) || 0;
      return `${indent}${storyline.name}（锚点 ${anchorCount}）`;
    });
    const copyText = [titleLine, ...treeLines].join('\n');

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(copyText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = copyText;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      alert('剧情树已复制。');
    } catch (error) {
      console.error('复制剧情树失败:', error);
      alert('复制失败，请稍后重试。');
    }
  };

  return (
    <PanelContainer style={style}>
      <Title>
        <TitleText>
          剧情追踪器
          {activeStoryline ? `: ${activeStoryline.name}（含子剧情）` : ': 所有锚点'}
        </TitleText>
        <CopyTreeButton
          type="button"
          onClick={handleCopyStorylineTree}
          disabled={activeStorylineTree.length === 0}
          title={activeStorylineTree.length > 0 ? '复制当前显示的剧情树' : '当前无可复制的剧情树'}
        >
          复制剧情树
        </CopyTreeButton>
      </Title>
      {activeStorylineTree.length > 0 && (
        <StorylineTreeSection>
          <StorylineTreeTitle>当前剧情树</StorylineTreeTitle>
          <StorylineTreeList>
            {activeStorylineTree.map(({ storyline, level }) => {
              const storylineAnchors = anchorsByStorylineId.get(storyline.id) || [];
              const primaryAnchor = storylineAnchors[0];
              const isSingleAnchor = storylineAnchors.length === 1 && primaryAnchor;
              const isEditingSingleAnchor =
                Boolean(isSingleAnchor) &&
                editingAnchor?.id === primaryAnchor?.id &&
                editingAnchor.storylineId === storyline.id;
              const showExpandedAnchors =
                storylineAnchors.length > 1 &&
                (expandedStorylineId === storyline.id || editingAnchor?.storylineId === storyline.id);
              const anchorSummary = storylineAnchors
                .map((anchor, index) => `${index + 1}. ${anchor.description || '剧情锚点'}`)
                .join('\n');

              return (
                <StorylineTreeItem key={storyline.id}>
                  <StorylineTreeRow level={level}>
                    <StorylineColorDot style={{ backgroundColor: storyline.color }} />
                    {isEditingSingleAnchor ? (
                      <EditingTextarea
                        ref={textareaRef}
                        style={{ flex: 1, minWidth: 0 }}
                        value={editingAnchor.description}
                        onChange={e => setEditingAnchor({ ...editingAnchor, description: e.target.value })}
                        onBlur={handleCommitEdit}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleCommitEdit();
                          }
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            setEditingAnchor(null);
                          }
                        }}
                      />
                    ) : primaryAnchor ? (
                      <StorylineTreeNameButton
                        type="button"
                        onClick={() => onSelectAnchor(primaryAnchor.id)}
                        onDoubleClick={() => {
                          if (storylineAnchors.length === 1) {
                            handleStartEditing(primaryAnchor, storyline.id);
                            return;
                          }
                          toggleExpandedStoryline(storyline.id);
                        }}
                        title={
                          storylineAnchors.length === 1
                            ? `${primaryAnchor.description || '剧情锚点'} | 单击定位正文 | 双击编辑描述`
                            : `${anchorSummary}\n单击定位到第一个锚点 | 双击展开多个锚点`
                        }
                        aria-label={`${storyline.name} 的剧情锚点`}
                      >
                        {storyline.name}
                      </StorylineTreeNameButton>
                    ) : (
                      <StorylineTreeName>{storyline.name}</StorylineTreeName>
                    )}
                    <StorylineTreeActions>
                      <StorylineAnchorCount>
                        锚点 {anchorCountByStorylineId.get(storyline.id) || 0}
                      </StorylineAnchorCount>
                      {storylineAnchors.length === 1 && primaryAnchor && (
                        <InlineDeleteButton
                          type="button"
                          className="storyline-anchor-inline-delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`确定要删除剧情锚点 "${primaryAnchor.description}" 吗？`)) {
                              onDeleteAnchor(primaryAnchor.id);
                            }
                          }}
                          title="删除锚点"
                        >
                          ×
                        </InlineDeleteButton>
                      )}
                      {storylineAnchors.length > 1 && (
                        <StorylineExpandButton
                          type="button"
                          onClick={() => toggleExpandedStoryline(storyline.id)}
                          title={showExpandedAnchors ? '收起多个锚点' : '展开多个锚点'}
                        >
                          {showExpandedAnchors ? '收起' : '展开'}
                        </StorylineExpandButton>
                      )}
                    </StorylineTreeActions>
                  </StorylineTreeRow>
                  {showExpandedAnchors && (
                    <StorylineAnchorLinks level={level}>
                      {storylineAnchors.map((anchor) =>
                        editingAnchor?.id === anchor.id && editingAnchor.storylineId === storyline.id ? (
                          <StorylineAnchorLinkRow key={`${storyline.id}:${anchor.id}:editing`}>
                            <EditingTextarea
                              ref={textareaRef}
                              value={editingAnchor.description}
                              onChange={e => setEditingAnchor({ ...editingAnchor, description: e.target.value })}
                              onBlur={handleCommitEdit}
                              onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleCommitEdit();
                                }
                                if (e.key === 'Escape') {
                                  e.preventDefault();
                                  setEditingAnchor(null);
                                }
                              }}
                            />
                          </StorylineAnchorLinkRow>
                        ) : (
                          <StorylineAnchorLinkRow key={`${storyline.id}:${anchor.id}`}>
                            <StorylineAnchorLinkButton
                              type="button"
                              onClick={() => onSelectAnchor(anchor.id)}
                              onDoubleClick={() => handleStartEditing(anchor, storyline.id)}
                              title={`${anchor.description || '剧情锚点'} | 单击定位正文 | 双击编辑描述`}
                              aria-label={anchor.description || `${storyline.name} 的剧情锚点`}
                            >
                              {anchor.description || '剧情锚点'}
                            </StorylineAnchorLinkButton>
                            <InlineDeleteButton
                              type="button"
                              className="storyline-anchor-inline-delete"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`确定要删除剧情锚点 "${anchor.description}" 吗？`)) {
                                  onDeleteAnchor(anchor.id);
                                }
                              }}
                              title="删除锚点"
                            >
                              ×
                            </InlineDeleteButton>
                          </StorylineAnchorLinkRow>
                        )
                      )}
                    </StorylineAnchorLinks>
                  )}
                </StorylineTreeItem>
              );
            })}
          </StorylineTreeList>
          {filteredAnchors.length === 0 && (
            <StorylineTreeHint>这条故事线及其子剧情还没有剧情锚点。</StorylineTreeHint>
          )}
        </StorylineTreeSection>
      )}
      {!hasActiveStorylineTree && filteredAnchors.length > 0 ? (
        <AnchorList>
          {filteredAnchors.map(anchor =>
            editingAnchor?.id === anchor.id ? (
              <AnchorItem key={anchor.id} color={activeStoryline?.color}>
                <EditingTextarea
                  ref={textareaRef}
                  value={editingAnchor.description}
                  onChange={e => setEditingAnchor({ ...editingAnchor, description: e.target.value })}
                  onBlur={handleCommitEdit}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleCommitEdit();
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setEditingAnchor(null);
                    }
                  }}
                />
              </AnchorItem>
            ) : (
              <AnchorItem
                key={anchor.id}
                color={activeStoryline?.color}
                onClick={() => onSelectAnchor(anchor.id)}
                onDoubleClick={() => handleStartEditing(anchor, null)}
                title="单击定位正文 | 双击编辑描述"
              >
                <AnchorDescription>{anchor.description}</AnchorDescription>
                <DeleteButton
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`确定要删除剧情锚点 "${anchor.description}" 吗？`)) {
                      onDeleteAnchor(anchor.id);
                    }
                  }}
                  title="删除锚点"
                >
                  🗑️
                </DeleteButton>
              </AnchorItem>
            )
          )}
        </AnchorList>
      ) : !hasActiveStorylineTree ? (
        <Placeholder>
          {activeStorylineId ? '这条故事线及其子剧情还没有剧情锚点。' : '当前小说还没有剧情锚点。'}
        </Placeholder>
      ) : null}
    </PanelContainer>
  );
};

export default StorylineTrackerPanel;

import React, { useState, useEffect, useRef, useMemo } from 'react';
import styled from '@emotion/styled';
import type { Chapter, PlotAnchor, Storyline } from '../../types';
import { COLORS, SPACING, FONTS, panelStyles, globalPlaceholderTextStyles, BORDERS } from '../../styles';
import type { StorylineDerivedData } from './storylineTree';

interface StorylineTrackerPanelProps {
  plotAnchors: PlotAnchor[];
  chapters: Chapter[];
  storylineDerivedData: StorylineDerivedData;
  activeStorylineId: string | null;
  selectedChapterId: string | null;
  onSelectStoryline: (storylineId: string | null) => void;
  onSelectAnchor: (anchorId: string) => void;
  onUpdateAnchor: (anchorId: string, updates: Partial<PlotAnchor>) => void;
  onDeleteAnchor: (anchorId: string) => void;
  style?: React.CSSProperties;
}

const getAnchorLabel = (anchor: PlotAnchor) => anchor.description?.trim() || '未命名';
const getChapterLabel = (chapter: Chapter | null) => chapter?.title?.trim() || '未命名章节';

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

const StorylineTreeSummary = styled.div<{ level: number }>`
  display: flex;
  align-items: center;
  gap: ${SPACING.xs};
  min-width: 0;
  margin-top: ${SPACING.xs};
  padding-left: ${props => props.level * 16 + 18}px;

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
  overflow-wrap: anywhere;
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

const StorylineBranchToggleButton = styled.button`
  width: 18px;
  padding: 0;
  border: none;
  background: none;
  color: ${COLORS.textLight};
  font-size: ${FONTS.sizeSmall};
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;

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

const AnchorMeta = styled.div`
  margin-bottom: ${SPACING.xs};
  color: ${COLORS.textLight};
  font-size: ${FONTS.sizeSmall};
  line-height: 1.6;
`;

const ContextStorylineLinkList = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${SPACING.xs};
  margin-bottom: ${SPACING.xs};
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

const NearbyAnchorList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.sm};
`;

const NearbyAnchorButton = styled.button<{ accentColor: string }>`
  width: 100%;
  padding: ${SPACING.md};
  border: 1px solid ${COLORS.gray300};
  border-left: 4px solid ${props => props.accentColor};
  border-radius: ${BORDERS.radius};
  background-color: ${COLORS.white};
  color: ${COLORS.text};
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;

  &:hover {
    border-color: ${COLORS.primary};
    box-shadow: 0 2px 6px rgba(0,0,0,0.08);
  }
`;

const NearbyAnchorLabel = styled.div`
  color: ${COLORS.textLight};
  font-size: ${FONTS.sizeSmall};
  line-height: 1.5;
`;

const NearbyAnchorMeta = styled.div`
  margin-top: ${SPACING.xs};
  color: ${COLORS.textLight};
  font-size: ${FONTS.sizeSmall};
  line-height: 1.6;
`;

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

const TRACKER_AUTO_COLLAPSE_LEVEL = 1;

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

const buildDefaultCollapsedTrackerIds = (
  rootId: string,
  storylineById: Map<string, Storyline>,
  childrenByParentId: Map<string | null, Storyline[]>
): Set<string> => {
  const root = storylineById.get(rootId);
  if (!root) return new Set<string>();

  const collapsed = new Set<string>();
  const walk = (node: Storyline, level: number) => {
    const children = childrenByParentId.get(node.id) || [];
    if (children.length > 0 && level >= TRACKER_AUTO_COLLAPSE_LEVEL) {
      collapsed.add(node.id);
    }
    children.forEach((child) => walk(child, level + 1));
  };

  walk(root, 0);
  return collapsed;
};

const StorylineTrackerPanel: React.FC<StorylineTrackerPanelProps> = ({
  plotAnchors,
  chapters,
  storylineDerivedData,
  activeStorylineId,
  selectedChapterId,
  onSelectStoryline,
  onSelectAnchor,
  onUpdateAnchor,
  onDeleteAnchor,
  style,
}) => {
  const {
    storylineById,
    childrenByParentId,
    descendantsByStorylineId,
    anchorsByStorylineId,
    anchorCountByStorylineId,
  } = storylineDerivedData;
  const [editingAnchor, setEditingAnchor] = useState<{
    id: string;
    description: string;
    storylineId: string | null;
  } | null>(null);
  const [expandedStorylineId, setExpandedStorylineId] = useState<string | null>(null);
  const [collapsedTreeIds, setCollapsedTreeIds] = useState<Set<string>>(new Set());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sortedChapters = useMemo(
    () => [...chapters].sort((a, b) => a.originalStartIndex - b.originalStartIndex),
    [chapters]
  );
  const sortedAnchors = useMemo(
    () => [...plotAnchors].sort((a, b) => a.position - b.position),
    [plotAnchors]
  );

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

  useEffect(() => {
    if (!activeStorylineId) {
      setCollapsedTreeIds(new Set());
      return;
    }
    setCollapsedTreeIds(
      buildDefaultCollapsedTrackerIds(activeStorylineId, storylineById, childrenByParentId)
    );
  }, [activeStorylineId, storylineById, childrenByParentId]);

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
      ...(descendantsByStorylineId.get(activeStorylineId) || []),
    ]);
  }, [activeStorylineId, descendantsByStorylineId]);

  const filteredAnchors = useMemo(() => {
    if (!filteredStorylineIds) {
      return sortedAnchors;
    }

    const uniqueAnchors = new Map<string, PlotAnchor>();
    filteredStorylineIds.forEach((storylineId) => {
      const anchors = anchorsByStorylineId.get(storylineId) || [];
      anchors.forEach((anchor) => {
        uniqueAnchors.set(anchor.id, anchor);
      });
    });

    return [...uniqueAnchors.values()].sort((a, b) => a.position - b.position);
  }, [anchorsByStorylineId, filteredStorylineIds, sortedAnchors]);

  const anchorById = useMemo(() => {
    return new Map(plotAnchors.map((anchor) => [anchor.id, anchor] as const));
  }, [plotAnchors]);

  const hasActiveStorylineTree = activeStorylineTree.length > 0;
  const currentChapter = useMemo(() => {
    if (!selectedChapterId) return null;
    return sortedChapters.find((chapter) => chapter.id === selectedChapterId) || null;
  }, [selectedChapterId, sortedChapters]);

  const getAnchorStorylines = (anchor: PlotAnchor) => {
    const storylines = anchor.storylineIds
      .map((storylineId) => storylineById.get(storylineId))
      .filter((storyline): storyline is Storyline => Boolean(storyline));
    if (storylines.length > 0) return storylines;
    return [];
  };

  const getAnchorAccentColor = (anchor: PlotAnchor) => {
    const color = anchor.storylineIds
      .map((storylineId) => storylineById.get(storylineId)?.color)
      .find((value): value is string => Boolean(value));
    if (color) return color;
    return anchor.isPending ? COLORS.warning : COLORS.gray300;
  };

  const currentChapterAnchors = useMemo(() => {
    if (!currentChapter) return [];
    return sortedAnchors.filter((anchor) => (
      anchor.position >= currentChapter.originalStartIndex &&
      anchor.position < currentChapter.originalEndIndex
    ));
  }, [currentChapter, sortedAnchors]);

  const previousAnchor = useMemo(() => {
    if (!currentChapter) return null;
    for (let index = sortedAnchors.length - 1; index >= 0; index -= 1) {
      const anchor = sortedAnchors[index];
      if (anchor.position < currentChapter.originalStartIndex) {
        return anchor;
      }
    }
    return null;
  }, [currentChapter, sortedAnchors]);

  const nextAnchor = useMemo(() => {
    if (!currentChapter) return null;
    return (
      sortedAnchors.find((anchor) => anchor.position >= currentChapter.originalEndIndex) ||
      null
    );
  }, [currentChapter, sortedAnchors]);

  const handleStartEditing = (anchor: PlotAnchor, storylineId: string | null) => {
    setEditingAnchor({ id: anchor.id, description: anchor.description, storylineId });
  };

  const handleSelectStorylineAnchor = (storylineId: string, anchorId: string) => {
    onSelectStoryline(storylineId);
    onSelectAnchor(anchorId);
  };

  const toggleTreeBranch = (storylineId: string) => {
    setCollapsedTreeIds((current) => {
      const next = new Set(current);
      if (next.has(storylineId)) {
        next.delete(storylineId);
      } else {
        next.add(storylineId);
      }
      return next;
    });
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
    const treeLines = activeStorylineTree.flatMap(({ storyline, level }) => {
      const indent = '  '.repeat(level);
      const storylineAnchors = anchorsByStorylineId.get(storyline.id) || [];
      const lines = [`${indent}${storyline.name}`];
      const namedAnchors = storylineAnchors.filter((anchor) => anchor.description?.trim());
      namedAnchors.forEach((anchor, index) => {
        lines.push(`${indent}  ${index + 1}. ${anchor.description.trim()}`);
      });
      return lines;
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

  const renderTrackerTreeNode = (storyline: Storyline, level: number): React.ReactNode => {
    const storylineAnchors = anchorsByStorylineId.get(storyline.id) || [];
    const primaryAnchor = storylineAnchors[0];
    const hasSingleAnchor = storylineAnchors.length === 1 && Boolean(primaryAnchor);
    const childStorylines = childrenByParentId.get(storyline.id) || [];
    const hasChildren = childStorylines.length > 0;
    const isCollapsed = collapsedTreeIds.has(storyline.id);
    const showExpandedAnchors =
      storylineAnchors.length > 1 &&
      (expandedStorylineId === storyline.id || editingAnchor?.storylineId === storyline.id);
    const isEditingPrimaryAnchor =
      Boolean(primaryAnchor) &&
      editingAnchor?.id === primaryAnchor?.id &&
      editingAnchor.storylineId === storyline.id &&
      !showExpandedAnchors;
    const showPrimaryAnchorPreview =
      Boolean(primaryAnchor) &&
      storylineAnchors.length > 1 &&
      !showExpandedAnchors;

    return (
      <React.Fragment key={storyline.id}>
        <StorylineTreeItem>
          <StorylineTreeRow level={level}>
            <StorylineColorDot style={{ backgroundColor: storyline.color }} />
            {hasChildren ? (
              <StorylineBranchToggleButton
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTreeBranch(storyline.id);
                }}
                title={isCollapsed ? '展开子剧情' : '折叠子剧情'}
                aria-label={isCollapsed ? '展开子剧情' : '折叠子剧情'}
              >
                {isCollapsed ? '▸' : '▾'}
              </StorylineBranchToggleButton>
            ) : (
              <span style={{ width: 18, flexShrink: 0 }} />
            )}
            {hasSingleAnchor && primaryAnchor ? (
              <StorylineTreeNameButton
                type="button"
                onClick={() => onSelectAnchor(primaryAnchor.id)}
                onDoubleClick={() => handleStartEditing(primaryAnchor, storyline.id)}
                title={`${storyline.name} | 单击定位正文 | 双击编辑锚点描述`}
                aria-label={`${storyline.name}，单击定位正文`}
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
                    if (window.confirm(`确定要删除剧情锚点 "${getAnchorLabel(primaryAnchor)}" 吗？`)) {
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
          {isEditingPrimaryAnchor && primaryAnchor && editingAnchor ? (
            <StorylineTreeSummary level={level}>
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
            </StorylineTreeSummary>
          ) : showPrimaryAnchorPreview && primaryAnchor ? (
            <StorylineTreeSummary level={level}>
              <StorylineAnchorLinkButton
                type="button"
                onClick={() => onSelectAnchor(primaryAnchor.id)}
                onDoubleClick={() => handleStartEditing(primaryAnchor, storyline.id)}
                title={`${getAnchorLabel(primaryAnchor)} | 单击定位正文 | 双击编辑描述`}
                aria-label={`${storyline.name} 的 ${getAnchorLabel(primaryAnchor)}`}
              >
                {getAnchorLabel(primaryAnchor)}
              </StorylineAnchorLinkButton>
            </StorylineTreeSummary>
          ) : null}
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
                      title={`${getAnchorLabel(anchor)} | 单击定位正文 | 双击编辑描述`}
                      aria-label={`${storyline.name} 的 ${getAnchorLabel(anchor)}`}
                    >
                      {getAnchorLabel(anchor)}
                    </StorylineAnchorLinkButton>
                    <InlineDeleteButton
                      type="button"
                      className="storyline-anchor-inline-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`确定要删除剧情锚点 "${getAnchorLabel(anchor)}" 吗？`)) {
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
        {!isCollapsed && childStorylines.map((child) => renderTrackerTreeNode(child, level + 1))}
      </React.Fragment>
    );
  };

  return (
    <PanelContainer style={style}>
      <Title>
        <TitleText>
          剧情追踪器
          {activeStoryline ? `: ${activeStoryline.name}（含子剧情）` : ': 当前章节剧情概览'}
        </TitleText>
        {hasActiveStorylineTree && (
          <CopyTreeButton
            type="button"
            onClick={handleCopyStorylineTree}
            disabled={activeStorylineTree.length === 0}
            title={activeStorylineTree.length > 0 ? '复制当前显示的剧情树' : '当前无可复制的剧情树'}
          >
            复制剧情树
          </CopyTreeButton>
        )}
      </Title>
      {activeStorylineTree.length > 0 && (
        <StorylineTreeSection>
        <StorylineTreeTitle>当前剧情树</StorylineTreeTitle>
        <StorylineTreeList>
          {activeStoryline ? renderTrackerTreeNode(activeStoryline, 0) : null}
        </StorylineTreeList>
          {filteredAnchors.length === 0 && (
            <StorylineTreeHint>这条故事线及其子剧情还没有剧情锚点。</StorylineTreeHint>
          )}
        </StorylineTreeSection>
      )}
      {!activeStorylineId ? (
        currentChapter ? (
          <>
            <StorylineTreeTitle>当前章节：{getChapterLabel(currentChapter)}</StorylineTreeTitle>
            {currentChapterAnchors.length > 0 ? (
              <AnchorList>
                {currentChapterAnchors.map(anchor =>
                  editingAnchor?.id === anchor.id ? (
                    <AnchorItem key={anchor.id} color={getAnchorAccentColor(anchor)}>
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
                      color={getAnchorAccentColor(anchor)}
                      onClick={() => onSelectAnchor(anchor.id)}
                      onDoubleClick={() => handleStartEditing(anchor, null)}
                      title="单击定位正文 | 双击编辑描述"
                    >
                      <AnchorMeta>剧情线</AnchorMeta>
                      <ContextStorylineLinkList>
                        {getAnchorStorylines(anchor).length > 0 ? (
                          getAnchorStorylines(anchor).map((storyline) => (
                            <StorylineAnchorLinkButton
                              key={`${anchor.id}:${storyline.id}`}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectStorylineAnchor(storyline.id, anchor.id);
                              }}
                              title={`${storyline.name} | 单击定位正文并选中故事线`}
                            >
                              {storyline.name}
                            </StorylineAnchorLinkButton>
                          ))
                        ) : (
                          <AnchorMeta style={{ marginBottom: 0 }}>未关联故事线</AnchorMeta>
                        )}
                      </ContextStorylineLinkList>
                      <AnchorDescription>{getAnchorLabel(anchor)}</AnchorDescription>
                      <DeleteButton
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`确定要删除剧情锚点 "${getAnchorLabel(anchor)}" 吗？`)) {
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
            ) : (previousAnchor || nextAnchor) ? (
              <NearbyAnchorList>
                {previousAnchor && (
                  <NearbyAnchorButton
                    type="button"
                    accentColor={getAnchorAccentColor(previousAnchor)}
                    onClick={() => onSelectAnchor(previousAnchor.id)}
                    title="定位到上一处剧情"
                  >
                    <NearbyAnchorLabel>上一处剧情</NearbyAnchorLabel>
                    <ContextStorylineLinkList>
                      {getAnchorStorylines(previousAnchor).length > 0 ? (
                        getAnchorStorylines(previousAnchor).map((storyline) => (
                          <StorylineAnchorLinkButton
                            key={`previous:${previousAnchor.id}:${storyline.id}`}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectStorylineAnchor(storyline.id, previousAnchor.id);
                            }}
                            title={`${storyline.name} | 单击定位正文并选中故事线`}
                          >
                            {storyline.name}
                          </StorylineAnchorLinkButton>
                        ))
                      ) : (
                        <AnchorMeta style={{ marginBottom: 0 }}>未关联故事线</AnchorMeta>
                      )}
                    </ContextStorylineLinkList>
                    <NearbyAnchorMeta>
                      {getAnchorLabel(previousAnchor)}
                    </NearbyAnchorMeta>
                  </NearbyAnchorButton>
                )}
                {nextAnchor && (
                  <NearbyAnchorButton
                    type="button"
                    accentColor={getAnchorAccentColor(nextAnchor)}
                    onClick={() => onSelectAnchor(nextAnchor.id)}
                    title="定位到下一处剧情"
                  >
                    <NearbyAnchorLabel>下一处剧情</NearbyAnchorLabel>
                    <ContextStorylineLinkList>
                      {getAnchorStorylines(nextAnchor).length > 0 ? (
                        getAnchorStorylines(nextAnchor).map((storyline) => (
                          <StorylineAnchorLinkButton
                            key={`next:${nextAnchor.id}:${storyline.id}`}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectStorylineAnchor(storyline.id, nextAnchor.id);
                            }}
                            title={`${storyline.name} | 单击定位正文并选中故事线`}
                          >
                            {storyline.name}
                          </StorylineAnchorLinkButton>
                        ))
                      ) : (
                        <AnchorMeta style={{ marginBottom: 0 }}>未关联故事线</AnchorMeta>
                      )}
                    </ContextStorylineLinkList>
                    <NearbyAnchorMeta>
                      {getAnchorLabel(nextAnchor)}
                    </NearbyAnchorMeta>
                  </NearbyAnchorButton>
                )}
              </NearbyAnchorList>
            ) : (
              <Placeholder>当前小说还没有剧情锚点。</Placeholder>
            )}
          </>
        ) : (
          <Placeholder>请先在左侧选择一个章节，再查看当前章节的剧情概览。</Placeholder>
        )
      ) : !hasActiveStorylineTree && filteredAnchors.length > 0 ? (
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
                <AnchorDescription>{getAnchorLabel(anchor)}</AnchorDescription>
                <DeleteButton
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`确定要删除剧情锚点 "${getAnchorLabel(anchor)}" 吗？`)) {
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

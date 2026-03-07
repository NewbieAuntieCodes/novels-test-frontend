import React, { useState, useEffect, useRef } from 'react';
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

const StorylineTreeItem = styled.li<{ level: number }>`
  display: flex;
  align-items: center;
  gap: ${SPACING.xs};
  margin: ${SPACING.xs} 0;
  padding-left: ${props => props.level * 16}px;
  color: ${COLORS.text};
  font-size: ${FONTS.sizeSmall};
`;

const StorylineColorDot = styled.span`
  width: 10px;
  height: 10px;
  border-radius: 2px;
  flex-shrink: 0;
  border: 1px solid rgba(0, 0, 0, 0.1);
`;

const StorylineAnchorCount = styled.span`
  margin-left: auto;
  color: ${COLORS.textLight};
  font-size: ${FONTS.sizeSmall};
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

const collectDescendantStorylineIds = (storylineId: string, allStorylines: Storyline[]): string[] => {
  const descendants: string[] = [];
  const queue: string[] = [storylineId];
  const visited = new Set<string>([storylineId]);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = allStorylines.filter((s) => s.parentId === currentId);
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
  allStorylines: Storyline[]
): Array<{ storyline: Storyline; level: number }> => {
  const root = allStorylines.find((s) => s.id === rootId);
  if (!root) return [];

  const result: Array<{ storyline: Storyline; level: number }> = [];
  const walk = (node: Storyline, level: number) => {
    result.push({ storyline: node, level });
    const children = allStorylines.filter((s) => s.parentId === node.id);
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
  const [editingAnchor, setEditingAnchor] = useState<{ id: string; description: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editingAnchor && textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.focus();
      const length = textarea.value.length;
      textarea.setSelectionRange(length, length);
    }
  }, [editingAnchor]);

  const activeStoryline = storylines.find(s => s.id === activeStorylineId);
  const activeStorylineTree = activeStorylineId ? buildStorylineSubtree(activeStorylineId, storylines) : [];

  const filteredStorylineIds = activeStorylineId
    ? new Set<string>([activeStorylineId, ...collectDescendantStorylineIds(activeStorylineId, storylines)])
    : null;

  const filteredAnchors = (filteredStorylineIds
    ? plotAnchors.filter(a => a.storylineIds.some(id => filteredStorylineIds.has(id)))
    : plotAnchors
  ).sort((a, b) => a.position - b.position);

  const anchorCountByStorylineId = new Map<string, number>();
  if (activeStorylineTree.length > 0) {
    activeStorylineTree.forEach(({ storyline }) => anchorCountByStorylineId.set(storyline.id, 0));
    plotAnchors.forEach((anchor) => {
      anchor.storylineIds.forEach((storylineId) => {
        if (anchorCountByStorylineId.has(storylineId)) {
          anchorCountByStorylineId.set(storylineId, (anchorCountByStorylineId.get(storylineId) || 0) + 1);
        }
      });
    });
  }

  const handleCommitEdit = () => {
    if (!editingAnchor) return;
    const originalAnchor = plotAnchors.find(a => a.id === editingAnchor.id);
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
            {activeStorylineTree.map(({ storyline, level }) => (
              <StorylineTreeItem key={storyline.id} level={level}>
                <StorylineColorDot style={{ backgroundColor: storyline.color }} />
                <span>{storyline.name}</span>
                <StorylineAnchorCount>
                  锚点 {anchorCountByStorylineId.get(storyline.id) || 0}
                </StorylineAnchorCount>
              </StorylineTreeItem>
            ))}
          </StorylineTreeList>
        </StorylineTreeSection>
      )}
      {filteredAnchors.length > 0 ? (
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
                onDoubleClick={() => setEditingAnchor({ id: anchor.id, description: anchor.description })}
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
      ) : (
        <Placeholder>
          {activeStorylineId ? '这条故事线及其子剧情还没有剧情锚点。' : '当前小说还没有剧情锚点。'}
        </Placeholder>
      )}
    </PanelContainer>
  );
};

export default StorylineTrackerPanel;

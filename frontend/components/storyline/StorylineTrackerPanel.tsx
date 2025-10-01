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
`;

const AnchorList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  flex-grow: 1;
  overflow-y: auto;
`;

const AnchorItem = styled.li`
  background-color: ${COLORS.white};
  border: 1px solid ${COLORS.gray300};
  padding: ${SPACING.md};
  margin-bottom: ${SPACING.sm};
  border-radius: ${FONTS.sizeSmall};
  box-shadow: 0 1px 3px rgba(0,0,0,0.03);
  cursor: pointer;
  transition: box-shadow 0.2s, border-color 0.2s;
  border-left: 4px solid ${props => props.color || COLORS.gray300};
  position: relative;

  &:hover {
    box-shadow: 0 2px 6px rgba(0,0,0,0.08);
    border-color: ${COLORS.primary};
  }
`;

const AnchorDescription = styled.p`
  margin: 0;
  color: ${COLORS.text};
  word-break: break-word;
  line-height: 1.5;
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

const StorylineTrackerPanel: React.FC<StorylineTrackerPanelProps> = ({
  plotAnchors,
  storylines,
  activeStorylineId,
  onSelectAnchor,
  onUpdateAnchor,
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

  const filteredAnchors = (activeStorylineId
    ? plotAnchors.filter(a => a.storylineIds.includes(activeStorylineId))
    : plotAnchors
  ).sort((a, b) => a.position - b.position);

  const handleCommitEdit = () => {
    if (!editingAnchor) return;
    const originalAnchor = plotAnchors.find(a => a.id === editingAnchor.id);
    const trimmedDescription = editingAnchor.description.trim();

    if (originalAnchor && trimmedDescription && originalAnchor.description !== trimmedDescription) {
        onUpdateAnchor(editingAnchor.id, { description: trimmedDescription });
    }
    setEditingAnchor(null);
  };

  return (
    <PanelContainer style={style}>
      <Title>
        剧情追踪器
        {activeStoryline ? `: ${activeStoryline.name}` : ': 所有锚点'}
      </Title>
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
              </AnchorItem>
            )
          )}
        </AnchorList>
      ) : (
        <Placeholder>
          {activeStorylineId ? '这条故事线还没有剧情锚点。' : '当前小说还没有剧情锚点。'}
        </Placeholder>
      )}
    </PanelContainer>
  );
};

export default StorylineTrackerPanel;

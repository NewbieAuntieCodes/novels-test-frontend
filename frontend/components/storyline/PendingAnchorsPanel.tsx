import React from 'react';
import styled from '@emotion/styled';
import type { PlotAnchor } from "../types";
import { COLORS, SPACING, FONTS, BORDERS, panelStyles, globalPlaceholderTextStyles } from '../../styles';

interface PendingAnchorsPanelProps {
  plotAnchors: PlotAnchor[];
  novelText: string;
  onSelectAnchor: (anchorId: string) => void;
  onEditAnchor: (anchorId: string) => void;
  onDeleteAnchor: (anchorId: string) => void;
  style?: React.CSSProperties;
}

const PanelContainer = styled.div`
  ${panelStyles as any};
  background-color: ${COLORS.gray100};
  display: flex;
  flex-direction: column;
`;

const Title = styled.h3`
  font-size: ${FONTS.sizeBase};
  color: ${COLORS.dark};
  margin: 0 0 ${SPACING.md} 0;
  padding-bottom: ${SPACING.sm};
  border-bottom: 1px solid ${COLORS.gray300};
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
  border-left: 4px solid ${COLORS.warning};
  padding: ${SPACING.md};
  margin-bottom: ${SPACING.sm};
  border-radius: ${BORDERS.radius};
  cursor: pointer;
  transition: box-shadow 0.2s, border-color 0.2s;
  position: relative;

  &:hover {
    box-shadow: 0 2px 6px rgba(0,0,0,0.08);
    border-color: ${COLORS.primary};
  }

  &:hover button {
    opacity: 1;
  }
`;

const AnchorPosition = styled.div`
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.textLight};
  margin-bottom: ${SPACING.xs};
`;

const AnchorPreview = styled.div`
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.text};
  line-height: 1.6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const DeleteButton = styled.button`
  position: absolute;
  top: ${SPACING.sm};
  right: ${SPACING.sm};
  background: none;
  border: none;
  cursor: pointer;
  color: ${COLORS.danger};
  font-size: 14px;
  padding: ${SPACING.xs};
  opacity: 0;
  transition: opacity 0.2s;

  &:hover {
    color: ${COLORS.dangerHover};
  }
`;

const Placeholder = styled.div(globalPlaceholderTextStyles);

const PendingAnchorsPanel: React.FC<PendingAnchorsPanelProps> = ({
  plotAnchors,
  novelText,
  onSelectAnchor,
  onEditAnchor,
  onDeleteAnchor,
  style,
}) => {
  const pendingAnchors = plotAnchors
    .filter(a => a.isPending)
    .sort((a, b) => a.position - b.position);

  const getLineNumber = (position: number): number => {
    const textBeforePosition = novelText.substring(0, position);
    return textBeforePosition.split('\n').length;
  };

  const getPreviewText = (position: number): string => {
    const previewLength = 50;
    const start = Math.max(0, position - 20);
    const end = Math.min(novelText.length, position + previewLength);
    let preview = novelText.substring(start, end).trim();

    // Replace newlines with spaces for preview
    preview = preview.replace(/\n+/g, ' ');

    if (start > 0) preview = '...' + preview;
    if (end < novelText.length) preview = preview + '...';

    return preview;
  };

  return (
    <PanelContainer style={style}>
      <Title>📍 待归类锚点 ({pendingAnchors.length})</Title>
      {pendingAnchors.length > 0 ? (
        <AnchorList>
          {pendingAnchors.map(anchor => (
            <AnchorItem
              key={anchor.id}
              onClick={() => onSelectAnchor(anchor.id)}
              onDoubleClick={() => onEditAnchor(anchor.id)}
              title="单击定位正文 | 双击编辑分配故事线"
            >
              <AnchorPosition>第 {getLineNumber(anchor.position)} 行</AnchorPosition>
              <AnchorPreview>{getPreviewText(anchor.position)}</AnchorPreview>
              <DeleteButton
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm('确定要删除此待归类锚点吗？')) {
                    onDeleteAnchor(anchor.id);
                  }
                }}
                title="删除锚点"
              >
                🗑️
              </DeleteButton>
            </AnchorItem>
          ))}
        </AnchorList>
      ) : (
        <Placeholder>暂无待归类的剧情锚点。</Placeholder>
      )}
    </PanelContainer>
  );
};

export default PendingAnchorsPanel;

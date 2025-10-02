import React, { CSSProperties } from 'react';
import styled from '@emotion/styled';
import type { Tag, SelectionDetails } from '../types';
import { COLORS, SPACING, FONTS, BORDERS, panelStyles } from '../../styles';
import TagList from './TagList';

interface TagSelectionPanelProps {
  tags: Tag[];
  activeTagId: string | null;
  onApplyTagToSelection: (tagId: string) => void;
  currentSelection: SelectionDetails | null;
  onCreatePendingAnnotation: () => void;
  style?: CSSProperties;
}

const PanelContainer = styled.div`
  ${panelStyles as any};
  background-color: ${COLORS.white};
  min-width: 220px;
`;

const Title = styled.h2`
  font-size: ${FONTS.sizeH3};
  color: ${COLORS.dark};
  margin: 0 0 ${SPACING.md} 0;
  padding-bottom: ${SPACING.sm};
  border-bottom: 1px solid ${COLORS.gray300};
`;

const PendingButton = styled.button`
  width: 100%;
  padding: ${SPACING.md};
  margin-bottom: ${SPACING.md};
  background-color: ${COLORS.warning};
  color: ${COLORS.dark};
  border: none;
  border-radius: ${BORDERS.radius};
  cursor: pointer;
  font-size: ${FONTS.sizeBase};
  font-weight: 500;
  transition: all 0.2s;

  &:hover {
    opacity: 0.8;
  }

  &:disabled {
    background-color: ${COLORS.gray300};
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

const Hint = styled.p`
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.textLight};
  margin: 0 0 ${SPACING.md} 0;
  padding: ${SPACING.sm};
  background-color: ${COLORS.gray100};
  border-radius: ${BORDERS.radius};
`;

const TagSelectionPanel: React.FC<TagSelectionPanelProps> = ({
  tags,
  activeTagId,
  onApplyTagToSelection,
  currentSelection,
  onCreatePendingAnnotation,
  style,
}) => {
  return (
    <PanelContainer style={style}>
      <Title>标签选择</Title>

      <PendingButton
        onClick={onCreatePendingAnnotation}
        disabled={!currentSelection}
        title="将选中文本标记为待标注"
      >
        📌 标记待标注
      </PendingButton>

      <Hint>
        {currentSelection
          ? '选择标签应用到选中文本，或点击上方按钮标记为待标注'
          : '请先在右侧正文中选中文本'}
      </Hint>

      <TagList
        tags={tags}
        activeTagId={activeTagId}
        onTagClick={onApplyTagToSelection}
        onTagDoubleClick={() => {}}
        showControls={false}
        mode="apply"
      />
    </PanelContainer>
  );
};

export default TagSelectionPanel;

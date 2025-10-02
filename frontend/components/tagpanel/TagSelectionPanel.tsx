import React, { CSSProperties } from 'react';
import styled from '@emotion/styled';
import type { Tag } from '../types';
import { COLORS, SPACING, FONTS, BORDERS, panelStyles } from '../../styles';
import TagList from './TagList';
import TagCreationForm from './TagCreationForm';

interface TagSelectionPanelProps {
  tags: Tag[];
  activeTagId: string | null;
  onApplyTagToSelection: (tagId: string) => void;
  onAddTag: (name: string, color: string, parentId: string | null) => void;
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
  onAddTag,
  style,
}) => {
  return (
    <PanelContainer style={style}>
      <Title>标签选择</Title>

      <TagCreationForm
        tags={tags}
        onAddTag={onAddTag}
        activeTagId={activeTagId}
      />

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

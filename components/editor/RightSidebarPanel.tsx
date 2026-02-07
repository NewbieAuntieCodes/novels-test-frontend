import React from 'react';
import styled from '@emotion/styled';
import type { Annotation, Tag } from '../../types';
import FilterResultsPanel from '../FilterResultsPanel';
import { COLORS, BORDERS } from '../../styles';

interface RightSidebarPanelProps {
  style?: React.CSSProperties;
  annotations: Annotation[];
  getTagById: (id: string) => Tag | undefined;
  activeFilterTag: Tag | null | undefined;
  novelText?: string;
  globalFilterTagName?: string | null;
  includeDescendantTags?: boolean;
  onTagClick?: (tagId: string) => void;
  onTagDoubleClick?: (tagName: string) => void;
  allUserTags: Tag[];
  onDeleteAnnotation?: (annotationId: string) => void;
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 220px;
  min-height: 0;
  border: 1px solid ${COLORS.borderLight};
  border-radius: ${BORDERS.radius};
  overflow: hidden;
`;

const RightSidebarPanel: React.FC<RightSidebarPanelProps> = ({
  style,
  annotations,
  getTagById,
  activeFilterTag,
  novelText,
  globalFilterTagName,
  includeDescendantTags,
  onTagClick,
  onTagDoubleClick,
  allUserTags,
  onDeleteAnnotation,
}) => (
  <Container style={style}>
    <FilterResultsPanel
      style={{ height: '100%' }}
      annotations={annotations}
      getTagById={getTagById}
      activeFilterTag={activeFilterTag}
      novelText={novelText}
      globalFilterTagName={globalFilterTagName}
      includeDescendantTags={includeDescendantTags}
      onTagClick={onTagClick}
      onTagDoubleClick={onTagDoubleClick}
      allUserTags={allUserTags}
      onDeleteAnnotation={onDeleteAnnotation}
    />
  </Container>
);

export default RightSidebarPanel;


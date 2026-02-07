import React, { useState, CSSProperties, useEffect } from 'react';
import styled from '@emotion/styled';
// FIX: Import SelectionDetails for use in TagPanelProps.
import type { Tag, Chapter, SelectionDetails } from "../types";
import { COLORS, SPACING, FONTS, panelStyles as basePanelStyles } from '../../styles';
import type { EditorMode } from '../editor/NovelEditorPage';

import TagManagementView from './TagManagementView';
import ChapterListView from './ChapterListView';

interface TagPanelProps {
  tags: Tag[];
  onAddTag: (name: string, color: string, parentId: string | null) => void;
  activeTagId: string | null;
  onUpdateTagParent: (tagId: string, newParentId: string | null) => void;
  onUpdateTagColor: (tagId: string, newColor: string) => void;
  onUpdateTagName: (tagId: string, newName: string) => void;
  onDeleteTag: (tagId: string) => void;
  novelId: string;
  chapters: Chapter[];
  selectedChapterId: string | null;
  onSelectChapter: (id: string | null) => void;
  style?: CSSProperties;
  editorMode: EditorMode;
  onApplyTagToSelection: (tagId: string) => void;
  onSelectTagForReadMode: (tagId: string | null) => void;
  onTagGlobalSearch?: (tagName: string) => void;
  // FIX: Add missing props to support creating annotations from selection.
  currentSelection: SelectionDetails | null;
  onCreatePendingAnnotation: () => void;
  onDeleteAnnotationsInSelection: () => void;
}

type ViewMode = 'tags' | 'chapters';

const PanelContainer = styled.div({
    ...(basePanelStyles as object),
    minWidth: '220px',
});

const ViewModeToggle = styled.div`
  display: flex;
  margin-bottom: ${SPACING.lg};
  border-bottom: 1px solid ${COLORS.gray300};
`;

const ViewModeButton = styled.button<{ isActive: boolean }>`
  padding: ${SPACING.sm} ${SPACING.md};
  border: none;
  background-color: transparent;
  cursor: pointer;
  font-size: ${FONTS.sizeSmall};
  color: ${props => (props.isActive ? COLORS.primary : COLORS.textLight)};
  border-bottom: 3px solid ${props => (props.isActive ? COLORS.primary : 'transparent')};
  margin-bottom: -1px;
  transition: color 0.2s, border-color 0.2s;
  font-weight: ${props => (props.isActive ? 'bold' : 'normal')};

  &:hover:not(:disabled) {
    color: ${COLORS.primary};
  }

  &:disabled {
    color: ${COLORS.gray500};
    cursor: not-allowed;
  }
`;

const TagPanel: React.FC<TagPanelProps> = ({
    tags, onAddTag, activeTagId,
    onUpdateTagParent, onUpdateTagColor, onUpdateTagName, onDeleteTag,
    chapters, selectedChapterId, onSelectChapter,
    style, editorMode, onApplyTagToSelection, onSelectTagForReadMode,
    onTagGlobalSearch,
    // FIX: Destructure new props.
    currentSelection,
    onCreatePendingAnnotation,
    onDeleteAnnotationsInSelection,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('tags');
  
  const chaptersDisabled = !chapters || chapters.length === 0;

  useEffect(() => {
    if (chaptersDisabled && viewMode === 'chapters') {
      setViewMode('tags');
    }
  }, [chaptersDisabled, viewMode]);

  return (
    <PanelContainer style={style}>
      <ViewModeToggle>
        <ViewModeButton 
          isActive={viewMode === 'tags'}
          onClick={() => setViewMode('tags')}
          aria-pressed={viewMode === 'tags'}
        >
          标签管理
        </ViewModeButton>
        <ViewModeButton
          isActive={viewMode === 'chapters'}
          onClick={() => {
            if (!chaptersDisabled) setViewMode('chapters');
          }}
          aria-pressed={viewMode === 'chapters'}
          disabled={chaptersDisabled}
        >
          章节列表
        </ViewModeButton>
      </ViewModeToggle>

      {viewMode === 'tags' && (
        <TagManagementView
          tags={tags}
          onAddTag={onAddTag}
          activeTagId={activeTagId}
          onUpdateTagParent={onUpdateTagParent}
          onUpdateTagColor={onUpdateTagColor}
          onUpdateTagName={onUpdateTagName}
          onDeleteTag={onDeleteTag}
          editorMode={editorMode}
          onApplyTagToSelection={onApplyTagToSelection}
          onSelectTagForReadMode={onSelectTagForReadMode}
          onTagGlobalSearch={onTagGlobalSearch}
          // FIX: Pass missing props down to TagManagementView.
          currentSelection={currentSelection}
          onCreatePendingAnnotation={onCreatePendingAnnotation}
          onDeleteAnnotationsInSelection={onDeleteAnnotationsInSelection}
        />
      )}

      {viewMode === 'chapters' && !chaptersDisabled && (
        <ChapterListView
          chapters={chapters}
          selectedChapterId={selectedChapterId}
          onSelectChapter={onSelectChapter}
        />
      )}
    </PanelContainer>
  );
};

export default TagPanel;

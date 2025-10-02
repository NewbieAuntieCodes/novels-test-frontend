import React from 'react';
import styled from '@emotion/styled';
import type { Tag, SelectionDetails } from "../types";
import type { EditorMode } from '../editor/NovelEditorPage';
import { COLORS, SPACING, FONTS, globalPlaceholderTextStyles, BORDERS, SHADOWS } from '../../styles';

import TagCreationForm from './TagCreationForm';
import TagList from './TagList';


interface TagManagementViewProps {
  tags: Tag[]; // These are allUserTags filtered by current user
  onAddTag: (name: string, color: string, parentId: string | null) => void;
  activeTagId: string | null; // A global tag ID
  onUpdateTagParent: (tagId: string, newParentId: string | null) => void;
  onUpdateTagColor: (tagId: string, newColor: string) => void; 
  onUpdateTagName: (tagId: string, newName: string) => void;
  editorMode: EditorMode; 
  onApplyTagToSelection: (tagId: string) => void; // Applies a global tag
  onSelectTagForReadMode: (tagId: string | null) => void; // Selects a global tag
  onTagGlobalSearch?: (tagName: string) => void;
  currentSelection: SelectionDetails | null;
  onCreatePendingAnnotation: () => void;
}

const Title = styled.h2`
  font-size: ${FONTS.sizeH3};
  color: ${COLORS.dark};
  margin-bottom: ${SPACING.lg};
`;

const TagManagementContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  min-height: 0; /* Important for flex-grow in a scrollable container */
`;

const TagListContainer = styled.div`
  flex-grow: 1;
  overflow-y: auto;
  min-height: 150px;
  margin-top: ${SPACING.lg};
`;

const Placeholder = styled.div({
  ...globalPlaceholderTextStyles,
  p: {
    margin: 0,
    padding: 0,
  },
  'p:last-of-type': {
    marginTop: SPACING.xs,
    fontSize: FONTS.sizeSmall,
    color: COLORS.textLighter,
  },
});

const PendingActionButton = styled.button`
  padding: ${SPACING.sm} ${SPACING.lg};
  width: 100%;
  background-color: ${COLORS.warning};
  color: ${COLORS.dark};
  border: 1px solid #e6a700;
  border-radius: ${BORDERS.radius};
  cursor: pointer;
  transition: all 0.2s;
  font-size: ${FONTS.sizeBase};
  font-weight: bold;
  margin-bottom: ${SPACING.lg};

  &:hover:not(:disabled) {
    background-color: #ffca2c;
    border-color: #e6a700;
    box-shadow: ${SHADOWS.small};
  }

  &:disabled {
    background-color: ${COLORS.gray200};
    border-color: ${COLORS.gray300};
    color: ${COLORS.gray500};
    cursor: not-allowed;
  }
`;

const TagManagementView: React.FC<TagManagementViewProps> = ({
  tags, onAddTag, activeTagId,
  onUpdateTagParent, onUpdateTagColor, onUpdateTagName,
  editorMode, onApplyTagToSelection, onSelectTagForReadMode,
  onTagGlobalSearch,
  currentSelection,
  onCreatePendingAnnotation,
}) => {
  return (
    <TagManagementContainer>
      <Title>标签管理</Title>

      {editorMode === 'annotation' && (
        <>
          <PendingActionButton
            disabled={!currentSelection || !currentSelection.text.trim()}
            onClick={onCreatePendingAnnotation}
            title={!currentSelection || !currentSelection.text.trim() ? "请先在内容面板划词选择文本" : `标记已选择的文本: "${currentSelection.text.substring(0, 20)}..."`}
          >
            📌 标记待办
          </PendingActionButton>
          <TagCreationForm
            tags={tags}
            onAddTag={onAddTag}
            activeTagId={activeTagId}
          />
        </>
      )}

      {editorMode === 'tag' && (
        <TagCreationForm
          tags={tags}
          onAddTag={onAddTag}
          activeTagId={activeTagId}
        />
      )}

      <TagListContainer>
        {tags.length > 0 ? (
          <TagList
            tags={tags}
            activeTagId={activeTagId}
            editorMode={editorMode}
            onUpdateTagParent={onUpdateTagParent}
            onUpdateTagColor={onUpdateTagColor}
            onUpdateTagName={onUpdateTagName}
            onApplyTagToSelection={onApplyTagToSelection}
            onSelectTagForReadMode={onSelectTagForReadMode}
            onTagGlobalSearch={onTagGlobalSearch}
          />
        ) : (
          <Placeholder>
            <p>您还没有任何标签。</p>
             {editorMode === 'annotation' && (
                <p>使用上方表单创建一个。</p>
            )}
          </Placeholder>
        )}
      </TagListContainer>
    </TagManagementContainer>
  );
};

export default TagManagementView;
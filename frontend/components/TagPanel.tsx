import React, { CSSProperties } from 'react';
import type { Tag, SelectionDetails } from '../types';
import { panelStyles as basePanelStyles } from "../styles";
import type { EditorMode } from './editor/NovelEditorPage';

import TagManagementView from './tagpanel/TagManagementView';

interface TagPanelProps {
  tags: Tag[]; // These are currentUserTags (all global tags for the user)
  onAddTag: (name: string, color: string, parentId: string | null) => void;
  activeTagId: string | null; // A global tag ID
  onUpdateTagParent: (tagId: string, newParentId: string | null) => void;
  onUpdateTagColor: (tagId: string, newColor: string) => void; 
  onUpdateTagName: (tagId: string, newName: string) => void;
  style?: CSSProperties;
  editorMode: EditorMode; 
  onApplyTagToSelection: (tagId: string) => void; // Applies a global tag
  onSelectTagForReadMode: (tagId: string | null) => void; // Selects a global tag
  onTagGlobalSearch?: (tagName: string) => void;
  currentSelection: SelectionDetails | null;
  onCreatePendingAnnotation: () => void;
}

const stylesObj: { [key: string]: CSSProperties } = {
  panel: {
    ...basePanelStyles, 
    minWidth: '220px', 
  },
};

const TagPanel: React.FC<TagPanelProps> = ({ 
    tags, onAddTag, activeTagId, 
    onUpdateTagParent, onUpdateTagColor, onUpdateTagName, 
    style, editorMode, onApplyTagToSelection, onSelectTagForReadMode,
    onTagGlobalSearch,
    currentSelection,
    onCreatePendingAnnotation,
}) => {
  return (
    <div style={{...stylesObj.panel, ...style}}>
      <TagManagementView
        tags={tags}
        onAddTag={onAddTag}
        activeTagId={activeTagId}
        onUpdateTagParent={onUpdateTagParent}
        onUpdateTagColor={onUpdateTagColor}
        onUpdateTagName={onUpdateTagName}
        editorMode={editorMode}
        onApplyTagToSelection={onApplyTagToSelection}
        onSelectTagForReadMode={onSelectTagForReadMode}
        onTagGlobalSearch={onTagGlobalSearch}
        currentSelection={currentSelection}
        onCreatePendingAnnotation={onCreatePendingAnnotation}
      />
    </div>
  );
};

export default TagPanel;
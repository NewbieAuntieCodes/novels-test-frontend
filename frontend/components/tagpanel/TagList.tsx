import React, { useState, CSSProperties, DragEvent } from 'react';
import styled from '@emotion/styled';
import type { Tag } from "../types";
import type { EditorMode } from '../editor/NovelEditorPage';
import { getAllDescendantTagIds } from "../../utils";
import { COLORS, SPACING, FONTS, globalPlaceholderTextStyles } from '../../styles';
import TagItem from './TagItem';

interface TagListProps {
  tags: Tag[];
  activeTagId: string | null;
  editorMode: EditorMode;
  onUpdateTagParent: (tagId: string, newParentId: string | null) => void;
  onUpdateTagColor: (tagId: string, newColor: string) => void;
  onUpdateTagName: (tagId: string, newName: string) => void;
  onApplyTagToSelection: (tagId: string) => void;
  onSelectTagForReadMode: (tagId: string | null) => void;
  onTagGlobalSearch?: (tagName: string) => void;
}

const List = styled.ul<{ isDragOver: boolean }>`
  list-style: none;
  padding: 0;
  margin: 0;
  flex-grow: 1;
  outline: 2px dashed ${props => (props.isDragOver ? COLORS.primary : 'transparent')};
  transition: outline-color 0.2s;
  min-height: 100px;
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

const TagList: React.FC<TagListProps> = ({
  tags, activeTagId, editorMode,
  onUpdateTagParent, onUpdateTagColor, onUpdateTagName,
  onApplyTagToSelection, onSelectTagForReadMode, onTagGlobalSearch
}) => {
  const [draggedTagId, setDraggedTagId] = useState<string | null>(null);
  const [dragOverTagId, setDragOverTagId] = useState<string | null>(null); 
  const [isDraggingOverListArea, setIsDraggingOverListArea] = useState<boolean>(false); 

  const [editingColorTagId, setEditingColorTagId] = useState<string | null>(null);
  const [currentColorInputValue, setCurrentColorInputValue] = useState<string>('');
  
  const [editingNameData, setEditingNameData] = useState<{ id: string; currentNameValue: string } | null>(null);

  const cancelAllEdits = () => {
    setEditingColorTagId(null);
    setEditingNameData(null);
  };

  const handleDragStart = (e: DragEvent<HTMLLIElement>, tagId: string) => {
    cancelAllEdits();
    e.dataTransfer.setData('text/plain', tagId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTagId(tagId);
  };

  const handleDragOverItem = (e: DragEvent<HTMLLIElement>, targetTagId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (targetTagId !== dragOverTagId) {
      setDragOverTagId(targetTagId);
    }
    setIsDraggingOverListArea(false);
  };
  
  const handleDragLeaveItem = (e: DragEvent<HTMLLIElement>, targetTagId: string) => {
    if (dragOverTagId === targetTagId && e.relatedTarget !== e.currentTarget && !e.currentTarget.contains(e.relatedTarget as Node)) {
       setDragOverTagId(null);
   }
 };

  const handleDragOverList = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!dragOverTagId) {
        setIsDraggingOverListArea(true);
    }
  };

  const handleDragLeaveList = (e: DragEvent<HTMLElement>) => {
    if (e.target === e.currentTarget) { 
        setIsDraggingOverListArea(false);
    }
  };

  const handleDropOnItem = (e: DragEvent<HTMLLIElement>, potentialParentId: string) => {
    e.preventDefault();
    const droppedTagId = e.dataTransfer.getData('text/plain');
    setDragOverTagId(null);
    setDraggedTagId(null);
    setIsDraggingOverListArea(false);

    if (!droppedTagId || droppedTagId === potentialParentId) return;

    const descendants = getAllDescendantTagIds(droppedTagId, tags);
    if (descendants.includes(potentialParentId)) {
      alert("无法将标签移动到其自身的子标签下。");
      return;
    }
    
    const originalTag = tags.find(t => t.id === droppedTagId);
    if (originalTag && originalTag.parentId !== potentialParentId) {
        onUpdateTagParent(droppedTagId, potentialParentId);
    }
  };

  const handleDropOnList = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    const targetElement = e.target as HTMLElement;
    if (targetElement.closest('li[draggable="true"]') && e.currentTarget.contains(targetElement.closest('li[draggable="true"]'))) {
        return; 
    }
    
    const droppedTagId = e.dataTransfer.getData('text/plain');
    setIsDraggingOverListArea(false);
    setDraggedTagId(null);
    setDragOverTagId(null);

    if (!droppedTagId) return;

    const originalTag = tags.find(t => t.id === droppedTagId);
    if (originalTag && originalTag.parentId !== null) {
        onUpdateTagParent(droppedTagId, null);
    }
  };
  
  const handleDragEnd = () => {
    setDraggedTagId(null);
    setDragOverTagId(null);
    setIsDraggingOverListArea(false);
  };

  const handleTagClick = (tagId: string) => {
    if (editingColorTagId === tagId || editingNameData?.id === tagId) {
      return;
    }
    cancelAllEdits(); 

    if (editorMode === 'edit' || editorMode === 'annotation') {
      onApplyTagToSelection(tagId);
    } else { 
      const isCurrentlyActiveForRead = activeTagId === tagId;
      onSelectTagForReadMode(isCurrentlyActiveForRead ? null : tagId);
    }
  };

  const handleTagDoubleClick = (tagName: string) => {
    if (onTagGlobalSearch) {
      cancelAllEdits();
      onTagGlobalSearch(tagName);
    }
  };

  const handleStartColorEdit = (tagId: string, currentColor: string) => {
    cancelAllEdits();
    setEditingColorTagId(tagId);
    setCurrentColorInputValue(currentColor);
  };
  const handleColorEditChange = (newColor: string) => {
    setCurrentColorInputValue(newColor);
  };
  const handleCommitColorEdit = (tagId: string) => {
    if (editingColorTagId !== tagId) return;
    const tag = tags.find(t => t.id === tagId);
    if (tag && currentColorInputValue !== tag.color) {
      onUpdateTagColor(tagId, currentColorInputValue);
    }
    setEditingColorTagId(null);
  };
  const handleCancelColorEdit = () => {
    setEditingColorTagId(null);
  };

  const handleStartNameEdit = (tagId: string, currentName: string) => {
    cancelAllEdits();
    setEditingNameData({ id: tagId, currentNameValue: currentName });
  };
  const handleNameEditChange = (newName: string) => {
    setEditingNameData(prev => prev ? { ...prev, currentNameValue: newName } : null);
  };
  const handleCommitNameEdit = (tagId: string) => {
    if (!editingNameData || editingNameData.id !== tagId) return; 

    const trimmedName = editingNameData.currentNameValue.trim();
    if (trimmedName) {
        const originalTag = tags.find(t => t.id === editingNameData.id);
        if (originalTag && originalTag.name !== trimmedName) {
             onUpdateTagName(editingNameData.id, trimmedName);
        }
    } else {
        const originalTag = tags.find(t => t.id === editingNameData.id);
        if (originalTag) setEditingNameData({ id:tagId, currentNameValue: originalTag.name}); // revert
        alert("标签名称不能为空。");
    }
    setEditingNameData(null);
  };
  const handleCancelNameEdit = () => {
    setEditingNameData(null);
  };

  const renderTagsRecursive = (parentId: string | null, level: number = 0): React.ReactElement[] => {
    return tags
      .filter(tag => tag.parentId === parentId)
      .sort((a, b) => {
        // 🆕 「待标注」标签始终排在最前面
        const PENDING_TAG_NAME = '待标注';
        if (a.name === PENDING_TAG_NAME) return -1;
        if (b.name === PENDING_TAG_NAME) return 1;
        return a.name.localeCompare(b.name);
      })
      .map(tag => (
        <React.Fragment key={tag.id}>
          <TagItem
            tag={tag}
            level={level}
            isActive={activeTagId === tag.id && !editingColorTagId && !editingNameData}
            isBeingDragged={draggedTagId === tag.id}
            isDragOverTarget={dragOverTagId === tag.id && editorMode === 'annotation'}
            isEditingThisColor={editingColorTagId === tag.id}
            isEditingThisName={editingNameData?.id === tag.id}
            currentColorInputValueForEdit={editingColorTagId === tag.id ? currentColorInputValue : tag.color}
            currentNameInputValueForEdit={editingNameData?.id === tag.id ? editingNameData.currentNameValue : tag.name}
            onTagClick={handleTagClick}
            onTagDoubleClick={handleTagDoubleClick}
            onDragStart={handleDragStart}
            onDragOverItem={handleDragOverItem}
            onDragLeaveItem={handleDragLeaveItem}
            onDropOnItem={handleDropOnItem}
            onDragEnd={handleDragEnd}
            onStartColorEdit={handleStartColorEdit}
            onColorEditChange={handleColorEditChange}
            onCommitColorEdit={handleCommitColorEdit}
            onCancelColorEdit={handleCancelColorEdit}
            onStartNameEdit={handleStartNameEdit}
            onNameEditChange={handleNameEditChange}
            onCommitNameEdit={handleCommitNameEdit}
            onCancelNameEdit={handleCancelNameEdit}
            editorMode={editorMode}
          />
          {renderTagsRecursive(tag.id, level + 1)}
        </React.Fragment>
      ));
  };

  return (
    <List
      isDragOver={isDraggingOverListArea && !dragOverTagId && editorMode === 'annotation'}
      role="listbox"
      aria-label="可用标签"
      onDragOver={editorMode === 'annotation' ? handleDragOverList : undefined}
      onDragLeave={editorMode === 'annotation' ? handleDragLeaveList : undefined}
      onDrop={editorMode === 'annotation' ? handleDropOnList : undefined}
    >
      {tags.length > 0 ? (
        renderTagsRecursive(null)
      ) : (
        <Placeholder>
            <p>当前小说还没有标签。</p>
             {editorMode === 'annotation' && (
                <p>使用上方表单创建一个。</p>
            )}
        </Placeholder>
      )}
    </List>
  );
};

export default TagList;
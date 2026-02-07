import React, { DragEvent, useRef, useEffect } from 'react';
import styled from '@emotion/styled';
import type { Tag } from "../types";
import { COLORS, SPACING, BORDERS } from '../../styles';
import type { EditorMode } from '../editor/NovelEditorPage';

interface TagItemProps {
  tag: Tag;
  level: number;
  hasChildren: boolean;
  isExpanded: boolean;
  isActive: boolean;
  isBeingDragged: boolean;
  isDragOverTarget: boolean;
  isEditingThisColor: boolean;
  isEditingThisName: boolean;
  currentColorInputValueForEdit: string;
  currentNameInputValueForEdit: string;
  onTagClick: (tagId: string) => void;
  onTagDoubleClick: (tagName: string) => void;
  onToggleExpand: (tagId: string) => void;
  onDragStart: (e: DragEvent<HTMLLIElement>, tagId: string) => void;
  onDragOverItem: (e: DragEvent<HTMLLIElement>, targetTagId: string) => void;
  onDragLeaveItem: (e: DragEvent<HTMLLIElement>, targetTagId: string) => void;
  onDropOnItem: (e: DragEvent<HTMLLIElement>, potentialParentId: string) => void;
  onDragEnd: () => void;
  onStartColorEdit: (tagId: string, currentColor: string) => void;
  onColorEditChange: (newColor: string) => void;
  onCommitColorEdit: (tagId: string) => void;
  onCancelColorEdit: () => void;
  onStartNameEdit: (tagId: string, currentName: string) => void;
  onNameEditChange: (newName: string) => void;
  onCommitNameEdit: (tagId: string) => void;
  onCancelNameEdit: () => void;
  onDeleteTag: (tagId: string, tagName: string) => void;
  editorMode: EditorMode;
  entityLabel?: string;
}

const StyledListItem = styled.li<{
  level: number;
  isActive: boolean;
  isBeingDragged: boolean;
  isDragOverTarget: boolean;
}>`
  padding: ${SPACING.xs} ${SPACING.sm} ${SPACING.xs} ${props => props.level * parseInt(SPACING.lg) + parseInt(SPACING.sm)}px;
  margin-bottom: 2px; /* Reduced from SPACING.xs for tighter spacing */
  border-radius: ${BORDERS.radius};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: ${SPACING.sm};
  transition: background-color 0.1s, opacity 0.2s, outline 0.2s, color 0.1s;
  word-break: break-word;
  outline: 2px solid ${props => props.isDragOverTarget ? COLORS.primary : 'transparent'};
  color: ${props => props.isActive ? COLORS.primary : COLORS.text};
  background-color: ${props => props.isActive ? COLORS.gray100 : 'transparent'};
  font-weight: ${props => props.isActive ? 'bold' : 'normal'};
  position: relative;
  opacity: ${props => props.isBeingDragged ? 0.5 : 1};

  &:hover {
    background-color: ${props => !props.isActive ? COLORS.gray100 : COLORS.gray200};
  }
`;

const FoldButton = styled.button`
  width: 14px;
  height: 14px;
  padding: 0;
  border: none;
  background: transparent;
  color: ${COLORS.textLight};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  line-height: 1;
  font-weight: bold;
  cursor: pointer;
  user-select: none;

  &:hover {
    color: ${COLORS.primary};
  }
`;

const FoldSpacer = styled.span`
  width: 14px;
  height: 14px;
  display: inline-block;
  flex-shrink: 0;
`;

const ColorPreview = styled.span<{ editorMode: EditorMode }>`
  width: 16px;
  height: 16px;
  border-radius: 3px;
  border: 1px solid ${COLORS.black}33;
  display: inline-block;
  flex-shrink: 0;
  cursor: ${props => (props.editorMode === 'annotation' ? 'pointer' : 'default')};
`;

const InlineColorInput = styled.input`
  width: 24px;
  height: 24px;
  min-width: 24px;
  padding: 1px;
  border: 1px solid ${COLORS.gray500};
  border-radius: 3px;
  box-sizing: border-box;
  cursor: pointer;
  flex-shrink: 0;
`;

const InlineTagEditInput = styled.input`
  padding: 2px ${SPACING.xs};
  border: ${BORDERS.width} ${BORDERS.style} ${BORDERS.color};
  border-radius: ${BORDERS.radius};
  font-size: inherit;
  font-family: inherit;
  height: auto;
  box-sizing: border-box;
  flex-grow: 1;
  line-height: normal;
  min-height: 20px;
  margin-right: ${SPACING.xs};
  background-color: ${COLORS.white};
  color: ${COLORS.text};

  &:focus {
    border-color: ${COLORS.primary};
    box-shadow: 0 0 0 0.2rem ${COLORS.primary}40;
    outline: none;
  }
`;

const TagNameSpan = styled.span`
  flex-grow: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-left: ${SPACING.xs};
`;

const EditButton = styled.button`
  background: transparent;
  border: none;
  color: ${COLORS.textLight};
  padding: 0 ${SPACING.xs};
  font-size: 0.9em;
  line-height: 1;
  margin-left: ${SPACING.xs};
  flex-shrink: 0;
  min-width: auto;
  box-shadow: none;
  cursor: pointer;
  border-radius: ${BORDERS.radius};

  &:hover {
    color: ${COLORS.primary};
    background: ${COLORS.gray200};
  }
`;

const DeleteButton = styled.button`
  background: transparent;
  border: none;
  color: ${COLORS.textLight};
  padding: 0 ${SPACING.xs};
  font-size: 0.9em;
  line-height: 1;
  margin-left: 2px;
  flex-shrink: 0;
  min-width: auto;
  box-shadow: none;
  cursor: pointer;
  border-radius: ${BORDERS.radius};

  &:hover {
    color: ${COLORS.danger};
    background: ${COLORS.dangerLight};
  }
`;


const TagItem: React.FC<TagItemProps> = ({
  tag, level, hasChildren, isExpanded, isActive, isBeingDragged, isDragOverTarget,
  isEditingThisColor, isEditingThisName,
  currentColorInputValueForEdit, currentNameInputValueForEdit,
  onTagClick, onTagDoubleClick, onToggleExpand,
  onDragStart, onDragOverItem, onDragLeaveItem, onDropOnItem, onDragEnd,
  onStartColorEdit, onColorEditChange, onCommitColorEdit, onCancelColorEdit,
  onStartNameEdit, onNameEditChange, onCommitNameEdit, onCancelNameEdit,
  onDeleteTag,
  editorMode,
  entityLabel,
}) => {
  const label = entityLabel || '标签';
  const nameInputRef = useRef<HTMLInputElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingThisName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingThisName]);

  useEffect(() => {
    if (isEditingThisColor && colorInputRef.current) {
      colorInputRef.current.focus(); 
    }
  }, [isEditingThisColor]);

  const handleListItemClick = () => {
    if (isEditingThisColor || isEditingThisName) return;
    onTagClick(tag.id);
  };
  
  const handleNameSpanDoubleClick = (e: React.MouseEvent<HTMLSpanElement>) => {
    if (isEditingThisColor || isEditingThisName) return;
    e.stopPropagation();
    onTagDoubleClick(tag.name);
  };

  const handleEditNameButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (editorMode === 'annotation') {
      onStartNameEdit(tag.id, tag.name);
    }
  };

  const handleDeleteButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (editorMode === 'annotation') {
      onDeleteTag(tag.id, tag.name);
    }
  };

  const handleColorPreviewClick = (e: React.MouseEvent<HTMLSpanElement>) => {
    e.stopPropagation();
    if (editorMode === 'annotation') {
      onStartColorEdit(tag.id, tag.color);
    }
  };

  const handleFoldToggleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onToggleExpand(tag.id);
  };

  return (
    <StyledListItem
      level={level}
      isActive={isActive}
      isBeingDragged={isBeingDragged}
      isDragOverTarget={isDragOverTarget}
      onClick={handleListItemClick}
      role="option"
      aria-selected={isActive}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleListItemClick(); }}
      draggable={(editorMode === 'annotation' || editorMode === 'read') && !isEditingThisColor && !isEditingThisName}
      onDragStart={(e) => (editorMode === 'annotation' || editorMode === 'read') && !isEditingThisColor && !isEditingThisName && onDragStart(e, tag.id)}
      onDragOver={(e) => editorMode === 'annotation' && onDragOverItem(e, tag.id)}
      onDragLeave={(e) => editorMode === 'annotation' && onDragLeaveItem(e, tag.id)}
      onDrop={(e) => editorMode === 'annotation' && onDropOnItem(e, tag.id)}
      onDragEnd={(editorMode === 'annotation' || editorMode === 'read') ? onDragEnd : undefined}
    >
      {hasChildren ? (
        <FoldButton
          type="button"
          onClick={handleFoldToggleClick}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label={`${isExpanded ? '折叠' : '展开'}${label} "${tag.name}" 的子${label}`}
          aria-expanded={isExpanded}
          title={isExpanded ? '折叠' : '展开'}
        >
          {isExpanded ? '-' : '+'}
        </FoldButton>
      ) : (
        <FoldSpacer aria-hidden="true" />
      )}
      {editorMode === 'annotation' && isEditingThisColor ? (
        <InlineColorInput
          ref={colorInputRef}
          type="color"
          value={currentColorInputValueForEdit}
          onChange={(e) => onColorEditChange(e.target.value)}
          onBlur={() => onCommitColorEdit(tag.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { onCommitColorEdit(tag.id); e.preventDefault(); }
            else if (e.key === 'Escape') { onCancelColorEdit(); e.preventDefault(); }
          }}
          onClick={(e) => e.stopPropagation()}
          aria-label={`修改${label} ${tag.name} 的颜色`}
        />
      ) : (
        <ColorPreview
          style={{ backgroundColor: tag.color }}
          editorMode={editorMode}
          onClick={handleColorPreviewClick}
          title={editorMode === 'annotation' ? `点击修改颜色 (${tag.color})` : `颜色: ${tag.color}`}
          role={editorMode === 'annotation' ? "button" : undefined}
          aria-label={editorMode === 'annotation' ? `修改${label} ${tag.name} 的颜色` : `${label} ${tag.name} 的颜色预览`}
        />
      )}
      {editorMode === 'annotation' && isEditingThisName ? (
        <InlineTagEditInput
          ref={nameInputRef}
          type="text"
          value={currentNameInputValueForEdit}
          onChange={(e) => onNameEditChange(e.target.value)}
          onBlur={() => onCommitNameEdit(tag.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { onCommitNameEdit(tag.id); e.preventDefault(); }
            else if (e.key === 'Escape') { onCancelNameEdit(); e.preventDefault(); }
          }}
          onClick={(e) => e.stopPropagation()}
          aria-label={`重命名${label} ${tag.name}`}
        />
      ) : (
        <TagNameSpan
          onDoubleClick={handleNameSpanDoubleClick}
          title={`${tag.name} (双击全局搜索此名称)`}
        >
          {tag.name}
        </TagNameSpan>
      )}
      {editorMode === 'annotation' && !isEditingThisName && !isEditingThisColor && (
        <>
          <EditButton
            onClick={handleEditNameButtonClick}
            aria-label={`重命名${label} ${tag.name}`}
            title={`重命名${label}`}
          >
            ✏️
          </EditButton>
          <DeleteButton
            onClick={handleDeleteButtonClick}
            aria-label={`删除${label} ${tag.name}`}
            title={`删除${label}`}
          >
            🗑️
          </DeleteButton>
        </>
      )}
    </StyledListItem>
  );
};

export default TagItem;

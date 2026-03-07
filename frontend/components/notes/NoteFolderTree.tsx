import React, { DragEvent, useMemo, useState } from 'react';
import styled from '@emotion/styled';
import type { NoteFolder } from '../../types';
import { COLORS, SPACING, FONTS, BORDERS, globalPlaceholderTextStyles } from '../../styles';

type FolderSelection = string | null | '__all__';

interface NoteFolderTreeProps {
  folders: NoteFolder[];
  childrenByParentId: Map<string | null, NoteFolder[]>;
  selectedFolderId: FolderSelection;
  collapsedFolderIds: Set<string>;
  disabled?: boolean;
  onSelectFolder: (selection: FolderSelection) => void;
  onToggleFolderCollapsed: (folderId: string) => void;
  onEnsureFolderExpanded: (folderId: string) => void;
  onMoveFolder: (folderId: string, parentId: string | null) => void;
  onMoveEntry: (entryId: string, folderId: string | null) => void;
}

const List = styled.ul<{ $isDragOver: boolean }>`
  list-style: none;
  padding: ${SPACING.sm};
  margin: 0;
  flex: 1;
  overflow: auto;
  border: 1px solid ${COLORS.borderLight};
  border-radius: ${BORDERS.radius};
  background: ${COLORS.white};
  outline: 2px dashed ${props => (props.$isDragOver ? COLORS.primary : 'transparent')};
  transition: outline-color 0.2s;
  min-height: 0;
`;

const SpecialItem = styled.li<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: ${SPACING.sm};
  padding: ${SPACING.sm};
  margin-bottom: ${SPACING.sm};
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  background-color: ${props => (props.$active ? COLORS.highlightBackground : COLORS.gray100)};
  border: 2px solid ${props => (props.$active ? COLORS.primary : COLORS.gray300)};

  &:hover {
    background-color: ${props => (props.$active ? COLORS.highlightBackground : COLORS.gray200)};
    border-color: ${COLORS.primary};
  }
`;

const SpecialText = styled.span<{ $active: boolean }>`
  flex-grow: 1;
  font-size: ${FONTS.sizeBase};
  font-weight: ${props => (props.$active ? 'bold' : 'normal')};
  color: ${props => (props.$active ? COLORS.primary : COLORS.text)};
`;

const FolderRow = styled.li<{
  $level: number;
  $active: boolean;
  $isBeingDragged: boolean;
  $isDragOverTarget: boolean;
}>`
  padding: ${SPACING.xs} ${SPACING.sm} ${SPACING.xs} ${props => props.$level * parseInt(SPACING.lg) + parseInt(SPACING.sm)}px;
  margin-bottom: 2px;
  border-radius: ${BORDERS.radius};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: ${SPACING.sm};
  transition: background-color 0.1s, opacity 0.2s, outline 0.2s, color 0.1s;
  outline: 2px solid ${props => (props.$isDragOverTarget ? COLORS.primary : 'transparent')};
  color: ${props => (props.$active ? COLORS.primary : COLORS.text)};
  background-color: ${props => (props.$active ? COLORS.gray100 : 'transparent')};
  font-weight: ${props => (props.$active ? 'bold' : 'normal')};
  position: relative;
  opacity: ${props => (props.$isBeingDragged ? 0.5 : 1)};
  user-select: none;

  &:hover {
    background-color: ${props => (!props.$active ? COLORS.gray100 : COLORS.gray200)};
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

const FolderNameSpan = styled.span`
  flex-grow: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-left: ${SPACING.xs};
`;

const EmptyState = styled.li(globalPlaceholderTextStyles);

const NoteFolderTree: React.FC<NoteFolderTreeProps> = ({
  folders,
  childrenByParentId,
  selectedFolderId,
  collapsedFolderIds,
  disabled = false,
  onSelectFolder,
  onToggleFolderCollapsed,
  onEnsureFolderExpanded,
  onMoveFolder,
  onMoveEntry,
}) => {
  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [isDraggingOverListArea, setIsDraggingOverListArea] = useState<boolean>(false);

  const folderById = useMemo(() => new Map(folders.map((f) => [f.id, f] as const)), [folders]);

  const collectDescendantFolderIds = (rootId: string) => {
    const result = new Set<string>();
    const stack = [rootId];
    while (stack.length) {
      const id = stack.pop()!;
      if (result.has(id)) continue;
      result.add(id);
      const children = childrenByParentId.get(id) || [];
      children.forEach((child) => stack.push(child.id));
    }
    return result;
  };

  const NOTE_FOLDER_MIME = 'application/x-note-folder';
  const NOTE_ENTRY_MIME = 'application/x-note-entry';
  const NOTE_FOLDER_PREFIX = 'noteFolder:';
  const NOTE_ENTRY_PREFIX = 'noteEntry:';

  const readPrefixedPlain = (plain: string, prefix: string) => (plain.startsWith(prefix) ? plain.slice(prefix.length) : '');

  const readDraggedFolderId = (dt: DataTransfer) =>
    dt.getData(NOTE_FOLDER_MIME) || readPrefixedPlain(dt.getData('text/plain') || '', NOTE_FOLDER_PREFIX);

  const readDraggedEntryId = (dt: DataTransfer) =>
    dt.getData(NOTE_ENTRY_MIME) || readPrefixedPlain(dt.getData('text/plain') || '', NOTE_ENTRY_PREFIX);

  const handleDragStart = (e: DragEvent<HTMLLIElement>, folderId: string) => {
    if (disabled) return;
    e.dataTransfer.setData(NOTE_FOLDER_MIME, folderId);
    e.dataTransfer.setData('text/plain', `${NOTE_FOLDER_PREFIX}${folderId}`);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedFolderId(folderId);
  };

  const handleDragOverItem = (e: DragEvent<HTMLLIElement>, targetFolderId: string) => {
    if (disabled) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (targetFolderId !== dragOverFolderId) {
      setDragOverFolderId(targetFolderId);
    }
    setIsDraggingOverListArea(false);
  };

  const handleDragLeaveItem = (e: DragEvent<HTMLLIElement>, targetFolderId: string) => {
    if (disabled) return;
    if (
      dragOverFolderId === targetFolderId &&
      e.relatedTarget !== e.currentTarget &&
      !e.currentTarget.contains(e.relatedTarget as Node)
    ) {
      setDragOverFolderId(null);
    }
  };

  const handleDragOverList = (e: DragEvent<HTMLElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!dragOverFolderId) {
      setIsDraggingOverListArea(true);
    }
  };

  const handleDragLeaveList = (e: DragEvent<HTMLElement>) => {
    if (disabled) return;
    if (e.target === e.currentTarget) {
      setIsDraggingOverListArea(false);
    }
  };

  const resetDragState = () => {
    setDraggedFolderId(null);
    setDragOverFolderId(null);
    setIsDraggingOverListArea(false);
  };

  const handleDropOnItem = (e: DragEvent<HTMLLIElement>, potentialParentId: string) => {
    if (disabled) return;
    e.preventDefault();
    const droppedEntryId = readDraggedEntryId(e.dataTransfer);
    if (droppedEntryId) {
      onEnsureFolderExpanded(potentialParentId);
      onMoveEntry(droppedEntryId, potentialParentId);
      resetDragState();
      return;
    }

    const droppedFolderId = readDraggedFolderId(e.dataTransfer);
    resetDragState();

    if (!droppedFolderId || droppedFolderId === potentialParentId) return;

    const descendants = collectDescendantFolderIds(droppedFolderId);
    if (descendants.has(potentialParentId)) {
      alert('无法将文件夹移动到其自身的子文件夹下。');
      return;
    }

    const original = folderById.get(droppedFolderId);
    if (original && original.parentId === potentialParentId) return;

    onEnsureFolderExpanded(potentialParentId);
    onMoveFolder(droppedFolderId, potentialParentId);
  };

  const handleDropOnList = (e: DragEvent<HTMLElement>) => {
    if (disabled) return;
    e.preventDefault();
    const targetElement = e.target as HTMLElement;
    const draggableItem = targetElement.closest('li[draggable="true"]');
    if (draggableItem && e.currentTarget.contains(draggableItem)) {
      return;
    }

    const droppedFolderId = readDraggedFolderId(e.dataTransfer);
    resetDragState();
    if (!droppedFolderId) return;

    const original = folderById.get(droppedFolderId);
    if (original && original.parentId !== null) {
      onMoveFolder(droppedFolderId, null);
    }
  };

  const handleDragEnd = () => {
    resetDragState();
  };

  const renderFoldersRecursive = (parentId: string | null, level = 0): React.ReactElement[] => {
    const children = childrenByParentId.get(parentId) || [];
    return children.flatMap((folder) => {
      const childFolders = childrenByParentId.get(folder.id) || [];
      const hasChildren = childFolders.length > 0;
      const isExpanded = !collapsedFolderIds.has(folder.id);
      const isActive = selectedFolderId === folder.id;

      const row = (
        <FolderRow
          key={folder.id}
          $level={level}
          $active={isActive}
          $isBeingDragged={draggedFolderId === folder.id}
          $isDragOverTarget={dragOverFolderId === folder.id}
          onClick={() => onSelectFolder(folder.id)}
          role="option"
          aria-selected={isActive}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onSelectFolder(folder.id);
          }}
          draggable={!disabled}
          onDragStart={(e) => !disabled && handleDragStart(e, folder.id)}
          onDragOver={(e) => !disabled && handleDragOverItem(e, folder.id)}
          onDragLeave={(e) => !disabled && handleDragLeaveItem(e, folder.id)}
          onDrop={(e) => !disabled && handleDropOnItem(e, folder.id)}
          onDragEnd={!disabled ? handleDragEnd : undefined}
          title={folder.name}
        >
          {hasChildren ? (
            <FoldButton
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFolderCollapsed(folder.id);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              aria-label={`${isExpanded ? '折叠' : '展开'}文件夹 "${folder.name}" 的子文件夹`}
              aria-expanded={isExpanded}
              title={isExpanded ? '折叠' : '展开'}
            >
              {isExpanded ? '-' : '+'}
            </FoldButton>
          ) : (
            <FoldSpacer aria-hidden="true" />
          )}
          <FolderNameSpan>{folder.name}</FolderNameSpan>
        </FolderRow>
      );

      const descendants = hasChildren && isExpanded ? renderFoldersRecursive(folder.id, level + 1) : [];
      return [row, ...descendants];
    });
  };

  return (
    <List
      $isDragOver={isDraggingOverListArea && !dragOverFolderId}
      role="listbox"
      aria-label="笔记文件夹"
      onDragOver={handleDragOverList}
      onDragLeave={handleDragLeaveList}
      onDrop={handleDropOnList}
    >
      <SpecialItem
        $active={selectedFolderId === '__all__'}
        onClick={() => onSelectFolder('__all__')}
        role="option"
        aria-selected={selectedFolderId === '__all__'}
        title="显示全部笔记"
      >
        <SpecialText $active={selectedFolderId === '__all__'}>全部</SpecialText>
      </SpecialItem>
      <SpecialItem
        $active={selectedFolderId === null}
        onClick={() => onSelectFolder(null)}
        role="option"
        aria-selected={selectedFolderId === null}
        title="显示未分类的笔记"
        onDragOver={(e) => {
          if (disabled) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(e) => {
          if (disabled) return;
          e.preventDefault();
          const droppedEntryId = readDraggedEntryId(e.dataTransfer);
          resetDragState();
          if (!droppedEntryId) return;
          onMoveEntry(droppedEntryId, null);
        }}
      >
        <SpecialText $active={selectedFolderId === null}>待整理</SpecialText>
      </SpecialItem>

      {folders.length > 0 ? renderFoldersRecursive(null) : <EmptyState>暂无文件夹</EmptyState>}
    </List>
  );
};

export default NoteFolderTree;

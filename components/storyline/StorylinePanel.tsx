import React, { useState, useRef, useEffect, DragEvent } from 'react';
import styled from '@emotion/styled';
import type { Storyline } from "../types";
import { getNextColor } from "../../utils";
import { COLORS, SPACING, FONTS, BORDERS, SHADOWS, panelStyles, globalPlaceholderTextStyles } from '../../styles';

interface StorylinePanelProps {
  storylines: Storyline[];
  activeStorylineId: string | null;
  onAddStoryline: (name: string, color: string, parentId: string | null) => void;
  onUpdateStoryline: (id: string, updates: Partial<Storyline>) => void;
  onDeleteStoryline: (id: string) => void;
  onSelectStoryline: (id: string | null) => void;
  style?: React.CSSProperties;
}

const PanelContainer = styled.div`
  ${panelStyles as any}
  display: flex;
  flex-direction: column;
`;

const Title = styled.h2`
  font-size: ${FONTS.sizeH3};
  color: ${COLORS.dark};
  margin-bottom: ${SPACING.lg};
`;

const StorylineForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.md};
  margin-bottom: ${SPACING.lg};
`;

const InputGroup = styled.div`
  display: flex;
  gap: ${SPACING.elementGap};
  align-items: center;
`;

const StorylineInput = styled.input`
  padding: ${SPACING.sm};
  border: ${BORDERS.width} ${BORDERS.style} ${BORDERS.color};
  border-radius: ${BORDERS.radius};
  font-size: ${FONTS.sizeSmall};
  flex-grow: 1;
  background-color: ${COLORS.white};
  color: ${COLORS.text};
  &:focus {
    border-color: ${COLORS.primary};
    box-shadow: 0 0 0 0.2rem ${COLORS.primary}40;
    outline: none;
  }
`;

const ColorInput = styled.input`
  min-width: 40px;
  height: 38px;
  padding: 2px;
  border: 1px solid ${COLORS.border};
  border-radius: ${BORDERS.radius};
  cursor: pointer;
`;

const AddButton = styled.button`
  padding: ${SPACING.sm} ${SPACING.lg};
  background-color: ${COLORS.primary};
  color: ${COLORS.white};
  border: none;
  border-radius: ${BORDERS.radius};
  cursor: pointer;
  align-self: flex-start;
  &:hover { background-color: ${COLORS.primaryHover}; }
`;

const ParentSelect = styled.select`
  padding: ${SPACING.sm};
  border: ${BORDERS.width} ${BORDERS.style} ${BORDERS.color};
  border-radius: ${BORDERS.radius};
  background-color: ${COLORS.white};
  font-size: ${FONTS.sizeSmall};
  width: 100%;
  &:focus {
    border-color: ${COLORS.primary};
    box-shadow: 0 0 0 0.2rem ${COLORS.primary}40;
    outline: none;
  }
`;


const ListContainer = styled.div`
  flex-grow: 1;
  overflow-y: auto;
`;

const StorylineList = styled.ul<{ isDragOver: boolean }>`
  list-style: none;
  padding: 0;
  margin: 0;
  outline: 2px dashed ${props => (props.isDragOver ? COLORS.primary : 'transparent')};
  transition: outline-color 0.2s;
  min-height: 50px;
`;

const StorylineItem = styled.li<{ isActive: boolean; level: number; isDragOverTarget: boolean; isBeingDragged: boolean; }>`
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px ${SPACING.xs};
  padding-left: ${props => props.level * 20 + 4}px;
  border-radius: ${BORDERS.radius};
  cursor: pointer;
  border: 1px solid transparent;
  outline: 2px solid ${props => props.isDragOverTarget ? COLORS.primary : 'transparent'};
  opacity: ${props => props.isBeingDragged ? 0.5 : 1};
  
  ${props => props.isActive && `
    border-color: ${COLORS.primary};
    background-color: ${COLORS.white};
  `}
  
  &:hover {
    background-color: ${props => (props.isActive ? COLORS.white : COLORS.gray100)};
  }
`;

const ColorPreview = styled.div`
  width: 16px;
  height: 16px;
  border-radius: 3px;
  border: 1px solid rgba(0,0,0,0.1);
  flex-shrink: 0;
`;

const StorylineName = styled.span`
  flex-grow: 1;
  word-break: break-word;
`;

const ActionButton = styled.button`
  background: none; border: none; cursor: pointer; padding: ${SPACING.xs};
  color: ${COLORS.textLighter};
  &:hover { color: ${COLORS.primary}; }
`;

const Placeholder = styled.div(globalPlaceholderTextStyles);

// Helper function (can be moved to utils if needed elsewhere)
const getAllDescendantIds = (storylineId: string, allStorylines: Storyline[]): string[] => {
  const descendants: string[] = [];
  const queue: string[] = [storylineId];
  const visited = new Set<string>([storylineId]);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = allStorylines.filter(s => s.parentId === currentId);
    for (const child of children) {
      if (!visited.has(child.id)) {
        visited.add(child.id);
        descendants.push(child.id);
        queue.push(child.id);
      }
    }
  }
  return descendants;
};


const StorylinePanel: React.FC<StorylinePanelProps> = ({
  storylines, activeStorylineId, onAddStoryline, onUpdateStoryline, onDeleteStoryline, onSelectStoryline, style
}) => {
  const [newStorylineName, setNewStorylineName] = useState('');
  const [newStorylineColor, setNewStorylineColor] = useState(getNextColor());
  const [newStorylineParent, setNewStorylineParent] = useState<string | null>(null);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [isDraggingOverList, setIsDraggingOverList] = useState(false);


  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newStorylineName.trim()) {
      onAddStoryline(newStorylineName.trim(), newStorylineColor, newStorylineParent);
      setNewStorylineName('');
      setNewStorylineColor(getNextColor());
      setNewStorylineParent(null);
    }
  };

  const handleStartEdit = (storyline: Storyline) => {
    setEditingId(storyline.id);
    setEditingName(storyline.name);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleCommitEdit = () => {
    if (editingId && editingName.trim()) {
      onUpdateStoryline(editingId, { name: editingName.trim() });
    }
    handleCancelEdit();
  };
  
  const confirmDelete = (id: string, name: string) => {
    if (window.confirm(`您确定要删除故事线 "${name}" 吗？其子故事线将移至上级。`)) {
      onDeleteStoryline(id);
    }
  };

  // --- Drag & Drop Handlers ---
  const handleDragStart = (e: DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedId(id);
  };

  const handleDragOverItem = (e: DragEvent, id: string) => {
    e.preventDefault();
    if (id !== dragOverId) {
      setDragOverId(id);
    }
    setIsDraggingOverList(false);
  };
  
  const handleDragLeaveItem = () => {
     setDragOverId(null);
  };

  const handleDragOverList = (e: DragEvent) => {
    e.preventDefault();
    if (!dragOverId) {
        setIsDraggingOverList(true);
    }
  };

  const handleDragLeaveList = (e: DragEvent) => {
    if (e.target === e.currentTarget) {
      setIsDraggingOverList(false);
    }
  };

  const handleDropOnItem = (e: DragEvent, parentId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedId = e.dataTransfer.getData('text/plain');
    if (!droppedId || droppedId === parentId) return;

    const descendants = getAllDescendantIds(droppedId, storylines);
    if (descendants.includes(parentId)) {
      alert("不能将故事线移动到其自己的子级下。");
      return;
    }
    
    onUpdateStoryline(droppedId, { parentId });
    handleDragEnd();
  };
  
  const handleDropOnList = (e: DragEvent) => {
    e.preventDefault();
    const droppedId = e.dataTransfer.getData('text/plain');
    const original = storylines.find(s => s.id === droppedId);
    if (original && original.parentId !== null) {
      onUpdateStoryline(droppedId, { parentId: null });
    }
    handleDragEnd();
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
    setIsDraggingOverList(false);
  };


  const renderStorylinesRecursive = (parentId: string | null, level: number = 0) => {
    return storylines
      .filter(sl => sl.parentId === parentId)
      .sort((a,b) => a.name.localeCompare(b.name))
      .map(sl => (
        <React.Fragment key={sl.id}>
          <StorylineItem
            isActive={sl.id === activeStorylineId && !editingId}
            level={level}
            isDragOverTarget={dragOverId === sl.id}
            isBeingDragged={draggedId === sl.id}
            onClick={() => onSelectStoryline(sl.id === activeStorylineId ? null : sl.id)}
            draggable={!editingId}
            onDragStart={e => handleDragStart(e, sl.id)}
            onDragOver={e => handleDragOverItem(e, sl.id)}
            onDragLeave={handleDragLeaveItem}
            onDrop={e => handleDropOnItem(e, sl.id)}
            onDragEnd={handleDragEnd}
          >
            <ColorPreview style={{ backgroundColor: sl.color }} />
            {editingId === sl.id ? (
              <StorylineInput
                ref={inputRef}
                value={editingName}
                onChange={e => setEditingName(e.target.value)}
                onBlur={handleCommitEdit}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCommitEdit();
                  if (e.key === 'Escape') handleCancelEdit();
                }}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <StorylineName>{sl.name}</StorylineName>
            )}
            
            <ActionButton onClick={(e) => { e.stopPropagation(); handleStartEdit(sl); }} title="重命名">✏️</ActionButton>
            <ActionButton onClick={(e) => { e.stopPropagation(); confirmDelete(sl.id, sl.name); }} title="删除">🗑️</ActionButton>
          </StorylineItem>
          {renderStorylinesRecursive(sl.id, level + 1)}
        </React.Fragment>
      ));
  };

  return (
    <PanelContainer style={style}>
      <Title>故事线管理</Title>
      <StorylineForm onSubmit={handleAddSubmit}>
        <InputGroup>
          <StorylineInput
            type="text"
            value={newStorylineName}
            onChange={e => setNewStorylineName(e.target.value)}
            placeholder="新故事线名称"
            required
          />
          <ColorInput
            type="color"
            value={newStorylineColor}
            onChange={e => setNewStorylineColor(e.target.value)}
          />
        </InputGroup>
        <InputGroup>
          <ParentSelect value={newStorylineParent || ''} onChange={e => setNewStorylineParent(e.target.value || null)}>
            <option value="">作为顶级故事线</option>
            {storylines.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </ParentSelect>
        </InputGroup>
        <AddButton type="submit">创建故事线</AddButton>
      </StorylineForm>
      <ListContainer>
        {storylines.length > 0 ? (
          <StorylineList 
            isDragOver={isDraggingOverList}
            onDragOver={handleDragOverList}
            onDragLeave={handleDragLeaveList}
            onDrop={handleDropOnList}
          >
            {renderStorylinesRecursive(null, 0)}
          </StorylineList>
        ) : (
          <Placeholder>
            <p>还没有故事线。</p>
            <p>尝试创建一个，例如“主线”。</p>
          </Placeholder>
        )}
      </ListContainer>
    </PanelContainer>
  );
};

export default StorylinePanel;
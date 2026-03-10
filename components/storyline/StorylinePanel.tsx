import React, { useState, useRef, useEffect, useMemo, useCallback, DragEvent } from 'react';
import styled from '@emotion/styled';
import type { PlotAnchor, Storyline } from "../types";
import { getNextColor } from "../../utils";
import { COLORS, SPACING, FONTS, BORDERS, SHADOWS, panelStyles, globalPlaceholderTextStyles } from '../../styles';

interface StorylinePanelProps {
  storylines: Storyline[];
  plotAnchors: PlotAnchor[];
  activeStorylineId: string | null;
  onAddStoryline: (name: string, color: string, parentId: string | null) => void;
  onBatchAddStorylines: (items: Array<{ path: string; color?: string }>) => Promise<{ createdCount: number; skippedCount: number }>;
  onBatchDeleteStorylines: (
    storylineIds: string[]
  ) => Promise<{ deletedCount: number; affectedAnchorCount: number; pendingAnchorCount: number }>;
  onUpdateStoryline: (id: string, updates: Partial<Storyline>) => void;
  onReorderStoryline: (draggedId: string, targetId: string, position: 'before' | 'after') => void;
  onDeleteStoryline: (id: string) => void;
  onSelectStoryline: (id: string | null) => void;
  onDragStateChange?: (state: { draggedId: string | null; dragOverId: string | null; isDraggingOverList: boolean }) => void;
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

const SecondaryButton = styled.button`
  padding: ${SPACING.sm} ${SPACING.lg};
  background-color: ${COLORS.gray200};
  color: ${COLORS.text};
  border: ${BORDERS.width} ${BORDERS.style} ${COLORS.gray300};
  border-radius: ${BORDERS.radius};
  cursor: pointer;
  align-self: flex-start;
  transition: background-color 0.2s, box-shadow 0.2s;
  &:hover {
    background-color: ${COLORS.gray300};
    box-shadow: ${SHADOWS.small};
  }
`;

const ButtonRow = styled.div`
  display: flex;
  gap: ${SPACING.sm};
`;

const DangerButton = styled(SecondaryButton)`
  color: ${COLORS.danger};
  border-color: ${COLORS.danger};

  &:hover:not(:disabled) {
    background-color: #ffe9ea;
    border-color: ${COLORS.dangerHover};
    color: ${COLORS.dangerHover};
  }
`;

const BatchBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${SPACING.sm};
  padding: ${SPACING.sm};
  margin-bottom: ${SPACING.md};
  border: ${BORDERS.width} ${BORDERS.style} ${COLORS.danger};
  border-radius: ${BORDERS.radius};
  background-color: #fff5f5;
`;

const BatchInfo = styled.div`
  width: 100%;
  color: ${COLORS.danger};
  font-size: ${FONTS.sizeSmall};
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

const BulkImportContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.sm};
  padding: ${SPACING.sm};
  margin-bottom: ${SPACING.lg};
  border: ${BORDERS.width} ${BORDERS.style} ${COLORS.gray300};
  border-radius: ${BORDERS.radius};
  background-color: ${COLORS.gray100};
`;

const BulkImportTitle = styled.div`
  font-size: ${FONTS.sizeSmall};
  font-weight: 600;
  color: ${COLORS.dark};
`;

const BulkImportTextarea = styled.textarea`
  width: 100%;
  min-height: 140px;
  padding: ${SPACING.sm};
  border: ${BORDERS.width} ${BORDERS.style} ${BORDERS.color};
  border-radius: ${BORDERS.radius};
  font-size: ${FONTS.sizeSmall};
  line-height: 1.5;
  resize: vertical;
  background-color: ${COLORS.white};
  color: ${COLORS.text};
  box-sizing: border-box;

  &:focus {
    border-color: ${COLORS.primary};
    box-shadow: 0 0 0 0.2rem ${COLORS.primary}40;
    outline: none;
  }
`;

const BulkImportHint = styled.div`
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.textLight};
  line-height: 1.5;
`;

const ImportButton = styled.button`
  padding: ${SPACING.sm} ${SPACING.lg};
  background-color: ${COLORS.secondary};
  color: ${COLORS.white};
  border: none;
  border-radius: ${BORDERS.radius};
  cursor: pointer;
  transition: background-color 0.2s, box-shadow 0.2s;

  &:hover:not(:disabled) {
    background-color: ${COLORS.secondaryHover};
    box-shadow: ${SHADOWS.small};
  }

  &:disabled {
    background-color: ${COLORS.gray300};
    cursor: not-allowed;
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

const StorylineItem = styled.li<{
  isActive: boolean;
  level: number;
  isDragOverTarget: boolean;
  isBeingDragged: boolean;
}>`
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px ${SPACING.xs};
  padding-left: ${props => props.level * 20 + 4}px;
  border-radius: ${BORDERS.radius};
  cursor: pointer;
  border: 1px solid transparent;
  outline: 2px solid ${props => (props.isDragOverTarget ? COLORS.primary : 'transparent')};
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

const RowColorInput = styled.input`
  width: 16px;
  height: 16px;
  padding: 0;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 3px;
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;

  &::-webkit-color-swatch-wrapper {
    padding: 0;
    border-radius: 2px;
  }

  &::-webkit-color-swatch {
    border: none;
    border-radius: 2px;
  }
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

const BatchCheckbox = styled.input`
  width: 16px;
  height: 16px;
  margin: 0;
  cursor: pointer;
  flex-shrink: 0;
`;

const ExpandToggleButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: ${SPACING.xs};
  color: ${COLORS.textLight};
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 4px;

  &:hover {
    background-color: ${COLORS.gray200};
    color: ${COLORS.text};
  }
`;

const DropActionMenu = styled.div`
  position: fixed;
  z-index: 1200;
  min-width: 160px;
  padding: ${SPACING.xs};
  border: 1px solid ${COLORS.gray300};
  border-radius: ${BORDERS.radius};
  background-color: ${COLORS.white};
  box-shadow: ${SHADOWS.medium};
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const DropActionButton = styled.button`
  border: none;
  background: transparent;
  color: ${COLORS.text};
  text-align: left;
  padding: ${SPACING.xs} ${SPACING.sm};
  border-radius: 4px;
  font-size: ${FONTS.sizeSmall};
  cursor: pointer;

  &:hover {
    background-color: ${COLORS.gray100};
  }
`;

const DropActionCancel = styled(DropActionButton)`
  color: ${COLORS.textLight};
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

const parseBulkStorylineInput = (input: string): Array<{ path: string; color?: string }> => {
  const items: Array<{ path: string; color?: string }> = [];
  const nameStack: string[] = [];
  const indentWidthStack: number[] = [0];
  const lines = input.split(/\r?\n/);

  const getIndentWidth = (rawLine: string): number => {
    const indentMatch = rawLine.match(/^[\t \u3000]*/);
    const indentRaw = indentMatch ? indentMatch[0] : '';
    // Support tab/full-width spaces while keeping previous 2-space semantics.
    return indentRaw
      .replace(/\t/g, '  ')
      .replace(/\u3000/g, '  ')
      .length;
  };

  const resolveIndentLevel = (indentWidth: number): number => {
    if (indentWidth <= 0) {
      indentWidthStack.length = 1;
      return 0;
    }

    let exactLevel = -1;
    for (let i = 0; i < indentWidthStack.length; i += 1) {
      if (indentWidthStack[i] === indentWidth) {
        exactLevel = i;
        break;
      }
    }

    if (exactLevel !== -1) {
      indentWidthStack.length = exactLevel + 1;
      return exactLevel;
    }

    const currentWidth = indentWidthStack[indentWidthStack.length - 1];
    if (indentWidth > currentWidth) {
      indentWidthStack.push(indentWidth);
      return indentWidthStack.length - 1;
    }

    let parentLevel = -1;
    for (let i = indentWidthStack.length - 1; i >= 0; i -= 1) {
      if (indentWidthStack[i] < indentWidth) {
        parentLevel = i;
        break;
      }
    }

    if (parentLevel === -1) {
      indentWidthStack.length = 1;
      indentWidthStack.push(indentWidth);
      return 1;
    }

    indentWidthStack.length = parentLevel + 1;
    indentWidthStack.push(indentWidth);
    return indentWidthStack.length - 1;
  };

  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;
    if (/^(#|\/\/)/.test(line)) continue;

    line = line.replace(/^([-*•]+|\d+[.)])\s+/, '').trim();
    if (!line) continue;

    let color: string | undefined;
    const colorMatch = line.match(/\s(#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}))\s*$/);
    if (colorMatch) {
      color = colorMatch[1];
      line = line.slice(0, line.length - colorMatch[0].length).trim();
    }
    if (!line) continue;

    let segments: string[] = [];
    if (/[>＞]/.test(line)) {
      segments = line
        .split(/[>＞]/)
        .map((segment) => segment.trim())
        .filter(Boolean);
    } else {
      const indentWidth = getIndentWidth(rawLine);
      const indentLevel = resolveIndentLevel(indentWidth);
      nameStack[indentLevel] = line;
      nameStack.length = indentLevel + 1;
      segments = nameStack.filter(Boolean);
    }

    if (segments.length === 0) continue;

    items.push({
      path: segments.join('/'),
      color,
    });
  }

  return items;
};

const COLOR_UPDATE_DEBOUNCE_MS = 800;


const StorylinePanel: React.FC<StorylinePanelProps> = ({
  storylines,
  plotAnchors,
  activeStorylineId,
  onAddStoryline,
  onBatchAddStorylines,
  onBatchDeleteStorylines,
  onUpdateStoryline,
  onReorderStoryline,
  onDeleteStoryline,
  onSelectStoryline,
  onDragStateChange,
  style
}) => {
  const [newStorylineName, setNewStorylineName] = useState('');
  const [newStorylineColor, setNewStorylineColor] = useState(getNextColor());
  const [newStorylineParent, setNewStorylineParent] = useState<string | null>(null);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [bulkImportText, setBulkImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isBatchDeleteMode, setIsBatchDeleteMode] = useState(false);
  const [selectedStorylineIds, setSelectedStorylineIds] = useState<Set<string>>(new Set());
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [collapsedStorylineIds, setCollapsedStorylineIds] = useState<Set<string>>(new Set());
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [isDraggingOverList, setIsDraggingOverList] = useState(false);
  const [dropActionMenu, setDropActionMenu] = useState<{
    draggedId: string;
    targetId: string;
    x: number;
    y: number;
  } | null>(null);
  const dropActionMenuRef = useRef<HTMLDivElement>(null);
  const colorUpdateTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingColorUpdatesRef = useRef<Map<string, string>>(new Map());
  const storylineColorByIdRef = useRef<Map<string, string>>(new Map());

  const handleToggleStorylineCollapsed = useCallback((storylineId: string) => {
    setCollapsedStorylineIds((prev) => {
      const next = new Set(prev);
      if (next.has(storylineId)) {
        next.delete(storylineId);
      } else {
        next.add(storylineId);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    storylineColorByIdRef.current = new Map(storylines.map((storyline) => [storyline.id, storyline.color]));
  }, [storylines]);

  useEffect(() => {
    const validIds = new Set(storylines.map((storyline) => storyline.id));
    setCollapsedStorylineIds((prev) => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (validIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [storylines]);


  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  useEffect(() => {
    if (activeStorylineId && storylines.some((s) => s.id === activeStorylineId)) {
      setNewStorylineParent(activeStorylineId);
      return;
    }
    setNewStorylineParent(null);
  }, [activeStorylineId, storylines]);

  useEffect(() => {
    const currentIds = new Set(storylines.map((s) => s.id));
    setSelectedStorylineIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set(Array.from(prev).filter((id) => currentIds.has(id)));
      if (next.size === prev.size) return prev;
      return next;
    });
  }, [storylines]);

  useEffect(() => {
    if (!isBatchDeleteMode) return;
    setEditingId(null);
    setEditingName('');
    setDropActionMenu(null);
    setDraggedId(null);
    setDragOverId(null);
    setIsDraggingOverList(false);
  }, [isBatchDeleteMode]);

  useEffect(() => {
    if (!dropActionMenu) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (dropActionMenuRef.current && target && !dropActionMenuRef.current.contains(target)) {
        setDropActionMenu(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [dropActionMenu]);

  useEffect(() => {
    onDragStateChange?.({ draggedId, dragOverId, isDraggingOverList });
  }, [draggedId, dragOverId, isDraggingOverList, onDragStateChange]);

  useEffect(() => {
    return () => {
      onDragStateChange?.({ draggedId: null, dragOverId: null, isDraggingOverList: false });
    };
  }, [onDragStateChange]);

  useEffect(() => {
    return () => {
      colorUpdateTimersRef.current.forEach((timer) => clearTimeout(timer));
      colorUpdateTimersRef.current.clear();
      pendingColorUpdatesRef.current.clear();
    };
  }, []);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newStorylineName.trim()) {
      onAddStoryline(newStorylineName.trim(), newStorylineColor, newStorylineParent);
      setNewStorylineName('');
      setNewStorylineColor(getNextColor());
      setNewStorylineParent(null);
    }
  };

  const handleBulkImport = async () => {
    const parsedItems = parseBulkStorylineInput(bulkImportText);
    if (parsedItems.length === 0) {
      alert('没有解析到可导入的剧情线，请检查输入格式。');
      return;
    }

    setIsImporting(true);
    try {
      const result = await onBatchAddStorylines(parsedItems);
      alert(`导入完成：新增 ${result.createdCount} 条，跳过 ${result.skippedCount} 条。`);
      if (result.createdCount > 0) {
        setBulkImportText('');
      }
    } catch (error) {
      console.error('批量导入剧情线失败:', error);
      alert('批量导入剧情线失败,请稍后重试');
    } finally {
      setIsImporting(false);
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

  const flushStorylineColorUpdate = (storylineId: string) => {
    const timer = colorUpdateTimersRef.current.get(storylineId);
    if (timer) {
      clearTimeout(timer);
      colorUpdateTimersRef.current.delete(storylineId);
    }

    const pendingColor = pendingColorUpdatesRef.current.get(storylineId);
    if (!pendingColor) return;
    pendingColorUpdatesRef.current.delete(storylineId);

    const currentColor = storylineColorByIdRef.current.get(storylineId);
    if (!currentColor) return;
    if (currentColor.toLowerCase() === pendingColor.toLowerCase()) return;

    onUpdateStoryline(storylineId, { color: pendingColor });
  };

  const handleStorylineColorChange = (storylineId: string, color: string) => {
    pendingColorUpdatesRef.current.set(storylineId, color);

    const existingTimer = colorUpdateTimersRef.current.get(storylineId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      flushStorylineColorUpdate(storylineId);
    }, COLOR_UPDATE_DEBOUNCE_MS);
    colorUpdateTimersRef.current.set(storylineId, timer);
  };

  const getCascadeDeleteSet = (ids: Iterable<string>) => {
    const next = new Set<string>();
    for (const id of ids) {
      next.add(id);
      const descendants = getAllDescendantIds(id, storylines);
      descendants.forEach((descendantId) => next.add(descendantId));
    }
    return next;
  };

  const computeDeleteImpact = (ids: Iterable<string>) => {
    const cascadeIds = getCascadeDeleteSet(ids);
    const affectedAnchors = plotAnchors.filter((anchor) =>
      anchor.storylineIds.some((storylineId) => cascadeIds.has(storylineId))
    );
    const pendingAfterDeleteCount = affectedAnchors.filter((anchor) => {
      const remaining = anchor.storylineIds.filter((storylineId) => !cascadeIds.has(storylineId));
      return remaining.length === 0;
    }).length;

    return {
      cascadeIds,
      deleteCount: cascadeIds.size,
      affectedAnchorCount: affectedAnchors.length,
      pendingAfterDeleteCount,
    };
  };

  const toggleBatchMode = () => {
    if (isBatchDeleteMode) {
      setIsBatchDeleteMode(false);
      setSelectedStorylineIds(new Set());
      return;
    }
    setIsBatchDeleteMode(true);
  };

  const toggleStorylineChecked = (storylineId: string) => {
    setSelectedStorylineIds((prev) => {
      const next = new Set(prev);
      const cascadeSet = getCascadeDeleteSet([storylineId]);
      if (next.has(storylineId)) {
        cascadeSet.forEach((id) => next.delete(id));
      } else {
        cascadeSet.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleSelectAllForBatchDelete = () => {
    setSelectedStorylineIds(new Set(storylines.map((s) => s.id)));
  };

  const handleClearBatchDeleteSelection = () => {
    setSelectedStorylineIds(new Set());
  };

  const handleInvertBatchDeleteSelection = () => {
    setSelectedStorylineIds((prev) => {
      const allIds = storylines.map((s) => s.id);
      const next = new Set<string>();
      allIds.forEach((id) => {
        if (!prev.has(id)) next.add(id);
      });
      return next;
    });
  };

  const handleBatchDeleteConfirm = async () => {
    if (selectedStorylineIds.size === 0) {
      alert('请先选择要删除的故事线。');
      return;
    }

    const impact = computeDeleteImpact(selectedStorylineIds);
    const confirmed = window.confirm(
      [
        `确定删除选中的故事线吗？`,
        `将删除故事线：${impact.deleteCount} 条`,
        `影响锚点：${impact.affectedAnchorCount} 个`,
        `将转为待归类：${impact.pendingAfterDeleteCount} 个`,
        '',
        '此操作不可撤销。',
      ].join('\n')
    );
    if (!confirmed) return;

    setIsBatchDeleting(true);
    try {
      const result = await onBatchDeleteStorylines(Array.from(selectedStorylineIds));
      setSelectedStorylineIds(new Set());
      setIsBatchDeleteMode(false);
      alert(
        `批量删除完成：删除故事线 ${result.deletedCount} 条，影响锚点 ${result.affectedAnchorCount} 个，转为待归类 ${result.pendingAnchorCount} 个。`
      );
    } catch (error) {
      console.error('批量删除剧情线失败:', error);
      alert('批量删除剧情线失败,请稍后重试');
    } finally {
      setIsBatchDeleting(false);
    }
  };
  
  const confirmDelete = (id: string, name: string) => {
    if (window.confirm(`您确定要删除故事线 "${name}" 吗？其子故事线将移至上级。`)) {
      onDeleteStoryline(id);
    }
  };

  // --- Drag & Drop Handlers ---
  const handleDragStart = (e: DragEvent, id: string) => {
    if (isBatchDeleteMode) return;
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedId(id);
  };

  const handleDragOverItem = (e: DragEvent, id: string) => {
    if (isBatchDeleteMode) return;
    e.preventDefault();
    if (id !== dragOverId) {
      setDragOverId(id);
    }
    setIsDraggingOverList(false);
  };
  
  const handleDragLeaveItem = (id: string) => {
    if (dragOverId === id) {
      setDragOverId(null);
    }
  };

  const handleDragOverList = (e: DragEvent) => {
    if (isBatchDeleteMode) return;
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

  const handleDropOnItem = (e: DragEvent, targetId: string) => {
    if (isBatchDeleteMode) return;
    e.preventDefault();
    e.stopPropagation();
    const droppedId = e.dataTransfer.getData('text/plain');
    if (!droppedId || droppedId === targetId) return;
    const menuWidth = 180;
    const menuHeight = 132;
    const safeX = Math.min(Math.max(8, e.clientX), Math.max(8, window.innerWidth - menuWidth - 8));
    const safeY = Math.min(Math.max(8, e.clientY), Math.max(8, window.innerHeight - menuHeight - 8));
    setDropActionMenu({
      draggedId: droppedId,
      targetId,
      x: safeX,
      y: safeY,
    });
    handleDragEnd();
  };
  
  const handleDropOnList = (e: DragEvent) => {
    if (isBatchDeleteMode) return;
    e.preventDefault();
    const droppedId = e.dataTransfer.getData('text/plain');
    const original = storylines.find(s => s.id === droppedId);
    if (original && original.parentId !== null) {
      onUpdateStoryline(droppedId, { parentId: null });
    }
    handleDragEnd();
  };

  const handleDragEnd = () => {
    if (isBatchDeleteMode) return;
    setDraggedId(null);
    setDragOverId(null);
    setIsDraggingOverList(false);
  };

  const handleDropAction = (action: 'before' | 'after' | 'inside') => {
    if (!dropActionMenu) return;

    const { draggedId, targetId } = dropActionMenu;
    if (action === 'before' || action === 'after') {
      onReorderStoryline(draggedId, targetId, action);
      setDropActionMenu(null);
      return;
    }

    const descendants = getAllDescendantIds(draggedId, storylines);
    if (descendants.includes(targetId)) {
      alert("不能将故事线移动到其自己的子级下。");
      setDropActionMenu(null);
      return;
    }

    onUpdateStoryline(draggedId, { parentId: targetId });
    setDropActionMenu(null);
  };

  const childrenByParentId = useMemo(() => {
    const map = new Map<string | null, Storyline[]>();
    storylines.forEach((storyline) => {
      const parentKey = storyline.parentId ?? null;
      const current = map.get(parentKey) || [];
      current.push(storyline);
      map.set(parentKey, current);
    });
    return map;
  }, [storylines]);

  const renderStorylinesRecursive = (parentId: string | null, level: number = 0) => {
    const currentLevelStorylines = childrenByParentId.get(parentId) || [];
    return currentLevelStorylines.map(sl => {
      const children = childrenByParentId.get(sl.id) || [];
      const hasChildren = children.length > 0;
      const isCollapsed = collapsedStorylineIds.has(sl.id);
      return (
        <React.Fragment key={sl.id}>
          <StorylineItem
            isActive={!isBatchDeleteMode && sl.id === activeStorylineId && !editingId}
            level={level}
            isDragOverTarget={dragOverId === sl.id}
            isBeingDragged={draggedId === sl.id}
            onClick={() => {
              if (isBatchDeleteMode) {
                toggleStorylineChecked(sl.id);
                return;
              }
              onSelectStoryline(sl.id === activeStorylineId ? null : sl.id);
            }}
            draggable={!editingId && !isBatchDeleteMode}
            onDragStart={e => handleDragStart(e, sl.id)}
            onDragOver={e => handleDragOverItem(e, sl.id)}
            onDragLeave={() => handleDragLeaveItem(sl.id)}
            onDrop={e => handleDropOnItem(e, sl.id)}
            onDragEnd={handleDragEnd}
          >
            {isBatchDeleteMode && (
              <BatchCheckbox
                type="checkbox"
                checked={selectedStorylineIds.has(sl.id)}
                onChange={() => toggleStorylineChecked(sl.id)}
                onClick={(e) => e.stopPropagation()}
                aria-label={`选择删除故事线 ${sl.name}`}
              />
            )}
            {hasChildren ? (
              <ExpandToggleButton
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleStorylineCollapsed(sl.id);
                }}
                title={isCollapsed ? '展开子剧情' : '折叠子剧情'}
                aria-label={isCollapsed ? '展开子剧情' : '折叠子剧情'}
              >
                {isCollapsed ? '▸' : '▾'}
              </ExpandToggleButton>
            ) : (
              <span style={{ width: 20, flexShrink: 0 }} />
            )}
            {isBatchDeleteMode ? (
              <ColorPreview style={{ backgroundColor: sl.color }} />
            ) : (
              <RowColorInput
                key={`${sl.id}:${sl.color}`}
                type="color"
                defaultValue={sl.color}
                title="修改颜色"
                aria-label={`修改故事线 ${sl.name} 颜色`}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onDragStart={(e) => e.preventDefault()}
                onChange={(e) => handleStorylineColorChange(sl.id, e.target.value)}
                onBlur={() => flushStorylineColorUpdate(sl.id)}
              />
            )}
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

            {!isBatchDeleteMode && (
              <>
                <ActionButton onClick={(e) => { e.stopPropagation(); handleStartEdit(sl); }} title="重命名">✏️</ActionButton>
                <ActionButton onClick={(e) => { e.stopPropagation(); confirmDelete(sl.id, sl.name); }} title="删除">🗑️</ActionButton>
              </>
            )}
          </StorylineItem>
          {!isCollapsed && renderStorylinesRecursive(sl.id, level + 1)}
        </React.Fragment>
      );
    });
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
        <ButtonRow>
          <AddButton type="submit">创建故事线</AddButton>
          <SecondaryButton
            type="button"
            onClick={() => setIsBulkImportOpen(prev => !prev)}
          >
            {isBulkImportOpen ? '收起批量导入' : '批量导入'}
          </SecondaryButton>
          <DangerButton type="button" onClick={toggleBatchMode}>
            {isBatchDeleteMode ? '退出批量删除' : '批量删除'}
          </DangerButton>
        </ButtonRow>
      </StorylineForm>
      {isBatchDeleteMode && (
        <BatchBar>
          <BatchInfo>已选中 {selectedStorylineIds.size} 条故事线（选中父级会自动包含全部子级）。</BatchInfo>
          <SecondaryButton type="button" onClick={handleSelectAllForBatchDelete} disabled={isBatchDeleting}>
            全选
          </SecondaryButton>
          <SecondaryButton type="button" onClick={handleClearBatchDeleteSelection} disabled={isBatchDeleting}>
            清空
          </SecondaryButton>
          <SecondaryButton type="button" onClick={handleInvertBatchDeleteSelection} disabled={isBatchDeleting}>
            反选
          </SecondaryButton>
          <DangerButton
            type="button"
            onClick={handleBatchDeleteConfirm}
            disabled={selectedStorylineIds.size === 0 || isBatchDeleting}
          >
            {isBatchDeleting ? '删除中...' : '确认删除'}
          </DangerButton>
        </BatchBar>
      )}
      {isBulkImportOpen && (
        <BulkImportContainer>
          <BulkImportTitle>批量导入剧情线</BulkImportTitle>
          <BulkImportTextarea
            value={bulkImportText}
            onChange={(e) => setBulkImportText(e.target.value)}
            placeholder={`推荐用你现在这种缩进写法：\n主线A\n  子线A1\n    关键节点A1-1\n  子线A2\n主线B\n\n规则：\n- 无缩进=顶级\n- 一级缩进=二级（2空格/1Tab/1全角空格）\n- 二级缩进=三级\n- 行尾可加颜色：主线A #A0C4FF\n- 若要路径写法，请用 >：主线A > 子线A1 > 关键节点A1-1\n- / 不再作为层级分隔符`}
          />
          <BulkImportHint>
            按输入顺序创建；同层同名会自动跳过，不会覆盖已有剧情线；导入会自动补齐缺失父级。
          </BulkImportHint>
          <ButtonRow>
            <ImportButton
              type="button"
              onClick={handleBulkImport}
              disabled={isImporting}
            >
              {isImporting ? '导入中...' : '开始导入'}
            </ImportButton>
            <SecondaryButton
              type="button"
              onClick={() => setBulkImportText('')}
              disabled={isImporting}
            >
              清空输入
            </SecondaryButton>
          </ButtonRow>
        </BulkImportContainer>
      )}
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
      {dropActionMenu && (
        <DropActionMenu
          ref={dropActionMenuRef}
          style={{ left: dropActionMenu.x, top: dropActionMenu.y }}
        >
          <DropActionButton type="button" onClick={() => handleDropAction('before')}>
            放到前面
          </DropActionButton>
          <DropActionButton type="button" onClick={() => handleDropAction('after')}>
            放到后面
          </DropActionButton>
          <DropActionButton type="button" onClick={() => handleDropAction('inside')}>
            作为子剧情
          </DropActionButton>
          <DropActionCancel type="button" onClick={() => setDropActionMenu(null)}>
            取消
          </DropActionCancel>
        </DropActionMenu>
      )}
    </PanelContainer>
  );
};

export default StorylinePanel;

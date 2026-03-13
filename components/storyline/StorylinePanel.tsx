import React, { useState, useRef, useEffect, useMemo, useCallback, DragEvent, useDeferredValue } from 'react';
import styled from '@emotion/styled';
import type { PlotAnchor, Storyline } from "../../types";
import { getNextColor } from "../../utils";
import { COLORS, SPACING, FONTS, BORDERS, SHADOWS, panelStyles, globalPlaceholderTextStyles } from '../../styles';
import type { StorylineDerivedData } from './storylineTree';
import {
  buildChildrenByParentId,
  buildParentByStorylineId,
  collectAncestorStorylineIds,
  flattenStorylineRows,
  getDefaultCollapsedStorylineIds,
} from './storylineTree';
import { buildPreviewStorylinesFromImportItems, parseBulkStorylineInput } from './storylineImport';
import { useVirtualRows } from './useVirtualRows';

interface StorylinePanelProps {
  novelId: string;
  storylines: Storyline[];
  plotAnchors: PlotAnchor[];
  storylineDerivedData: StorylineDerivedData;
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

const TxtSourceContainer = styled(BulkImportContainer)`
  background: linear-gradient(180deg, #fff8ef 0%, #fffdf8 100%);
  border-color: #e7d6bb;
`;

const TxtSourceHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.xs};
`;

const TxtSourceTitle = styled.div`
  font-size: ${FONTS.sizeSmall};
  font-weight: 600;
  color: ${COLORS.dark};
`;

const TxtSourceDescription = styled.div`
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.textLight};
  line-height: 1.5;
`;

const TxtSourceMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.xs};
  padding: ${SPACING.sm};
  border: ${BORDERS.width} ${BORDERS.style} #eadfce;
  border-radius: ${BORDERS.radius};
  background-color: ${COLORS.white};
`;

const TxtSourcePath = styled.div`
  font-family: Consolas, 'Courier New', monospace;
  font-size: 12px;
  color: ${COLORS.text};
  word-break: break-all;
`;

const TxtSourceStatus = styled.div<{ $tone?: 'default' | 'error' | 'success' }>`
  font-size: ${FONTS.sizeSmall};
  color: ${props =>
    props.$tone === 'error'
      ? COLORS.danger
      : props.$tone === 'success'
        ? COLORS.secondary
        : COLORS.textLight};
`;

const PreviewSummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: ${SPACING.sm};
`;

const PreviewSummaryCard = styled.div`
  padding: ${SPACING.sm};
  border: ${BORDERS.width} ${BORDERS.style} #eadfce;
  border-radius: ${BORDERS.radius};
  background-color: ${COLORS.white};
`;

const PreviewSummaryLabel = styled.div`
  font-size: 12px;
  color: ${COLORS.textLight};
  margin-bottom: 2px;
`;

const PreviewSummaryValue = styled.div`
  font-size: ${FONTS.sizeBase};
  color: ${COLORS.dark};
  font-weight: 600;
  word-break: break-word;
`;

const PreviewModalOverlay = styled.div<{ $isOpen: boolean }>`
  display: ${props => (props.$isOpen ? 'flex' : 'none')};
  position: fixed;
  inset: 0;
  z-index: 1300;
  background-color: rgba(18, 24, 33, 0.52);
  justify-content: center;
  align-items: center;
  padding: ${SPACING.xl};
`;

const PreviewModalContent = styled.div`
  width: min(1200px, 88vw);
  height: min(84vh, 920px);
  background: linear-gradient(180deg, #fffdf8 0%, #fff9f1 100%);
  border-radius: 14px;
  box-shadow: 0 20px 50px rgba(37, 28, 11, 0.24);
  border: 1px solid #eadfce;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const PreviewModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: ${SPACING.lg};
  padding: ${SPACING.lg} ${SPACING.xl};
  border-bottom: 1px solid #eadfce;
  background-color: rgba(255, 255, 255, 0.72);
`;

const PreviewModalTitleGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.xs};
  min-width: 0;
`;

const PreviewModalTitle = styled.h3`
  margin: 0;
  font-size: 1.35rem;
  color: ${COLORS.dark};
`;

const PreviewModalSubtitle = styled.div`
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.textLight};
  line-height: 1.5;
  word-break: break-all;
`;

const PreviewModalToolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${SPACING.sm};
  padding: ${SPACING.md} ${SPACING.xl};
  border-bottom: 1px solid #eadfce;
  background-color: rgba(255, 255, 255, 0.64);
`;

const PreviewSearchInput = styled.input`
  flex: 1 1 260px;
  min-width: 220px;
  padding: ${SPACING.sm} ${SPACING.md};
  border: ${BORDERS.width} ${BORDERS.style} #d8ccb9;
  border-radius: 999px;
  background-color: ${COLORS.white};
  font-size: ${FONTS.sizeBase};
  color: ${COLORS.text};

  &:focus {
    border-color: #b48b53;
    box-shadow: 0 0 0 0.2rem rgba(180, 139, 83, 0.18);
    outline: none;
  }
`;

const PreviewModalBody = styled.div`
  flex: 1;
  overflow: auto;
  padding: ${SPACING.lg} ${SPACING.xl} ${SPACING.xl};
`;

const PreviewTreeContainer = styled.div`
  min-height: 100%;
  border: ${BORDERS.width} ${BORDERS.style} #eadfce;
  border-radius: 12px;
  background-color: rgba(255, 255, 255, 0.86);
  overflow: hidden;
`;

const PreviewTreeRow = styled.div<{ $level: number; $isMatch: boolean }>`
  display: flex;
  align-items: center;
  gap: ${SPACING.xs};
  min-height: 36px;
  padding: 6px ${SPACING.md};
  padding-left: ${props => props.$level * 24 + 12}px;
  border-bottom: 1px solid #f0e7db;
  background-color: ${props => (props.$isMatch ? '#fff3d9' : 'transparent')};

  &:last-of-type {
    border-bottom: none;
  }
`;

const PreviewTreeToggle = styled.button`
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: ${COLORS.textLight};
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &:hover {
    background-color: #f3eadb;
    color: ${COLORS.dark};
  }
`;

const PreviewTreeSpacer = styled.span`
  width: 22px;
  height: 22px;
  flex-shrink: 0;
`;

const PreviewTreeName = styled.div`
  font-size: ${FONTS.sizeBase};
  color: ${COLORS.text};
  line-height: 1.5;
  word-break: break-word;
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

const COLOR_UPDATE_DEBOUNCE_MS = 800;
const STORYLINE_ROW_HEIGHT = 34;
const STORYLINE_SOURCE_STORAGE_KEY_PREFIX = 'storyline-source-file:';

interface StorylineSourceSnapshot {
  filePath?: string;
  fileName?: string;
  content?: string;
  modifiedAt?: number;
  bytes?: number;
  cancelled?: boolean;
}

interface StorylineSourceChangePayload extends StorylineSourceSnapshot {
  ok?: boolean;
  reason?: string;
  error?: string;
}

const normalizeFilePathKey = (value: string | null | undefined): string =>
  String(value || '').trim().replace(/\//g, '\\').toLowerCase();

const formatTimestamp = (value?: number): string => {
  if (!value || !Number.isFinite(value)) return '未知';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
};

const areStringSetsEqual = (left: Set<string>, right: Set<string>): boolean => {
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
};

const getDefaultPreviewCollapsedStorylineIds = (
  childrenByParentId: Map<string | null, Storyline[]>
): Set<string> => {
  const collapsed = new Set<string>();

  const walk = (parentId: string | null, level: number) => {
    const children = childrenByParentId.get(parentId) || [];
    children.forEach((storyline) => {
      const childStorylines = childrenByParentId.get(storyline.id) || [];
      if (childStorylines.length > 0 && level >= 1) {
        collapsed.add(storyline.id);
      }
      walk(storyline.id, level + 1);
    });
  };

  walk(null, 0);
  return collapsed;
};


const StorylinePanel: React.FC<StorylinePanelProps> = ({
  novelId,
  storylines,
  plotAnchors,
  storylineDerivedData,
  activeStorylineId,
  onAddStoryline,
  onBatchAddStorylines,
  onBatchDeleteStorylines,
  onUpdateStoryline,
  onReorderStoryline,
  onDeleteStoryline,
  onSelectStoryline,
  style
}) => {
  const { childrenByParentId, descendantsByStorylineId, parentByStorylineId } = storylineDerivedData;
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
  const [storylineSourcePath, setStorylineSourcePath] = useState('');
  const [storylineSourceContent, setStorylineSourceContent] = useState('');
  const [storylineSourceModifiedAt, setStorylineSourceModifiedAt] = useState<number | undefined>(undefined);
  const [storylineSourceBytes, setStorylineSourceBytes] = useState<number | undefined>(undefined);
  const [storylineSourceError, setStorylineSourceError] = useState('');
  const [isStorylineSourceLoading, setIsStorylineSourceLoading] = useState(false);
  const [isStorylineSourceWatching, setIsStorylineSourceWatching] = useState(false);
  const [isSyncingStorylineSource, setIsSyncingStorylineSource] = useState(false);
  const [isStorylineSourcePanelOpen, setIsStorylineSourcePanelOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewSearchQuery, setPreviewSearchQuery] = useState('');
  const [previewCollapsedStorylineIds, setPreviewCollapsedStorylineIds] = useState<Set<string>>(new Set());
  
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
  const initializedCollapseNovelIdRef = useRef<string | null>(null);
  const storylineSourcePathRef = useRef('');
  const previewCollapseSourcePathRef = useRef('');
  const previewKnownNodeIdsRef = useRef<Set<string>>(new Set());
  const storylineSourceStorageKey = `${STORYLINE_SOURCE_STORAGE_KEY_PREFIX}${novelId}`;
  const storylineSourceApi = useMemo(() => (window as any)?.electronAPI?.storylineSource, []);
  const isStorylineSourceAvailable = Boolean(
    storylineSourceApi?.pickTxtFile &&
      storylineSourceApi?.readTxtFile &&
      storylineSourceApi?.watchTxtFile &&
      storylineSourceApi?.stopWatchingTxtFile &&
      storylineSourceApi?.onChanged
  );
  const parsedStorylineSourceItems = useMemo(
    () => parseBulkStorylineInput(storylineSourceContent),
    [storylineSourceContent]
  );
  const deferredPreviewSearchQuery = useDeferredValue(previewSearchQuery.trim());
  const previewStorylines = useMemo(
    () => buildPreviewStorylinesFromImportItems(parsedStorylineSourceItems),
    [parsedStorylineSourceItems]
  );
  const previewChildrenByParentId = useMemo(
    () => buildChildrenByParentId(previewStorylines),
    [previewStorylines]
  );
  const previewParentByStorylineId = useMemo(
    () => buildParentByStorylineId(previewStorylines),
    [previewStorylines]
  );
  const previewMatchingIds = useMemo(() => {
    const keyword = deferredPreviewSearchQuery.toLowerCase();
    if (!keyword) return new Set<string>();

    return new Set(
      previewStorylines
        .filter((storyline) => storyline.name.toLowerCase().includes(keyword))
        .map((storyline) => storyline.id)
    );
  }, [deferredPreviewSearchQuery, previewStorylines]);
  const previewVisibleStorylineIds = useMemo(() => {
    if (previewMatchingIds.size === 0) return null;

    const visibleIds = new Set<string>();
    previewMatchingIds.forEach((storylineId) => {
      visibleIds.add(storylineId);
      collectAncestorStorylineIds(storylineId, previewParentByStorylineId).forEach((ancestorId) => {
        visibleIds.add(ancestorId);
      });
    });

    return visibleIds;
  }, [previewMatchingIds, previewParentByStorylineId]);
  const previewStorylineRows = useMemo(
    () =>
      flattenStorylineRows({
        childrenByParentId: previewChildrenByParentId,
        collapsedStorylineIds: deferredPreviewSearchQuery ? new Set() : previewCollapsedStorylineIds,
        visibleStorylineIds: previewVisibleStorylineIds,
        forceExpand: Boolean(deferredPreviewSearchQuery),
      }),
    [
      deferredPreviewSearchQuery,
      previewChildrenByParentId,
      previewCollapsedStorylineIds,
      previewVisibleStorylineIds,
    ]
  );
  const flatStorylineRows = useMemo(
    () =>
      flattenStorylineRows({
        childrenByParentId,
        collapsedStorylineIds,
      }),
    [childrenByParentId, collapsedStorylineIds]
  );
  const {
    containerRef: listContainerRef,
    visibleItems: visibleStorylineRows,
    paddingTop,
    paddingBottom,
  } = useVirtualRows(flatStorylineRows, STORYLINE_ROW_HEIGHT, 10);
  const applyStorylineSourceSnapshot = useCallback((snapshot?: StorylineSourceSnapshot | null) => {
    if (!snapshot || snapshot.cancelled) return;

    setStorylineSourcePath(snapshot.filePath || '');
    storylineSourcePathRef.current = snapshot.filePath || '';
    setStorylineSourceContent(snapshot.content || '');
    setStorylineSourceModifiedAt(snapshot.modifiedAt);
    setStorylineSourceBytes(snapshot.bytes);
    setStorylineSourceError('');
  }, []);

  const resetStorylineSourceState = useCallback(() => {
    setStorylineSourcePath('');
    storylineSourcePathRef.current = '';
    setStorylineSourceContent('');
    setStorylineSourceModifiedAt(undefined);
    setStorylineSourceBytes(undefined);
    setStorylineSourceError('');
    setIsStorylineSourceWatching(false);
  }, []);

  const loadAndWatchStorylineSource = useCallback(
    async (filePath: string) => {
      if (!storylineSourceApi?.watchTxtFile) {
        throw new Error('当前 Electron 版本不支持剧情线 TXT 监听。');
      }

      setIsStorylineSourceLoading(true);
      try {
        const snapshot = (await storylineSourceApi.watchTxtFile(filePath)) as StorylineSourceSnapshot;
        applyStorylineSourceSnapshot(snapshot);
        setIsStorylineSourceWatching(true);
        localStorage.setItem(storylineSourceStorageKey, snapshot.filePath || filePath);
      } finally {
        setIsStorylineSourceLoading(false);
      }
    },
    [applyStorylineSourceSnapshot, storylineSourceApi, storylineSourceStorageKey]
  );

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
    storylineSourcePathRef.current = storylineSourcePath;
  }, [storylineSourcePath]);

  useEffect(() => {
    if (!isStorylineSourceAvailable || !storylineSourceApi?.onChanged) return;

    const unsubscribe = storylineSourceApi.onChanged((payload: StorylineSourceChangePayload) => {
      const incomingPath = normalizeFilePathKey(payload?.filePath);
      const currentPath = normalizeFilePathKey(storylineSourcePathRef.current);
      if (incomingPath && currentPath && incomingPath !== currentPath) {
        return;
      }

      if (payload?.ok === false) {
        if (payload.filePath) {
          setStorylineSourcePath(payload.filePath);
          storylineSourcePathRef.current = payload.filePath;
        }
        setStorylineSourceError(payload.error || '监听剧情线 TXT 失败。');
        setIsStorylineSourceWatching(Boolean(payload.filePath || currentPath));
        return;
      }

      applyStorylineSourceSnapshot(payload);
      setIsStorylineSourceWatching(true);
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [applyStorylineSourceSnapshot, isStorylineSourceAvailable, storylineSourceApi]);

  useEffect(() => {
    if (!isStorylineSourceAvailable) {
      resetStorylineSourceState();
      return;
    }

    const savedPath = localStorage.getItem(storylineSourceStorageKey);
    if (!savedPath) {
      resetStorylineSourceState();
      return;
    }

    let cancelled = false;
    setStorylineSourcePath(savedPath);
    storylineSourcePathRef.current = savedPath;
    setStorylineSourceContent('');
    setStorylineSourceModifiedAt(undefined);
    setStorylineSourceBytes(undefined);
    setStorylineSourceError('');
    setIsStorylineSourceWatching(false);

    loadAndWatchStorylineSource(savedPath).catch((error) => {
      if (cancelled) return;
      setStorylineSourceError(error instanceof Error ? error.message : String(error));
      setIsStorylineSourceWatching(false);
    });

    return () => {
      cancelled = true;
      storylineSourceApi?.stopWatchingTxtFile?.().catch(() => {});
    };
  }, [
    isStorylineSourceAvailable,
    loadAndWatchStorylineSource,
    resetStorylineSourceState,
    storylineSourceApi,
    storylineSourceStorageKey,
  ]);

  useEffect(() => {
    const validIds = new Set(previewStorylines.map((storyline) => storyline.id));
    const defaultCollapsedIds = getDefaultPreviewCollapsedStorylineIds(previewChildrenByParentId);
    const normalizedSourcePath = normalizeFilePathKey(storylineSourcePath);
    const previousSourcePath = previewCollapseSourcePathRef.current;
    const previousKnownIds = previewKnownNodeIdsRef.current;

    if (normalizedSourcePath !== previousSourcePath) {
      previewCollapseSourcePathRef.current = normalizedSourcePath;
      previewKnownNodeIdsRef.current = validIds;
      setPreviewCollapsedStorylineIds(defaultCollapsedIds);
      return;
    }

    setPreviewCollapsedStorylineIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (validIds.has(id)) {
          next.add(id);
        }
      });

      validIds.forEach((id) => {
        if (!previousKnownIds.has(id) && defaultCollapsedIds.has(id)) {
          next.add(id);
        }
      });

      return areStringSetsEqual(prev, next) ? prev : next;
    });

    previewKnownNodeIdsRef.current = validIds;
  }, [previewChildrenByParentId, previewStorylines, storylineSourcePath]);

  useEffect(() => {
    if (!isPreviewModalOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsPreviewModalOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isPreviewModalOpen]);

  useEffect(() => {
    if (storylines.length === 0) {
      if (initializedCollapseNovelIdRef.current !== novelId) {
        setCollapsedStorylineIds(new Set());
      }
      return;
    }
    if (initializedCollapseNovelIdRef.current === novelId) return;

    initializedCollapseNovelIdRef.current = novelId;
    setCollapsedStorylineIds(
      getDefaultCollapsedStorylineIds(storylines, childrenByParentId, parentByStorylineId, activeStorylineId)
    );
  }, [activeStorylineId, childrenByParentId, novelId, parentByStorylineId, storylines]);

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
    if (!activeStorylineId) return;

    const expandedIds = new Set<string>([
      activeStorylineId,
      ...collectAncestorStorylineIds(activeStorylineId, parentByStorylineId),
    ]);
    setCollapsedStorylineIds((prev) => {
      let changed = false;
      const next = new Set(prev);
      expandedIds.forEach((id) => {
        if (next.delete(id)) {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [activeStorylineId, parentByStorylineId]);

  useEffect(() => {
    if (!activeStorylineId) return;
    const container = listContainerRef.current;
    if (!container) return;

    const activeIndex = flatStorylineRows.findIndex((row) => row.storyline.id === activeStorylineId);
    if (activeIndex < 0) return;

    const itemTop = activeIndex * STORYLINE_ROW_HEIGHT;
    const itemBottom = itemTop + STORYLINE_ROW_HEIGHT;
    const viewportTop = container.scrollTop;
    const viewportBottom = viewportTop + container.clientHeight;

    if (itemTop >= viewportTop && itemBottom <= viewportBottom) return;

    const targetTop = Math.max(0, itemTop - STORYLINE_ROW_HEIGHT * 4);
    requestAnimationFrame(() => {
      container.scrollTop = targetTop;
    });
  }, [activeStorylineId, flatStorylineRows, listContainerRef]);


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

  const handlePickStorylineSource = async () => {
    if (!storylineSourceApi?.pickTxtFile) {
      alert('该功能需要在 Electron 桌面版中使用。');
      return;
    }

    try {
      const picked = (await storylineSourceApi.pickTxtFile()) as StorylineSourceSnapshot;
      if (picked?.cancelled || !picked?.filePath) {
        return;
      }
      setPreviewSearchQuery('');
      setIsStorylineSourcePanelOpen(true);
      await loadAndWatchStorylineSource(picked.filePath);
    } catch (error) {
      console.error('选择剧情线 TXT 失败:', error);
      setStorylineSourceError(error instanceof Error ? error.message : String(error));
      setIsStorylineSourceWatching(false);
    }
  };

  const handleRefreshStorylineSource = async () => {
    if (!storylineSourcePath) {
      alert('请先选择一个剧情线 TXT 文件。');
      return;
    }
    if (!storylineSourceApi?.readTxtFile) {
      alert('当前 Electron 版本不支持刷新剧情线 TXT。');
      return;
    }

    setIsStorylineSourceLoading(true);
    try {
      const snapshot = (await storylineSourceApi.readTxtFile(storylineSourcePath)) as StorylineSourceSnapshot;
      applyStorylineSourceSnapshot(snapshot);
    } catch (error) {
      console.error('刷新剧情线 TXT 失败:', error);
      setStorylineSourceError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsStorylineSourceLoading(false);
    }
  };

  const handleToggleStorylineSourceWatch = async () => {
    if (!storylineSourcePath) {
      alert('请先选择一个剧情线 TXT 文件。');
      return;
    }
    if (!storylineSourceApi?.stopWatchingTxtFile || !storylineSourceApi?.watchTxtFile) {
      alert('当前 Electron 版本不支持剧情线 TXT 自动监听。');
      return;
    }

    if (isStorylineSourceWatching) {
      try {
        await storylineSourceApi.stopWatchingTxtFile();
        setIsStorylineSourceWatching(false);
      } catch (error) {
        console.error('停止监听剧情线 TXT 失败:', error);
        setStorylineSourceError(error instanceof Error ? error.message : String(error));
      }
      return;
    }

    try {
      await loadAndWatchStorylineSource(storylineSourcePath);
    } catch (error) {
      console.error('开启监听剧情线 TXT 失败:', error);
      setStorylineSourceError(error instanceof Error ? error.message : String(error));
      setIsStorylineSourceWatching(false);
    }
  };

  const handleClearStorylineSource = async () => {
    try {
      await storylineSourceApi?.stopWatchingTxtFile?.();
    } catch {
      // Ignore cleanup errors when user explicitly clears the source.
    }

    localStorage.removeItem(storylineSourceStorageKey);
    setIsPreviewModalOpen(false);
    setPreviewSearchQuery('');
    resetStorylineSourceState();
  };

  const handleOpenPreviewModal = async () => {
    if (!storylineSourcePath) {
      alert('请先选择一个剧情线 TXT 文件。');
      return;
    }

    try {
      if (storylineSourceApi?.watchTxtFile) {
        await loadAndWatchStorylineSource(storylineSourcePath);
      } else if (storylineSourceApi?.readTxtFile) {
        setIsStorylineSourceLoading(true);
        const snapshot = (await storylineSourceApi.readTxtFile(storylineSourcePath)) as StorylineSourceSnapshot;
        applyStorylineSourceSnapshot(snapshot);
      }
    } catch (error) {
      console.error('打开剧情线大预览前刷新失败:', error);
      setStorylineSourceError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsStorylineSourceLoading(false);
      setIsPreviewModalOpen(true);
    }
  };

  const handleRefreshPreviewModal = async () => {
    if (!storylineSourcePath) {
      alert('请先选择一个剧情线 TXT 文件。');
      return;
    }

    try {
      if (storylineSourceApi?.watchTxtFile) {
        await loadAndWatchStorylineSource(storylineSourcePath);
      } else if (storylineSourceApi?.readTxtFile) {
        setIsStorylineSourceLoading(true);
        const snapshot = (await storylineSourceApi.readTxtFile(storylineSourcePath)) as StorylineSourceSnapshot;
        applyStorylineSourceSnapshot(snapshot);
      }
    } catch (error) {
      console.error('刷新剧情线大预览失败:', error);
      setStorylineSourceError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsStorylineSourceLoading(false);
    }
  };

  const handleTogglePreviewStorylineCollapsed = (storylineId: string) => {
    setPreviewCollapsedStorylineIds((prev) => {
      const next = new Set(prev);
      if (next.has(storylineId)) {
        next.delete(storylineId);
      } else {
        next.add(storylineId);
      }
      return next;
    });
  };

  const handleExpandAllPreviewStorylines = () => {
    setPreviewCollapsedStorylineIds(new Set());
  };

  const handleCollapseDeepPreviewStorylines = () => {
    setPreviewCollapsedStorylineIds(
      getDefaultPreviewCollapsedStorylineIds(previewChildrenByParentId)
    );
  };

  const handleSyncStorylineSource = async () => {
    if (parsedStorylineSourceItems.length === 0) {
      alert('当前 TXT 没有解析到可导入的剧情线。');
      return;
    }

    setIsSyncingStorylineSource(true);
    try {
      const result = await onBatchAddStorylines(parsedStorylineSourceItems);
      alert(`同步完成：新增 ${result.createdCount} 条，跳过 ${result.skippedCount} 条。`);
    } catch (error) {
      console.error('同步剧情线 TXT 失败:', error);
      alert('同步剧情线 TXT 失败，请稍后重试。');
    } finally {
      setIsSyncingStorylineSource(false);
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
      const descendants = descendantsByStorylineId.get(id) || [];
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

    const descendants = descendantsByStorylineId.get(draggedId) || [];
    if (descendants.includes(targetId)) {
      alert("不能将故事线移动到其自己的子级下。");
      setDropActionMenu(null);
      return;
    }

    onUpdateStoryline(draggedId, { parentId: targetId });
    setDropActionMenu(null);
  };

  const renderStorylineRow = ({
    storyline,
    level,
    hasVisibleChildren,
    isCollapsed,
  }: (typeof flatStorylineRows)[number]) => (
    <StorylineItem
      key={storyline.id}
      isActive={!isBatchDeleteMode && storyline.id === activeStorylineId && !editingId}
      level={level}
      isDragOverTarget={dragOverId === storyline.id}
      isBeingDragged={draggedId === storyline.id}
      onClick={() => {
        if (isBatchDeleteMode) {
          toggleStorylineChecked(storyline.id);
          return;
        }
        onSelectStoryline(storyline.id === activeStorylineId ? null : storyline.id);
      }}
      draggable={!editingId && !isBatchDeleteMode}
      onDragStart={e => handleDragStart(e, storyline.id)}
      onDragOver={e => handleDragOverItem(e, storyline.id)}
      onDragLeave={() => handleDragLeaveItem(storyline.id)}
      onDrop={e => handleDropOnItem(e, storyline.id)}
      onDragEnd={handleDragEnd}
    >
      {isBatchDeleteMode && (
        <BatchCheckbox
          type="checkbox"
          checked={selectedStorylineIds.has(storyline.id)}
          onChange={() => toggleStorylineChecked(storyline.id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`选择删除故事线 ${storyline.name}`}
        />
      )}
      {hasVisibleChildren ? (
        <ExpandToggleButton
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleToggleStorylineCollapsed(storyline.id);
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
        <ColorPreview style={{ backgroundColor: storyline.color }} />
      ) : (
        <RowColorInput
          key={`${storyline.id}:${storyline.color}`}
          type="color"
          defaultValue={storyline.color}
          title="修改颜色"
          aria-label={`修改故事线 ${storyline.name} 颜色`}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onDragStart={(e) => e.preventDefault()}
          onChange={(e) => handleStorylineColorChange(storyline.id, e.target.value)}
          onBlur={() => flushStorylineColorUpdate(storyline.id)}
        />
      )}
      {editingId === storyline.id ? (
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
        <StorylineName>{storyline.name}</StorylineName>
      )}

      {!isBatchDeleteMode && (
        <>
          <ActionButton onClick={(e) => { e.stopPropagation(); handleStartEdit(storyline); }} title="重命名">✏️</ActionButton>
          <ActionButton onClick={(e) => { e.stopPropagation(); confirmDelete(storyline.id, storyline.name); }} title="删除">🗑️</ActionButton>
        </>
      )}
    </StorylineItem>
  );

  const renderPreviewStorylineRow = ({
    storyline,
    level,
    hasVisibleChildren,
    isCollapsed,
  }: (typeof previewStorylineRows)[number]) => {
    const isMatch = previewMatchingIds.has(storyline.id);

    return (
      <PreviewTreeRow key={storyline.id} $level={level} $isMatch={isMatch}>
        {hasVisibleChildren ? (
          <PreviewTreeToggle
            type="button"
            onClick={() => handleTogglePreviewStorylineCollapsed(storyline.id)}
            title={isCollapsed ? '展开子级' : '折叠子级'}
            aria-label={isCollapsed ? '展开子级' : '折叠子级'}
          >
            {isCollapsed ? '▸' : '▾'}
          </PreviewTreeToggle>
        ) : (
          <PreviewTreeSpacer />
        )}
        <ColorPreview style={{ backgroundColor: storyline.color }} />
        <PreviewTreeName>{storyline.name}</PreviewTreeName>
      </PreviewTreeRow>
    );
  };

  const storylineSourceStatus = storylineSourceError
    ? storylineSourceError
    : storylineSourcePath
      ? isStorylineSourceWatching
        ? '已开启自动监听，TXT 改动后会自动刷新预览。'
        : '当前未监听文件变化，可以手动刷新或重新开启监听。'
      : '选择一个本地 TXT 文件后，这里会直接显示解析后的剧情树。';
  const storylineSourceStatusTone: 'default' | 'error' | 'success' = storylineSourceError
    ? 'error'
    : storylineSourcePath && isStorylineSourceWatching
      ? 'success'
      : 'default';
  const previewSearchResultLabel = deferredPreviewSearchQuery
    ? `搜索命中 ${previewMatchingIds.size} 个节点，当前展示 ${previewStorylineRows.length} 行。`
    : `当前展示 ${previewStorylineRows.length} 行，默认折叠较深层级。`;

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
            onClick={() => setIsStorylineSourcePanelOpen((prev) => !prev)}
          >
            {isStorylineSourcePanelOpen ? '收起TXT预览' : 'TXT预览'}
          </SecondaryButton>
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
      {isStorylineSourcePanelOpen && (
        <TxtSourceContainer>
          <TxtSourceHeader>
            <TxtSourceTitle>TXT 剧情线预览</TxtSourceTitle>
            <TxtSourceDescription>
              直接选择本地剧情线 TXT，自动解析层级并监听文件变更。确认没问题后，再一键同步到当前小说的故事线管理。
            </TxtSourceDescription>
          </TxtSourceHeader>
          <ButtonRow>
            <SecondaryButton
              type="button"
              onClick={handlePickStorylineSource}
              disabled={!isStorylineSourceAvailable || isStorylineSourceLoading}
            >
              {isStorylineSourceLoading ? '读取中...' : '选择 TXT'}
            </SecondaryButton>
            <SecondaryButton
              type="button"
              onClick={handleRefreshStorylineSource}
              disabled={!isStorylineSourceAvailable || !storylineSourcePath || isStorylineSourceLoading}
            >
              刷新预览
            </SecondaryButton>
            <SecondaryButton
              type="button"
              onClick={handleOpenPreviewModal}
              disabled={!isStorylineSourceAvailable || !storylineSourcePath || isStorylineSourceLoading}
            >
              打开大预览
            </SecondaryButton>
            <SecondaryButton
              type="button"
              onClick={handleToggleStorylineSourceWatch}
              disabled={!isStorylineSourceAvailable || !storylineSourcePath || isStorylineSourceLoading}
            >
              {isStorylineSourceWatching ? '停止监听' : '开启监听'}
            </SecondaryButton>
            <ImportButton
              type="button"
              onClick={handleSyncStorylineSource}
              disabled={
                !isStorylineSourceAvailable ||
                parsedStorylineSourceItems.length === 0 ||
                isSyncingStorylineSource ||
                isStorylineSourceLoading
              }
            >
              {isSyncingStorylineSource ? '同步中...' : '同步到剧情线管理'}
            </ImportButton>
            <SecondaryButton
              type="button"
              onClick={handleClearStorylineSource}
              disabled={!storylineSourcePath && !storylineSourceContent}
            >
              清除来源
            </SecondaryButton>
          </ButtonRow>
          {!isStorylineSourceAvailable ? (
            <TxtSourceStatus $tone="error">
              当前页面检测不到 Electron 剧情线文件能力。请使用桌面版 Electron 打开项目后再使用此功能。
            </TxtSourceStatus>
          ) : (
            <>
              <TxtSourceStatus $tone={storylineSourceStatusTone}>{storylineSourceStatus}</TxtSourceStatus>
              {storylineSourcePath ? (
                <>
                  <TxtSourceMeta>
                    <TxtSourcePath>{storylineSourcePath}</TxtSourcePath>
                  </TxtSourceMeta>
                  <PreviewSummaryGrid>
                    <PreviewSummaryCard>
                      <PreviewSummaryLabel>解析路径数</PreviewSummaryLabel>
                      <PreviewSummaryValue>{parsedStorylineSourceItems.length}</PreviewSummaryValue>
                    </PreviewSummaryCard>
                    <PreviewSummaryCard>
                      <PreviewSummaryLabel>树节点数</PreviewSummaryLabel>
                      <PreviewSummaryValue>{previewStorylines.length}</PreviewSummaryValue>
                    </PreviewSummaryCard>
                    <PreviewSummaryCard>
                      <PreviewSummaryLabel>最近更新时间</PreviewSummaryLabel>
                      <PreviewSummaryValue>{formatTimestamp(storylineSourceModifiedAt)}</PreviewSummaryValue>
                    </PreviewSummaryCard>
                    <PreviewSummaryCard>
                      <PreviewSummaryLabel>文件体积</PreviewSummaryLabel>
                      <PreviewSummaryValue>
                        {typeof storylineSourceBytes === 'number' ? `${storylineSourceBytes} bytes` : '未知'}
                      </PreviewSummaryValue>
                    </PreviewSummaryCard>
                  </PreviewSummaryGrid>
                </>
              ) : null}
              {storylineSourcePath && previewStorylineRows.length === 0 ? (
                <TxtSourceStatus>
                  当前文件还没有解析出有效层级。请检查缩进、`&gt;` 路径写法或颜色标记格式。
                </TxtSourceStatus>
              ) : null}
            </>
          )}
        </TxtSourceContainer>
      )}
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
      <ListContainer ref={listContainerRef}>
        {storylines.length > 0 ? (
          <StorylineList 
            isDragOver={isDraggingOverList}
            onDragOver={handleDragOverList}
            onDragLeave={handleDragLeaveList}
            onDrop={handleDropOnList}
            style={{ paddingTop, paddingBottom }}
          >
            {visibleStorylineRows.map(renderStorylineRow)}
          </StorylineList>
        ) : (
          <Placeholder>
            <p>还没有故事线。</p>
            <p>尝试创建一个，例如“主线”。</p>
          </Placeholder>
        )}
      </ListContainer>
      <PreviewModalOverlay
        $isOpen={isPreviewModalOpen}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setIsPreviewModalOpen(false);
          }
        }}
      >
        <PreviewModalContent onClick={(event) => event.stopPropagation()}>
          <PreviewModalHeader>
            <PreviewModalTitleGroup>
              <PreviewModalTitle>剧情线大预览</PreviewModalTitle>
              <PreviewModalSubtitle>
                {storylineSourcePath || '尚未选择剧情线 TXT 文件'}
              </PreviewModalSubtitle>
              <TxtSourceStatus $tone={storylineSourceStatusTone}>{previewSearchResultLabel}</TxtSourceStatus>
            </PreviewModalTitleGroup>
            <SecondaryButton type="button" onClick={() => setIsPreviewModalOpen(false)}>
              关闭
            </SecondaryButton>
          </PreviewModalHeader>
          <PreviewModalToolbar>
            <PreviewSearchInput
              type="text"
              value={previewSearchQuery}
              onChange={(event) => setPreviewSearchQuery(event.target.value)}
              placeholder="搜索剧情线名称，自动显示命中节点及其上级路径"
            />
            <SecondaryButton
              type="button"
              onClick={handleRefreshPreviewModal}
              disabled={!storylineSourcePath || isStorylineSourceLoading}
            >
              {isStorylineSourceLoading ? '刷新中...' : '刷新文件'}
            </SecondaryButton>
            <SecondaryButton
              type="button"
              onClick={handleExpandAllPreviewStorylines}
              disabled={previewStorylineRows.length === 0}
            >
              全部展开
            </SecondaryButton>
            <SecondaryButton
              type="button"
              onClick={handleCollapseDeepPreviewStorylines}
              disabled={previewStorylineRows.length === 0}
            >
              恢复默认折叠
            </SecondaryButton>
            <SecondaryButton
              type="button"
              onClick={() => setPreviewSearchQuery('')}
              disabled={!previewSearchQuery}
            >
              清空搜索
            </SecondaryButton>
          </PreviewModalToolbar>
          <PreviewModalBody>
            <PreviewTreeContainer>
              {previewStorylineRows.length > 0 ? (
                previewStorylineRows.map(renderPreviewStorylineRow)
              ) : (
                <Placeholder>
                  <p>当前没有可展示的剧情线预览。</p>
                  <p>{deferredPreviewSearchQuery ? '换个关键词试试。' : '请先选择并解析一个 TXT 文件。'}</p>
                </Placeholder>
              )}
            </PreviewTreeContainer>
          </PreviewModalBody>
        </PreviewModalContent>
      </PreviewModalOverlay>
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

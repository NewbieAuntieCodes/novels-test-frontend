import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from '@emotion/styled';
import type { Note, NoteFolder, Novel, Tag } from '../../types';
import { notesApi } from '../../api';
import { termCompatApi } from '../../api/termCompat';
import { normalizeNoteTitleKey } from '../../utils';
import { COLORS, SPACING, FONTS, BORDERS, SHADOWS, panelStyles, globalPlaceholderTextStyles } from '../../styles';
import NoteEditor from './NoteEditor';
import NoteFolderTree from './NoteFolderTree';
import TagManagementView from '../tagpanel/TagManagementView';

interface NotesLibraryPageProps {
  onBack: () => void;
  projects: Novel[];
}

const ALL_FOLDER_ID = '__all__';

type FolderSelection = string | null | typeof ALL_FOLDER_ID;

type NoteEntry = {
  entryId: string;
  titleKey: string;
  title: string;
  folderId: string | null;
  notes: Note[];
  updatedAt: string;
};

const buildEntryId = (folderId: string | null, titleKey: string) => JSON.stringify([folderId, titleKey]);

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background-color: ${COLORS.background};
`;

const Header = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${SPACING.md} ${SPACING.lg};
  background-color: ${COLORS.gray100};
  border-bottom: 1px solid ${COLORS.gray300};
  flex-shrink: 0;
  gap: ${SPACING.lg};
`;

const Title = styled.h1`
  margin: 0;
  font-size: ${FONTS.sizeH2};
  color: ${COLORS.dark};
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${SPACING.sm};
`;

const BaseButton = styled.button<{ $variant?: 'primary' | 'secondary' | 'danger' }>`
  padding: ${SPACING.sm} ${SPACING.lg};
  border-radius: ${BORDERS.radius};
  border: 1px solid
    ${props => {
      if (props.$variant === 'danger') return COLORS.danger;
      if (props.$variant === 'primary') return COLORS.primary;
      return COLORS.border;
    }};
  background: ${props => {
    if (props.$variant === 'danger') return COLORS.danger;
    if (props.$variant === 'primary') return COLORS.primary;
    return COLORS.white;
  }};
  color: ${props => (props.$variant === 'secondary' ? COLORS.text : COLORS.white)};
  cursor: pointer;
  font-size: ${FONTS.sizeSmall};
  transition: background-color 0.2s, box-shadow 0.2s;
  white-space: nowrap;

  &:hover:not(:disabled) {
    background: ${props => {
      if (props.$variant === 'danger') return COLORS.dangerHover;
      if (props.$variant === 'primary') return COLORS.primaryHover;
      return COLORS.gray100;
    }};
    box-shadow: ${SHADOWS.small};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    box-shadow: none;
  }
`;

const MainContent = styled.main`
  display: flex;
  flex-grow: 1;
  overflow: hidden;
  padding: ${SPACING.lg};
  gap: 0;
`;

const Panel = styled.div(panelStyles);

const LeftPanel = styled(Panel)`
  flex-basis: 24%;
  min-width: 260px;
  gap: ${SPACING.md};
`;

const MiddlePanel = styled(Panel)`
  flex-basis: 28%;
  min-width: 280px;
  gap: ${SPACING.md};
`;

const RightPanel = styled(Panel)`
  flex: 1 1 0;
  min-width: 320px;
  gap: ${SPACING.md};
  overflow: hidden;
`;

const CompareEditors = styled.div`
  display: flex;
  gap: ${SPACING.md};
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

const ComparePane = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.xs};
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
`;

const ComparePaneHeader = styled.div`
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.textLight};
  flex-shrink: 0;
`;

const ResizeHandle = styled.div<{ $active?: boolean }>`
  flex: 0 0 ${SPACING.lg};
  cursor: col-resize;
  position: relative;
  user-select: none;
  touch-action: none;

  &::before {
    content: '';
    position: absolute;
    top: 8px;
    bottom: 8px;
    left: 50%;
    width: 2px;
    transform: translateX(-50%);
    background: ${props => (props.$active ? COLORS.primary : COLORS.gray300)};
    border-radius: 2px;
    opacity: ${props => (props.$active ? 1 : 0)};
    transition: opacity 0.15s, background-color 0.15s;
  }

  &:hover::before {
    opacity: 1;
  }
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-size: ${FONTS.sizeH3};
  color: ${COLORS.dark};
`;

const SearchInput = styled.input`
  padding: ${SPACING.sm};
  border: ${BORDERS.width} ${BORDERS.style} ${BORDERS.color};
  border-radius: ${BORDERS.radius};
  box-sizing: border-box;
  background-color: ${COLORS.white};
  font-size: ${FONTS.sizeSmall};
  width: 100%;

  &:focus {
    border-color: ${COLORS.primary};
    box-shadow: 0 0 0 0.2rem ${COLORS.primary}40;
    outline: none;
  }
`;

const Placeholder = styled.div(globalPlaceholderTextStyles);

const EntryList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.sm};
  overflow: auto;
  border: 1px solid ${COLORS.borderLight};
  border-radius: ${BORDERS.radius};
  padding: ${SPACING.sm};
  background: ${COLORS.white};
  flex: 1;
  min-height: 0;
`;

const EntryItem = styled.button<{ $active?: boolean }>`
  text-align: left;
  width: 100%;
  border: 1px solid ${props => (props.$active ? COLORS.primary : COLORS.gray300)};
  background: ${props => (props.$active ? COLORS.highlightBackground : COLORS.white)};
  border-radius: ${BORDERS.radius};
  padding: ${SPACING.md};
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.15s, background-color 0.15s;

  &:hover {
    transform: translateY(-1px);
    box-shadow: ${SHADOWS.small};
    background: ${COLORS.gray100};
  }
`;

const EntryTitle = styled.div`
  font-weight: 700;
  font-size: ${FONTS.sizeBase};
  color: ${COLORS.dark};
  margin-bottom: ${SPACING.xs};
  word-break: break-word;
`;

const EntryMeta = styled.div`
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.textLight};
  margin-bottom: ${SPACING.xs};
`;

const EntryPreview = styled.div`
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.text};
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 3.2em;
  overflow: hidden;
`;

const SelectedEntryHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${SPACING.sm};
`;

const SelectedEntryActions = styled.div`
  display: flex;
  gap: ${SPACING.xs};
  flex-wrap: wrap;
  justify-content: flex-end;
`;

const CardList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.xs};
  overflow: auto;
  border: 1px solid ${COLORS.borderLight};
  border-radius: ${BORDERS.radius};
  padding: ${SPACING.sm};
  background: ${COLORS.white};
  max-height: 180px;
`;

const CardRow = styled.div<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${SPACING.xs};
  border: 1px solid ${props => (props.$active ? COLORS.primary : COLORS.gray300)};
  background: ${props => (props.$active ? COLORS.highlightBackground : COLORS.white)};
  border-radius: ${BORDERS.radius};
  padding: ${SPACING.sm};
`;

const CardButton = styled.button`
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  padding: 0;
  flex: 1;
  min-width: 0;
`;

const CardMeta = styled.div`
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.textLight};
`;

const CardActions = styled.div`
  display: flex;
  gap: ${SPACING.xs};
`;

const SmallButton = styled.button<{ $variant?: 'primary' | 'danger' | 'secondary' }>`
  padding: 2px ${SPACING.sm};
  border-radius: ${BORDERS.radius};
  border: 1px solid
    ${props => {
      if (props.$variant === 'danger') return COLORS.danger;
      if (props.$variant === 'primary') return COLORS.primary;
      return COLORS.border;
    }};
  background: ${props => {
    if (props.$variant === 'danger') return COLORS.danger;
    if (props.$variant === 'primary') return COLORS.primary;
    return COLORS.white;
  }};
  color: ${props => (props.$variant === 'secondary' ? COLORS.text : COLORS.white)};
  cursor: pointer;
  font-size: ${FONTS.sizeSmall};
  white-space: nowrap;

  &:hover:not(:disabled) {
    background: ${props => {
      if (props.$variant === 'danger') return COLORS.dangerHover;
      if (props.$variant === 'primary') return COLORS.primaryHover;
      return COLORS.gray100;
    }};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const ChildFolderToggleButton = styled.button<{ isActive: boolean }>`
  padding: 2px ${SPACING.sm};
  font-size: ${FONTS.sizeSmall};
  border: 1px solid ${props => (props.isActive ? COLORS.primary : COLORS.gray300)};
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s, border-color 0.2s;
  white-space: nowrap;
  background-color: ${props => (props.isActive ? COLORS.primary : COLORS.gray200)};
  color: ${props => (props.isActive ? COLORS.white : COLORS.text)};

  &:hover:not(:disabled) {
    background-color: ${props => (props.isActive ? COLORS.primaryHover : COLORS.gray300)};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const FolderSelect = styled.select`
  padding: 2px ${SPACING.sm};
  border-radius: ${BORDERS.radius};
  border: 1px solid ${COLORS.border};
  background: ${COLORS.white};
  font-size: ${FONTS.sizeSmall};
`;

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(
    d.getHours()
  ).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const stripHtmlToText = (input: string): string => {
  const text = (input || '').trim();
  if (!text) return '';
  if (!/[<>]/.test(text)) return text;

  try {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    return (doc.body.textContent || '').trim();
  } catch {
    return text.replaceAll(/<[^>]*>/g, ' ').replaceAll(/\s+/g, ' ').trim();
  }
};

const buildFolderChildrenMap = (folders: NoteFolder[]) => {
  const childrenByParentId = new Map<string | null, NoteFolder[]>();
  for (const folder of folders) {
    const parent = folder.parentId ?? null;
    const bucket = childrenByParentId.get(parent);
    if (bucket) bucket.push(folder);
    else childrenByParentId.set(parent, [folder]);
  }
  for (const [key, bucket] of childrenByParentId.entries()) {
    bucket.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
    childrenByParentId.set(key, bucket);
  }
  return childrenByParentId;
};

const collectDescendantFolderIds = (rootId: string, childrenByParentId: Map<string | null, NoteFolder[]>) => {
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

const NotesLibraryPage: React.FC<NotesLibraryPageProps> = ({ onBack, projects }) => {
  const mainRef = useRef<HTMLElement | null>(null);
  const leftPanelRef = useRef<HTMLDivElement | null>(null);
  const middlePanelRef = useRef<HTMLDivElement | null>(null);

  const [leftWidth, setLeftWidth] = useState<number | null>(null);
  const [middleWidth, setMiddleWidth] = useState<number | null>(null);
  const [activeResizer, setActiveResizer] = useState<'left' | 'middle' | null>(null);
  const dragStateRef = useRef<{
    type: 'left' | 'middle';
    startX: number;
    startLeftWidth: number;
    startMiddleWidth: number;
    contentWidth: number;
    hasMiddle: boolean;
  } | null>(null);

  const [folders, setFolders] = useState<NoteFolder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<FolderSelection>(ALL_FOLDER_ID);
  const [includeChildFolders, setIncludeChildFolders] = useState<boolean>(true);
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(() => new Set());
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [savingNoteIds, setSavingNoteIds] = useState<Set<string>>(() => new Set());
  const [saveErrorsByNoteId, setSaveErrorsByNoteId] = useState<Record<string, string | null>>({});
  const [isCompareMode, setIsCompareMode] = useState<boolean>(false);
  const [compareLeftNoteId, setCompareLeftNoteId] = useState<string | null>(null);
  const [compareRightNoteId, setCompareRightNoteId] = useState<string | null>(null);
  const [isEntryListVisible, setIsEntryListVisible] = useState<boolean>(true);
  const entryListVisibleBeforeCompareRef = useRef<boolean | null>(null);

  const [libraryView, setLibraryView] = useState<'notes' | 'projectTerms'>('notes');
  const sortedProjects = useMemo(() => {
    const list = [...projects];
    return list.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
  }, [projects]);
  const [projectQuery, setProjectQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectTags, setProjectTags] = useState<Tag[]>([]);
  const [isLoadingProjectTags, setIsLoadingProjectTags] = useState(false);
  const [projectTagsError, setProjectTagsError] = useState<string | null>(null);
  const [activeTermId, setActiveTermId] = useState<string | null>(null);

  const getMainContentBoxWidth = () => {
    const el = mainRef.current;
    if (!el) return 0;
    const style = window.getComputedStyle(el);
    const paddingLeft = Number.parseFloat(style.paddingLeft || '0') || 0;
    const paddingRight = Number.parseFloat(style.paddingRight || '0') || 0;
    return el.clientWidth - paddingLeft - paddingRight;
  };

  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

  const startResize = (type: 'left' | 'middle') => (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;

    const hasMiddle = isEntryListVisible;
    if (type === 'middle' && !hasMiddle) return;

    const leftMeasured = leftPanelRef.current?.getBoundingClientRect().width ?? 0;
    const middleMeasured = hasMiddle ? middlePanelRef.current?.getBoundingClientRect().width ?? 0 : 0;
    const initialLeft = leftWidth ?? leftMeasured;
    const initialMiddle = middleWidth ?? middleMeasured;

    if (leftWidth === null && leftMeasured > 0) setLeftWidth(leftMeasured);
    if (middleWidth === null && middleMeasured > 0) setMiddleWidth(middleMeasured);

    dragStateRef.current = {
      type,
      startX: e.clientX,
      startLeftWidth: initialLeft,
      startMiddleWidth: initialMiddle,
      contentWidth: getMainContentBoxWidth(),
      hasMiddle,
    };

    setActiveResizer(type);
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const stopResize = useCallback(() => {
    dragStateRef.current = null;
    setActiveResizer(null);
  }, []);

  useEffect(() => {
    if (!activeResizer) return;

    const handleMove = (e: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state) return;

      const dx = e.clientX - state.startX;
      const resizerWidth = Number.parseInt(SPACING.lg, 10) || 16;
      const totalResizerWidth = resizerWidth * (state.hasMiddle ? 2 : 1);
      const leftMin = 260;
      const middleMin = state.hasMiddle ? 280 : 0;
      const rightMin = 320;

      if (state.type === 'left') {
        const maxLeft = state.hasMiddle
          ? Math.max(
              leftMin,
              state.contentWidth - totalResizerWidth - rightMin - Math.max(middleMin, state.startMiddleWidth)
            )
          : Math.max(leftMin, state.contentWidth - totalResizerWidth - rightMin);
        const nextLeft = clamp(state.startLeftWidth + dx, leftMin, maxLeft);
        setLeftWidth(nextLeft);
      } else {
        if (!state.hasMiddle) return;
        const maxMiddle = Math.max(middleMin, state.contentWidth - totalResizerWidth - rightMin - Math.max(leftMin, state.startLeftWidth));
        const nextMiddle = clamp(state.startMiddleWidth + dx, middleMin, maxMiddle);
        setMiddleWidth(nextMiddle);
      }
    };

    const handleUp = () => stopResize();

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [activeResizer, stopResize]);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const nextNotes = await notesApi.listNotes();
      const nextFolders = await notesApi.listFolders();
      setNotes(nextNotes);
      setFolders(nextFolders);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (libraryView !== 'projectTerms') return;
    setIsCompareMode(false);
    setIsEntryListVisible(true);
  }, [libraryView]);

  useEffect(() => {
    if (libraryView !== 'projectTerms') return;
    if (selectedProjectId && sortedProjects.some((p) => p.id === selectedProjectId)) return;
    setSelectedProjectId(sortedProjects[0]?.id ?? null);
  }, [libraryView, sortedProjects, selectedProjectId]);

  const selectedProject = useMemo(
    () => sortedProjects.find((p) => p.id === selectedProjectId) || null,
    [sortedProjects, selectedProjectId]
  );

  const filteredProjects = useMemo(() => {
    const q = projectQuery.trim().toLowerCase();
    if (!q) return sortedProjects;
    return sortedProjects.filter((p) => {
      const title = (p.title || '').toLowerCase();
      const author = (p.author || '').toLowerCase();
      return title.includes(q) || author.includes(q);
    });
  }, [sortedProjects, projectQuery]);

  const loadProjectTags = useCallback(async (projectId: string) => {
    setIsLoadingProjectTags(true);
    setProjectTagsError(null);
    try {
      const tags = await termCompatApi.getAll({ novelId: projectId });
      setProjectTags(tags);
    } catch (err) {
      setProjectTagsError(err instanceof Error ? err.message : '加载失败');
      setProjectTags([]);
    } finally {
      setIsLoadingProjectTags(false);
    }
  }, []);

  useEffect(() => {
    if (libraryView !== 'projectTerms') return;
    if (!selectedProjectId) {
      setProjectTags([]);
      setActiveTermId(null);
      return;
    }
    setActiveTermId(null);
    loadProjectTags(selectedProjectId);
  }, [libraryView, selectedProjectId, loadProjectTags]);

  const foldersById = useMemo(() => new Map(folders.map((f) => [f.id, f] as const)), [folders]);
  const childrenByParentId = useMemo(() => buildFolderChildrenMap(folders), [folders]);
  const selectedFolderHasChildren = useMemo(() => {
    if (selectedFolderId === ALL_FOLDER_ID || selectedFolderId === null) return false;
    return (childrenByParentId.get(selectedFolderId as string) || []).length > 0;
  }, [childrenByParentId, selectedFolderId]);

  useEffect(() => {
    setCollapsedFolderIds((prev) => {
      const existingIds = new Set(folders.map((f) => f.id));
      const next = new Set<string>();
      for (const id of prev) {
        if (existingIds.has(id)) next.add(id);
      }
      return next.size === prev.size ? prev : next;
    });
  }, [folders]);

  useEffect(() => {
    if (selectedFolderId === ALL_FOLDER_ID || selectedFolderId === null) return;
    const targetId = selectedFolderId as string;
    setCollapsedFolderIds((prev) => {
      const next = new Set(prev);
      const visited = new Set<string>();
      let currentId: string | null = targetId;
      while (currentId) {
        if (visited.has(currentId)) break;
        visited.add(currentId);
        const folder = foldersById.get(currentId);
        if (!folder || !folder.parentId) break;
        next.delete(folder.parentId);
        currentId = folder.parentId;
      }
      return next;
    });
  }, [foldersById, selectedFolderId]);

  const folderScopeIds = useMemo(() => {
    if (selectedFolderId === ALL_FOLDER_ID) return null;
    if (selectedFolderId === null) return new Set<string>();
    if (!includeChildFolders) return new Set<string>([selectedFolderId]);
    return collectDescendantFolderIds(selectedFolderId, childrenByParentId);
  }, [selectedFolderId, includeChildFolders, childrenByParentId]);

  const notesInScope = useMemo(() => {
    if (selectedFolderId === ALL_FOLDER_ID) return notes;
    if (selectedFolderId === null) return notes.filter((n) => n.folderId === null);
    const scope = folderScopeIds;
    if (!scope) return notes;
    return notes.filter((n) => n.folderId !== null && scope.has(n.folderId));
  }, [notes, selectedFolderId, folderScopeIds]);

  const entryGroups = useMemo(() => {
    const map = new Map<string, NoteEntry>();
    for (const note of notesInScope) {
      const titleKey = note.titleKey || note.title;
      if (!titleKey) continue;
      const entryId = buildEntryId(note.folderId ?? null, titleKey);
      const existing = map.get(entryId);
      if (!existing) {
        map.set(entryId, {
          entryId,
          titleKey,
          title: note.title,
          folderId: note.folderId ?? null,
          notes: [note],
          updatedAt: note.updatedAt,
        });
        continue;
      }
      existing.notes.push(note);
      if (new Date(note.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
        existing.updatedAt = note.updatedAt;
        existing.title = note.title;
      }
    }
    for (const entry of map.values()) {
      entry.notes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    return map;
  }, [notesInScope]);

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = Array.from(entryGroups.values());
    if (!q) {
      return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    const filtered = list.filter((entry) => {
      const haystackTitle = (entry.title || '').toLowerCase();
      if (haystackTitle.includes(q)) return true;
      return entry.notes.some((n) => stripHtmlToText(n.content || '').toLowerCase().includes(q));
    });
    return filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [entryGroups, query]);

  const selectedEntry = useMemo(() => {
    if (!selectedEntryId) return null;
    return entryGroups.get(selectedEntryId) || null;
  }, [entryGroups, selectedEntryId]);

  const selectedNote = useMemo(() => {
    if (!selectedNoteId) return null;
    return notes.find((n) => n.id === selectedNoteId) || null;
  }, [notes, selectedNoteId]);

  const compareLeftNote = useMemo(() => {
    if (!selectedEntry || !compareLeftNoteId) return null;
    return selectedEntry.notes.find((n) => n.id === compareLeftNoteId) || null;
  }, [selectedEntry, compareLeftNoteId]);

  const compareRightNote = useMemo(() => {
    if (!selectedEntry || !compareRightNoteId) return null;
    return selectedEntry.notes.find((n) => n.id === compareRightNoteId) || null;
  }, [selectedEntry, compareRightNoteId]);

  const selectedEntryNoteIdsKey = useMemo(
    () => (selectedEntry ? selectedEntry.notes.map((n) => n.id).join('|') : ''),
    [selectedEntry]
  );

  useEffect(() => {
    if (!isCompareMode) return;

    if (!selectedEntry) {
      if (compareLeftNoteId !== null) setCompareLeftNoteId(null);
      if (compareRightNoteId !== null) setCompareRightNoteId(null);
      return;
    }

    const ids = selectedEntry.notes.map((n) => n.id);
    const leftFallback =
      (compareLeftNoteId && ids.includes(compareLeftNoteId) ? compareLeftNoteId : null) ||
      (selectedNoteId && ids.includes(selectedNoteId) ? selectedNoteId : null) ||
      ids[0] ||
      null;
    const rightFallback =
      compareRightNoteId && ids.includes(compareRightNoteId) && compareRightNoteId !== leftFallback
        ? compareRightNoteId
        : ids.find((id) => id !== leftFallback) ?? null;

    if (leftFallback !== compareLeftNoteId) setCompareLeftNoteId(leftFallback);
    if (rightFallback !== compareRightNoteId) setCompareRightNoteId(rightFallback);
  }, [isCompareMode, selectedEntryId, selectedEntryNoteIdsKey, selectedNoteId, compareLeftNoteId, compareRightNoteId, selectedEntry]);

  useEffect(() => {
    if (!selectedEntryId) return;
    if (entryGroups.has(selectedEntryId)) return;
    setSelectedEntryId(null);
    setSelectedNoteId(null);
  }, [entryGroups, selectedEntryId]);

  useEffect(() => {
    if (!selectedEntry) return;
    if (selectedNoteId && selectedEntry.notes.some((n) => n.id === selectedNoteId)) return;
    setSelectedNoteId(selectedEntry.notes[0]?.id ?? null);
  }, [selectedEntry, selectedNoteId]);

  const toggleFolderCollapsed = (folderId: string) => {
    setCollapsedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const ensureFolderExpanded = (folderId: string) => {
    setCollapsedFolderIds((prev) => {
      if (!prev.has(folderId)) return prev;
      const next = new Set(prev);
      next.delete(folderId);
      return next;
    });
  };

  const handleMoveFolder = async (folderId: string, parentId: string | null) => {
    try {
      const updated = await notesApi.updateFolder(folderId, { parentId });
      setFolders((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    } catch (err) {
      alert(err instanceof Error ? err.message : '移动失败');
    }
  };

  const folderOptions = useMemo(() => {
    const rootFolders = childrenByParentId.get(null) || [];
    const options: Array<{ id: string | null; label: string }> = [{ id: null, label: '待整理' }];

    const walk = (folder: NoteFolder, depth: number) => {
      options.push({ id: folder.id, label: `${'—'.repeat(depth)} ${folder.name}`.trim() });
      const children = childrenByParentId.get(folder.id) || [];
      children.forEach((child) => walk(child, depth + 1));
    };

    rootFolders.forEach((folder) => walk(folder, 0));
    return options;
  }, [childrenByParentId]);

  const getFolderPathLabel = useCallback(
    (folderId: string | null) => {
      if (folderId === null) return '待整理';
      const names: string[] = [];
      const visited = new Set<string>();
      let currentId: string | null | undefined = folderId;
      while (currentId) {
        if (visited.has(currentId)) break;
        visited.add(currentId);
        const folder = foldersById.get(currentId);
        if (!folder) break;
        names.unshift(folder.name);
        currentId = folder.parentId;
      }
      return names.join(' / ') || '未知文件夹';
    },
    [foldersById]
  );

  const handleCreateNote = async (titleOverride?: string) => {
    const title = (titleOverride ?? window.prompt('词条标题：') ?? '').trim();
    if (!title) return;

    const titleKey = normalizeNoteTitleKey(title);
    if (titleKey) {
      const existingEntryIds = new Set(
        notes
          .filter((n) => (n.titleKey || normalizeNoteTitleKey(n.title)) === titleKey)
          .map((n) => buildEntryId(n.folderId ?? null, titleKey))
      );
      if (existingEntryIds.size > 0) {
        alert(`已存在同名词条「${title}」（共 ${existingEntryIds.size} 个）。仍将继续创建。`);
      }
    }

    const folderId =
      selectedFolderId === ALL_FOLDER_ID ? null : selectedFolderId === null ? null : (selectedFolderId as string);

    try {
      const created = await notesApi.createNote({ title, folderId });
      setNotes((prev) => [created, ...prev]);
      setSelectedEntryId(buildEntryId(created.folderId ?? null, created.titleKey || created.title));
      setSelectedNoteId(created.id);
      setSaveErrorsByNoteId({});
    } catch (err) {
      alert(err instanceof Error ? err.message : '创建失败');
    }
  };

  const handleAddCard = async () => {
    if (!selectedEntry) return;
    const folderId = selectedEntry.folderId ?? null;
    try {
      const created = await notesApi.createNote({ title: selectedEntry.title, folderId });
      setNotes((prev) => [created, ...prev]);
      setSelectedEntryId(buildEntryId(created.folderId ?? null, created.titleKey || created.title));
      setSelectedNoteId(created.id);
      setSaveErrorsByNoteId({});

      if (isCompareMode) {
        if (compareLeftNoteId === null) {
          setCompareLeftNoteId(created.id);
        } else if (created.id !== compareLeftNoteId) {
          setCompareRightNoteId(created.id);
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '创建失败');
    }
  };

  const handleDeleteCard = async (noteId: string) => {
    const confirmed = window.confirm('确定删除这张卡片吗？');
    if (!confirmed) return;
    try {
      await notesApi.deleteNote(noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      setSavingNoteIds((prev) => {
        if (!prev.has(noteId)) return prev;
        const next = new Set(prev);
        next.delete(noteId);
        return next;
      });
      setSaveErrorsByNoteId((prev) => {
        if (!(noteId in prev)) return prev;
        const next = { ...prev };
        delete next[noteId];
        return next;
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    }
  };

  const moveEntryToFolder = async (entry: NoteEntry, folderId: string | null, keepSelected: boolean) => {
    const currentFolderId = entry.folderId ?? null;
    if (currentFolderId === folderId) return;

    const entryNoteIds = new Set(entry.notes.map((n) => n.id));
    const willMerge = notes.some(
      (n) =>
        !entryNoteIds.has(n.id) &&
        (n.folderId ?? null) === folderId &&
        (n.titleKey || normalizeNoteTitleKey(n.title)) === entry.titleKey
    );
    if (willMerge) {
      const targetLabel = folderId === null ? '待整理' : getFolderPathLabel(folderId);
      const confirmed = window.confirm(
        `目标「${targetLabel}」下已存在同名词条「${entry.title}」。\n\n继续移动会将它们合并为同一个词条（卡片会叠加）。\n\n确定继续吗？`
      );
      if (!confirmed) return;
    }

    try {
      const updated = await Promise.all(entry.notes.map((n) => notesApi.updateNote(n.id, { folderId })));
      const updatedMap = new Map(updated.map((n) => [n.id, n] as const));
      setNotes((prev) => prev.map((n) => updatedMap.get(n.id) ?? n));

      if (keepSelected) {
        const nextTitleKey = updated[0]?.titleKey || entry.titleKey;
        setSelectedEntryId(buildEntryId(folderId, nextTitleKey));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '移动失败');
    }
  };

  const handleMoveEntryToFolder = async (folderId: string | null) => {
    if (!selectedEntry) return;
    await moveEntryToFolder(selectedEntry, folderId, true);
  };

  const handleMoveEntryByDrag = async (entryId: string, folderId: string | null) => {
    const entry = entryGroups.get(entryId);
    if (!entry) return;
    await moveEntryToFolder(entry, folderId, selectedEntryId === entryId);
  };

  const handleToggleCompareMode = () => {
    if (isCompareMode) {
      setIsCompareMode(false);
      const restore = entryListVisibleBeforeCompareRef.current;
      if (restore !== null) setIsEntryListVisible(restore);
      entryListVisibleBeforeCompareRef.current = null;
      return;
    }

    if (!selectedEntry) return;

    entryListVisibleBeforeCompareRef.current = isEntryListVisible;
    setIsEntryListVisible(false);

    const ids = selectedEntry.notes.map((n) => n.id);
    const left = (selectedNoteId && ids.includes(selectedNoteId) ? selectedNoteId : ids[0] ?? null) ?? null;
    const right = ids.find((id) => id !== left) ?? null;
    setCompareLeftNoteId(left);
    setCompareRightNoteId(right);
    setIsCompareMode(true);
  };

  const handleSwapCompareSides = () => {
    setCompareLeftNoteId(compareRightNoteId);
    setCompareRightNoteId(compareLeftNoteId);
  };

  const handleSetCompareLeft = (noteId: string) => {
    if (compareRightNoteId === noteId) {
      setCompareRightNoteId(compareLeftNoteId);
    }
    setCompareLeftNoteId(noteId);
    setSelectedNoteId(noteId);
  };

  const handleSetCompareRight = (noteId: string) => {
    if (compareLeftNoteId === noteId) {
      setCompareLeftNoteId(compareRightNoteId);
    }
    setCompareRightNoteId(noteId);
    setSelectedNoteId(noteId);
  };

  const handleSaveNoteById = async (noteId: string, html: string) => {
    setSavingNoteIds((prev) => {
      const next = new Set(prev);
      next.add(noteId);
      return next;
    });
    setSaveErrorsByNoteId((prev) => ({ ...prev, [noteId]: null }));
    try {
      const saved = await notesApi.updateNote(noteId, { content: html });
      setNotes((prev) => prev.map((n) => (n.id === saved.id ? saved : n)));
    } catch (err) {
      setSaveErrorsByNoteId((prev) => ({ ...prev, [noteId]: err instanceof Error ? err.message : '保存失败' }));
    } finally {
      setSavingNoteIds((prev) => {
        const next = new Set(prev);
        next.delete(noteId);
        return next;
      });
    }
  };

  const handleCreateFolder = async () => {
    const name = (window.prompt('新文件夹名称：') ?? '').trim();
    if (!name) return;

    const parentId = selectedFolderId === ALL_FOLDER_ID || selectedFolderId === null ? null : (selectedFolderId as string);
    try {
      const created = await notesApi.createFolder({ name, parentId });
      setFolders((prev) => [created, ...prev]);
      if (parentId) {
        ensureFolderExpanded(parentId);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '创建失败');
    }
  };

  const handleRenameFolder = async () => {
    if (selectedFolderId === ALL_FOLDER_ID || selectedFolderId === null) return;
    const folder = foldersById.get(selectedFolderId as string);
    if (!folder) return;
    const name = (window.prompt('重命名为：', folder.name) ?? '').trim();
    if (!name || name === folder.name) return;
    try {
      const updated = await notesApi.updateFolder(folder.id, { name });
      setFolders((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    } catch (err) {
      alert(err instanceof Error ? err.message : '重命名失败');
    }
  };

  const handleDeleteFolder = async () => {
    if (selectedFolderId === ALL_FOLDER_ID || selectedFolderId === null) return;
    const folderId = selectedFolderId as string;
    const folder = foldersById.get(folderId);
    if (!folder) return;

    const hasChildren = (childrenByParentId.get(folderId) || []).length > 0;
    if (hasChildren) {
      alert('该文件夹还有子文件夹，请先移动/删除子文件夹。');
      return;
    }

    const hasNotes = notes.some((n) => n.folderId === folderId);
    if (hasNotes) {
      alert('该文件夹下还有笔记，请先移动/删除笔记。');
      return;
    }

    const confirmed = window.confirm(`确定删除文件夹「${folder.name}」吗？`);
    if (!confirmed) return;
    try {
      await notesApi.deleteFolder(folderId);
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
      setSelectedFolderId(ALL_FOLDER_ID);
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setProjectTagsError(null);
  };

  const handleAddProjectTerm = async (name: string, color: string, parentId: string | null) => {
    if (!selectedProjectId) return;
    try {
      const created = await termCompatApi.create({ name, color, parentId, novelId: selectedProjectId });
      setProjectTags((prev) => [...prev, created]);
      setActiveTermId(created.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : '创建失败');
    }
  };

  const handleUpdateProjectTermParent = async (tagId: string, parentId: string | null) => {
    try {
      const updated = await termCompatApi.update(tagId, { parentId });
      setProjectTags((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      alert(err instanceof Error ? err.message : '移动失败');
    }
  };

  const handleUpdateProjectTermColor = async (tagId: string, color: string) => {
    try {
      const updated = await termCompatApi.update(tagId, { color });
      setProjectTags((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      alert(err instanceof Error ? err.message : '更新失败');
    }
  };

  const handleUpdateProjectTermName = async (tagId: string, name: string) => {
    try {
      const updated = await termCompatApi.update(tagId, { name });
      setProjectTags((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      alert(err instanceof Error ? err.message : '更新失败');
    }
  };

  const handleDeleteProjectTerm = async (tagId: string) => {
    try {
      await termCompatApi.delete(tagId);
      setProjectTags((prev) => prev.filter((t) => t.id !== tagId));
      setActiveTermId((prev) => (prev === tagId ? null : prev));
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    }
  };

  const selectedEntryFolderId = selectedEntry?.folderId ?? null;

  return (
    <PageContainer>
      <Header>
        <Title>笔记</Title>
        <HeaderRight>
          <BaseButton
            type="button"
            $variant={libraryView === 'notes' ? 'primary' : 'secondary'}
            onClick={() => setLibraryView('notes')}
            disabled={isLoading}
          >
            笔记库
          </BaseButton>
          <BaseButton
            type="button"
            $variant={libraryView === 'projectTerms' ? 'primary' : 'secondary'}
            onClick={() => setLibraryView('projectTerms')}
            disabled={isLoading}
          >
            项目词条
          </BaseButton>
          {libraryView === 'notes' && (
            <BaseButton type="button" $variant="primary" onClick={() => handleCreateNote()} disabled={isLoading}>
              新建笔记
            </BaseButton>
          )}
          <BaseButton type="button" $variant="secondary" onClick={onBack}>
            返回项目
          </BaseButton>
        </HeaderRight>
      </Header>

      <MainContent ref={(el) => { mainRef.current = el; }}>
        {libraryView === 'notes' ? (
          <>
        <LeftPanel
          ref={leftPanelRef}
          style={leftWidth !== null ? { flex: `0 0 ${leftWidth}px`, width: leftWidth } : undefined}
        >
          <SectionTitle>分类</SectionTitle>
          {error && <div style={{ color: COLORS.danger, fontSize: FONTS.sizeSmall }}>{error}</div>}
          <div style={{ display: 'flex', gap: SPACING.xs, flexWrap: 'wrap' }}>
            <SmallButton type="button" $variant="primary" onClick={handleCreateFolder} disabled={isLoading}>
              新建文件夹
            </SmallButton>
            <SmallButton
              type="button"
              $variant="secondary"
              onClick={handleRenameFolder}
              disabled={isLoading || selectedFolderId === ALL_FOLDER_ID || selectedFolderId === null}
            >
              重命名
            </SmallButton>
            <SmallButton
              type="button"
              $variant="danger"
              onClick={handleDeleteFolder}
              disabled={isLoading || selectedFolderId === ALL_FOLDER_ID || selectedFolderId === null}
            >
              删除
            </SmallButton>
            <ChildFolderToggleButton
              type="button"
              isActive={includeChildFolders}
              onClick={() => setIncludeChildFolders((prev) => !prev)}
              aria-pressed={includeChildFolders}
              disabled={selectedFolderId === ALL_FOLDER_ID || selectedFolderId === null || !selectedFolderHasChildren}
              title={
                selectedFolderId === ALL_FOLDER_ID || selectedFolderId === null
                  ? '选择一个文件夹后可用'
                  : selectedFolderHasChildren
                    ? includeChildFolders
                      ? '已包含子文件夹'
                      : '不包含子文件夹'
                    : '没有子文件夹'
              }
            >
              含子文件夹
            </ChildFolderToggleButton>
          </div>

          {isLoading ? (
            <Placeholder>正在加载…</Placeholder>
          ) : (
            <NoteFolderTree
              folders={folders}
              childrenByParentId={childrenByParentId}
              selectedFolderId={selectedFolderId}
              collapsedFolderIds={collapsedFolderIds}
              disabled={isLoading}
              onSelectFolder={setSelectedFolderId}
              onToggleFolderCollapsed={toggleFolderCollapsed}
              onEnsureFolderExpanded={ensureFolderExpanded}
              onMoveFolder={handleMoveFolder}
              onMoveEntry={handleMoveEntryByDrag}
            />
          )}
        </LeftPanel>

        <ResizeHandle
          role="separator"
          aria-label={isEntryListVisible ? '调整分类与词条宽度' : '调整分类与编辑区宽度'}
          aria-orientation="vertical"
          $active={activeResizer === 'left'}
          onPointerDown={startResize('left')}
          onDoubleClick={() => setLeftWidth(null)}
          title="拖动调整宽度（双击恢复默认）"
        />

        {isEntryListVisible && (
          <>
            <MiddlePanel
              ref={middlePanelRef}
              style={middleWidth !== null ? { flex: `0 0 ${middleWidth}px`, width: middleWidth } : undefined}
            >
              <SectionTitle>词条</SectionTitle>
              <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索词条 / 内容" aria-label="搜索笔记" />

              {isLoading ? (
                <Placeholder>正在加载…</Placeholder>
              ) : filteredEntries.length === 0 ? (
                <Placeholder>暂无词条</Placeholder>
              ) : (
                <EntryList>
                  {filteredEntries.map((entry) => {
                    const latest = entry.notes[0];
                    const preview = stripHtmlToText(latest?.content || '') || '（空）';
                    return (
                      <EntryItem
                        key={entry.entryId}
                        type="button"
                        $active={selectedEntryId === entry.entryId}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/x-note-entry', entry.entryId);
                          e.dataTransfer.setData('text/plain', `noteEntry:${entry.entryId}`);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onClick={() => {
                          setSelectedEntryId(entry.entryId);
                          setSelectedNoteId(entry.notes[0]?.id ?? null);
                          setSaveErrorsByNoteId({});
                        }}
                        title="点击打开（可拖动到左侧文件夹移动）"
                      >
                        <EntryTitle>{entry.title}</EntryTitle>
                        <EntryMeta>
                          {getFolderPathLabel(entry.folderId)} · {entry.notes.length} 张卡片 · 更新 {formatDateTime(entry.updatedAt)}
                        </EntryMeta>
                        <EntryPreview>{preview}</EntryPreview>
                      </EntryItem>
                    );
                  })}
                </EntryList>
              )}
            </MiddlePanel>

            <ResizeHandle
              role="separator"
              aria-label="调整词条与编辑区宽度"
              aria-orientation="vertical"
              $active={activeResizer === 'middle'}
              onPointerDown={startResize('middle')}
              onDoubleClick={() => setMiddleWidth(null)}
              title="拖动调整宽度（双击恢复默认）"
            />
          </>
        )}

        <RightPanel>
          <SelectedEntryHeader>
            <div style={{ minWidth: 0 }}>
              <SectionTitle>{selectedEntry ? selectedEntry.title : '编辑'}</SectionTitle>
              {selectedEntry && (
                <div style={{ fontSize: FONTS.sizeSmall, color: COLORS.textLight, marginTop: SPACING.xs }}>
                  {getFolderPathLabel(selectedEntry.folderId)} · {selectedEntry.notes.length} 张卡片 · 更新 {formatDateTime(selectedEntry.updatedAt)}
                </div>
              )}
            </div>
            <SelectedEntryActions>
              <SmallButton
                type="button"
                $variant="secondary"
                onClick={() => setIsEntryListVisible((prev) => !prev)}
                disabled={isLoading}
                title={isEntryListVisible ? '收起词条列表' : '展开词条列表'}
              >
                {isEntryListVisible ? '收起词条' : '展开词条'}
              </SmallButton>
              <SmallButton
                type="button"
                $variant={isCompareMode ? 'primary' : 'secondary'}
                onClick={handleToggleCompareMode}
                disabled={isLoading || (!selectedEntry && !isCompareMode)}
                title="左右对照编辑两张卡片"
              >
                {isCompareMode ? '退出对照' : '对照模式'}
              </SmallButton>
              {isCompareMode && (
                <SmallButton
                  type="button"
                  $variant="secondary"
                  onClick={handleSwapCompareSides}
                  disabled={!compareLeftNoteId || !compareRightNoteId || isLoading}
                  title="交换左右"
                >
                  交换
                </SmallButton>
              )}
              {selectedEntry && (
                <>
                  <FolderSelect
                    value={selectedEntryFolderId ?? ''}
                    onChange={(e) => handleMoveEntryToFolder(e.target.value ? e.target.value : null)}
                    aria-label="移动到文件夹"
                    title="移动到文件夹"
                  >
                    {folderOptions.map((opt) => (
                      <option key={String(opt.id)} value={opt.id ?? ''}>
                        {opt.label}
                      </option>
                    ))}
                  </FolderSelect>
                  <SmallButton type="button" $variant="primary" onClick={handleAddCard} disabled={isLoading}>
                    新增卡片
                  </SmallButton>
                </>
              )}
            </SelectedEntryActions>
          </SelectedEntryHeader>

          {selectedEntry && (
            <CardList>
              {selectedEntry.notes.map((n) => (
                <CardRow
                  key={n.id}
                  $active={selectedNoteId === n.id || (isCompareMode && (compareLeftNoteId === n.id || compareRightNoteId === n.id))}
                >
                  <CardButton
                    type="button"
                    onClick={() => {
                      setSelectedNoteId(n.id);
                      setSaveErrorsByNoteId({});
                    }}
                    title="打开卡片"
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
                      <CardMeta>
                        {isCompareMode && compareLeftNoteId === n.id ? '左 · ' : ''}
                        {isCompareMode && compareRightNoteId === n.id ? '右 · ' : ''}
                        更新 {formatDateTime(n.updatedAt)}
                      </CardMeta>
                      <div style={{ fontSize: FONTS.sizeSmall, color: COLORS.text, whiteSpace: 'pre-wrap' }}>
                        {stripHtmlToText(n.content || '').slice(0, 60) || '（空）'}
                      </div>
                    </div>
                  </CardButton>
                  <CardActions>
                    {isCompareMode && (
                      <>
                        <SmallButton
                          type="button"
                          $variant={compareLeftNoteId === n.id ? 'primary' : 'secondary'}
                          onClick={() => handleSetCompareLeft(n.id)}
                          disabled={isLoading}
                          title="设为左侧"
                        >
                          左
                        </SmallButton>
                        <SmallButton
                          type="button"
                          $variant={compareRightNoteId === n.id ? 'primary' : 'secondary'}
                          onClick={() => handleSetCompareRight(n.id)}
                          disabled={isLoading}
                          title="设为右侧"
                        >
                          右
                        </SmallButton>
                      </>
                    )}
                    <SmallButton type="button" $variant="danger" onClick={() => handleDeleteCard(n.id)} title="删除卡片">
                      删除
                    </SmallButton>
                  </CardActions>
                </CardRow>
              ))}
            </CardList>
          )}

          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {isCompareMode ? (
              <CompareEditors>
                <ComparePane>
                  <ComparePaneHeader>左侧</ComparePaneHeader>
                  <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                    <NoteEditor
                      note={compareLeftNote}
                      isSaving={compareLeftNote ? savingNoteIds.has(compareLeftNote.id) : false}
                      error={compareLeftNote ? saveErrorsByNoteId[compareLeftNote.id] : null}
                      onSave={(html) =>
                        compareLeftNote ? handleSaveNoteById(compareLeftNote.id, html) : Promise.resolve()
                      }
                    />
                  </div>
                </ComparePane>
                <ComparePane>
                  <ComparePaneHeader>右侧</ComparePaneHeader>
                  <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                    <NoteEditor
                      note={compareRightNote}
                      isSaving={compareRightNote ? savingNoteIds.has(compareRightNote.id) : false}
                      error={compareRightNote ? saveErrorsByNoteId[compareRightNote.id] : null}
                      onSave={(html) =>
                        compareRightNote ? handleSaveNoteById(compareRightNote.id, html) : Promise.resolve()
                      }
                    />
                  </div>
                </ComparePane>
              </CompareEditors>
            ) : (
              <NoteEditor
                note={selectedNote}
                isSaving={selectedNote ? savingNoteIds.has(selectedNote.id) : false}
                error={selectedNote ? saveErrorsByNoteId[selectedNote.id] : null}
                onSave={(html) => (selectedNote ? handleSaveNoteById(selectedNote.id, html) : Promise.resolve())}
              />
            )}
          </div>
        </RightPanel>
          </>
        ) : (
          <>
            <LeftPanel>
              <SectionTitle>项目</SectionTitle>
              <SearchInput
                value={projectQuery}
                onChange={(e) => setProjectQuery(e.target.value)}
                placeholder="搜索项目 / 作者"
                aria-label="搜索项目"
              />

              {filteredProjects.length === 0 ? (
                <Placeholder>暂无项目</Placeholder>
              ) : (
                <EntryList>
                  {filteredProjects.map((p) => (
                    <EntryItem
                      key={p.id}
                      type="button"
                      $active={selectedProjectId === p.id}
                      onClick={() => handleSelectProject(p.id)}
                      onDoubleClick={() => {
                        window.location.hash = `#/edit/${p.id}`;
                      }}
                      title="点击选择（双击打开项目）"
                    >
                      <EntryTitle>{p.title}</EntryTitle>
                      <EntryMeta>
                        {p.author ? `作者：${p.author} · ` : ''}
                        更新 {formatDateTime(p.updatedAt || p.createdAt || '')}
                      </EntryMeta>
                    </EntryItem>
                  ))}
                </EntryList>
              )}
            </LeftPanel>

            <RightPanel>
              <SelectedEntryHeader>
                <div style={{ minWidth: 0 }}>
                  <SectionTitle>{selectedProject ? selectedProject.title : '词条'}</SectionTitle>
                  {selectedProject && (
                    <div style={{ fontSize: FONTS.sizeSmall, color: COLORS.textLight, marginTop: SPACING.xs }}>
                      {selectedProject.author ? `作者：${selectedProject.author} · ` : ''}
                      更新 {formatDateTime(selectedProject.updatedAt || selectedProject.createdAt || '')}
                    </div>
                  )}
                </div>
                <SelectedEntryActions>
                  {selectedProjectId && (
                    <>
                      <SmallButton
                        type="button"
                        $variant="secondary"
                        onClick={() => loadProjectTags(selectedProjectId)}
                        disabled={isLoadingProjectTags}
                        title="重新加载词条"
                      >
                        刷新
                      </SmallButton>
                      <SmallButton
                        type="button"
                        $variant="secondary"
                        onClick={() => {
                          window.location.hash = `#/edit/${selectedProjectId}`;
                        }}
                        title="打开项目编辑器"
                      >
                        打开项目
                      </SmallButton>
                    </>
                  )}
                </SelectedEntryActions>
              </SelectedEntryHeader>

              {projectTagsError && <div style={{ color: COLORS.danger, fontSize: FONTS.sizeSmall }}>{projectTagsError}</div>}

              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                {isLoadingProjectTags ? (
                  <Placeholder>正在加载词条…</Placeholder>
                ) : selectedProject ? (
                  <TagManagementView
                    tags={projectTags}
                    onAddTag={handleAddProjectTerm}
                    activeTagId={activeTermId}
                    onUpdateTagParent={handleUpdateProjectTermParent}
                    onUpdateTagColor={handleUpdateProjectTermColor}
                    onUpdateTagName={handleUpdateProjectTermName}
                    onDeleteTag={handleDeleteProjectTerm}
                    editorMode="annotation"
                    onApplyTagToSelection={(id) => setActiveTermId(id)}
                    onSelectTagForReadMode={() => {}}
                    currentSelection={null}
                    onCreatePendingAnnotation={() => {}}
                    onDeleteAnnotationsInSelection={() => {}}
                    entityLabel="词条"
                    showSelectionActions={false}
                  />
                ) : (
                  <Placeholder>暂无项目</Placeholder>
                )}
              </div>
            </RightPanel>
          </>
        )}
      </MainContent>
    </PageContainer>
  );
};

export default NotesLibraryPage;

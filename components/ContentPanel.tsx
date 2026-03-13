import React, { useMemo, useState, CSSProperties, useEffect, useRef, useCallback } from 'react';
import type { Annotation, Tag, Novel, Chapter, SelectionDetails, Storyline, PlotAnchor } from '../types';
import { 
    COLORS, SPACING, 
} from "../styles";
import { getAllDescendantTagIds, getContrastingTextColor, getAllAncestorTagIds, countWords } from "../utils";
import type { EditorMode } from './editor/NovelEditorPage';
import PlotAnchorPopover from './storyline/PlotAnchorPopover';
import type { StorylineDerivedData } from './storyline/storylineTree';
import { getDefaultCollapsedStorylineIds } from './storyline/storylineTree';
import { getNovelReadingPosition, setNovelReadingPosition } from '../utils/novelReadingPosition';
import SnippetContent from './contentPanel/SnippetContent';
import {
  Panel,
  Title,
  WordCount,
  ChildTagToggleButton,
  FindOpenButton,
  SplitChapterButton,
  FindBarContainer,
  FindInput,
  FindStatus,
  FindIconButton,
  FindMark,
  NovelInput,
  ContentPreviewContainer,
  ContentDisplay,
  AnnotatedSpan,
  Placeholder,
  ParagraphWrapper,
  AddAnchorButton,
  AnchorLine,
  AnchorContainer,
  AnchorMarker,
  AnchorLineSegment,
  AnchorTooltip,
  NextChapterButton,
} from './contentPanel/styles';


interface ContentPanelProps {
  novel: Novel;
  storylineDerivedData: StorylineDerivedData;
  onNovelTextChange: (text: string) => void;
  onChapterTextChange: (chapterId: string, newContent: string) => void;
  onTextSelection: () => void;
  annotations: Annotation[];
  getTagById: (id: string) => Tag | undefined;
  selectedChapter: Chapter | null;
  style?: CSSProperties;
  viewMode: 'full' | 'snippet';
  activeFilterTagDetails: Tag | null;
  globalFilterTagName?: string | null;
  allNovelTags: Tag[];
  editorMode: EditorMode;
  onDeleteAnnotation?: (annotationId: string) => void;
  currentSelection: SelectionDetails | null;
  // Storyline Props
  onAddPlotAnchor: (description: string, position: number, storylineIds: string[]) => void;
  onUpdatePlotAnchor: (anchorId: string, updates: Partial<PlotAnchor>) => void;
  onDeletePlotAnchor: (anchorId: string) => void;
  scrollToAnchorId: string | null;
  onScrollToAnchorComplete: () => void;
  // Chapter navigation
  onSelectChapter?: (chapterId: string | null) => void;
  locateRequest?: { chapterId: string; absoluteIndex: number } | null;
  onLocateRequestHandled?: () => void;
  // Drag and drop tagging
  onBatchCreateAnnotations?: (tagId: string, textSegments: Array<{ text: string; startIndex: number; endIndex: number }>) => void;
  includeChildTagsInReadMode: boolean;
  onToggleIncludeChildTagsInReadMode: () => void;
  onSplitChapterAtCursor?: (chapterId: string, newContent: string, cursorOffset: number) => Promise<void> | void;
}

export const ContentPanel: React.FC<ContentPanelProps> = ({
  novel, storylineDerivedData, onNovelTextChange, onChapterTextChange, onTextSelection, annotations, getTagById, selectedChapter, style,
  viewMode, activeFilterTagDetails, globalFilterTagName, allNovelTags, editorMode,
  onDeleteAnnotation,
  currentSelection,
  onAddPlotAnchor, onDeletePlotAnchor, onUpdatePlotAnchor,
  scrollToAnchorId, onScrollToAnchorComplete,
  onSelectChapter,
  locateRequest,
  onLocateRequestHandled,
  onBatchCreateAnnotations,
  includeChildTagsInReadMode,
  onToggleIncludeChildTagsInReadMode,
  onSplitChapterAtCursor,
}) => {
  const [editedText, setEditedText] = useState('');
  const [popoverState, setPopoverState] = useState<{ anchor: PlotAnchor | null; position: number; target: HTMLElement } | null>(null);
  const [popoverCollapsedStorylineIds, setPopoverCollapsedStorylineIds] = useState<Set<string>>(new Set());
  const [isNearBottom, setIsNearBottom] = useState(false);
  const [shouldScrollToTop, setShouldScrollToTop] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [pendingLocate, setPendingLocate] = useState<{ chapterId: string | null; absoluteIndex: number; highlightLength?: number } | null>(null);

  // In-book find (Ctrl+F) - search across the current novel's chapter contents and jump between matches.
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [debouncedFindQuery, setDebouncedFindQuery] = useState('');
  // Find scope: from the chapter where the find bar was opened, to the end of the book.
  const [findStartChapterId, setFindStartChapterId] = useState<string | null>(null);
  const [findStartAbsoluteIndex, setFindStartAbsoluteIndex] = useState<number>(0);
  const [findMatches, setFindMatches] = useState<Array<{ chapterId: string | null; absoluteStart: number }>>([]);
  const [activeFindIndex, setActiveFindIndex] = useState<number>(-1);
  const [activeFindAbsoluteStart, setActiveFindAbsoluteStart] = useState<number | null>(null);
  const [isFinding, setIsFinding] = useState(false);
  const [isFindComposing, setIsFindComposing] = useState(false);
  const findInputRef = useRef<HTMLInputElement>(null);
  const lastAutoJumpQueryRef = useRef<string>('');
  const findJobIdRef = useRef(0);

  const anchorRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const contentDisplayRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedChapterId = selectedChapter?.id ?? null;
  const selectedChapterTitle = selectedChapter?.title ?? '';
  const selectedChapterStartIndex = selectedChapter?.originalStartIndex ?? 0;
  const selectedChapterContent = selectedChapter?.content ?? '';
  const isAnnotationLikeMode = editorMode === 'annotation' || editorMode === 'plotRange';
  const isReadMode = editorMode === 'read' || editorMode === 'plotRangeRead';
  const isReadOrAnnotationLikeMode = isReadMode || isAnnotationLikeMode;
  const isPreviewMode = isReadOrAnnotationLikeMode || editorMode === 'storyline';
  const handleTogglePopoverStorylineCollapsed = useCallback((storylineId: string) => {
    setPopoverCollapsedStorylineIds((prev) => {
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
    if (!popoverState) return;
    if ((novel.storylines || []).length === 0) {
      setPopoverCollapsedStorylineIds(new Set());
      return;
    }

    setPopoverCollapsedStorylineIds((prev) => {
      const next =
        prev.size > 0
          ? new Set(prev)
          : getDefaultCollapsedStorylineIds(
              novel.storylines || [],
              storylineDerivedData.childrenByParentId,
              storylineDerivedData.parentByStorylineId
            );

      const selectedStorylineIds = popoverState.anchor?.storylineIds || [];
      selectedStorylineIds.forEach((storylineId) => {
        let current: string | null = storylineId;
        while (current) {
          next.delete(current);
          current = storylineDerivedData.parentByStorylineId.get(current) ?? null;
        }
      });

      return next;
    });
  }, [novel.storylines, popoverState, storylineDerivedData.childrenByParentId, storylineDerivedData.parentByStorylineId]);

  useEffect(() => {
    const validIds = new Set((novel.storylines || []).map((storyline) => storyline.id));
    setPopoverCollapsedStorylineIds((prev) => {
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
  }, [novel.storylines]);

  useEffect(() => {
    if (!locateRequest) return;
    if (!isReadMode) return;

    setPendingLocate({ chapterId: locateRequest.chapterId, absoluteIndex: locateRequest.absoluteIndex, highlightLength: 1 });
    if (onSelectChapter) {
      onSelectChapter(locateRequest.chapterId);
    }
    onLocateRequestHandled?.();
  }, [locateRequest, isReadMode, onSelectChapter, onLocateRequestHandled]);

  const handleLocateToText = useCallback((chapterId: string, absoluteIndex: number) => {
    setPendingLocate({ chapterId, absoluteIndex });
    onSelectChapter?.(chapterId);
  }, [onSelectChapter]);

  // 缓存每个章节的滚动位置（比例），key 为章节ID或 'full-novel'
  const scrollPositionCache = useRef<Record<string, number>>({});
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPersistRef = useRef<{ chapterId: string | null; scrollRatio: number } | null>(null);

  const schedulePersistReadingPosition = (chapterId: string | null, scrollRatio: number) => {
    if (viewMode !== 'full') return;
    pendingPersistRef.current = { chapterId, scrollRatio };
    if (persistTimerRef.current) return;

    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null;
      const pending = pendingPersistRef.current;
      if (!pending) return;
      setNovelReadingPosition(novel.userId, novel.id, pending);
    }, 400);
  };

  useEffect(() => {
    const saved = getNovelReadingPosition(novel.userId, novel.id);
    if (!saved) return;
    const cacheKey = saved.chapterId || 'full-novel';
    scrollPositionCache.current[cacheKey] = saved.scrollRatio;
  }, [novel.id, novel.userId]);

  useEffect(() => {
    const cacheKey = selectedChapter ? selectedChapter.id : 'full-novel';
    const cachedRatio = scrollPositionCache.current[cacheKey] ?? 0;
    schedulePersistReadingPosition(selectedChapterId, cachedRatio);
  }, [selectedChapterId, viewMode]);

  useEffect(() => {
    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      const pending = pendingPersistRef.current;
      if (pending) {
        setNovelReadingPosition(novel.userId, novel.id, pending);
      }
    };
  }, [novel.id, novel.userId]);

  useEffect(() => {
    if (scrollToAnchorId) {
      const element = anchorRefs.current.get(scrollToAnchorId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.setAttribute('data-is-scrolling-to', 'true');
        const handleAnimationEnd = () => {
          element.removeAttribute('data-is-scrolling-to');
          onScrollToAnchorComplete();
        };
        element.addEventListener('animationend', handleAnimationEnd, { once: true });
      } else {
        onScrollToAnchorComplete();
      }
    }
  }, [scrollToAnchorId, onScrollToAnchorComplete]);

  // 计算章节排序和下一章
  const sortedChapters = useMemo(() => {
    return [...(novel.chapters || [])].sort((a, b) => a.originalStartIndex - b.originalStartIndex);
  }, [novel.chapters]);

  const nextChapter = useMemo(() => {
    if (!selectedChapter || !sortedChapters.length) return null;
    const currentIndex = sortedChapters.findIndex(ch => ch.id === selectedChapter.id);
    if (currentIndex === -1 || currentIndex === sortedChapters.length - 1) return null;
    return sortedChapters[currentIndex + 1];
  }, [selectedChapter, sortedChapters]);

  const snapshotFindStartScope = useCallback(() => {
    if (sortedChapters.length > 0) {
      const current = selectedChapterId
        ? sortedChapters.find(ch => ch.id === selectedChapterId)
        : null;
      const start = current ?? sortedChapters[0];
      setFindStartChapterId(start?.id ?? null);
      setFindStartAbsoluteIndex(start?.originalStartIndex ?? 0);
      return;
    }

    setFindStartChapterId(null);
    setFindStartAbsoluteIndex(0);
  }, [sortedChapters, selectedChapterId]);

  const openFindBar = useCallback(() => {
    if (!isFindOpen) {
      snapshotFindStartScope();
    }
    setIsFindOpen(true);
    requestAnimationFrame(() => {
      findInputRef.current?.focus();
      findInputRef.current?.select();
    });
  }, [isFindOpen, snapshotFindStartScope]);

  useEffect(() => {
    // This effect syncs the local state with the prop from above.
    // It runs when the user selects a new chapter or when the underlying novel text is updated from the parent.
    const sourceText = selectedChapterId
      ? selectedChapterContent
      : (editorMode === 'edit' ? novel.text : '');
    setEditedText(sourceText);
  }, [selectedChapterId, selectedChapterContent, novel.text, editorMode]);

  // 处理滚动到顶部逻辑
  useEffect(() => {
    if (shouldScrollToTop && contentDisplayRef.current) {
      contentDisplayRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      setShouldScrollToTop(false);
    }
  }, [shouldScrollToTop, selectedChapter?.id]);

  // 当 editorMode 或 selectedChapter 改变时，恢复滚动位置
  useEffect(() => {
    const cacheKey = getScrollCacheKey();
    const cachedRatio = scrollPositionCache.current[cacheKey];

    if (cachedRatio === undefined) return; // 首次进入，不恢复

    // 使用 requestAnimationFrame 确保渲染完成后再恢复滚动
    requestAnimationFrame(() => {
      if (editorMode === 'edit' && textareaRef.current) {
        const { scrollHeight, clientHeight } = textareaRef.current;
        const scrollableHeight = scrollHeight - clientHeight;
        if (scrollableHeight > 0) {
          const targetScrollTop = cachedRatio * scrollableHeight;
          textareaRef.current.scrollTop = targetScrollTop;
        }
      } else if (isPreviewMode && contentDisplayRef.current) {
        const { scrollHeight, clientHeight } = contentDisplayRef.current;
        const scrollableHeight = scrollHeight - clientHeight;
        if (scrollableHeight > 0) {
          const targetScrollTop = cachedRatio * scrollableHeight;
          contentDisplayRef.current.scrollTop = targetScrollTop;
        }
      }
    });
  }, [editorMode, selectedChapter?.id]);

  // 阅读模式：从片段列表“定位”到正文对应位置
  useEffect(() => {
    if (!pendingLocate) return;
    if (!isReadOrAnnotationLikeMode || viewMode !== 'full') return;
    if (selectedChapterId !== pendingLocate.chapterId) return;
    if (!contentDisplayRef.current) return;

    const container = contentDisplayRef.current;
    const targetOffsetInChapter = pendingLocate.absoluteIndex - selectedChapterStartIndex;
    if (Number.isNaN(targetOffsetInChapter) || targetOffsetInChapter < 0) {
      setPendingLocate(null);
      return;
    }

    const resolveTextPosition = (
      root: HTMLElement,
      charOffset: number
    ): { node: Text; offset: number } | null => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let remaining = Math.max(0, charOffset);
      let node = walker.nextNode() as Text | null;

      while (node) {
        const value = node.nodeValue ?? '';
        if (remaining <= value.length) {
          return { node, offset: Math.min(remaining, value.length) };
        }
        remaining -= value.length;
        node = walker.nextNode() as Text | null;
      }

      return null;
    };

    const scrollToRange = () => {
      const highlightLength = Math.max(1, pendingLocate.highlightLength ?? 1);
      const startPos = resolveTextPosition(container, targetOffsetInChapter);
      const endPos = resolveTextPosition(container, targetOffsetInChapter + highlightLength);

      if (!startPos || !endPos) {
        setPendingLocate(null);
        return;
      }

      try {
        const range = document.createRange();
        range.setStart(startPos.node, startPos.offset);
        range.setEnd(endPos.node, endPos.offset);

        const rect = range.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const deltaTop = rect.top - containerRect.top;
        const targetTop = container.scrollTop + deltaTop - container.clientHeight / 3;

        container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });

        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
      } catch {
        // ignore
      } finally {
        setPendingLocate(null);
      }
    };

    // 等待章节切换与滚动恢复完成后再定位
    requestAnimationFrame(() => requestAnimationFrame(scrollToRange));
  }, [pendingLocate, editorMode, viewMode, selectedChapterId, selectedChapterStartIndex]);

  // Debounce find input to avoid scanning large novels on every keystroke.
  useEffect(() => {
    if (isFindComposing) return;
    const handle = setTimeout(() => setDebouncedFindQuery(findQuery), 200);
    return () => clearTimeout(handle);
  }, [findQuery, isFindComposing]);

  const normalizedFindQuery = useMemo(() => debouncedFindQuery.trim(), [debouncedFindQuery]);

  // If the find bar is open but the user hasn't entered a query yet, keep the scope aligned
  // with the currently selected chapter (so "from this chapter" stays intuitive).
  useEffect(() => {
    if (!isFindOpen) return;
    if (normalizedFindQuery) return;
    snapshotFindStartScope();
  }, [isFindOpen, normalizedFindQuery, snapshotFindStartScope]);

  const findAbsStartToIndex = useMemo(() => {
    const map = new Map<number, number>();
    findMatches.forEach((m, idx) => map.set(m.absoluteStart, idx));
    return map;
  }, [findMatches]);

  // Keep display index in sync if the user set the cursor via click before the full scan finished.
  useEffect(() => {
    if (activeFindAbsoluteStart === null) return;
    const idx = findAbsStartToIndex.get(activeFindAbsoluteStart);
    if (typeof idx === 'number' && idx !== activeFindIndex) {
      setActiveFindIndex(idx);
    }
  }, [findAbsStartToIndex, activeFindAbsoluteStart, activeFindIndex]);

  // Compute matches across chapter contents (titles are intentionally excluded since chapter.content omits them).
  useEffect(() => {
    if (!isFindOpen) return;

    const q = normalizedFindQuery;
    if (!q) {
      setIsFinding(false);
      setFindMatches([]);
      setActiveFindIndex(-1);
      setActiveFindAbsoluteStart(null);
      lastAutoJumpQueryRef.current = '';
      return;
    }

    const jobId = ++findJobIdRef.current;
    setIsFinding(true);
    setFindMatches([]);
    setActiveFindIndex(-1);
    setActiveFindAbsoluteStart(null);

    const chaptersToSearch: Array<{ chapterId: string | null; startIndex: number; text: string }> = (() => {
      if (sortedChapters.length === 0) {
        return [{ chapterId: null, startIndex: 0, text: novel.text }];
      }

      // Scope starts at the chapter where the find UI was opened (defaulting to the current chapter).
      const effectiveStartChapterId = findStartChapterId;
      let startIdx = effectiveStartChapterId
        ? sortedChapters.findIndex(ch => ch.id === effectiveStartChapterId)
        : -1;

      if (startIdx < 0) {
        startIdx = sortedChapters.findIndex(ch => ch.originalStartIndex >= findStartAbsoluteIndex);
      }
      if (startIdx < 0) startIdx = 0;

      return sortedChapters
        .slice(startIdx)
        .map(ch => ({ chapterId: ch.id, startIndex: ch.originalStartIndex, text: ch.content }));
    })();

    const results: Array<{ chapterId: string | null; absoluteStart: number }> = [];
    let chapterIdx = 0;
    let fromIndex = 0;

    const tick = () => {
      if (findJobIdRef.current !== jobId) return; // cancelled

      const deadline = performance.now() + 12;
      while (chapterIdx < chaptersToSearch.length && performance.now() < deadline) {
        const chapter = chaptersToSearch[chapterIdx];
        const foundAt = chapter.text.indexOf(q, fromIndex);
        if (foundAt === -1) {
          chapterIdx += 1;
          fromIndex = 0;
          continue;
        }

        results.push({ chapterId: chapter.chapterId, absoluteStart: chapter.startIndex + foundAt });
        fromIndex = foundAt + Math.max(1, q.length);
      }

      if (chapterIdx < chaptersToSearch.length) {
        setTimeout(tick, 0);
        return;
      }

      // Finished
      if (findJobIdRef.current !== jobId) return;
      setIsFinding(false);
      setFindMatches(results);
      setActiveFindIndex(results.length ? 0 : -1);
      setActiveFindAbsoluteStart(results.length ? results[0].absoluteStart : null);
    };

    setTimeout(tick, 0);
  }, [isFindOpen, normalizedFindQuery, sortedChapters, novel.text, findStartChapterId, findStartAbsoluteIndex]);

  const locateFindMatchByIndex = useCallback((matchIndex: number) => {
    if (viewMode !== 'full') return;
    if (!isReadOrAnnotationLikeMode) return;
    if (!normalizedFindQuery) return;

    const match = findMatches[matchIndex];
    if (!match) return;

    setActiveFindIndex(matchIndex);
    setActiveFindAbsoluteStart(match.absoluteStart);
    setPendingLocate({
      chapterId: match.chapterId,
      absoluteIndex: match.absoluteStart,
      highlightLength: normalizedFindQuery.length,
    });

    if (match.chapterId !== selectedChapterId) {
      onSelectChapter?.(match.chapterId);
    }

    requestAnimationFrame(() => findInputRef.current?.focus());
  }, [editorMode, viewMode, normalizedFindQuery, findMatches, onSelectChapter, selectedChapterId]);

  const locateFindMatchByAbsoluteStart = useCallback((absoluteStart: number, chapterId: string | null) => {
    if (viewMode !== 'full') return;
    if (!isReadOrAnnotationLikeMode) return;
    if (!normalizedFindQuery) return;

    setActiveFindAbsoluteStart(absoluteStart);
    const idx = findAbsStartToIndex.get(absoluteStart);
    setActiveFindIndex(typeof idx === 'number' ? idx : -1);

    setPendingLocate({
      chapterId,
      absoluteIndex: absoluteStart,
      highlightLength: normalizedFindQuery.length,
    });

    if (chapterId !== selectedChapterId) {
      onSelectChapter?.(chapterId);
    }

    requestAnimationFrame(() => findInputRef.current?.focus());
  }, [editorMode, viewMode, normalizedFindQuery, findAbsStartToIndex, onSelectChapter, selectedChapterId]);

  const goToNextFindMatch = useCallback(() => {
    if (!findMatches.length) return;

    const currentAbs = activeFindAbsoluteStart;
    if (currentAbs === null) {
      locateFindMatchByIndex(0);
      return;
    }

    // first index with absoluteStart > currentAbs
    let left = 0;
    let right = findMatches.length;
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (findMatches[mid].absoluteStart <= currentAbs) left = mid + 1;
      else right = mid;
    }

    const nextIndex = left < findMatches.length ? left : 0;
    locateFindMatchByIndex(nextIndex);
  }, [findMatches, activeFindAbsoluteStart, locateFindMatchByIndex]);

  const goToPrevFindMatch = useCallback(() => {
    if (!findMatches.length) return;

    const currentAbs = activeFindAbsoluteStart;
    if (currentAbs === null) {
      locateFindMatchByIndex(findMatches.length - 1);
      return;
    }

    // first index with absoluteStart >= currentAbs
    let left = 0;
    let right = findMatches.length;
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (findMatches[mid].absoluteStart < currentAbs) left = mid + 1;
      else right = mid;
    }

    const prevIndex = left > 0 ? left - 1 : findMatches.length - 1;
    locateFindMatchByIndex(prevIndex);
  }, [findMatches, activeFindAbsoluteStart, locateFindMatchByIndex]);

  // After a search completes, auto-jump to the first match (TXT/Chrome-like behavior).
  useEffect(() => {
    if (!isFindOpen) return;
    if (isFinding) return;
    if (!normalizedFindQuery) return;
    if (!findMatches.length) return;

    const autoJumpKey = `${normalizedFindQuery}@@${findStartAbsoluteIndex}`;
    if (lastAutoJumpQueryRef.current === autoJumpKey) return;
    lastAutoJumpQueryRef.current = autoJumpKey;
    locateFindMatchByIndex(0);
  }, [isFindOpen, isFinding, normalizedFindQuery, findMatches.length, locateFindMatchByIndex, findStartAbsoluteIndex]);

  // Keyboard shortcuts: Ctrl+F opens; Enter/Down -> next; Shift+Enter/Up -> prev; Esc closes.
  useEffect(() => {
    const canUseFindHere = isReadOrAnnotationLikeMode && viewMode === 'full';

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      const isCtrlF = (e.ctrlKey || e.metaKey) && key.toLowerCase() === 'f';

      if (isCtrlF && canUseFindHere) {
        e.preventDefault();
        openFindBar();
        return;
      }

      if (!isFindOpen) return;

      if (key === 'Escape') {
        e.preventDefault();
        setIsFindOpen(false);
        return;
      }

      const activeEl = document.activeElement;
      const isFindFocused = activeEl === findInputRef.current;
      if (!isFindFocused) return;

      if (key === 'ArrowUp') {
        e.preventDefault();
        goToPrevFindMatch();
        return;
      }

      if (key === 'ArrowDown') {
        e.preventDefault();
        goToNextFindMatch();
        return;
      }

      if (key === 'Enter' || key === 'F3') {
        e.preventDefault();
        if (e.shiftKey) {
          goToPrevFindMatch();
        } else {
          goToNextFindMatch();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editorMode, viewMode, isFindOpen, goToNextFindMatch, goToPrevFindMatch, openFindBar]);

  // If the panel view can no longer support searching, auto-close the find bar.
  useEffect(() => {
    const canUseFindHere = isReadOrAnnotationLikeMode && viewMode === 'full';
    if (!canUseFindHere && isFindOpen) setIsFindOpen(false);
  }, [editorMode, viewMode, isFindOpen]);

  // Reset find state when switching novels.
  useEffect(() => {
    setIsFindOpen(false);
    setFindQuery('');
    setDebouncedFindQuery('');
    setFindStartChapterId(null);
    setFindStartAbsoluteIndex(0);
    setFindMatches([]);
    setActiveFindIndex(-1);
    setActiveFindAbsoluteStart(null);
    setIsFinding(false);
    setIsFindComposing(false);
    lastAutoJumpQueryRef.current = '';
    findJobIdRef.current += 1; // cancel any in-flight job
  }, [novel.id]);

  // 获取当前章节的缓存 key
  const getScrollCacheKey = () => {
    return selectedChapter ? selectedChapter.id : 'full-novel';
  };

  // 监听滚动事件，判断是否接近底部 + 缓存滚动位置比例
  const handleScroll = () => {
    if (!contentDisplayRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = contentDisplayRef.current;
    const threshold = 80; // 距离底部80px以内
    const nearBottom = scrollHeight - scrollTop - clientHeight <= threshold;
    setIsNearBottom(nearBottom);

    // 缓存滚动位置比例（标注模式）
    const scrollableHeight = scrollHeight - clientHeight;
    if (scrollableHeight > 0) {
      const scrollRatio = scrollTop / scrollableHeight;
      scrollPositionCache.current[getScrollCacheKey()] = scrollRatio;
      schedulePersistReadingPosition(selectedChapterId, scrollRatio);
    }
  };

  // 监听画本模式的滚动事件
  const handleTextareaScroll = () => {
    if (!textareaRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = textareaRef.current;

    // 缓存滚动位置比例（画本模式）
    const scrollableHeight = scrollHeight - clientHeight;
    if (scrollableHeight > 0) {
      const scrollRatio = scrollTop / scrollableHeight;
      scrollPositionCache.current[getScrollCacheKey()] = scrollRatio;
      schedulePersistReadingPosition(selectedChapterId, scrollRatio);
    }
  };

  const handleTextareaBlur = () => {
    // This function is called when the user clicks away from the textarea.
    // It commits the changes to the global state, triggering the expensive re-processing.
    if (selectedChapter) {
      if (editedText !== selectedChapter.content) {
        onChapterTextChange(selectedChapter.id, editedText);
      }
    } else {
      if (editedText !== novel.text) {
        onNovelTextChange(editedText);
      }
    }
  };

  const handleSplitChapterClick = useCallback(async () => {
    if (editorMode !== 'edit') return;
    if (!selectedChapterId || !onSplitChapterAtCursor) return;
    if (!textareaRef.current) return;

    const cursorOffset = textareaRef.current.selectionStart ?? 0;
    const normalizedText = editedText.replace(/\r\n|\r/g, '\n');

    if (normalizedText.length === 0) {
      alert('当前章节为空，无法拆分。');
      return;
    }
    if (cursorOffset <= 0 || cursorOffset >= normalizedText.length) {
      alert('请把光标放在章节中间位置后再拆分。');
      return;
    }

    try {
      await onSplitChapterAtCursor(selectedChapterId, normalizedText, cursorOffset);
    } catch (error) {
      console.error('[拆分章节] 处理失败:', error);
      alert('拆分章节失败，请重试。');
    }
  }, [editorMode, selectedChapterId, onSplitChapterAtCursor, editedText]);

  const textForPreview = useMemo(() => {
    if (viewMode === 'snippet' && editorMode !== 'storyline') return ''; 
    return selectedChapterId
      ? selectedChapterContent
      : (editorMode === 'edit' ? novel.text : '');
  }, [viewMode, editorMode, selectedChapterId, selectedChapterContent, novel.text]);

  const displayOffsetForPreview = useMemo(() => {
    if (viewMode === 'snippet' && editorMode !== 'storyline') return 0;
    return selectedChapterId ? selectedChapterStartIndex : 0;
  }, [viewMode, editorMode, selectedChapterId, selectedChapterStartIndex]);


  // 缓存标签深度计算，避免重复计算
  const tagDepthCache = useMemo(() => {
    const cache = new Map<string, number>();
    allNovelTags.forEach(tag => {
      cache.set(tag.id, getAllAncestorTagIds(tag.id, allNovelTags).length);
    });
    return cache;
  }, [allNovelTags]);

  // 🆕 缓存标签层级关系，避免重复计算
  const tagHierarchyCache = useMemo(() => {
    const descendantsMap = new Map<string, Set<string>>();
    allNovelTags.forEach(tag => {
      descendantsMap.set(tag.id, new Set(getAllDescendantTagIds(tag.id, allNovelTags)));
    });
    return descendantsMap;
  }, [allNovelTags]);

  // 🆕 按锚点位置建立索引，避免在每段渲染时重复遍历全部锚点
  const plotAnchorsByPosition = useMemo(() => {
    const map = new Map<number, PlotAnchor[]>();
    (novel.plotAnchors || []).forEach((anchor) => {
      const list = map.get(anchor.position) || [];
      list.push(anchor);
      map.set(anchor.position, list);
    });
    return map;
  }, [novel.plotAnchors]);

  // ✅ 拆分 storyline 渲染逻辑，减少不必要的重新计算
  const storylineContent = useMemo(() => {
    if (editorMode !== 'storyline') return null;
      const text = textForPreview;
      const paragraphs = text.split('\n');
      let charIndex = displayOffsetForPreview;

      const storylineMap = storylineDerivedData.storylineById;

      return (
        <div>
          {paragraphs.map((p, index) => {
            const pStart = charIndex;
            const pEnd = pStart + p.length;
            const positionForNewAnchor = pStart; // Anchor is at the beginning of the paragraph
            charIndex = pEnd + 1; // +1 for newline

            // Find anchors that belong *before* this paragraph
            const anchorsHere = plotAnchorsByPosition.get(positionForNewAnchor) || [];
            
            // FIX: Refactored complex one-liner to be more explicit and type-safe, preventing potential inference errors.
            const anchorColors = anchorsHere
              .flatMap(a => a.storylineIds.map(id => storylineMap.get(id)))
              .filter((sl): sl is Storyline => Boolean(sl))
              .map(sl => sl.color);
            const totalColors = anchorColors.length;

            return (
              <ParagraphWrapper key={index}>
                <AnchorContainer>
                  {anchorsHere.length > 0 && (
                     <AnchorMarker
                       ref={(el) => {
                         if (el) {
                           anchorsHere.forEach(anchor => anchorRefs.current.set(anchor.id, el));
                         } else {
                           anchorsHere.forEach(anchor => anchorRefs.current.delete(anchor.id));
                         }
                       }}
                       colors={anchorColors}
                       onClick={(e) => setPopoverState({ anchor: anchorsHere[0], position: anchorsHere[0].position, target: e.currentTarget as HTMLElement })}
                     >
                       <AnchorTooltip>
                         {anchorsHere.map(a => a.description).join('\n---\n')}
                       </AnchorTooltip>
                       {anchorColors.map((color, i) => (
                         <AnchorLineSegment key={i} style={{ backgroundColor: color, width: `${100 / totalColors}%` }} />
                       ))}
                     </AnchorMarker>
                  )}
                </AnchorContainer>
                <AddAnchorButton
                  className="add-anchor-btn"
                  title="添加剧情锚点"
                  onClick={(e) => setPopoverState({ anchor: null, position: positionForNewAnchor, target: e.currentTarget as HTMLElement })}
                >
                  ⚓
                </AddAnchorButton>
                <span>{p || '\u00A0' /* Render empty lines properly */}</span>
              </ParagraphWrapper>
            );
          })}
        </div>
      );
  }, [displayOffsetForPreview, editorMode, plotAnchorsByPosition, storylineDerivedData.storylineById, textForPreview]);

  const displayedContentOrSnippets = useMemo(() => {
    // Return pre-computed storyline content
    if (storylineContent) return storylineContent;

    if (editorMode !== 'storyline' && viewMode === 'snippet') {
      return (
        <SnippetContent
          novel={novel}
          editorMode={editorMode}
          annotations={annotations}
          allNovelTags={allNovelTags}
          activeFilterTagDetails={activeFilterTagDetails}
          globalFilterTagName={globalFilterTagName}
          includeChildTagsInReadMode={includeChildTagsInReadMode}
          tagDepthCache={tagDepthCache}
          tagHierarchyCache={tagHierarchyCache}
          onSelectChapter={onSelectChapter}
          onLocateToText={handleLocateToText}
          onDeleteAnnotation={onDeleteAnnotation}
          onBatchCreateAnnotations={onBatchCreateAnnotations}
          getTagById={getTagById}
        />
      );
    }

    const currentDisplayText = textForPreview;

    const shouldRenderFindHighlights =
      isFindOpen &&
      Boolean(normalizedFindQuery) &&
      viewMode === 'full' &&
      isReadOrAnnotationLikeMode;

    const FIND_HIGHLIGHT_LIMIT_PER_CHAPTER = 2000;
    const findRanges = (() => {
      if (!shouldRenderFindHighlights) return [];
      if (!normalizedFindQuery) return [];

      const q = normalizedFindQuery;
      const ranges: Array<{ start: number; end: number; absStart: number }> = [];
      let fromIndex = 0;

      while (ranges.length < FIND_HIGHLIGHT_LIMIT_PER_CHAPTER) {
        const foundAt = currentDisplayText.indexOf(q, fromIndex);
        if (foundAt === -1) break;
        ranges.push({
          start: foundAt,
          end: foundAt + q.length,
          absStart: displayOffsetForPreview + foundAt,
        });
        fromIndex = foundAt + Math.max(1, q.length);
      }

      return ranges;
    })();

    // Pointer-based segmentation keeps highlights correct even if matches cross annotation boundaries.
    let findRangePtr = 0;
    const renderWithFindHighlights = (segmentText: string, segmentViewStart: number, keyPrefix: string) => {
      if (!shouldRenderFindHighlights) return segmentText;
      if (!normalizedFindQuery) return segmentText;
      if (!findRanges.length) return segmentText;

      const segmentViewEnd = segmentViewStart + segmentText.length;

      // Skip finished ranges
      while (findRangePtr < findRanges.length && findRanges[findRangePtr].end <= segmentViewStart) {
        findRangePtr += 1;
      }

      const nodes: React.ReactNode[] = [];
      let cursor = segmentViewStart;
      let i = findRangePtr;

      while (i < findRanges.length) {
        const range = findRanges[i];
        if (range.start >= segmentViewEnd) break;

        const overlapStart = Math.max(range.start, segmentViewStart);
        const overlapEnd = Math.min(range.end, segmentViewEnd);

        if (overlapStart > cursor) {
          nodes.push(
            segmentText.substring(cursor - segmentViewStart, overlapStart - segmentViewStart)
          );
        }

        nodes.push(
          <FindMark
            key={`${keyPrefix}:${range.absStart}:${overlapStart}`}
            isActive={activeFindAbsoluteStart === range.absStart}
            title="点击定位到该命中"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              locateFindMatchByAbsoluteStart(range.absStart, selectedChapterId);
            }}
            onMouseUp={(e) => {
              e.stopPropagation();
            }}
          >
            {segmentText.substring(overlapStart - segmentViewStart, overlapEnd - segmentViewStart)}
          </FindMark>
        );

        cursor = overlapEnd;

        // Advance if the full range ended inside this segment; otherwise keep it for the next segment.
        if (range.end <= segmentViewEnd) {
          i += 1;
        } else {
          break;
        }
      }

      findRangePtr = i;

      if (cursor < segmentViewEnd) {
        nodes.push(segmentText.substring(cursor - segmentViewStart));
      }

      return nodes.length ? nodes : segmentText;
    };

    const hasSelectedChapter = Boolean(selectedChapterId);
    if (!currentDisplayText.trim() && (isReadMode || (editorMode === 'edit' && !novel.text && !hasSelectedChapter))) {
      const placeholderMsg = hasSelectedChapter 
        ? "当前章节内容为空。" 
        : (editorMode === 'edit' ? "在此处粘贴或输入您的小说文本。" : "小说内容为空。");
      return <Placeholder>{placeholderMsg}</Placeholder>;
    }
    
    // 限制一次渲染的标注数量，提升性能
    const MAX_ANNOTATIONS_TO_RENDER = 500;
    const relevantAnnotations = annotations
      .filter(ann => {
        const annStartInView = ann.startIndex - displayOffsetForPreview;
        const annEndInView = ann.endIndex - displayOffsetForPreview;
        return annEndInView > 0 && annStartInView < currentDisplayText.length;
      })
      .sort((a, b) => a.startIndex - b.startIndex)
      .slice(0, MAX_ANNOTATIONS_TO_RENDER);

    if (relevantAnnotations.length === 0 && currentDisplayText.trim()) {
         return <span>{renderWithFindHighlights(currentDisplayText, 0, 'plain')}</span>;
    }
    if (!currentDisplayText.trim() && relevantAnnotations.length === 0) { 
        return <Placeholder>{editorMode === 'edit' ? "开始编辑文本..." : "无内容可预览。"}</Placeholder>;
    }

    let lastIndex = 0;
    const parts: React.ReactNode[] = [];
    
    relevantAnnotations.forEach((ann) => {
      const annStartInView = Math.max(0, ann.startIndex - displayOffsetForPreview);
      const annEndInView = Math.min(currentDisplayText.length, ann.endIndex - displayOffsetForPreview);

      if (annStartInView >= currentDisplayText.length || annEndInView <= 0 || annStartInView >= annEndInView) return;

      if (annStartInView > lastIndex) {
        const segmentText = currentDisplayText.substring(lastIndex, annStartInView);
        parts.push(
          <React.Fragment key={`t:${lastIndex}`}>
            {renderWithFindHighlights(segmentText, lastIndex, `t:${lastIndex}`)}
          </React.Fragment>
        );
      }
      
      const renderStart = Math.max(annStartInView, lastIndex);

      if (annEndInView <= renderStart) {
        return;
      }
      
      let primaryTagForHighlight: Tag | null = null;
      const annotationTagsInvolved = ann.tagIds.map(tid => getTagById(tid)).filter((t): t is Tag => !!t);

      if (annotationTagsInvolved.length > 0) {
        const activeFilterTagId = activeFilterTagDetails?.id;

        if (activeFilterTagId) {
            // 使用缓存的层级关系
            const descendants = tagHierarchyCache.get(activeFilterTagId) || new Set();
            const activeHierarchyTagIds = new Set([activeFilterTagId, ...descendants]);

            const contextualTags = annotationTagsInvolved.filter(t => activeHierarchyTagIds.has(t.id));

            if (contextualTags.length > 0) {
                let deepestLevel = -1;
                const deepestContextualTags: Tag[] = [];
                for (const tag of contextualTags) {
                    const depth = tagDepthCache.get(tag.id) ?? 0;
                    if (depth > deepestLevel) {
                        deepestLevel = depth;
                        deepestContextualTags.length = 0;
                        deepestContextualTags.push(tag);
                    } else if (depth === deepestLevel) {
                        deepestContextualTags.push(tag);
                    }
                }
                primaryTagForHighlight = deepestContextualTags.length > 0
                    ? [...deepestContextualTags].sort((a, b) => a.name.localeCompare(b.name))[0]
                    : null;
            }
        }

        if (!primaryTagForHighlight) {
            let deepestLevel = -1;
            const deepestTags: Tag[] = [];
            for (const tag of annotationTagsInvolved) {
              const depth = tagDepthCache.get(tag.id) ?? 0;
              if (depth > deepestLevel) {
                deepestLevel = depth;
                deepestTags.length = 0;
                deepestTags.push(tag);
              } else if (depth === deepestLevel) {
                deepestTags.push(tag);
              }
            }
            primaryTagForHighlight = deepestTags.length > 0 ? [...deepestTags].sort((a,b) => a.name.localeCompare(b.name))[0] : [...annotationTagsInvolved].sort((a,b) => a.name.localeCompare(b.name))[0];
        }
      }
      
      const tagNames = annotationTagsInvolved.map(t => t.name).join(' | ');
      const bgColor = primaryTagForHighlight?.color || COLORS.gray300;
      const color = primaryTagForHighlight ? getContrastingTextColor(primaryTagForHighlight.color) : COLORS.black;

      const title = ann.isPotentiallyMisaligned ? `标签: ${tagNames} (此标注可能已错位)`
        : `标签: ${tagNames}`;

      parts.push(
        <AnnotatedSpan
          key={ann.id}
          style={{ backgroundColor: bgColor, color: color }}
          isMisaligned={ann.isPotentiallyMisaligned}
          title={title}
        >
          {renderWithFindHighlights(
            currentDisplayText.substring(renderStart, annEndInView),
            renderStart,
            `a:${ann.id}`
          )}
        </AnnotatedSpan>
      );
      lastIndex = Math.max(lastIndex, annEndInView);
    });

    if (lastIndex < currentDisplayText.length) {
      const tailText = currentDisplayText.substring(lastIndex);
      parts.push(
        <React.Fragment key={`t:${lastIndex}`}>
          {renderWithFindHighlights(tailText, lastIndex, `t:${lastIndex}`)}
        </React.Fragment>
      );
    }

    return <>{parts}</>;
  }, [
    storylineContent, editorMode, viewMode, isFindOpen,
    textForPreview, annotations, getTagById, displayOffsetForPreview,
    activeFilterTagDetails, globalFilterTagName, includeChildTagsInReadMode,
    allNovelTags, tagDepthCache, tagHierarchyCache, selectedChapterId, novel.text, novel.title, novel.chapters,
    normalizedFindQuery, activeFindAbsoluteStart, locateFindMatchByAbsoluteStart,
    handleLocateToText, onSelectChapter, onDeleteAnnotation, onBatchCreateAnnotations
  ]);


  const panelTitle = useMemo(() => {
    if (editorMode === 'edit') {
        return selectedChapterId ? `画本模式: ${selectedChapterTitle}` : "画本模式: 小说原文";
    }
    if (editorMode === 'annotation') {
        return selectedChapterId ? `标注模式: ${selectedChapterTitle}` : "标注模式: 全文预览与标注";
    }
    if (editorMode === 'plotRange') {
        return selectedChapterId ? `剧情范围模式: ${selectedChapterTitle}` : "剧情范围模式: 全文预览与标注";
    }
    if (editorMode === 'read') {
        if (viewMode === 'snippet') {
          if (globalFilterTagName) return `片段: 全局搜索 "${globalFilterTagName}"`;
          if (!activeFilterTagDetails) return "片段阅读";
          return `片段: ${activeFilterTagDetails.name}${includeChildTagsInReadMode ? ' (含子标签)' : ''}`;
        }
        return selectedChapterId ? `标注阅读模式: ${selectedChapterTitle}` : "标注阅读模式: 小说原文";
    }
    if (editorMode === 'plotRangeRead') {
        if (viewMode === 'snippet') {
          if (globalFilterTagName) return `范围片段: 全局搜索 "${globalFilterTagName}"`;
          if (!activeFilterTagDetails) return "范围片段阅读";
          return `范围片段: ${activeFilterTagDetails.name}${includeChildTagsInReadMode ? ' (含子标签)' : ''}`;
        }
        return selectedChapterId ? `剧情范围阅读模式: ${selectedChapterTitle}` : "剧情范围阅读模式: 小说原文";
    }
    if (editorMode === 'storyline') {
        return selectedChapterId ? `剧情线模式: ${selectedChapterTitle}` : "剧情线模式: 小说原文";
    }
    return "内容";
  }, [viewMode, selectedChapterId, selectedChapterTitle, activeFilterTagDetails, globalFilterTagName, editorMode, includeChildTagsInReadMode]);

  // 计算当前章节字数（仅在画本模式下显示）
  const wordCount = useMemo(() => {
    if (editorMode !== 'edit') return null;

    const textToCount = selectedChapterId ? editedText : novel.text;
    return countWords(textToCount);
  }, [editorMode, selectedChapterId, editedText, novel.text]);

  const isFullNovelEditMode = editorMode === 'edit' && !selectedChapterId;

  const handleSaveAnchor = (description: string, storylineIds: string[]) => {
    if (popoverState) {
      if (popoverState.anchor) {
        // Editing existing anchor
        onUpdatePlotAnchor(popoverState.anchor.id, { description, storylineIds });
      } else {
        // Creating new anchor
        onAddPlotAnchor(description, popoverState.position, storylineIds);
      }
      setPopoverState(null);
    }
  };

  const handleDeleteAnchor = () => {
    if (popoverState?.anchor) {
      if (window.confirm("您确定要删除此剧情锚点吗？")) {
        onDeletePlotAnchor(popoverState.anchor.id);
        setPopoverState(null);
      }
    }
  };

  const handleNextChapter = () => {
    if (nextChapter && onSelectChapter) {
      onSelectChapter(nextChapter.id);
      setShouldScrollToTop(true);
    }
  };

  // 处理标签拖放到选中文本
  const handleDragOver = (e: React.DragEvent) => {
    // 只在阅读模式且有选中文本时允许拖放
    if (!isReadMode || !currentSelection || !onBatchCreateAnnotations) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    // 只在阅读模式且有选中文本时处理拖放
    if (!isReadMode || !currentSelection || !onBatchCreateAnnotations) {
      return;
    }

    const tagId = e.dataTransfer.getData('text/plain');
    if (!tagId) {
      return;
    }

    const tag = getTagById(tagId);
    if (!tag) {
      alert('标签不存在');
      return;
    }

    // ✅ 如果 currentSelection 包含 annotationId，说明是在 snippet 上选择的文本
    // 这种情况下直接更新该标注，不按段落分割
    if (currentSelection.annotationId) {
      console.log('[拖放标注 - Snippet] 更新已有标注:', currentSelection.annotationId);

      // 使用 snippet 的完整范围创建单个 segment
      const textSegment = {
        text: currentSelection.text,
        startIndex: currentSelection.startIndex,
        endIndex: currentSelection.endIndex
      };

      onBatchCreateAnnotations(tagId, [textSegment]);

      alert(`已为标注「${currentSelection.text.substring(0, 20)}...」添加标签「${tag.name}」`);
      window.getSelection()?.removeAllRanges();
      return;
    }

    // ✅ 不在 snippet 内，按段落分割处理
    const selectedText = currentSelection.text;
    const rawParagraphs = selectedText.split('\n');

    // 只保留非空段落用于标注
    const paragraphs = rawParagraphs.filter(p => p.trim().length > 0);

    if (paragraphs.length === 0) {
      alert('请选择有效的文本内容');
      return;
    }

    console.log('[拖放标注] 选中文本:', selectedText);
    console.log('[拖放标注] 段落数量:', paragraphs.length);
    console.log('[拖放标注] 选择范围:', currentSelection.startIndex, '-', currentSelection.endIndex);

    // 计算每个段落在原文中的位置
    const textSegments: Array<{ text: string; startIndex: number; endIndex: number }> = [];

    // 直接使用分割后的段落位置
    let searchOffset = 0;
    for (const paragraph of rawParagraphs) {
      if (paragraph.trim().length > 0) {
        // 计算这个段落在选中文本中的起始位置
        const absoluteStart = currentSelection.startIndex + searchOffset;
        const absoluteEnd = absoluteStart + paragraph.length;

        textSegments.push({
          text: paragraph,
          startIndex: absoluteStart,
          endIndex: absoluteEnd
        });

        console.log('[拖放标注] 段落:', paragraph.substring(0, 20) + '...', '位置:', absoluteStart, '-', absoluteEnd);
      }
      // 移动到下一个段落（包括换行符）
      searchOffset += paragraph.length + 1;
    }

    if (textSegments.length === 0) {
      console.error('[拖放标注] 无法定位任何段落');
      alert('无法定位选中的段落');
      return;
    }

    // 批量创建标注
    onBatchCreateAnnotations(tagId, textSegments);

    // 提示用户
    const tagName = tag.name;
    const count = textSegments.length;
    alert(`已为 ${count} 个段落添加标签「${tagName}」`);

    // 清除选中
    window.getSelection()?.removeAllRanges();
  };


  return (
    <Panel style={style}>
      <Title>
        <span>{panelTitle}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
          {editorMode === 'edit' && selectedChapterId && onSplitChapterAtCursor && (
            <SplitChapterButton
              type="button"
              title="按当前光标位置拆分章节"
              aria-label="拆分章节"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleSplitChapterClick}
            >
              拆分章节
            </SplitChapterButton>
          )}
          {editorMode === 'edit' && wordCount !== null && (
            <WordCount>（字数：{wordCount.toLocaleString()}）</WordCount>
          )}
          {isReadMode &&
            viewMode === 'snippet' &&
            activeFilterTagDetails &&
            !globalFilterTagName &&
            (tagHierarchyCache.get(activeFilterTagDetails.id)?.size ?? 0) > 0 && (
              <ChildTagToggleButton
                type="button"
                isActive={includeChildTagsInReadMode}
                onClick={onToggleIncludeChildTagsInReadMode}
                aria-pressed={includeChildTagsInReadMode}
                title={includeChildTagsInReadMode ? '已包含子标签' : '不包含子标签'}
              >
                含子标签
              </ChildTagToggleButton>
            )}
          {isReadOrAnnotationLikeMode && viewMode === 'full' && (
            <FindOpenButton
              type="button"
              onClick={openFindBar}
              title="查找 (Ctrl+F)"
            >
              查找
            </FindOpenButton>
          )}
        </div>
      </Title>

      {editorMode === 'edit' && (
        <NovelInput
          ref={textareaRef}
          key={selectedChapter ? selectedChapter.id : 'full-novel'}
          value={editedText}
          onChange={(e) => setEditedText(e.target.value)}
          onBlur={handleTextareaBlur}
          onScroll={handleTextareaScroll}
          placeholder={selectedChapter ? "编辑当前章节内容..." : "在此处粘贴或输入您的小说文本..."}
          aria-label={selectedChapter ? `编辑章节: ${selectedChapter.title}` : "小说文本输入"}
        />
      )}

      {isPreviewMode && (
        <ContentPreviewContainer>
          {isReadOrAnnotationLikeMode && viewMode === 'full' && isFindOpen && (
            <FindBarContainer>
              <FindInput
                ref={findInputRef}
                value={findQuery}
                onChange={(e) => setFindQuery(e.target.value)}
                onCompositionStart={() => setIsFindComposing(true)}
                onCompositionEnd={() => setIsFindComposing(false)}
                placeholder="查找（从本章到结尾）"
                aria-label="查找（从本章到结尾）"
                hasError={Boolean(normalizedFindQuery) && !isFinding && findMatches.length === 0}
              />
              <FindStatus>
                {isFinding
                  ? '搜索中…'
                  : (normalizedFindQuery
                    ? (findMatches.length > 0
                      ? `${activeFindIndex >= 0 ? activeFindIndex + 1 : 0}/${findMatches.length}`
                      : '无结果')
                    : '')}
              </FindStatus>
              <FindIconButton
                type="button"
                title="上一个 (ArrowUp / Shift+Enter)"
                aria-label="上一个"
                onMouseDown={(e) => e.preventDefault()}
                onClick={goToPrevFindMatch}
                disabled={isFinding || findMatches.length === 0}
              >
                ↑
              </FindIconButton>
              <FindIconButton
                type="button"
                title="下一个 (ArrowDown / Enter)"
                aria-label="下一个"
                onMouseDown={(e) => e.preventDefault()}
                onClick={goToNextFindMatch}
                disabled={isFinding || findMatches.length === 0}
              >
                ↓
              </FindIconButton>
              <FindIconButton
                type="button"
                title="关闭 (Esc)"
                aria-label="关闭查找"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setIsFindOpen(false)}
              >
                ✕
              </FindIconButton>
            </FindBarContainer>
          )}
          <ContentDisplay
            ref={contentDisplayRef}
            id="content-display-area"
            onMouseUp={isReadOrAnnotationLikeMode ? onTextSelection : undefined}
            onScroll={handleScroll}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            role="article"
            aria-live="polite"
            isFullNovelEditMode={isFullNovelEditMode}
            isDragOver={isDragOver && isReadMode}
          >
            {displayedContentOrSnippets}
          </ContentDisplay>
          {isAnnotationLikeMode && nextChapter && (
            <NextChapterButton
              visible={isNearBottom}
              onClick={handleNextChapter}
              title={`下一章: ${nextChapter.title}`}
              aria-label={`下一章: ${nextChapter.title}`}
            >
              →
            </NextChapterButton>
          )}
        </ContentPreviewContainer>
      )}

      {popoverState && (
        <PlotAnchorPopover
          targetElement={popoverState.target}
          storylines={novel.storylines || []}
          storylineDerivedData={storylineDerivedData}
          existingAnchor={popoverState.anchor}
          collapsedStorylineIds={popoverCollapsedStorylineIds}
          onToggleStorylineCollapsed={handleTogglePopoverStorylineCollapsed}
          onSave={handleSaveAnchor}
          onDelete={handleDeleteAnchor}
          onClose={() => setPopoverState(null)}
        />
      )}
    </Panel>
  );
};

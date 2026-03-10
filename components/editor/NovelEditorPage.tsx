import React, { useState, useRef, useEffect, useMemo } from 'react';
import styled from '@emotion/styled';
import JSZip from 'jszip';
import type { Novel, Tag, Annotation, User, TagTemplate } from "../../types";
import { COLORS, SPACING, FONTS, SHADOWS, BORDERS, panelStyles as basePanelStyles } from '../../styles';

import TagPanel from '../TagPanel';
import { ContentPanel } from '../ContentPanel';
import ChapterListView from '../tagpanel/ChapterListView'; // Import ChapterListView
import TagManagementView from '../tagpanel/TagManagementView';
import { usePanelResizer, MIN_PANEL_PERCENTAGE } from './hooks/usePanelResizer';
import { useNovelEditorState } from './hooks/useNovelEditorState';
import { useNoteWorkspaceState } from './hooks/useNoteWorkspaceState';
import NoteWorkspaceContentPanel from './NoteWorkspaceContentPanel';
import StorylinePanel from '../storyline/StorylinePanel';
import StorylineTrackerPanel from '../storyline/StorylineTrackerPanel';
import RightSidebarPanel from './RightSidebarPanel';
import WritingModeWorkspace from './writing/WritingModeWorkspace';
import { novelsApi, annotationsApi } from '../../api';
import { tagCompatApi as tagsApi } from '../../api/tagCompat';
import { termCompatApi } from '../../api/termCompat';
import { tagPlacementsApi } from '../../api/tagPlacements';
import { LRUCache } from '../../utils/LRUCache';


interface NovelEditorPageProps {
  novel: Novel;
  allUserTags: Tag[];
  allUserAnnotations: Annotation[];
  tagTemplates: TagTemplate[];
  onUpdateTemplates: (templates: TagTemplate[]) => void;
  setNovels: React.Dispatch<React.SetStateAction<Novel[]>>;
  setAllUserTags: React.Dispatch<React.SetStateAction<Tag[]>>;
  setAllUserAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>;
  onNavigateBack: () => void;
  currentUser: User;
  onUpdateTagName: (tagId: string, newName: string) => void;
  onDeleteTag: (tagId: string) => void;
  novelDataCache?: React.MutableRefObject<LRUCache<string, {
    tags: Tag[];
    rangeTags: Tag[];
    terms: Tag[];
    annotations: Annotation[];
    timestamp: number;
  }>>;
  novelContentCache?: React.MutableRefObject<LRUCache<string, {
    novel: Novel;
    timestamp: number;
  }>>;
}

export type EditorMode = 'edit' | 'annotation' | 'plotRange' | 'read' | 'plotRangeRead' | 'storyline' | 'writing';
type WorkspaceMode = 'tag' | 'note';
type StorylineDragState = {
  draggedId: string | null;
  dragOverId: string | null;
  isDraggingOverList: boolean;
};

const EDITOR_LOCATE_STORAGE_KEY = 'novelEditorLocateRequest';
const EDITOR_WORKSPACE_STORAGE_KEY = 'novelEditorWorkspaceMode';

const EditorPageContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background-color: ${COLORS.background};
`;

const EditorHeader = styled.header`
  display: flex;
  align-items: center;
  padding: ${SPACING.sm} ${SPACING.lg};
  background-color: ${COLORS.gray100};
  border-bottom: 1px solid ${COLORS.gray300};
  flex-shrink: 0;
`;

const BaseButton = styled.button`
  padding: ${SPACING.xs} ${SPACING.md};
  font-size: ${FONTS.sizeSmall};
  background-color: ${COLORS.primary};
  color: ${COLORS.white};
  border: none;
  border-radius: ${BORDERS.radius};
  cursor: pointer;
  transition: background-color 0.2s, box-shadow 0.2s;
  
  &:hover {
    background-color: ${COLORS.primaryHover};
    box-shadow: ${SHADOWS.small};
  }
`;

const BackButton = styled(BaseButton)`
  background-color: ${COLORS.secondary};
  margin-right: ${SPACING.md};
  
  &:hover {
    background-color: ${COLORS.secondaryHover};
  }
`;

const EditorTitle = styled.h1`
  margin: 0;
  margin-right: ${SPACING.lg};
  font-size: ${FONTS.sizeH3};
  color: ${COLORS.dark};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ModeToggleContainer = styled.div`
  display: flex;
  align-items: center;
  border: 1px solid ${COLORS.gray400};
  border-radius: ${BORDERS.radius};
  overflow: hidden;
`;

const ModeToggleButton = styled.button<{ isActive: boolean }>`
  padding: ${SPACING.xs} ${SPACING.md};
  font-size: ${FONTS.sizeSmall};
  border: none;
  border-right: 1px solid ${COLORS.gray400};
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s;
  background-color: ${props => props.isActive ? COLORS.primary : COLORS.white};
  color: ${props => props.isActive ? COLORS.white : COLORS.text};

  &:last-of-type {
    border-right: none;
  }

  &:hover {
    background-color: ${props => props.isActive ? COLORS.primaryHover : COLORS.gray200};
  }
`;

const MainContentArea = styled.main`
  display: flex;
  flex-grow: 1;
  overflow: hidden;
  width: 100%;
`;

const ChapterListPanel = styled.div({
    ...basePanelStyles,
    minWidth: '100px',
});

const TermPanel = styled.div({
    ...basePanelStyles,
    minWidth: '220px',
});

const Resizer = styled.div<{ isHovered: boolean }>`
  flex: 0 0 ${SPACING.sm};
  background-color: ${props => props.isHovered ? COLORS.gray400 : COLORS.gray200};
  cursor: col-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  border-left: 1px solid ${COLORS.gray300};
  border-right: 1px solid ${COLORS.gray300};
  box-sizing: border-box;
  transition: background-color 0.2s;
`;

const ResizerIcon = styled.span`
  font-size: 10px;
  line-height: 0.5;
  color: ${COLORS.gray600};
  letter-spacing: -1px;
  user-select: none;
  writing-mode: vertical-rl;
  text-orientation: mixed;
`;

const sanitizeFilenameForDownload = (value: string, fallback = '章节'): string => {
  const trimmed = String(value || '').trim();
  const safe = trimmed
    .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '');
  return (safe || fallback).slice(0, 80);
};

const NovelEditorPage: React.FC<NovelEditorPageProps> = ({
  novel, allUserTags, allUserAnnotations, tagTemplates, onUpdateTemplates, setNovels, setAllUserTags, setAllUserAnnotations,
  onNavigateBack, currentUser, onUpdateTagName, onDeleteTag, novelDataCache, novelContentCache
}) => {
  const mainContentAreaRef = useRef<HTMLDivElement>(null);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(() => {
    try {
      const raw = localStorage.getItem(EDITOR_WORKSPACE_STORAGE_KEY);
      if (!raw) return (novel.projectMode ?? 'tag') as WorkspaceMode;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.novelId !== novel.id) return (novel.projectMode ?? 'tag') as WorkspaceMode;
      const mode = parsed.workspaceMode;
      if (mode === 'tag' || mode === 'note') return mode;
      return (novel.projectMode ?? 'tag') as WorkspaceMode;
    } catch {
      return (novel.projectMode ?? 'tag') as WorkspaceMode;
    }
  });

  const tagEntityLabel = workspaceMode === 'note' ? '词条' : '标签';
  const [tagEditorMode, setTagEditorMode] = useState<EditorMode>('annotation');
  const [noteEditorMode, setNoteEditorMode] = useState<'edit' | 'read'>('edit');
  const [isLoadingNovelData, setIsLoadingNovelData] = useState(false);
  const [loadedAnnotationsForNovelIds, setLoadedAnnotationsForNovelIds] = useState<Set<string>>(new Set());
  const [locateRequest, setLocateRequest] = useState<{ chapterId: string; absoluteIndex: number } | null>(null);
  const [storylineDragState, setStorylineDragState] = useState<StorylineDragState>({
    draggedId: null,
    dragOverId: null,
    isDraggingOverList: false,
  });
  const tagEditorBehaviorMode: EditorMode =
    tagEditorMode === 'plotRange'
      ? 'annotation'
      : (tagEditorMode === 'plotRangeRead' ? 'read' : tagEditorMode);

  const handleStorylineDragStateChange = (state: StorylineDragState) => {
    setStorylineDragState((prev) => {
      if (
        prev.draggedId === state.draggedId &&
        prev.dragOverId === state.dragOverId &&
        prev.isDraggingOverList === state.isDraggingOverList
      ) {
        return prev;
      }
      return state;
    });
  };

  const storylineIdSet = useMemo(
    () => new Set((novel.storylines || []).map((storyline) => storyline.id)),
    [novel.storylines]
  );

  useEffect(() => {
    if (!storylineDragState.draggedId && !storylineDragState.dragOverId) return;
    if (
      (storylineDragState.draggedId && !storylineIdSet.has(storylineDragState.draggedId)) ||
      (storylineDragState.dragOverId && !storylineIdSet.has(storylineDragState.dragOverId))
    ) {
      setStorylineDragState({ draggedId: null, dragOverId: null, isDraggingOverList: false });
    }
  }, [storylineDragState, storylineIdSet]);

  useEffect(() => {
    try {
      localStorage.setItem(EDITOR_WORKSPACE_STORAGE_KEY, JSON.stringify({ novelId: novel.id, workspaceMode }));
    } catch {
      // ignore
    }
  }, [novel.id, workspaceMode]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(EDITOR_LOCATE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.novelId !== novel.id) return;
      if (typeof parsed.chapterId !== 'string') return;
      if (typeof parsed.absoluteIndex !== 'number' || Number.isNaN(parsed.absoluteIndex)) return;

      localStorage.removeItem(EDITOR_LOCATE_STORAGE_KEY);
      setWorkspaceMode('tag');
      setTagEditorMode('read');
      setLocateRequest({ chapterId: parsed.chapterId, absoluteIndex: parsed.absoluteIndex });
    } catch {
      // ignore
    }
  }, [novel.id]);

  // 🆕 进入编辑器时加载小说全文、标签和标注
  useEffect(() => {
    const loadNovelData = async () => {
      try {
        const startTime = performance.now();
        console.log('[NovelEditor] 开始加载小说数据:', novel.id);

        // 🔧 先清理其他小说的数据，只保留全局数据和当前小说数据
        setAllUserTags(prev => prev.filter(t => t.novelId === null || t.novelId === novel.id));
        setAllUserAnnotations(prev => prev.filter(a => a.novelId === novel.id));

        // ✅ 检查 LRU 缓存（5分钟内有效）
        const CACHE_TTL = 5 * 60 * 1000; // 5分钟

        // ? 优先从缓存恢复全文/章节，避免重复读取大文本（退出编辑器时可能已清空 state）
        let effectiveNovel = novel;
        const shouldRestoreContent =
          !novel.text ||
          novel.text.trim() === '' ||
          !novel.chapters ||
          novel.chapters.length === 0;

        if (shouldRestoreContent) {
          const cachedContent = novelContentCache?.current.get(novel.id);
          if (cachedContent && (Date.now() - cachedContent.timestamp < CACHE_TTL)) {
            const cachedNovel = cachedContent.novel;
            const hasText = cachedNovel.text && cachedNovel.text.trim() !== '';
            const hasChapters = cachedNovel.chapters && cachedNovel.chapters.length > 0;
            if (hasText && hasChapters) {
              effectiveNovel = cachedNovel;
              setNovels(prev => prev.map(n => (n.id === novel.id ? cachedNovel : n)));
            }
          } else if (cachedContent) {
            novelContentCache?.current.delete(novel.id);
          }
        }
        // 兼容迁移：旧「笔记模式项目」将 chapters/标签树 迁移为 noteChapters/词条树
        // - 仅在 projectMode='note' 且 noteChapters 为空时迁移章节（chapters -> noteChapters）
        // - 仅在无任何标注且尚未存在 term 词条时，将该项目下所有标签挂载迁移为 term
        const isLegacyNoteProject = (novel.projectMode ?? 'tag') === 'note';
        if (isLegacyNoteProject) {
          const storedNovel = await novelsApi.getById(novel.id);
          effectiveNovel = storedNovel;

          const hasNoteChapters = (storedNovel.noteChapters || []).length > 0;
          const hasLegacyChapters = (storedNovel.chapters || []).length > 0;

          if (!hasNoteChapters && hasLegacyChapters) {
            const migratedNoteChapters = (storedNovel.chapters || []).map(ch => ({
              ...ch,
              htmlContent: ch.htmlContent ?? '',
            }));
            try {
              const updated = await novelsApi.updateFromCache(storedNovel, { noteChapters: migratedNoteChapters });
              effectiveNovel = updated;
              setNovels(prev => prev.map(n => (n.id === novel.id ? updated : n)));
              novelContentCache?.current.set(novel.id, { novel: updated, timestamp: Date.now() });
              console.log('[NovelEditor] 已迁移笔记章节：chapters -> noteChapters');
            } catch (err) {
              console.warn('[NovelEditor] 迁移笔记章节失败，继续加载：', err);
            }
          }

          try {
            const existingTerms = await tagPlacementsApi.getAll({ novelId: novel.id, placementType: 'term' });
            if (existingTerms.length === 0) {
              const legacyTagPlacements = await tagPlacementsApi.getAll({ novelId: novel.id, placementType: 'tag' });
              if (legacyTagPlacements.length > 0) {
                const existingAnnotations = await annotationsApi.getAll({ novelId: novel.id });
                if (existingAnnotations.length === 0) {
                  await Promise.all(legacyTagPlacements.map(p => tagPlacementsApi.update(p.id, { placementType: 'term' })));
                  novelDataCache?.current.delete(novel.id);
                  console.log('[NovelEditor] 已迁移词条树：tag placements -> term placements');
                } else {
                  console.log('[NovelEditor] 检测到该项目已有标注，跳过词条树迁移以避免破坏标注。');
                }
              }
            }
          } catch (err) {
            console.warn('[NovelEditor] 迁移词条树失败，继续加载：', err);
          }
        }

        const cached = novelDataCache?.current.get(novel.id);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
          // ⚡ 即使缓存命中，也要检查 novel.text 和 chapters 是否为空
          // 如果为空（可能被 index.tsx 清空过），需要继续加载全文
          const hasChapters = effectiveNovel.chapters && Array.isArray(effectiveNovel.chapters) && effectiveNovel.chapters.length > 0;
          const hasText = effectiveNovel.text && effectiveNovel.text.trim() !== '';

          if (!hasChapters || !hasText) {
            console.log('[NovelEditor] ⚠️ 缓存命中，但章节/正文为空，继续加载全文...');
            // 不 return，继续执行后续加载流程
          } else {
            console.log('[NovelEditor] ✅ 使用 LRU 缓存数据，跳过加载');
            // 从缓存恢复数据（只需要补充，因为上面已经过滤过了）
            setAllUserTags(prev => {
              const globalTags = prev.filter(t => t.novelId === null);
              const currentNovelTags = prev.filter(t => t.novelId === novel.id && (t.placementType ?? 'tag') === 'tag');
              const currentNovelRangeTags = prev.filter(t => t.novelId === novel.id && (t.placementType ?? 'tag') === 'rangeTag');
              const currentNovelTerms = prev.filter(t => t.novelId === novel.id && (t.placementType ?? 'tag') === 'term');

              const tagsToRestore: Tag[] = [];
              if (currentNovelTags.length === 0) tagsToRestore.push(...cached.tags);
              if (currentNovelRangeTags.length === 0) tagsToRestore.push(...(cached.rangeTags || []));
              if (currentNovelTerms.length === 0) tagsToRestore.push(...(cached.terms || []));

              if (tagsToRestore.length === 0) return prev;
              return [...globalTags, ...tagsToRestore];
            });
            setAllUserAnnotations(prev => {
              // 如果当前小说标注为空，才从缓存恢复
              if (prev.length === 0) {
                return cached.annotations;
              }
              return prev;
            });
            return;
          }
        } else if (cached) {
          // TTL 过期，删除旧缓存
          console.log('[NovelEditor] ⏰ 缓存已过期，删除旧条目');
          novelDataCache?.current.delete(novel.id);
        }

        // ✅ 检查本地状态缓存（同一会话内）
        const currentNovelTags = allUserTags.filter(t => t.novelId === novel.id && (t.placementType ?? 'tag') === 'tag');
        const currentNovelRangeTags = allUserTags.filter(t => t.novelId === novel.id && (t.placementType ?? 'tag') === 'rangeTag');
        if (loadedAnnotationsForNovelIds.has(novel.id) && (currentNovelTags.length > 0 || currentNovelRangeTags.length > 0)) {
          console.log('[NovelEditor] ✅ 该小说数据已在本地缓存，跳过加载');
          return;
        }

        setIsLoadingNovelData(true);

        // 1. 如果小说全文为空，加载全文
        const shouldLoadFullNovel =
          !effectiveNovel.chapters ||
          effectiveNovel.chapters.length === 0 ||
          (((novel.projectMode ?? 'tag') !== 'note') && (!effectiveNovel.text || effectiveNovel.text.trim() === ''));

        if (shouldLoadFullNovel) {
          console.log('[NovelEditor] 加载小说全文...');
          const t1 = performance.now();
          const fullNovel = await novelsApi.getById(novel.id);
          console.log('[NovelEditor] 小说全文加载完成，耗时:', (performance.now() - t1).toFixed(2), 'ms');
          setNovels(prev => prev.map(n => n.id === novel.id ? fullNovel : n));
          novelContentCache?.current.set(novel.id, { novel: fullNovel, timestamp: Date.now() });
          effectiveNovel = fullNovel;
        }

        // 2. ⚡ 并行加载该小说的标签 + 全局标签（避免拉取所有标签）
        console.log('[NovelEditor] 加载标签...');
        const t2 = performance.now();
        let [novelTags, novelRangeTags, globalTags, novelTerms] = await Promise.all([
          tagsApi.getAll({ novelId: novel.id, placementType: 'tag' }), // 该小说的细粒度标签
          tagsApi.getAll({ novelId: novel.id, placementType: 'rangeTag' }), // 该小说的剧情范围标签
          tagsApi.getAll({ novelId: 'global', placementType: 'tag' }), // 只加载全局标签
          termCompatApi.getAll({ novelId: novel.id }), // 该小说的词条
        ]);
        const t2_1 = performance.now();
        console.log('[NovelEditor] API 调用完成，耗时:', (t2_1 - t2).toFixed(2), 'ms');
        console.log(
          '[NovelEditor] 返回的标签数量 - 细粒度:',
          novelTags.length,
          '剧情范围:',
          novelRangeTags.length,
          '全局:',
          globalTags.length,
          '词条:',
          novelTerms.length
        );

        // 🆕 确保当前小说的细粒度/剧情范围标签树都包含「待标注」标签
        const PENDING_TAG_NAME = '待标注';
        const PENDING_TAG_COLOR = '#cccccc';
        const ensurePendingTag = async (
          sourceTags: Tag[],
          placementType: 'tag' | 'rangeTag',
          label: string
        ): Promise<Tag[]> => {
          const finalTags = [...sourceTags];
          const hasPendingTag = sourceTags.some(t => t.name === PENDING_TAG_NAME);
          if (hasPendingTag) return finalTags;

          console.log(`[NovelEditor] 为小说创建「待标注」标签（${label}）...`);
          try {
            const newPendingTag = await tagsApi.create({
              name: PENDING_TAG_NAME,
              color: PENDING_TAG_COLOR,
              parentId: null,
              novelId: novel.id,
              placementType,
            });
            finalTags.push(newPendingTag);
            console.log(`[NovelEditor] 「待标注」标签创建成功（${label}）`);
          } catch (error) {
            console.error(`创建待标注标签失败（${label}）:`, error);
          }
          return finalTags;
        };

        const finalNovelTags = await ensurePendingTag(novelTags, 'tag', '细粒度');
        const finalNovelRangeTags = await ensurePendingTag(novelRangeTags, 'rangeTag', '剧情范围');

        // 🔧 只保留当前小说的标签和全局标签，删除其他小说的标签
        const t2_3 = performance.now();
        const allTagsMap = new Map<string, Tag>();
        [...globalTags, ...finalNovelTags, ...finalNovelRangeTags, ...novelTerms].forEach(tag => {
          allTagsMap.set(tag.id, tag);
        });
        console.log('[NovelEditor] 构建标签Map完成，耗时:', (performance.now() - t2_3).toFixed(2), 'ms', '总数:', allTagsMap.size);
        console.log('[NovelEditor] 标签加载完成，总耗时:', (performance.now() - t2).toFixed(2), 'ms');

        // 3. 从后端加载当前小说的标注
        console.log('[NovelEditor] 加载标注...');
        const t3 = performance.now();
        const annotationsData = await annotationsApi.getAll({ novelId: novel.id });
        console.log('[NovelEditor] 标注加载完成，耗时:', (performance.now() - t3).toFixed(2), 'ms', '数量:', annotationsData.length);

        // 后端已经返回了正确的格式,包含 tagIds 字段
        const formattedAnnotations = annotationsData.map((ann: any) => ({
          id: ann.id,
          tagIds: ann.tagIds || [], // 后端已经有 tagIds 字段
          text: ann.text,
          startIndex: ann.startIndex,
          endIndex: ann.endIndex,
          novelId: ann.novelId,
          userId: ann.userId,
          annotationLayer: ann.annotationLayer ?? 'fine',
          isPotentiallyMisaligned: ann.isPotentiallyMisaligned,
        }));

        // 批量更新状态
        const t4 = performance.now();
        console.log('[NovelEditor] 开始更新状态...');
        setAllUserTags(Array.from(allTagsMap.values()));
        console.log('[NovelEditor] setAllUserTags 完成，耗时:', (performance.now() - t4).toFixed(2), 'ms');

        const t5 = performance.now();
        setAllUserAnnotations(formattedAnnotations);
        console.log('[NovelEditor] setAllUserAnnotations 完成，耗时:', (performance.now() - t5).toFixed(2), 'ms');

        setLoadedAnnotationsForNovelIds(prev => new Set([...prev, novel.id]));

        // 🆕 保存到 LRU 缓存（自动淘汰最旧的条目）
        if (novelDataCache) {
          novelDataCache.current.set(novel.id, {
            tags: Array.from(allTagsMap.values()).filter(t => t.novelId === novel.id && (t.placementType ?? 'tag') === 'tag'),
            rangeTags: Array.from(allTagsMap.values()).filter(t => t.novelId === novel.id && (t.placementType ?? 'tag') === 'rangeTag'),
            terms: Array.from(allTagsMap.values()).filter(t => t.novelId === novel.id && (t.placementType ?? 'tag') === 'term'),
            annotations: formattedAnnotations,
            timestamp: Date.now(),
          });
          console.log('[NovelEditor] 数据已保存到 LRU 缓存，当前缓存大小:', novelDataCache.current.size);
        }

        const endTime = performance.now();
        console.log('[NovelEditor] ✅ 全部加载完成，总耗时:', (endTime - startTime).toFixed(2), 'ms');

        // 数据更新完成后才关闭 loading，避免中间状态渲染
        const t6 = performance.now();
        setIsLoadingNovelData(false);
        console.log('[NovelEditor] setIsLoadingNovelData(false) 完成，耗时:', (performance.now() - t6).toFixed(2), 'ms');
      } catch (error) {
        console.error('❌ 加载小说数据错误:', error);
        alert(`加载小说数据失败：${error instanceof Error ? error.message : '未知错误'}`);
        setIsLoadingNovelData(false);
      }
    };

    loadNovelData();
  }, [novel.id]); // ✅ 只依赖 novel.id，避免无限循环

  // ✅ 移除组件卸载时的数据清理逻辑，保留缓存以加快重新打开速度
  
  const editorState = useNovelEditorState({
    novel,
    allUserTags,
    allUserAnnotations,
    setNovels,
    setAllUserTags,
    setAllUserAnnotations,
    currentUser,
    editorMode: tagEditorMode,
  });

  const noteState = useNoteWorkspaceState({
    novel,
    allUserTags,
    setNovels,
    setAllUserTags,
    currentUser,
  });

  const tagWorkspaceResizer = usePanelResizer({
    initialWidths: [15, 20, 40, 25],
    minPercentage: MIN_PANEL_PERCENTAGE,
    mainContentAreaRef,
  });

  const noteWorkspaceResizer = usePanelResizer({
    initialWidths: [18, 22, 60],
    minPercentage: MIN_PANEL_PERCENTAGE,
    mainContentAreaRef,
  });

  const panelWidths = workspaceMode === 'note' ? noteWorkspaceResizer.panelWidths : tagWorkspaceResizer.panelWidths;
  const handleMouseDownOnResizer =
    workspaceMode === 'note' ? noteWorkspaceResizer.handleMouseDownOnResizer : tagWorkspaceResizer.handleMouseDownOnResizer;
  const hoveredResizer = workspaceMode === 'note' ? noteWorkspaceResizer.hoveredResizer : tagWorkspaceResizer.hoveredResizer;
  const setHoveredResizer = workspaceMode === 'note' ? noteWorkspaceResizer.setHoveredResizer : tagWorkspaceResizer.setHoveredResizer;

  const handleExportChapterRange = async (startChapter: number, endChapter: number): Promise<void> => {
    const sortedChapters = [...(novel.chapters || [])].sort((a, b) => a.originalStartIndex - b.originalStartIndex);
    const total = sortedChapters.length;
    if (total === 0) {
      alert('暂无章节可导出。');
      return;
    }

    const isInvalidRange =
      startChapter < 1 ||
      endChapter < 1 ||
      startChapter > endChapter ||
      startChapter > total ||
      endChapter > total;
    if (isInvalidRange) {
      alert(`章节范围无效，请输入 1-${total} 的有效区间。`);
      return;
    }

    const selectedChapters = sortedChapters.slice(startChapter - 1, endChapter);
    if (selectedChapters.length === 0) {
      alert('该范围内没有可导出的章节。');
      return;
    }

    const api = (window as any)?.electronAPI;
    if (api?.tools?.exportChapterRangeTxt) {
      try {
        const result = await api.tools.exportChapterRangeTxt({
          novelTitle: novel.title,
          startChapter,
          endChapter,
          chapters: sortedChapters.map(chapter => ({
            title: chapter.title,
            content: chapter.content || '',
            originalStartIndex: chapter.originalStartIndex,
          })),
        });

        if (result?.cancelled) return;

        const exportedCount =
          typeof result?.exportedCount === 'number' ? result.exportedCount : selectedChapters.length;
        const dirInfo = typeof result?.outputDir === 'string' ? `\n目录：${result.outputDir}` : '';
        alert(`导出完成：${exportedCount} 个章节。${dirInfo}`);
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("No handler registered for 'tools:exportChapterRangeTxt'")) {
          alert('检测到桌面端导出接口未就绪，已自动改用 ZIP 下载。');
        } else {
          throw error;
        }
      }
    }

    const zip = new JSZip();
    const usedFileBaseNames = new Map<string, number>();
    selectedChapters.forEach((chapter, offset) => {
      const chapterNumber = startChapter + offset;
      const title = chapter.title || `第${chapterNumber}章`;
      const safeTitle = sanitizeFilenameForDownload(title, `第${chapterNumber}章`);
      const usedCount = usedFileBaseNames.get(safeTitle) || 0;
      usedFileBaseNames.set(safeTitle, usedCount + 1);
      const uniqueBaseName = usedCount === 0 ? safeTitle : `${safeTitle}(${usedCount + 1})`;
      const fileName = `${uniqueBaseName}.txt`;
      const body = String(chapter.content || '').replace(/\r\n?/g, '\n').trimEnd();
      const text = body ? `${title}\n\n${body}\n` : `${title}\n`;
      zip.file(fileName, text);
    });

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const novelSafeName = sanitizeFilenameForDownload(novel.title || '小说', '小说');
    const rangeName = `${startChapter}-${endChapter}`;
    const zipName = `${novelSafeName}_${rangeName}.zip`;

    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = zipName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    alert(`已下载 ZIP：${zipName}（包含 ${selectedChapters.length} 个章节）`);
  };

  const contentPanelViewMode =
    (tagEditorMode === 'read' || tagEditorMode === 'plotRangeRead') &&
    (editorState.activeTagId || editorState.globalFilterTagName)
      ? 'snippet'
      : 'full';

  // 加载中状态
  if (isLoadingNovelData) {
    return (
      <EditorPageContainer>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          fontSize: '1.2em',
          color: COLORS.textLight
        }}>
          正在加载小说数据...
        </div>
      </EditorPageContainer>
    );
  }

  return (
    <EditorPageContainer>
      <EditorHeader>
        <BackButton
          onClick={onNavigateBack}
          aria-label="返回项目列表"
        >
          返回列表
        </BackButton>
        <EditorTitle title={novel.title}>编辑: {novel.title}</EditorTitle>
        <ModeToggleContainer role="radiogroup" aria-label="工作区选择" style={{ marginRight: SPACING.md }}>
          <ModeToggleButton
            isActive={workspaceMode === 'tag'}
            onClick={() => setWorkspaceMode('tag')}
            role="radio"
            aria-checked={workspaceMode === 'tag'}
            title="标签工作区：用于小说正文、标签树与标注。"
          >
            标签
          </ModeToggleButton>
          <ModeToggleButton
            isActive={workspaceMode === 'note'}
            onClick={() => setWorkspaceMode('note')}
            role="radio"
            aria-checked={workspaceMode === 'note'}
            title="笔记工作区：用于笔记章节（富文本）与词条树。"
          >
            笔记
          </ModeToggleButton>
        </ModeToggleContainer>

        <ModeToggleContainer role="radiogroup" aria-label="编辑模式选择">
          {workspaceMode === 'tag' ? (
            <>
              <ModeToggleButton
                isActive={tagEditorMode === 'edit'}
                onClick={() => setTagEditorMode('edit')}
                role="radio"
                aria-checked={tagEditorMode === 'edit'}
                title="画本模式：用于编辑小说原文或章节内容。"
              >
                画本模式
              </ModeToggleButton>
              <ModeToggleButton
                isActive={tagEditorMode === 'annotation'}
                onClick={() => setTagEditorMode('annotation')}
                role="radio"
                aria-checked={tagEditorMode === 'annotation'}
                title={`标注模式：用于预览文本、划词选择并应用${tagEntityLabel}进行标注。`}
              >
                标注模式
              </ModeToggleButton>
              <ModeToggleButton
                isActive={tagEditorMode === 'read'}
                onClick={() => setTagEditorMode('read')}
                role="radio"
                aria-checked={tagEditorMode === 'read'}
                title="标注阅读模式：用于查阅细粒度标注片段。"
              >
                标注阅读
              </ModeToggleButton>
              <ModeToggleButton
                isActive={tagEditorMode === 'plotRange'}
                onClick={() => setTagEditorMode('plotRange')}
                role="radio"
                aria-checked={tagEditorMode === 'plotRange'}
                title={`剧情范围模式：用于按较大剧情范围进行${tagEntityLabel}标注。`}
              >
                剧情范围模式
              </ModeToggleButton>
              <ModeToggleButton
                isActive={tagEditorMode === 'plotRangeRead'}
                onClick={() => setTagEditorMode('plotRangeRead')}
                role="radio"
                aria-checked={tagEditorMode === 'plotRangeRead'}
                title="剧情范围阅读模式：用于查阅剧情范围标注片段。"
              >
                范围阅读
              </ModeToggleButton>
              <ModeToggleButton
                isActive={tagEditorMode === 'storyline'}
                onClick={() => setTagEditorMode('storyline')}
                role="radio"
                aria-checked={tagEditorMode === 'storyline'}
                title="剧情线模式：梳理剧情脉络，追踪故事线发展。"
              >
                剧情线模式
              </ModeToggleButton>
              <ModeToggleButton
                isActive={tagEditorMode === 'writing'}
                onClick={() => setTagEditorMode('writing')}
                role="radio"
                aria-checked={tagEditorMode === 'writing'}
                title="写作模式：管理对标小说、策划全局与章节并推进正文写作。"
              >
                写作模式
              </ModeToggleButton>
            </>
          ) : (
            <>
              <ModeToggleButton
                isActive={noteEditorMode === 'edit'}
                onClick={() => setNoteEditorMode('edit')}
                role="radio"
                aria-checked={noteEditorMode === 'edit'}
                title="画本模式：用于编辑笔记章节（富文本）。"
              >
                画本模式
              </ModeToggleButton>
              <ModeToggleButton
                isActive={noteEditorMode === 'read'}
                onClick={() => setNoteEditorMode('read')}
                role="radio"
                aria-checked={noteEditorMode === 'read'}
                title="阅读模式：用于阅读笔记章节内容。"
              >
                阅读模式
              </ModeToggleButton>
            </>
          )}
        </ModeToggleContainer>
      </EditorHeader>
      <MainContentArea ref={mainContentAreaRef}>
        {workspaceMode === 'note' ? (
          <>
            <ChapterListPanel style={{ flexBasis: `${panelWidths[0]}%` }}>
              <ChapterListView
                chapters={novel.noteChapters || []}
                selectedChapterId={noteState.selectedChapterId}
                onSelectChapter={noteState.handleSelectChapter}
                onCreateChapter={noteState.handleCreateChapter}
                onDeleteChapter={noteState.handleDeleteChapter}
                onRenameChapter={noteState.handleRenameChapter}
                onUpdateChapterLevel={noteState.handleUpdateChapterLevel}
              />
            </ChapterListPanel>
            <Resizer
              isHovered={hoveredResizer === 0}
              onMouseDown={(e) => handleMouseDownOnResizer(e, 0)}
              onMouseEnter={() => setHoveredResizer(0)}
              onMouseLeave={() => setHoveredResizer(null)}
              role="separator"
              aria-label="调整章节和词条面板宽度"
            >
              <ResizerIcon>|||</ResizerIcon>
            </Resizer>

            <TermPanel style={{ flexBasis: `${panelWidths[1]}%` }}>
              <TagManagementView
                tags={noteState.currentUserTerms}
                onAddTag={noteState.handleAddTerm}
                activeTagId={noteState.activeTermId}
                onUpdateTagParent={noteState.handleUpdateTermParent}
                onUpdateTagColor={noteState.handleUpdateTermColor}
                onUpdateTagName={noteState.handleUpdateTermName}
                onDeleteTag={noteState.handleDeleteTerm}
                editorMode={'annotation' as EditorMode}
                onApplyTagToSelection={(termId) => noteState.handleSelectTerm(termId)}
                onSelectTagForReadMode={(termId) => noteState.handleSelectTerm(termId)}
                currentSelection={null}
                onCreatePendingAnnotation={() => {}}
                onDeleteAnnotationsInSelection={() => {}}
                entityLabel="词条"
                showSelectionActions={false}
              />
            </TermPanel>

            <Resizer
              isHovered={hoveredResizer === 1}
              onMouseDown={(e) => handleMouseDownOnResizer(e, 1)}
              onMouseEnter={() => setHoveredResizer(1)}
              onMouseLeave={() => setHoveredResizer(null)}
              role="separator"
              aria-label="调整词条面板和内容面板宽度"
            >
              <ResizerIcon>|||</ResizerIcon>
            </Resizer>

            <NoteWorkspaceContentPanel
              style={{ flexBasis: `${panelWidths[2]}%` }}
              editorMode={noteEditorMode}
              selectedChapter={noteState.selectedChapter}
              onSaveChapterHtml={noteState.handleSaveChapterHtml}
            />
          </>
        ) : tagEditorMode === 'writing' ? (
          <WritingModeWorkspace
            novel={novel}
            setNovels={setNovels}
          />
        ) : (
          <>
            <ChapterListPanel style={{ flexBasis: `${panelWidths[0]}%` }}>
                <ChapterListView
                    chapters={novel.chapters || []}
                    selectedChapterId={editorState.selectedChapterId}
                    onSelectChapter={editorState.handleSelectChapter}
                    onCreateChapter={editorState.handleCreateChapter}
                    onExportChapterRange={handleExportChapterRange}
                    onMergeChapterWithPrevious={editorState.handleMergeChapterWithPrevious}
                    onMergeChapterRange={editorState.handleMergeChapterRange}
                    onDeleteChapter={editorState.handleDeleteChapter}
                    onRenameChapter={editorState.handleRenameChapter}
                    onUpdateChapterLevel={editorState.handleUpdateChapterLevel}
                />
            </ChapterListPanel>
        <Resizer
          isHovered={hoveredResizer === 0}
          onMouseDown={(e) => handleMouseDownOnResizer(e, 0)}
          onMouseEnter={() => setHoveredResizer(0)}
          onMouseLeave={() => setHoveredResizer(null)}
          role="separator"
          aria-label={`调整章节和${tagEntityLabel}面板宽度`}
        >
          <ResizerIcon>•••</ResizerIcon>
        </Resizer>
        
        {tagEditorMode === 'storyline' ? (
          <StorylinePanel
            style={{ flexBasis: `${panelWidths[1]}%` }}
            storylines={novel.storylines || []}
            plotAnchors={novel.plotAnchors || []}
            activeStorylineId={editorState.activeStorylineId}
            onAddStoryline={editorState.handleAddStoryline}
            onBatchAddStorylines={editorState.handleBatchAddStorylines}
            onBatchDeleteStorylines={editorState.handleBatchDeleteStorylines}
            onUpdateStoryline={editorState.handleUpdateStoryline}
            onReorderStoryline={editorState.handleReorderStoryline}
            onDeleteStoryline={editorState.handleDeleteStoryline}
            onSelectStoryline={editorState.handleSelectStoryline}
            onDragStateChange={handleStorylineDragStateChange}
          />
        ) : (
          <TagPanel
            style={{ flexBasis: `${panelWidths[1]}%` }}
            tags={editorState.currentUserTags}
            onAddTag={editorState.handleAddTag}
            activeTagId={editorState.activeTagId}
            onApplyTagToSelection={editorState.applyTagToSelection}
            onSelectTagForReadMode={editorState.selectTagForReadMode}
            onUpdateTagParent={editorState.handleUpdateTagParent}
            onUpdateTagColor={editorState.handleUpdateTagColor}
            onUpdateTagName={onUpdateTagName}
            onDeleteTag={onDeleteTag}
            novelId={novel.id}
            chapters={novel.chapters || []}
            selectedChapterId={editorState.selectedChapterId}
            onSelectChapter={editorState.handleSelectChapter}
            editorMode={tagEditorBehaviorMode}
            onTagGlobalSearch={editorState.handleTagGlobalSearch}
            currentSelection={editorState.currentSelection}
            onCreatePendingAnnotation={editorState.handleCreatePendingAnnotation}
            onDeleteAnnotationsInSelection={editorState.handleDeleteAnnotationsInSelection}
            entityLabel={tagEntityLabel}
            tagTemplates={tagTemplates}
            onUpdateTemplates={onUpdateTemplates}
            onImportTagTemplate={editorState.handleImportTagTemplate}
            defaultTemplateName={`${novel.title} 标签树`}
          />
        )}
        
        <Resizer
          isHovered={hoveredResizer === 1}
          onMouseDown={(e) => handleMouseDownOnResizer(e, 1)}
          onMouseEnter={() => setHoveredResizer(1)}
          onMouseLeave={() => setHoveredResizer(null)}
          role="separator"
          aria-label={`调整${tagEntityLabel}面板和内容面板宽度`}
        >
          <ResizerIcon>•••</ResizerIcon>
        </Resizer>
        <ContentPanel
          style={{ flexBasis: `${panelWidths[2]}%` }}
          novel={novel}
          onNovelTextChange={editorState.handleNovelTextChange}
          onChapterTextChange={editorState.handleChapterTextChange}
          onSplitChapterAtCursor={editorState.handleSplitChapterAtCursor}
          onTextSelection={editorState.handleTextSelection}
          annotations={editorState.annotationsForCurrentNovel}
          getTagById={editorState.getTagById}
          selectedChapter={editorState.currentChapterDetails}
          viewMode={contentPanelViewMode}
          activeFilterTagDetails={editorState.activeTagDetails}
          globalFilterTagName={editorState.globalFilterTagName}
          allNovelTags={editorState.currentUserTags}
          editorMode={tagEditorMode}
          onDeleteAnnotation={editorState.handleDeleteAnnotation}
          currentSelection={editorState.currentSelection}
          // Drag and drop tagging
          onBatchCreateAnnotations={editorState.handleBatchCreateAnnotations}
          // Storyline props
          onAddPlotAnchor={editorState.handleAddPlotAnchor}
          onDeletePlotAnchor={editorState.handleDeletePlotAnchor}
          onUpdatePlotAnchor={editorState.handleUpdatePlotAnchor}
          scrollToAnchorId={editorState.scrollToAnchorId}
          onScrollToAnchorComplete={() => editorState.setScrollToAnchorId(null)}
          // Chapter navigation
          onSelectChapter={editorState.handleSelectChapter}
          locateRequest={locateRequest}
          onLocateRequestHandled={() => setLocateRequest(null)}
          includeChildTagsInReadMode={editorState.includeChildTagsInReadMode}
          onToggleIncludeChildTagsInReadMode={editorState.toggleIncludeChildTagsInReadMode}
          storylineDragState={storylineDragState}
        />
        <Resizer
          isHovered={hoveredResizer === 2}
          onMouseDown={(e) => handleMouseDownOnResizer(e, 2)}
          onMouseEnter={() => setHoveredResizer(2)}
          onMouseLeave={() => setHoveredResizer(null)}
          role="separator"
          aria-label="调整内容面板和筛选结果面板宽度"
        >
          <ResizerIcon>•••</ResizerIcon>
        </Resizer>

        {tagEditorMode === 'storyline' ? (
           <StorylineTrackerPanel
             style={{ flexBasis: `${panelWidths[3]}%` }}
             plotAnchors={novel.plotAnchors || []}
             storylines={novel.storylines || []}
             activeStorylineId={editorState.activeStorylineId}
             onSelectAnchor={editorState.handleSelectPlotAnchor}
             onUpdateAnchor={editorState.handleUpdatePlotAnchor}
             onDeleteAnchor={editorState.handleDeletePlotAnchor}
           />
        ) : (
          <RightSidebarPanel
            style={{ flexBasis: `${panelWidths[3]}%` }}
            annotations={editorState.annotationsToDisplayOrFilter} 
            getTagById={editorState.getTagById}
            activeFilterTag={editorState.activeTagDetails} 
            novelText={novel.text}
            globalFilterTagName={editorState.globalFilterTagName} 
            includeDescendantTags={(tagEditorMode === 'read' || tagEditorMode === 'plotRangeRead') ? editorState.includeChildTagsInReadMode : true}
            onTagClick={editorState.selectTagForReadMode} 
            onTagDoubleClick={editorState.handleTagGlobalSearch} 
            allUserTags={editorState.currentUserTags}
            onDeleteAnnotation={editorState.handleDeleteAnnotation}
          />
        )}
          </>
        )}
      </MainContentArea>
    </EditorPageContainer>
  );
};

export default NovelEditorPage;

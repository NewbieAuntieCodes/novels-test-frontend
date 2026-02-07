import React, { useState, useMemo, useEffect, useRef } from 'react';
import styled from '@emotion/styled';
import type { Novel, Tag, Annotation, User, Chapter } from "../types";
import { COLORS, SPACING, FONTS, SHADOWS, BORDERS, panelStyles, globalPlaceholderTextStyles } from '../../styles';
import { getAllDescendantTagIds, getContrastingTextColor, getLeafTagIds, PENDING_ANNOTATION_TAG_NAME } from "../../utils";
import TagList from '../tagpanel/TagList';
import { annotationsApi, tagsApi } from '../../api';
import { usePanelResizer, MIN_PANEL_PERCENTAGE } from '../editor/hooks/usePanelResizer';

interface GlobalTagSearchPageProps {
  allUserTags: Tag[];
  allUserAnnotations: Annotation[];
  novels: Novel[];
  currentUser: User;
  navigateTo: (path: string) => void;
  onDeleteAnnotationGlobally: (annotationId: string) => void;
  setAllUserAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>;
}

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
`;

const PageTitle = styled.h1`
  font-size: ${FONTS.sizeH2};
  color: ${COLORS.dark};
  margin: 0;
`;

const BaseButton = styled.button`
  padding: ${SPACING.sm} ${SPACING.lg};
  background-color: ${COLORS.primary};
  color: ${COLORS.white};
  border: none;
  border-radius: ${BORDERS.radius};
  cursor: pointer;
  transition: background-color 0.2s, box-shadow 0.2s;
  font-size: ${FONTS.sizeSmall};

  &:hover {
    background-color: ${COLORS.primaryHover};
    box-shadow: ${SHADOWS.small};
  }
`;

const BackButton = styled(BaseButton)`
  background-color: ${COLORS.secondary};
  padding: ${SPACING.sm} ${SPACING.md};

  &:hover {
    background-color: ${COLORS.secondaryHover};
  }
`;

const MainContent = styled.main`
  display: flex;
  flex-grow: 1;
  overflow: hidden;
  padding: ${SPACING.lg};
  width: 100%;
  min-height: 0;
`;

const Panel = styled.div(panelStyles);

const LeftPanel = styled(Panel)`
  min-width: 250px;
`;

const RightPanel = styled(Panel)`
  min-width: 300px;
`;

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

const SearchInput = styled.input`
  padding: ${SPACING.sm};
  border: ${BORDERS.width} ${BORDERS.style} ${BORDERS.color};
  border-radius: ${BORDERS.radius};
  box-sizing: border-box;
  background-color: ${COLORS.white};
  font-size: ${FONTS.sizeSmall};
  width: 100%;
  margin-bottom: ${SPACING.lg};
  
  &:focus {
    border-color: ${COLORS.primary};
    box-shadow: 0 0 0 0.2rem ${COLORS.primary}40;
    outline: none;
  }
`;

const TagListContainer = styled.div`
  flex-grow: 1;
  overflow-y: auto;
  border: 1px solid ${COLORS.borderLight};
  border-radius: ${BORDERS.radius};
  padding: ${SPACING.sm};
`;

const ResultsTitle = styled.h2`
  font-size: ${FONTS.sizeH3};
  color: ${COLORS.dark};
  margin-bottom: ${SPACING.md};
`;

const ResultsScrollArea = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.md};
  flex-grow: 1;
  min-height: 0;
`;

const NovelGroup = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.sm};
`;

const NovelGroupHeader = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: ${SPACING.sm} ${SPACING.md};
  border-radius: ${BORDERS.radius};
  background-color: ${COLORS.gray100};
  border: 1px solid ${COLORS.gray300};
`;

const NovelGroupTitle = styled.h3`
  margin: 0;
  font-size: ${FONTS.sizeBase};
  color: ${COLORS.dark};
`;

const NovelGroupCount = styled.span`
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.textLight};
`;

const ChapterGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.sm};
  padding-left: ${SPACING.md};
`;

const ChapterGroupHeader = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: ${SPACING.xs} ${SPACING.sm};
  border-radius: 6px;
  background-color: ${COLORS.gray200};
  border: 1px solid ${COLORS.gray300};
`;

const ChapterGroupTitle = styled.h4`
  margin: 0;
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.dark};
  font-weight: bold;
`;

const ChapterGroupCount = styled.span`
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.textLight};
`;

const SnippetCard = styled.div<{ bgColor: string; textColor: string; isMisaligned?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.xs};
  position: relative;
  padding: ${SPACING.md};
  border: 2px solid ${props => (props.isMisaligned ? COLORS.warning : 'rgba(0,0,0,0.1)')};
  border-radius: ${BORDERS.radius};
  background-color: ${props => (props.isMisaligned ? `${COLORS.warning}20` : props.bgColor)};
  box-shadow: ${SHADOWS.small};
  cursor: default;
  transition: border-color 0.2s, background-color 0.2s, box-shadow 0.2s;

  &:hover {
    box-shadow: 0 0 8px ${COLORS.primary}30;
  }
`;

const SnippetContent = styled.div`
  display: flex;
  gap: ${SPACING.md};
  align-items: flex-start;
  min-width: 0;
`;

const SnippetBody = styled.div`
  flex: 1 1 auto;
  min-width: 0;
`;

const SnippetSide = styled.div`
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: ${SPACING.xs};
  align-items: flex-end;
  max-width: 45%;
`;

const TagPathStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.xs};
  align-items: flex-end;
  max-width: 100%;
`;

const TagPathRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${SPACING.xs};
  justify-content: flex-end;
  max-width: 100%;
`;

const SnippetMetaText = styled.span<{ textColor: string }>`
  font-size: ${FONTS.sizeSmall};
  color: ${props => props.textColor};
  opacity: 0.85;
`;

const TagLevelChip = styled.button<{ $bg: string; $color: string }>`
  display: inline-flex;
  align-items: center;
  padding: 2px ${SPACING.sm};
  border-radius: 999px;
  border: 1px solid rgba(0,0,0,0.15);
  background-color: ${props => props.$bg};
  font-size: ${FONTS.sizeSmall};
  color: ${props => props.$color};
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  user-select: none;
  box-shadow: none;

  &:hover {
    opacity: 0.9;
  }

  &:focus-visible {
    outline: 2px solid ${COLORS.primary}80;
    outline-offset: 2px;
  }
`;

const SnippetText = styled.p<{ textColor: string }>`
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.7;
  color: ${props => props.textColor};
`;

const LocateButton = styled.button<{ textColor: string }>`
  padding: 0;
  border: none;
  background: transparent;
  font-size: ${FONTS.sizeSmall};
  color: ${props => props.textColor};
  cursor: pointer;
  text-decoration: underline;
  opacity: 0.9;

  &:hover {
    opacity: 1;
  }

  &:focus-visible {
    outline: 2px solid ${COLORS.primary}80;
    outline-offset: 2px;
    border-radius: 4px;
  }
`;

const Placeholder = styled.p(globalPlaceholderTextStyles);

const GlobalTagSearchPage: React.FC<GlobalTagSearchPageProps> = ({
  allUserTags,
  allUserAnnotations,
  novels,
  currentUser,
  navigateTo,
  setAllUserAnnotations,
}) => {
  const mainContentAreaRef = useRef<HTMLDivElement>(null);
  const panelWidthsStorageKey = 'globalTagSearchPanelWidths';
  const initialPanelWidths = useMemo(() => {
    try {
      const raw = localStorage.getItem(panelWidthsStorageKey);
      if (!raw) return [30, 70];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length !== 2) return [30, 70];
      const [left, right] = parsed;
      if (typeof left !== 'number' || typeof right !== 'number') return [30, 70];
      const total = left + right;
      if (!Number.isFinite(total) || total <= 0) return [30, 70];
      const normalizedLeft = (left / total) * 100;
      const normalizedRight = 100 - normalizedLeft;
      return [normalizedLeft, normalizedRight];
    } catch {
      return [30, 70];
    }
  }, []);

  const {
    panelWidths,
    handleMouseDownOnResizer,
    hoveredResizer,
    setHoveredResizer,
  } = usePanelResizer({
    initialWidths: initialPanelWidths,
    minPercentage: MIN_PANEL_PERCENTAGE,
    mainContentAreaRef,
  });

  useEffect(() => {
    try {
      localStorage.setItem(panelWidthsStorageKey, JSON.stringify(panelWidths));
    } catch {
      // ignore
    }
  }, [panelWidths]);

  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [selectedMergedTagId, setSelectedMergedTagId] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isLoadingAnnotations, setIsLoadingAnnotations] = useState(false);
  const [hasLoadedAllAnnotations, setHasLoadedAllAnnotations] = useState(false);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [hasLoadedAllTags, setHasLoadedAllTags] = useState(false);
  const [allTagsForSearch, setAllTagsForSearch] = useState<Tag[]>(() => allUserTags);

  // 首次打开全局搜索页面时，加载所有标注数据（不加载小说文本）
  useEffect(() => {
    if (hasLoadedAllAnnotations) return;

    let cancelled = false;

    const loadAllAnnotations = async () => {
      try {
        setIsLoadingAnnotations(true);
        const allAnnotations = await annotationsApi.getAll(); // 加载所有标注（后端只返回标注数据，不含小说文本）
        if (cancelled) return;

        // 合并到全局状态，保留已有的标注
        setAllUserAnnotations(prev => {
          const existingIds = new Set(prev.map(a => a.id));
          const newAnnotations = allAnnotations.filter(a => !existingIds.has(a.id));
          return [...prev, ...newAnnotations];
        });

        setHasLoadedAllAnnotations(true);
      } catch (error) {
        if (cancelled) return;
        console.error('加载所有标注失败:', error);
        alert('加载标注数据失败，请刷新重试');
      } finally {
        if (!cancelled) setIsLoadingAnnotations(false);
      }
    };

    loadAllAnnotations();

    return () => {
      cancelled = true;
    };
  }, [hasLoadedAllAnnotations, setAllUserAnnotations]);

  useEffect(() => {
    if (hasLoadedAllTags) return;

    let cancelled = false;

    const loadAllTags = async () => {
      try {
        setIsLoadingTags(true);
        const allTags = await tagsApi.getAll();
        if (cancelled) return;
        setAllTagsForSearch(allTags);
        setHasLoadedAllTags(true);
      } catch (error) {
        if (cancelled) return;
        console.error('加载所有标签失败:', error);
        alert('加载标签数据失败，请刷新重试');
      } finally {
        if (!cancelled) setIsLoadingTags(false);
      }
    };

    loadAllTags();

    return () => {
      cancelled = true;
    };
  }, [hasLoadedAllTags]);

  const mergedTagData = useMemo(() => {
    const tagById = new Map(allTagsForSearch.map(tag => [tag.id, tag]));
    const pathCache = new Map<string, string[]>();

    const getPathNamesForRealTagId = (tagId: string): string[] => {
      const cached = pathCache.get(tagId);
      if (cached) return cached;

      const names: string[] = [];
      const visited = new Set<string>();
      let currentId: string | null | undefined = tagId;
      while (currentId) {
        if (visited.has(currentId)) break;
        visited.add(currentId);

        const tag = tagById.get(currentId);
        if (!tag) break;
        names.unshift(tag.name.trim());
        currentId = tag.parentId;
      }

      pathCache.set(tagId, names);
      return names;
    };

    const PATH_SEPARATOR = '\u001F';
    const mergedTagsById = new Map<string, Tag>();
    const mergedIdByRealId = new Map<string, string>();
    const realTagIdsByMergedId = new Map<string, Set<string>>();
    const mergedPathLabelById = new Map<string, string>();

    const toMergedId = (pathNames: string[]): string => `merged:${pathNames.join(PATH_SEPARATOR)}`;
    const toLabel = (pathNames: string[]): string => pathNames.join(' / ');

    const ensureMergedNode = (pathNames: string[], sampleColor: string) => {
      let parentMergedId: string | null = null;
      for (let i = 0; i < pathNames.length; i++) {
        const prefix = pathNames.slice(0, i + 1);
        const mergedId = toMergedId(prefix);
        if (!mergedTagsById.has(mergedId)) {
          mergedTagsById.set(mergedId, {
            id: mergedId,
            name: prefix[prefix.length - 1],
            color: sampleColor,
            parentId: parentMergedId,
            novelId: null,
            userId: currentUser.id,
          });
          mergedPathLabelById.set(mergedId, toLabel(prefix));
        }
        parentMergedId = mergedId;
      }
    };

    for (const realTag of allTagsForSearch) {
      if (realTag.name.trim() === PENDING_ANNOTATION_TAG_NAME) continue;

      const pathNames = getPathNamesForRealTagId(realTag.id)
        .map((name) => name.trim())
        .filter(Boolean);
      if (pathNames.length === 0) continue;
      if (pathNames.some((name) => name === PENDING_ANNOTATION_TAG_NAME)) continue;

      ensureMergedNode(pathNames, realTag.color);

      const mergedId = toMergedId(pathNames);
      mergedIdByRealId.set(realTag.id, mergedId);
      if (!realTagIdsByMergedId.has(mergedId)) {
        realTagIdsByMergedId.set(mergedId, new Set<string>());
      }
      realTagIdsByMergedId.get(mergedId)!.add(realTag.id);
    }

    return {
      mergedTags: Array.from(mergedTagsById.values()),
      mergedIdByRealId,
      realTagIdsByMergedId,
      mergedPathLabelById,
    };
  }, [allTagsForSearch, currentUser.id]);

  const filteredTags = useMemo(() => {
    const allMergedTags = mergedTagData.mergedTags;
    if (!tagSearchQuery.trim()) return allMergedTags;

    const query = tagSearchQuery.toLowerCase();
    const tagById = new Map(allMergedTags.map(tag => [tag.id, tag]));
    const childrenByParentId = new Map<string | null, string[]>();
    for (const tag of allMergedTags) {
      const key = tag.parentId ?? null;
      if (!childrenByParentId.has(key)) childrenByParentId.set(key, []);
      childrenByParentId.get(key)!.push(tag.id);
    }

    const matchedIds = allMergedTags
      .filter(tag => tag.name.toLowerCase().includes(query))
      .map(tag => tag.id);

    if (matchedIds.length === 0) return [];

    const includedIds = new Set<string>();

    const includeAncestors = (tagId: string) => {
      let currentId: string | null | undefined = tagId;
      const visited = new Set<string>();
      while (currentId) {
        if (visited.has(currentId)) break;
        visited.add(currentId);
        includedIds.add(currentId);
        currentId = tagById.get(currentId)?.parentId ?? null;
      }
    };

    const includeDescendants = (tagId: string) => {
      const queue: string[] = [tagId];
      const visited = new Set<string>([tagId]);
      let head = 0;
      while (head < queue.length) {
        const currentId = queue[head++];
        const children = childrenByParentId.get(currentId) || [];
        for (const childId of children) {
          if (visited.has(childId)) continue;
          visited.add(childId);
          includedIds.add(childId);
          queue.push(childId);
        }
      }
    };

    for (const id of matchedIds) {
      includeAncestors(id);
      includeDescendants(id);
    }

    return allMergedTags.filter(tag => includedIds.has(tag.id));
  }, [mergedTagData.mergedTags, tagSearchQuery]);

  const selectedTagScope = useMemo(() => {
    if (!selectedMergedTagId) {
      return { mergedIds: new Set<string>(), realIds: new Set<string>() };
    }

    const mergedIds = new Set<string>([
      selectedMergedTagId,
      ...getAllDescendantTagIds(selectedMergedTagId, mergedTagData.mergedTags),
    ]);

    const realIds = new Set<string>();
    for (const mergedId of mergedIds) {
      const set = mergedTagData.realTagIdsByMergedId.get(mergedId);
      if (!set) continue;
      for (const realTagId of set) realIds.add(realTagId);
    }

    return { mergedIds, realIds };
  }, [mergedTagData.mergedTags, mergedTagData.realTagIdsByMergedId, selectedMergedTagId]);

  const displayedAnnotations = useMemo(() => {
    if (!selectedMergedTagId) {
      return [];
    }
    if (selectedTagScope.realIds.size === 0) return [];
    return allUserAnnotations
      .filter(ann => ann.tagIds.some(tid => selectedTagScope.realIds.has(tid)))
      .sort((a, b) => {
        const novelA = novels.find(n => n.id === a.novelId)?.title || '';
        const novelB = novels.find(n => n.id === b.novelId)?.title || '';
        if (novelA.localeCompare(novelB) !== 0) {
          return novelA.localeCompare(novelB);
        }
        return a.startIndex - b.startIndex;
      });
  }, [allUserAnnotations, novels, selectedMergedTagId, selectedTagScope.realIds]);

  const activeMergedTag = useMemo(
    () => (selectedMergedTagId ? mergedTagData.mergedTags.find(t => t.id === selectedMergedTagId) : null),
    [mergedTagData.mergedTags, selectedMergedTagId]
  );

  const groupedResults = useMemo(() => {
    type LocateTarget = { novelId: string; chapterId: string; startIndex: number };
    type TagPathSegment = {
      mergedTagId: string | null;
      name: string;
      color: string;
    };
    type TagPath = {
      id: string;
      segments: TagPathSegment[];
    };
    type SnippetResult = {
      id: string;
      novelId: string;
      chapterId: string;
      startIndex: number;
      endIndex: number;
      text: string;
      annotationIds: string[];
      tagPaths: TagPath[];
      isPotentiallyMisaligned: boolean;
      locateTarget: LocateTarget;
    };
    type ChapterGroupResult = {
      chapterId: string;
      chapterNumber: number;
      chapterTitle: string;
      snippetCount: number;
      snippets: SnippetResult[];
    };
    type NovelGroupResult = {
      novelId: string;
      novelTitle: string;
      snippetCount: number;
      chapters: ChapterGroupResult[];
    };

    if (!selectedMergedTagId) return [] as NovelGroupResult[];

    const novelById = new Map(novels.map(n => [n.id, n]));
    const tagById = new Map(allTagsForSearch.map(tag => [tag.id, tag]));
    const mergedTagById = new Map(mergedTagData.mergedTags.map(tag => [tag.id, tag]));
    const sortedChaptersByNovelId = new Map<string, Chapter[]>();

    const buildTagPathFromLeafId = (leafTagId: string): TagPath | null => {
      const segments: TagPathSegment[] = [];
      const visited = new Set<string>();
      let currentId: string | null | undefined = leafTagId;

      while (currentId) {
        if (visited.has(currentId)) break;
        visited.add(currentId);

        const tag = tagById.get(currentId);
        if (!tag) break;

        segments.unshift({
          mergedTagId: mergedTagData.mergedIdByRealId.get(tag.id) ?? null,
          name: tag.name.trim(),
          color: tag.color,
        });

        currentId = tag.parentId;
      }

      if (segments.length === 0) return null;
      return { id: leafTagId, segments };
    };

    const buildTagPathFromMergedId = (mergedId: string): TagPath => {
      const segments: TagPathSegment[] = [];
      const visited = new Set<string>();
      let currentId: string | null | undefined = mergedId;

      while (currentId) {
        if (visited.has(currentId)) break;
        visited.add(currentId);

        const tag = mergedTagById.get(currentId);
        if (!tag) break;

        segments.unshift({
          mergedTagId: tag.id,
          name: tag.name.trim(),
          color: tag.color,
        });

        currentId = tag.parentId;
      }

      return { id: mergedId, segments };
    };

    const getSortedChapters = (novelId: string): Chapter[] => {
      if (sortedChaptersByNovelId.has(novelId)) return sortedChaptersByNovelId.get(novelId)!;
      const novel = novelById.get(novelId);
      const chapters = [...(novel?.chapters || [])].sort((a, b) => a.originalStartIndex - b.originalStartIndex);
      sortedChaptersByNovelId.set(novelId, chapters);
      return chapters;
    };

    const getChapterInfoForIndex = (
      novelId: string,
      absoluteIndex: number
    ): { chapterId: string; chapterNumber: number; chapterTitle: string } | null => {
      const chapters = getSortedChapters(novelId);
      if (chapters.length === 0) return null;

      let left = 0;
      let right = chapters.length - 1;
      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const chapter = chapters[mid];
        if (absoluteIndex < chapter.originalStartIndex) {
          right = mid - 1;
        } else if (absoluteIndex >= chapter.originalEndIndex) {
          left = mid + 1;
        } else {
          return {
            chapterId: chapter.id,
            chapterNumber: mid + 1,
            chapterTitle: chapter.title,
          };
        }
      }
      return null;
    };

    const groupContiguousAnnotations = (annotations: Annotation[], novelText?: string) => {
      type Group = {
        id: string;
        annotationIds: string[];
        startIndex: number;
        endIndex: number;
        tagIdsSet: Set<string>;
        fallbackTexts: string[];
        hasMisaligned: boolean;
      };

      if (annotations.length === 0) return [] as Array<{
        id: string;
        annotationIds: string[];
        startIndex: number;
        endIndex: number;
        tagIds: string[];
        text: string;
        hasMisaligned: boolean;
      }>;

      const text = novelText ?? '';
      const hasText = text.length > 0;
      const sorted = [...annotations].sort((a, b) => a.startIndex - b.startIndex);

      const gapIsMergeable = (gap: string): boolean => {
        const trimmed = gap.trim();
        if (trimmed === '') return true;
        return /^[\p{P}\p{S}]+$/u.test(trimmed);
      };

      const groups: Group[] = [];

      for (const ann of sorted) {
        const last = groups[groups.length - 1];
        const annStart = ann.startIndex;
        const annEnd = ann.endIndex;
        const annText = ann.text || '';
        const annMisaligned = Boolean(ann.isPotentiallyMisaligned);

        if (!last) {
          groups.push({
            id: ann.id,
            annotationIds: [ann.id],
            startIndex: annStart,
            endIndex: annEnd,
            tagIdsSet: new Set(ann.tagIds),
            fallbackTexts: [annText],
            hasMisaligned: annMisaligned,
          });
          continue;
        }

        const overlaps = annStart <= last.endIndex;
        const canSliceGap =
          hasText &&
          annStart >= last.endIndex &&
          annStart <= text.length &&
          last.endIndex <= text.length &&
          last.endIndex >= 0;

        const gapLen = annStart - last.endIndex;
        const shouldMerge =
          overlaps ||
          (canSliceGap && gapIsMergeable(text.slice(last.endIndex, annStart))) ||
          (!canSliceGap && gapLen <= 5);

        if (!shouldMerge) {
          groups.push({
            id: ann.id,
            annotationIds: [ann.id],
            startIndex: annStart,
            endIndex: annEnd,
            tagIdsSet: new Set(ann.tagIds),
            fallbackTexts: [annText],
            hasMisaligned: annMisaligned,
          });
          continue;
        }

        last.annotationIds.push(ann.id);
        last.startIndex = Math.min(last.startIndex, annStart);
        last.endIndex = Math.max(last.endIndex, annEnd);
        ann.tagIds.forEach(tid => last.tagIdsSet.add(tid));
        if (annText) last.fallbackTexts.push(annText);
        if (annMisaligned) last.hasMisaligned = true;
      }

      return groups.map(g => {
        const canSliceGroup =
          hasText &&
          g.startIndex >= 0 &&
          g.endIndex >= g.startIndex &&
          g.endIndex <= text.length;

        const mergedText = canSliceGroup
          ? text.slice(g.startIndex, g.endIndex)
          : g.fallbackTexts.filter(Boolean).join('');

        return {
          id: g.id,
          annotationIds: g.annotationIds,
          startIndex: g.startIndex,
          endIndex: g.endIndex,
          tagIds: Array.from(g.tagIdsSet),
          text: mergedText || '[无文本内容]',
          hasMisaligned: g.hasMisaligned,
        };
      });
    };

    const annotationsByNovel = new Map<string, Annotation[]>();
    for (const ann of displayedAnnotations) {
      if (!novelById.has(ann.novelId)) continue;
      if (!annotationsByNovel.has(ann.novelId)) annotationsByNovel.set(ann.novelId, []);
      annotationsByNovel.get(ann.novelId)!.push(ann);
    }

    const novelGroups: NovelGroupResult[] = [];

    for (const [novelId, annsForNovel] of annotationsByNovel.entries()) {
      const novel = novelById.get(novelId);
      if (!novel) continue;

      const annotationsByChapter = new Map<string, Annotation[]>();
      const chapterMetaById = new Map<string, { chapterNumber: number; chapterTitle: string }>();

      for (const ann of annsForNovel) {
        const chapterInfo = getChapterInfoForIndex(novelId, ann.startIndex);
        const chapterId = chapterInfo?.chapterId || 'unknown';
        if (!annotationsByChapter.has(chapterId)) annotationsByChapter.set(chapterId, []);
        annotationsByChapter.get(chapterId)!.push(ann);
        if (chapterInfo) {
          chapterMetaById.set(chapterId, { chapterNumber: chapterInfo.chapterNumber, chapterTitle: chapterInfo.chapterTitle });
        }
      }

      const chapterGroups: ChapterGroupResult[] = [];

      for (const [chapterId, annsForChapter] of annotationsByChapter.entries()) {
        const chapterMeta = chapterMetaById.get(chapterId);
        const chapterNumber = chapterMeta?.chapterNumber ?? 0;
        const chapterTitle = chapterMeta?.chapterTitle ?? '未分章节';

        const grouped = groupContiguousAnnotations(annsForChapter, novel.text);
        const snippets: SnippetResult[] = grouped.map(group => {
          const relevantTagIds = group.tagIds
            .map(id => tagById.get(id))
            .filter((tag): tag is Tag => !!tag && tag.name.trim() !== PENDING_ANNOTATION_TAG_NAME)
            .filter(tag => selectedTagScope.realIds.has(tag.id))
            .map(tag => tag.id);

          const leafTagIds = getLeafTagIds(relevantTagIds, allTagsForSearch);
          const tagPaths = leafTagIds
            .map(buildTagPathFromLeafId)
            .filter((path): path is TagPath => !!path && path.segments.length > 0);

          return {
            id: `${novelId}:${chapterId}:${group.startIndex}:${group.endIndex}`,
            novelId,
            chapterId,
            startIndex: group.startIndex,
            endIndex: group.endIndex,
            text: group.text,
            annotationIds: group.annotationIds,
            tagPaths: tagPaths.length > 0 ? tagPaths : [buildTagPathFromMergedId(selectedMergedTagId)],
            isPotentiallyMisaligned: group.hasMisaligned,
            locateTarget: { novelId, chapterId, startIndex: group.startIndex },
          };
        });

        snippets.sort((a, b) => a.startIndex - b.startIndex);

        chapterGroups.push({
          chapterId,
          chapterNumber,
          chapterTitle,
          snippetCount: snippets.length,
          snippets,
        });
      }

      chapterGroups.sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0) || a.chapterTitle.localeCompare(b.chapterTitle));

      const snippetCount = chapterGroups.reduce((sum, group) => sum + group.snippetCount, 0);
      novelGroups.push({
        novelId,
        novelTitle: novel.title || '未命名小说',
        snippetCount,
        chapters: chapterGroups,
      });
    }

    novelGroups.sort((a, b) => a.novelTitle.localeCompare(b.novelTitle));
    return novelGroups;
  }, [
    selectedMergedTagId,
    displayedAnnotations,
    novels,
    allTagsForSearch,
    mergedTagData.mergedIdByRealId,
    mergedTagData.mergedTags,
    selectedTagScope.realIds,
  ]);

  const getNovelTitleById = (novelId: string): string => {
    return novels.find(n => n.id === novelId)?.title || '未知小说';
  };

  const getTagById = (tagId: string): Tag | undefined => {
    return allTagsForSearch.find(t => t.id === tagId);
  };

  const handleTagSelectForSearch = (tagId: string | null) => {
    setSelectedMergedTagId(tagId);
  };

  const handleOpenLocateInReader = (novelId: string, chapterId: string, absoluteIndex: number) => {
    try {
      localStorage.setItem('novelEditorLocateRequest', JSON.stringify({
        novelId,
        chapterId,
        absoluteIndex,
        createdAt: Date.now(),
      }));
    } catch {
      // ignore
    }
    setIsNavigating(true);
    navigateTo(`#/edit/${novelId}`);
  };

  const handleNavigateToNovel = (novelId: string) => {
    // 直接导航，不设置 loading 状态，避免额外的重新渲染
    navigateTo(`#/edit/${novelId}`);
  };

  return (
    <PageContainer>
      {(isNavigating || isLoadingAnnotations) && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          fontSize: '1.2em',
          color: COLORS.textLight
        }}>
          {isLoadingAnnotations ? '正在加载所有标注数据...' : '正在打开小说...'}
        </div>
      )}
      <Header>
        <PageTitle>全局标签搜索</PageTitle>
        <BackButton onClick={() => navigateTo('#/projects')}>
          返回项目列表
        </BackButton>
      </Header>
      <MainContent ref={mainContentAreaRef}>
        <LeftPanel style={{ flexBasis: `${panelWidths[0]}%` }}>
          <SearchInput
            type="text"
            placeholder="搜索标签名称..."
            value={tagSearchQuery}
            onChange={(e) => setTagSearchQuery(e.target.value)}
            aria-label="搜索标签"
          />
          <TagListContainer>
            {isLoadingTags && allTagsForSearch.length === 0 ? (
              <Placeholder>正在加载标签...</Placeholder>
            ) : filteredTags.length > 0 ? (
              <TagList
                tags={filteredTags}
                activeTagId={selectedMergedTagId}
                editorMode="read"
                onApplyTagToSelection={() => {}}
                onSelectTagForReadMode={handleTagSelectForSearch}
                onUpdateTagParent={() => {}}
                onUpdateTagColor={() => {}}
                onUpdateTagName={() => {}}
                onDeleteTag={() => {}}
                onTagGlobalSearch={() => {}}
              />
            ) : (
              <Placeholder>没有找到匹配的标签。</Placeholder>
            )}
          </TagListContainer>
        </LeftPanel>
        <Resizer
          isHovered={hoveredResizer === 0}
          onMouseDown={(e) => handleMouseDownOnResizer(e, 0)}
          onMouseEnter={() => setHoveredResizer(0)}
          onMouseLeave={() => setHoveredResizer(null)}
          role="separator"
          aria-label="调整标签树与结果面板宽度"
        >
          <ResizerIcon>|||</ResizerIcon>
        </Resizer>
        <RightPanel style={{ flexBasis: `${panelWidths[1]}%` }}>
          <ResultsTitle>
            {selectedMergedTagId
              ? `标签 "${mergedTagData.mergedPathLabelById.get(selectedMergedTagId) || '未知标签'}" (含子标签) 的标注结果`
              : '请在左侧选择一个标签以查看标注'}
          </ResultsTitle>
          {/*
            <AnnotationList>
              {displayedAnnotations.map(ann => {
                const tagsForAnnotation = ann.tagIds
                  .map(tagId => getTagById(tagId))
                  .filter((tag): tag is Tag => !!tag && tag.name.trim() !== PENDING_ANNOTATION_TAG_NAME);

                const getRootId = (tagId: string): string => {
                  let currentTag = allUserTags.find(t => t.id === tagId);
                  if (!currentTag) return tagId;
                  while (currentTag.parentId) {
                    const parent = allUserTags.find(t => t.id === currentTag.parentId);
                    if (!parent) break;
                    currentTag = parent;
                  }
                  return currentTag.id;
                };

                const tagsByRoot = new Map<string, Tag[]>();
                tagsForAnnotation.forEach(tag => {
                  const rootId = getRootId(tag.id);
                  if (!tagsByRoot.has(rootId)) {
                    tagsByRoot.set(rootId, []);
                  }
                  tagsByRoot.get(rootId)!.push(tag);
                });

                const tagGroups = Array.from(tagsByRoot.values());

                tagGroups.sort((groupA, groupB) => {
                  const rootA = allUserTags.find(t => t.id === getRootId(groupA[0].id));
                  const rootB = allUserTags.find(t => t.id === getRootId(groupB[0].id));
                  return (rootA?.name || '').localeCompare(rootB?.name || '');
                });

                return (
                  <AnnotationItem key={ann.id}>
                    <AnnotationText>"{ann.text || '[无文本内容]'}"</AnnotationText>
                    <SourceNovelText>
                      来源: <SourceNovelLink onClick={() => handleNavigateToNovel(ann.novelId)} role="link" tabIndex={0} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleNavigateToNovel(ann.novelId)}>
                              {getNovelTitleById(ann.novelId)}
                            </SourceNovelLink>
                    </SourceNovelText>
                    <TagPillContainer>
                      {tagGroups.map((group, index) => {
                        const sortedGroup = group
                          .map(tag => ({
                            ...tag,
                            depth: getAllAncestorTagIds(tag.id, allUserTags).length
                          }))
                          .sort((a, b) => {
                            if (a.depth !== b.depth) {
                              return a.depth - b.depth;
                            }
                            return a.name.localeCompare(b.name);
                          });

                        return (
                          <TagGroupRow key={index}>
                            {sortedGroup.map(tag => {
                              const mergedId = mergedTagData.mergedIdByRealId.get(tag.id);
                              const isPrimaryFilterTag = !!mergedId && selectedTagScope.mergedIds.has(mergedId);
                              return (
                                <TagPill
                                  key={tag.id}
                                  bgColor={tag.color}
                                  textColor={getContrastingTextColor(tag.color)}
                                  isPrimary={!!isPrimaryFilterTag}
                                  onClick={() => mergedId && handleTagSelectForSearch(mergedId)}
                                  title={`筛选标签: ${tag.name}`}
                                >
                                  {tag.name}
                                </TagPill>
                              );
                            })}
                          </TagGroupRow>
                        );
                      })}
                    </TagPillContainer>
                    <DeleteButton
                      onClick={() => confirmDeleteAnnotation(ann.id)}
                      aria-label={`删除标注: ${ann.text.substring(0, 20)}...`}
                      title="删除此标注"
                    >✕</DeleteButton>
                  </AnnotationItem>
                );
              })}
            </AnnotationList>
          ) : (
            selectedMergedTagId && <Placeholder>此标签下没有找到任何标注。</Placeholder>
          */}

          {selectedMergedTagId && groupedResults.length === 0 && (
            <Placeholder>此标签下没有找到任何标注。</Placeholder>
          )}

          {selectedMergedTagId && groupedResults.length > 0 && (
            <ResultsScrollArea>
              {groupedResults.map(novelGroup => (
                <NovelGroup key={novelGroup.novelId}>
                  <NovelGroupHeader>
                    <NovelGroupTitle>{novelGroup.novelTitle}</NovelGroupTitle>
                    <NovelGroupCount>{novelGroup.snippetCount} 段</NovelGroupCount>
                  </NovelGroupHeader>

                  {novelGroup.chapters.map(chapterGroup => (
                    <ChapterGroup key={`${novelGroup.novelId}:${chapterGroup.chapterId}`}>
                      <ChapterGroupHeader>
                        <ChapterGroupTitle>
                          {chapterGroup.chapterNumber > 0 ? `第${chapterGroup.chapterNumber}章：` : ''}{chapterGroup.chapterTitle}
                        </ChapterGroupTitle>
                        <ChapterGroupCount>{chapterGroup.snippetCount} 段</ChapterGroupCount>
                      </ChapterGroupHeader>

                      {chapterGroup.snippets.map(snippet => {
                        const bgColor = activeMergedTag?.color || COLORS.white;
                        const textColor = activeMergedTag ? getContrastingTextColor(activeMergedTag.color) : COLORS.text;
                        return (
                          <SnippetCard
                            key={snippet.id}
                            bgColor={bgColor}
                            textColor={textColor}
                            isMisaligned={snippet.isPotentiallyMisaligned}
                            title={snippet.isPotentiallyMisaligned ? '此标注可能已错位' : undefined}
                          >
                            <SnippetContent>
                              <SnippetBody>
                                <SnippetText textColor={textColor}>{snippet.text}</SnippetText>
                              </SnippetBody>
                              <SnippetSide>
                                <TagPathStack>
                                  {snippet.tagPaths.map((path) => (
                                    <TagPathRow key={`${snippet.id}:path:${path.id}`}>
                                      {path.segments.map((segment, idx) => {
                                        const segmentTextColor = getContrastingTextColor(segment.color);
                                        return (
                                          <TagLevelChip
                                            key={`${path.id}:${idx}:${segment.name}`}
                                            $bg={segment.color}
                                            $color={segmentTextColor}
                                            onDoubleClick={() => {
                                              if (!segment.mergedTagId) return;
                                              setSelectedMergedTagId(prev => (prev === segment.mergedTagId ? null : segment.mergedTagId));
                                            }}
                                            title={segment.mergedTagId ? `双击：切换到标签 "${segment.name}"` : segment.name}
                                            aria-label={segment.mergedTagId ? `双击切换到标签 ${segment.name}` : segment.name}
                                            type="button"
                                          >
                                            {segment.name}
                                          </TagLevelChip>
                                        );
                                      })}
                                    </TagPathRow>
                                  ))}
                                </TagPathStack>
                                <SnippetMetaText textColor={textColor} title="此片段包含的标注数量">
                                  {snippet.annotationIds.length} 标注
                                </SnippetMetaText>
                                <LocateButton
                                  textColor={textColor}
                                  onClick={() =>
                                    handleOpenLocateInReader(
                                      snippet.locateTarget.novelId,
                                      snippet.locateTarget.chapterId,
                                      snippet.locateTarget.startIndex
                                    )
                                  }
                                  aria-label="打开阅读模式并定位到该片段"
                                  title="打开阅读模式并定位到该片段"
                                  type="button"
                                >
                                  点击定位 →
                                </LocateButton>
                              </SnippetSide>
                            </SnippetContent>
                          </SnippetCard>
                        );
                      })}
                    </ChapterGroup>
                  ))}
                </NovelGroup>
              ))}
            </ResultsScrollArea>
          )}
        </RightPanel>
      </MainContent>
    </PageContainer>
  );
};

export default GlobalTagSearchPage;

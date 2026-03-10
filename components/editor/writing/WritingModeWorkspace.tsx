import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from '@emotion/styled';
import type {
  BenchmarkChapterSnapshot,
  BenchmarkNovelSnapshot,
  GeminiTaskType,
  Novel,
  WritingAiMessage,
  WritingChapterPlan,
  WritingContextBasketItem,
  WritingGeminiRun,
  WritingScopeType,
  WritingWorkspace,
} from '../../../types';
import { novelsApi } from '../../../api';
import { generateId, splitTextIntoChapters } from '../../../utils';
import { COLORS, SPACING, FONTS, BORDERS, SHADOWS, panelStyles as basePanelStyles } from '../../../styles';

type PlannerTab = 'global' | 'rough' | 'chapter' | 'draft';

const GEMINI_TASK_LABELS: Record<GeminiTaskType, string> = {
  global_design: '全局人设/主线方案',
  rough_plot: '粗糙剧情方案',
  chapter_design: '章节细化方案',
  draft_writing: '章节正文草稿',
  custom: '自定义任务',
};

const PLANNER_TAB_LABELS: Record<PlannerTab, string> = {
  global: '全局人设主线',
  rough: '粗糙剧情',
  chapter: '章节细化',
  draft: '正文写作',
};

const TAB_TO_GEMINI_TASK: Record<PlannerTab, GeminiTaskType> = {
  global: 'global_design',
  rough: 'rough_plot',
  chapter: 'chapter_design',
  draft: 'draft_writing',
};

const buildPromptTemplate = (taskType: GeminiTaskType): string => {
  if (taskType === 'global_design') {
    return [
      '你是资深网文编辑。下面是一本来自【请填写平台，如起点男频/起点女频/晋江/番茄/自定义】的爆款小说参考内容（【请填写章节范围，如第1-3章】）。',
      '',
      '请基于这些内容完成以下分析：',
      '1. 拆解这些章节为什么有效：开篇吸引力、人物亮点、冲突设计、节奏推进、悬念/爽点安排。',
      '2. 告诉我应该怎么学习它：哪些点可直接借鉴，哪些点只能借思路，练习应先练什么后练什么。',
      '3. 基于这本书当前体现出的优势，给出最适合改编的题材方向，并分别说明：为什么适配、必须保留的核心点、可以调整的部分、最容易踩的坑。',
    ].join('\n');
  }

  if (taskType === 'rough_plot') {
    return [
      '请基于参考章节，为当前项目输出一版粗糙剧情方案。',
      '重点覆盖：阶段目标、冲突升级、关键转折、阶段收束。',
      '如果信息不足，请先列出需要补充的信息。',
    ].join('\n');
  }

  if (taskType === 'chapter_design') {
    return [
      '请基于参考章节与当前已有设定，细化本章方案。',
      '重点覆盖：本章出场人物职责、冲突链、关键转折、章节结尾钩子。',
    ].join('\n');
  }

  if (taskType === 'draft_writing') {
    return [
      '请基于参考章节风格与本章细化方案，产出一版可继续润色的正文草稿。',
      '保持节奏清晰，避免照搬参考原文。',
    ].join('\n');
  }

  return '请根据参考章节完成本次任务。';
};

const chapterSelectionKey = (benchmarkNovelId: string, chapterId: string): string =>
  `${benchmarkNovelId}::${chapterId}`;

const WRITING_LEFT_WIDTH_STORAGE_KEY = 'writingModeLeftPanelWidthPx';
const WRITING_RIGHT_WIDTH_STORAGE_KEY = 'writingModeRightPanelWidthPx';
const WRITING_LEFT_MIN = 240;
const WRITING_RIGHT_MIN = 280;
const WRITING_MIDDLE_MIN = 420;
const WRITING_RIGHT_WIDTH = 360;
const WRITING_RESIZER_WIDTH = 10;

interface WritingModeWorkspaceProps {
  novel: Novel;
  setNovels: React.Dispatch<React.SetStateAction<Novel[]>>;
}

const WorkspaceContainer = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: ${COLORS.background};
`;

const Panel = styled.div`
  ${basePanelStyles as any};
  border-right: 1px solid ${COLORS.gray300};
  min-width: 0;
`;

const RightPanel = styled(Panel)`
  border-right: none;
  border-left: 1px solid ${COLORS.gray300};
`;

const LeftCenterResizer = styled.div<{ $active?: boolean }>`
  flex: 0 0 ${WRITING_RESIZER_WIDTH}px;
  width: ${WRITING_RESIZER_WIDTH}px;
  cursor: col-resize;
  border-left: 1px solid ${COLORS.gray300};
  border-right: 1px solid ${COLORS.gray300};
  background: ${props => (props.$active ? COLORS.gray300 : COLORS.gray200)};
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  z-index: 5;
`;

const ResizerGrip = styled.span`
  font-size: 10px;
  line-height: 1;
  color: ${COLORS.gray600};
  letter-spacing: -1px;
`;

const CompactToolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${SPACING.xs};
`;

const SectionTitle = styled.h3`
  margin: 0 0 ${SPACING.md} 0;
  font-size: ${FONTS.sizeLarge};
  color: ${COLORS.dark};
`;

const BlockTitle = styled.h4`
  margin: 0 0 ${SPACING.sm} 0;
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.gray700};
`;

const InlineGroup = styled.div`
  display: flex;
  align-items: center;
  gap: ${SPACING.sm};
`;

const Select = styled.select`
  width: 100%;
  padding: ${SPACING.xs} ${SPACING.sm};
  border: 1px solid ${COLORS.gray400};
  border-radius: ${BORDERS.radius};
  font-size: ${FONTS.sizeSmall};
  background: ${COLORS.white};
`;

const Input = styled.input`
  width: 100%;
  padding: ${SPACING.xs} ${SPACING.sm};
  border: 1px solid ${COLORS.gray400};
  border-radius: ${BORDERS.radius};
  font-size: ${FONTS.sizeSmall};
`;

const NumberInput = styled(Input)`
  width: 96px;
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 110px;
  resize: vertical;
  padding: ${SPACING.sm};
  border: 1px solid ${COLORS.gray400};
  border-radius: ${BORDERS.radius};
  font-size: ${FONTS.sizeSmall};
  line-height: 1.45;
  font-family: inherit;
  box-sizing: border-box;
  background: ${COLORS.white};
`;

const SmallTextArea = styled(TextArea)`
  min-height: 84px;
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' | 'danger' }>`
  padding: ${SPACING.xs} ${SPACING.md};
  border-radius: ${BORDERS.radius};
  border: 1px solid
    ${props =>
      props.$variant === 'danger'
        ? COLORS.danger
        : props.$variant === 'secondary'
          ? COLORS.gray400
          : COLORS.primary};
  background: ${props =>
    props.$variant === 'danger'
      ? COLORS.danger
      : props.$variant === 'secondary'
        ? COLORS.white
        : COLORS.primary};
  color: ${props =>
    props.$variant === 'secondary'
      ? COLORS.text
      : COLORS.white};
  font-size: ${FONTS.sizeSmall};
  cursor: pointer;
  transition: background-color 0.2s, box-shadow 0.2s;

  &:hover:not(:disabled) {
    background: ${props =>
      props.$variant === 'danger'
        ? COLORS.dangerHover
        : props.$variant === 'secondary'
          ? COLORS.gray100
          : COLORS.primaryHover};
    box-shadow: ${SHADOWS.small};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    box-shadow: none;
  }
`;

const ListBox = styled.div`
  border: 1px solid ${COLORS.gray300};
  border-radius: ${BORDERS.radius};
  background: ${COLORS.white};
  overflow: auto;
`;

const ItemButton = styled.button<{ $active?: boolean }>`
  width: 100%;
  text-align: left;
  border: none;
  border-bottom: 1px solid ${COLORS.gray200};
  padding: ${SPACING.sm};
  background: ${props => (props.$active ? COLORS.highlightBackground : COLORS.white)};
  color: ${props => (props.$active ? COLORS.primary : COLORS.text)};
  font-size: ${FONTS.sizeSmall};
  cursor: pointer;

  &:last-of-type {
    border-bottom: none;
  }

  &:hover {
    background: ${props => (props.$active ? COLORS.highlightBackground : COLORS.gray100)};
  }
`;

const Tabs = styled.div`
  display: flex;
  gap: ${SPACING.xs};
  margin-bottom: ${SPACING.md};
`;

const TabButton = styled.button<{ $active?: boolean }>`
  padding: ${SPACING.xs} ${SPACING.md};
  border-radius: ${BORDERS.radius};
  border: 1px solid ${props => (props.$active ? COLORS.primary : COLORS.gray300)};
  background: ${props => (props.$active ? COLORS.primary : COLORS.white)};
  color: ${props => (props.$active ? COLORS.white : COLORS.text)};
  font-size: ${FONTS.sizeSmall};
  cursor: pointer;
`;

const Card = styled.div`
  border: 1px solid ${COLORS.gray300};
  border-radius: ${BORDERS.radius};
  background: ${COLORS.white};
  padding: ${SPACING.md};
  margin-bottom: ${SPACING.md};
`;

const Muted = styled.div`
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.textLighter};
`;

const ChatList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.sm};
  overflow: auto;
  flex: 1;
  margin-bottom: ${SPACING.md};
`;

const ChatBubble = styled.div<{ $role: 'user' | 'assistant' }>`
  align-self: ${props => (props.$role === 'user' ? 'flex-end' : 'stretch')};
  max-width: 100%;
  border: 1px solid ${props => (props.$role === 'user' ? COLORS.primary : COLORS.gray300)};
  background: ${props => (props.$role === 'user' ? COLORS.highlightBackground : COLORS.white)};
  border-radius: ${BORDERS.radius};
  padding: ${SPACING.sm};
  font-size: ${FONTS.sizeSmall};
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
`;

const Divider = styled.hr`
  width: 100%;
  border: none;
  border-top: 1px solid ${COLORS.gray300};
  margin: ${SPACING.md} 0;
`;

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: FONTS.sizeSmall,
  color: COLORS.gray700,
  marginBottom: SPACING.xs,
};

const buildDefaultWorkspace = (seed?: WritingWorkspace): WritingWorkspace => ({
  benchmarkNovels: seed?.benchmarkNovels ?? [],
  selectedBenchmarkNovelId: seed?.selectedBenchmarkNovelId ?? null,
  selectedBenchmarkChapterId: seed?.selectedBenchmarkChapterId ?? null,
  selectedChapterPlanId: seed?.selectedChapterPlanId ?? null,
  globalPlan: {
    premiseAndCast: seed?.globalPlan?.premiseAndCast ?? '',
    globalStoryline: seed?.globalPlan?.globalStoryline ?? '',
    worldRules: seed?.globalPlan?.worldRules ?? '',
  },
  roughPlan: {
    coarsePlot: seed?.roughPlan?.coarsePlot ?? '',
    stageOutline: seed?.roughPlan?.stageOutline ?? '',
    unresolvedQuestions: seed?.roughPlan?.unresolvedQuestions ?? '',
  },
  planningScope: {
    type: seed?.planningScope?.type ?? 'all',
    rangeStartChapter: seed?.planningScope?.rangeStartChapter ?? 1,
    rangeEndChapter: seed?.planningScope?.rangeEndChapter ?? 30,
    chapterPlanId: seed?.planningScope?.chapterPlanId ?? null,
  },
  chapterPlans: seed?.chapterPlans ?? [],
  aiMessages: seed?.aiMessages ?? [],
  contextBasket: seed?.contextBasket ?? [],
  geminiTaskType: seed?.geminiTaskType ?? 'global_design',
  geminiInstruction: seed?.geminiInstruction ?? buildPromptTemplate(seed?.geminiTaskType ?? 'global_design'),
  geminiDraftPayload: seed?.geminiDraftPayload ?? '',
  geminiResponseDraft: seed?.geminiResponseDraft ?? '',
  geminiRuns: seed?.geminiRuns ?? [],
  updatedAt: seed?.updatedAt ?? new Date().toISOString(),
});

const normalizeScopeType = (type: string | undefined): WritingScopeType => {
  if (type === 'all' || type === 'range' || type === 'single') {
    return type;
  }
  return 'all';
};

const normalizeWorkspace = (workspace: WritingWorkspace): WritingWorkspace => {
  const benchmarkNovels = workspace.benchmarkNovels || [];
  const chapterPlans = workspace.chapterPlans || [];
  const aiMessages = workspace.aiMessages || [];
  const contextBasket = workspace.contextBasket || [];
  const geminiRuns = workspace.geminiRuns || [];

  let selectedBenchmarkNovelId = workspace.selectedBenchmarkNovelId;
  if (!selectedBenchmarkNovelId || !benchmarkNovels.some(n => n.id === selectedBenchmarkNovelId)) {
    selectedBenchmarkNovelId = benchmarkNovels[0]?.id ?? null;
  }

  const activeBenchmarkNovel = selectedBenchmarkNovelId
    ? benchmarkNovels.find(n => n.id === selectedBenchmarkNovelId) || null
    : null;

  let selectedBenchmarkChapterId = workspace.selectedBenchmarkChapterId;
  if (!activeBenchmarkNovel) {
    selectedBenchmarkChapterId = null;
  } else if (
    selectedBenchmarkChapterId &&
    !activeBenchmarkNovel.chapters.some(ch => ch.id === selectedBenchmarkChapterId)
  ) {
    selectedBenchmarkChapterId = activeBenchmarkNovel.chapters[0]?.id ?? null;
  }

  let selectedChapterPlanId = workspace.selectedChapterPlanId;
  if (!selectedChapterPlanId || !chapterPlans.some(p => p.id === selectedChapterPlanId)) {
    selectedChapterPlanId = chapterPlans[0]?.id ?? null;
  }

  const roughPlan = {
    coarsePlot: workspace.roughPlan?.coarsePlot || '',
    stageOutline: workspace.roughPlan?.stageOutline || '',
    unresolvedQuestions: workspace.roughPlan?.unresolvedQuestions || '',
  };

  const normalizedScopeType = normalizeScopeType(workspace.planningScope?.type);
  const rangeStartChapter = Math.max(1, Number(workspace.planningScope?.rangeStartChapter || 1));
  const rangeEndChapter = Math.max(rangeStartChapter, Number(workspace.planningScope?.rangeEndChapter || rangeStartChapter));

  let scopeChapterPlanId = workspace.planningScope?.chapterPlanId ?? null;
  if (!scopeChapterPlanId || !chapterPlans.some(p => p.id === scopeChapterPlanId)) {
    scopeChapterPlanId = selectedChapterPlanId;
  }

  return {
    ...workspace,
    benchmarkNovels,
    roughPlan,
    chapterPlans,
    aiMessages,
    contextBasket,
    geminiRuns,
    planningScope: {
      type: normalizedScopeType,
      rangeStartChapter,
      rangeEndChapter,
      chapterPlanId: scopeChapterPlanId,
    },
    geminiTaskType: workspace.geminiTaskType || 'global_design',
    geminiInstruction: workspace.geminiInstruction || buildPromptTemplate(workspace.geminiTaskType || 'global_design'),
    geminiDraftPayload: workspace.geminiDraftPayload || '',
    geminiResponseDraft: workspace.geminiResponseDraft || '',
    selectedBenchmarkNovelId,
    selectedBenchmarkChapterId,
    selectedChapterPlanId,
  };
};

const mapNovelToSnapshotChapters = (sourceNovel: Novel): BenchmarkChapterSnapshot[] => {
  const normalizedText = (sourceNovel.text || '').replace(/\r\n|\r/g, '\n');
  const sourceChapters =
    sourceNovel.chapters && sourceNovel.chapters.length > 0
      ? sourceNovel.chapters
      : splitTextIntoChapters(normalizedText);

  return sourceChapters
    .slice()
    .sort((a, b) => a.originalStartIndex - b.originalStartIndex)
    .map(ch => ({
      id: generateId(),
      title: ch.title,
      content: ch.content,
      originalStartIndex: ch.originalStartIndex,
      originalEndIndex: ch.originalEndIndex,
      level: ch.level,
    }));
};

const shortTimeLabel = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};

const serializeContextBasket = (items: WritingContextBasketItem[]): string =>
  items
    .map((item, idx) => {
      return [
        `【素材${idx + 1}】`,
        `来源小说: ${item.sourceNovelTitle}`,
        `来源章节: ${item.sourceChapterTitle}`,
        '正文:',
        item.content,
      ].join('\n');
    })
    .join('\n\n');

const resolveScopeLabel = (
  workspace: WritingWorkspace,
  chapterPlans: WritingChapterPlan[]
): string => {
  if (workspace.planningScope.type === 'all') {
    return '全书';
  }
  if (workspace.planningScope.type === 'range') {
    return `${workspace.planningScope.rangeStartChapter}-${workspace.planningScope.rangeEndChapter}章`;
  }
  const chapterPlan = chapterPlans.find(item => item.id === workspace.planningScope.chapterPlanId);
  return chapterPlan
    ? `单章: 第${chapterPlan.chapterNumber}章 ${chapterPlan.title}`
    : '单章: 未绑定章节策划';
};


const WritingModeWorkspace: React.FC<WritingModeWorkspaceProps> = ({ novel, setNovels }) => {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [workspace, setWorkspace] = useState<WritingWorkspace>(() =>
    normalizeWorkspace(buildDefaultWorkspace(novel.writingWorkspace))
  );
  const [plannerTab, setPlannerTab] = useState<PlannerTab>('global');
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(WRITING_LEFT_WIDTH_STORAGE_KEY);
      const parsed = raw ? Number(raw) : NaN;
      if (!Number.isNaN(parsed) && parsed >= WRITING_LEFT_MIN) return parsed;
    } catch {
      // ignore
    }
    return 320;
  });
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(WRITING_RIGHT_WIDTH_STORAGE_KEY);
      const parsed = raw ? Number(raw) : NaN;
      if (!Number.isNaN(parsed) && parsed >= WRITING_RIGHT_MIN) return parsed;
    } catch {
      // ignore
    }
    return WRITING_RIGHT_WIDTH;
  });
  const [activeResizer, setActiveResizer] = useState<'left' | 'right' | null>(null);
  const [isImportToolsExpanded, setIsImportToolsExpanded] = useState(false);
  const [isBatchToolsExpanded, setIsBatchToolsExpanded] = useState(false);
  const [sourceNovels, setSourceNovels] = useState<Novel[]>([]);
  const [selectedSourceNovelId, setSelectedSourceNovelId] = useState<string>('');
  const [askInput, setAskInput] = useState('');
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [checkedChapterKeys, setCheckedChapterKeys] = useState<Set<string>>(new Set());
  const [rangeStart, setRangeStart] = useState<string>('1');
  const [rangeEnd, setRangeEnd] = useState<string>('3');

  const latestWorkspaceRef = useRef<WritingWorkspace>(workspace);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resizeStateRef = useRef<{ kind: 'left' | 'right'; startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    latestWorkspaceRef.current = workspace;
  }, [workspace]);

  useEffect(() => {
    const initial = normalizeWorkspace(buildDefaultWorkspace(novel.writingWorkspace));
    setWorkspace(initial);
    latestWorkspaceRef.current = initial;
    setPlannerTab('global');
    setSaveError(null);
    setLastSavedAt(null);
    setCheckedChapterKeys(new Set());
    setRangeStart('1');
    setRangeEnd('3');
    setIsImportToolsExpanded(false);
    setIsBatchToolsExpanded(false);
  }, [novel.id]);

  const clampLeftWidth = useCallback((proposed: number, currentRightWidth: number): number => {
    const containerWidth = workspaceRef.current?.offsetWidth ?? 1280;
    const max = Math.max(
      WRITING_LEFT_MIN,
      containerWidth - currentRightWidth - WRITING_MIDDLE_MIN - WRITING_RESIZER_WIDTH * 2
    );
    return Math.min(max, Math.max(WRITING_LEFT_MIN, proposed));
  }, []);

  const clampRightWidth = useCallback((proposed: number, currentLeftWidth: number): number => {
    const containerWidth = workspaceRef.current?.offsetWidth ?? 1280;
    const max = Math.max(
      WRITING_RIGHT_MIN,
      containerWidth - currentLeftWidth - WRITING_MIDDLE_MIN - WRITING_RESIZER_WIDTH * 2
    );
    return Math.min(max, Math.max(WRITING_RIGHT_MIN, proposed));
  }, []);

  useEffect(() => {
    const clamped = clampLeftWidth(leftPanelWidth, rightPanelWidth);
    if (clamped !== leftPanelWidth) {
      setLeftPanelWidth(clamped);
    }
  }, [leftPanelWidth, rightPanelWidth, clampLeftWidth]);

  useEffect(() => {
    const clamped = clampRightWidth(rightPanelWidth, leftPanelWidth);
    if (clamped !== rightPanelWidth) {
      setRightPanelWidth(clamped);
    }
  }, [leftPanelWidth, rightPanelWidth, clampRightWidth]);

  useEffect(() => {
    try {
      localStorage.setItem(WRITING_LEFT_WIDTH_STORAGE_KEY, String(Math.round(leftPanelWidth)));
    } catch {
      // ignore
    }
  }, [leftPanelWidth]);

  useEffect(() => {
    try {
      localStorage.setItem(WRITING_RIGHT_WIDTH_STORAGE_KEY, String(Math.round(rightPanelWidth)));
    } catch {
      // ignore
    }
  }, [rightPanelWidth]);

  const handleResizeMove = useCallback((event: MouseEvent) => {
    const state = resizeStateRef.current;
    if (!state) return;
    const delta = event.clientX - state.startX;
    if (state.kind === 'left') {
      setLeftPanelWidth(clampLeftWidth(state.startWidth + delta, rightPanelWidth));
      return;
    }
    setRightPanelWidth(clampRightWidth(state.startWidth - delta, leftPanelWidth));
  }, [clampLeftWidth, clampRightWidth, leftPanelWidth, rightPanelWidth]);

  const stopResizing = useCallback(() => {
    setActiveResizer(null);
    resizeStateRef.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', handleResizeMove);
  }, [handleResizeMove]);

  const startResizing = (kind: 'left' | 'right', event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    resizeStateRef.current = {
      kind,
      startX: event.clientX,
      startWidth: kind === 'left' ? leftPanelWidth : rightPanelWidth,
    };
    setActiveResizer(kind);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', stopResizing, { once: true });
  };

  const startResizingLeft = (event: React.MouseEvent<HTMLDivElement>) => {
    startResizing('left', event);
  };

  const startResizingRight = (event: React.MouseEvent<HTMLDivElement>) => {
    startResizing('right', event);
  };

  useEffect(() => {
    return () => {
      stopResizing();
      document.removeEventListener('mousemove', handleResizeMove);
    };
  }, [handleResizeMove, stopResizing]);

  useEffect(() => {
    let cancelled = false;
    const loadSources = async () => {
      setIsLoadingSources(true);
      try {
        const result = await novelsApi.getAll();
        if (cancelled) return;
        setSourceNovels(result.filter(item => item.id !== novel.id));
      } catch (error) {
        if (!cancelled) {
          console.error('[写作模式] 加载本地小说失败:', error);
        }
      } finally {
        if (!cancelled) setIsLoadingSources(false);
      }
    };

    loadSources();
    return () => {
      cancelled = true;
    };
  }, [novel.id]);

  const persistWorkspace = useCallback(
    async (candidate: WritingWorkspace) => {
      const payload: WritingWorkspace = {
        ...candidate,
        updatedAt: new Date().toISOString(),
      };

      setWorkspace(payload);
      latestWorkspaceRef.current = payload;
      setNovels(prev => prev.map(n => (n.id === novel.id ? { ...n, writingWorkspace: payload } : n)));
      setIsSaving(true);
      setSaveError(null);
      try {
        await novelsApi.update(novel.id, { writingWorkspace: payload });
        setLastSavedAt(payload.updatedAt);
      } catch (error) {
        const message = error instanceof Error ? error.message : '未知错误';
        setSaveError(message);
        console.error('[写作模式] 保存失败:', error);
      } finally {
        setIsSaving(false);
      }
    },
    [novel.id, setNovels]
  );

  const schedulePersist = useCallback(
    (next: WritingWorkspace) => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
      }
      persistTimerRef.current = setTimeout(() => {
        persistTimerRef.current = null;
        void persistWorkspace(latestWorkspaceRef.current);
      }, 450);
      latestWorkspaceRef.current = next;
      setWorkspace(next);
    },
    [persistWorkspace]
  );

  useEffect(() => {
    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      void persistWorkspace(latestWorkspaceRef.current);
    };
  }, [persistWorkspace]);

  const updateWorkspace = useCallback(
    (updater: (prev: WritingWorkspace) => WritingWorkspace, immediate: boolean = false) => {
      const current = latestWorkspaceRef.current;
      const next = normalizeWorkspace(updater(current));
      if (immediate) {
        void persistWorkspace(next);
        return;
      }
      schedulePersist(next);
    },
    [persistWorkspace, schedulePersist]
  );

  const importableSourceNovels = useMemo(() => {
    const importedSourceIds = new Set(workspace.benchmarkNovels.map(item => item.sourceNovelId));
    return sourceNovels.filter(item => !importedSourceIds.has(item.id));
  }, [sourceNovels, workspace.benchmarkNovels]);

  useEffect(() => {
    if (importableSourceNovels.length === 0) {
      if (selectedSourceNovelId !== '') setSelectedSourceNovelId('');
      return;
    }
    if (!importableSourceNovels.some(n => n.id === selectedSourceNovelId)) {
      setSelectedSourceNovelId(importableSourceNovels[0].id);
    }
  }, [importableSourceNovels, selectedSourceNovelId]);

  const selectedBenchmarkNovel = useMemo(() => {
    if (!workspace.selectedBenchmarkNovelId) return null;
    return workspace.benchmarkNovels.find(item => item.id === workspace.selectedBenchmarkNovelId) || null;
  }, [workspace.benchmarkNovels, workspace.selectedBenchmarkNovelId]);

  const selectedBenchmarkChapter = useMemo(() => {
    if (!selectedBenchmarkNovel || !workspace.selectedBenchmarkChapterId) return null;
    return selectedBenchmarkNovel.chapters.find(ch => ch.id === workspace.selectedBenchmarkChapterId) || null;
  }, [selectedBenchmarkNovel, workspace.selectedBenchmarkChapterId]);

  const isChapterFocused = Boolean(selectedBenchmarkChapter);

  const clearChapterFocus = () => {
    if (!workspace.selectedBenchmarkChapterId) return;
    updateWorkspace(prev => ({
      ...prev,
      selectedBenchmarkChapterId: null,
    }), true);
  };

  const selectedChapterPlan = useMemo(() => {
    if (!workspace.selectedChapterPlanId) return null;
    return workspace.chapterPlans.find(plan => plan.id === workspace.selectedChapterPlanId) || null;
  }, [workspace.chapterPlans, workspace.selectedChapterPlanId]);

  const scopeBoundChapterPlan = useMemo(() => {
    if (workspace.planningScope.type !== 'single') return selectedChapterPlan;
    if (!workspace.planningScope.chapterPlanId) return null;
    return workspace.chapterPlans.find(plan => plan.id === workspace.planningScope.chapterPlanId) || null;
  }, [
    selectedChapterPlan,
    workspace.chapterPlans,
    workspace.planningScope.chapterPlanId,
    workspace.planningScope.type,
  ]);

  const scopeLabel = useMemo(
    () => resolveScopeLabel(workspace, workspace.chapterPlans),
    [workspace]
  );

  const switchPlannerTab = (nextTab: PlannerTab) => {
    setPlannerTab(nextTab);
    const recommendedTask = TAB_TO_GEMINI_TASK[nextTab];
    if (workspace.geminiTaskType === 'custom' || workspace.geminiTaskType === recommendedTask) {
      return;
    }
    const currentTemplate = buildPromptTemplate(workspace.geminiTaskType);
    const shouldReplaceInstruction =
      !workspace.geminiInstruction.trim() || workspace.geminiInstruction.trim() === currentTemplate.trim();

    updateWorkspace(prev => ({
      ...prev,
      geminiTaskType: recommendedTask,
      geminiInstruction: shouldReplaceInstruction
        ? buildPromptTemplate(recommendedTask)
        : prev.geminiInstruction,
    }));
  };

  const handleImportBenchmarkNovel = async () => {
    if (!selectedSourceNovelId) return;
    try {
      const source = await novelsApi.getById(selectedSourceNovelId);
      const snapshot: BenchmarkNovelSnapshot = {
        id: generateId(),
        sourceNovelId: source.id,
        title: source.title,
        importedAt: new Date().toISOString(),
        chapters: mapNovelToSnapshotChapters(source),
      };

      updateWorkspace(prev => ({
        ...prev,
        benchmarkNovels: [...prev.benchmarkNovels, snapshot],
        selectedBenchmarkNovelId: snapshot.id,
        selectedBenchmarkChapterId: snapshot.chapters[0]?.id ?? null,
      }), true);
    } catch (error) {
      console.error('[写作模式] 导入对标小说失败:', error);
      alert(`导入失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleRemoveBenchmarkNovel = (benchmarkNovelId: string) => {
    const target = workspace.benchmarkNovels.find(item => item.id === benchmarkNovelId);
    if (!target) return;
    if (!window.confirm(`确定移除对标小说「${target.title}」吗？`)) return;

    setCheckedChapterKeys(prev => {
      const next = new Set<string>();
      prev.forEach(key => {
        if (!key.startsWith(`${benchmarkNovelId}::`)) next.add(key);
      });
      return next;
    });

    updateWorkspace(prev => ({
      ...prev,
      benchmarkNovels: prev.benchmarkNovels.filter(item => item.id !== benchmarkNovelId),
      contextBasket: prev.contextBasket.filter(item => item.sourceBenchmarkNovelId !== benchmarkNovelId),
      selectedBenchmarkNovelId:
        prev.selectedBenchmarkNovelId === benchmarkNovelId ? null : prev.selectedBenchmarkNovelId,
      selectedBenchmarkChapterId:
        prev.selectedBenchmarkNovelId === benchmarkNovelId ? null : prev.selectedBenchmarkChapterId,
    }), true);
  };

  const handleBenchmarkChapterContentChange = (content: string) => {
    if (!workspace.selectedBenchmarkNovelId || !workspace.selectedBenchmarkChapterId) return;
    const targetNovelId = workspace.selectedBenchmarkNovelId;
    const targetChapterId = workspace.selectedBenchmarkChapterId;

    updateWorkspace(prev => ({
      ...prev,
      benchmarkNovels: prev.benchmarkNovels.map(item => {
        if (item.id !== targetNovelId) return item;
        return {
          ...item,
          chapters: item.chapters.map(ch =>
            ch.id === targetChapterId
              ? {
                  ...ch,
                  content,
                  originalEndIndex: ch.originalStartIndex + content.length,
                }
              : ch
          ),
        };
      }),
    }));
  };

  const toggleChapterChecked = (benchmarkNovelId: string, chapterId: string) => {
    const key = chapterSelectionKey(benchmarkNovelId, chapterId);
    setCheckedChapterKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSelectRangeForCurrentNovel = () => {
    if (!selectedBenchmarkNovel || selectedBenchmarkNovel.chapters.length === 0) return;
    const start = Math.max(1, Number(rangeStart || '1'));
    const end = Math.max(1, Number(rangeEnd || '1'));
    const from = Math.min(start, end);
    const to = Math.max(start, end);

    const sorted = selectedBenchmarkNovel.chapters
      .slice()
      .sort((a, b) => a.originalStartIndex - b.originalStartIndex);

    const slice = sorted.slice(from - 1, to);
    if (slice.length === 0) return;

    setCheckedChapterKeys(prev => {
      const next = new Set(prev);
      slice.forEach(ch => next.add(chapterSelectionKey(selectedBenchmarkNovel.id, ch.id)));
      return next;
    });
  };

  const handleClearCheckedChapters = () => {
    setCheckedChapterKeys(new Set());
  };

  const handleAddCheckedChaptersToBasket = () => {
    if (checkedChapterKeys.size === 0) return;

    updateWorkspace(prev => {
      const exists = new Set(
        prev.contextBasket.map(item =>
          chapterSelectionKey(item.sourceBenchmarkNovelId, item.sourceBenchmarkChapterId)
        )
      );
      const toAdd: WritingContextBasketItem[] = [];

      const novels = prev.benchmarkNovels
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN'));

      novels.forEach(book => {
        const chapters = book.chapters
          .slice()
          .sort((a, b) => a.originalStartIndex - b.originalStartIndex);

        chapters.forEach(ch => {
          const key = chapterSelectionKey(book.id, ch.id);
          if (!checkedChapterKeys.has(key) || exists.has(key)) return;
          toAdd.push({
            id: generateId(),
            sourceBenchmarkNovelId: book.id,
            sourceBenchmarkChapterId: ch.id,
            sourceNovelTitle: book.title,
            sourceChapterTitle: ch.title,
            content: ch.content,
            addedAt: new Date().toISOString(),
          });
          exists.add(key);
        });
      });

      if (toAdd.length === 0) return prev;
      return {
        ...prev,
        contextBasket: [...prev.contextBasket, ...toAdd],
      };
    }, true);
  };

  const moveBasketItem = (itemId: string, direction: -1 | 1) => {
    updateWorkspace(prev => {
      const idx = prev.contextBasket.findIndex(item => item.id === itemId);
      if (idx === -1) return prev;
      const targetIdx = idx + direction;
      if (targetIdx < 0 || targetIdx >= prev.contextBasket.length) return prev;

      const next = [...prev.contextBasket];
      const [item] = next.splice(idx, 1);
      next.splice(targetIdx, 0, item);
      return { ...prev, contextBasket: next };
    }, true);
  };

  const removeBasketItem = (itemId: string) => {
    updateWorkspace(prev => ({
      ...prev,
      contextBasket: prev.contextBasket.filter(item => item.id !== itemId),
    }), true);
  };

  const clearBasket = () => {
    if (workspace.contextBasket.length === 0) return;
    if (!window.confirm('确定清空素材篮吗？')) return;
    updateWorkspace(prev => ({ ...prev, contextBasket: [] }), true);
  };

  const resolveGeminiInstruction = (taskType: GeminiTaskType, customInstruction: string): string => {
    if (customInstruction.trim()) return customInstruction.trim();
    return buildPromptTemplate(taskType);
  };

  const buildGeminiPayload = (
    instruction: string,
    contextBasket: WritingContextBasketItem[]
  ): string => {
    const materialsText = contextBasket.length > 0 ? serializeContextBasket(contextBasket) : '（当前素材篮为空）';
    const chapterSummary =
      contextBasket.length > 0
        ? contextBasket.map((item, index) => `${index + 1}. ${item.sourceNovelTitle}/${item.sourceChapterTitle}`).join('\n')
        : '（未选择章节）';

    return [
      instruction.trim(),
      '',
      '参考章节:',
      chapterSummary,
      '',
      '参考正文:',
      materialsText,
    ].join('\n');
  };

  const effectiveGeminiInstruction = useMemo(
    () => resolveGeminiInstruction(workspace.geminiTaskType, workspace.geminiInstruction),
    [workspace.geminiInstruction, workspace.geminiTaskType]
  );

  const autoGeminiPayload = useMemo(
    () => buildGeminiPayload(effectiveGeminiInstruction, workspace.contextBasket),
    [effectiveGeminiInstruction, workspace.contextBasket]
  );

  const handleGenerateGeminiPayload = () => {
    if (workspace.contextBasket.length === 0) {
      alert('素材篮为空，请先勾选章节并加入素材篮。');
      return;
    }

    const payload = autoGeminiPayload;
    const run: WritingGeminiRun = {
      id: generateId(),
      taskType: workspace.geminiTaskType,
      instruction: effectiveGeminiInstruction,
      contextItemIds: workspace.contextBasket.map(item => item.id),
      payload,
      createdAt: new Date().toISOString(),
    };

    updateWorkspace(prev => ({
      ...prev,
      geminiDraftPayload: payload,
      geminiRuns: [run, ...prev.geminiRuns].slice(0, 30),
    }), true);
  };

  const handleCopyGeminiPayload = async () => {
    if (workspace.contextBasket.length === 0) {
      alert('素材篮为空，请先勾选章节并加入素材篮。');
      return;
    }
    const content = autoGeminiPayload.trim();
    if (!content) {
      alert('当前发送包为空，请先填写提示词或选择章节。');
      return;
    }

    try {
      await navigator.clipboard.writeText(content);
      alert('发送文本已复制，可直接粘贴到 Gemini。');
    } catch (error) {
      console.error('[写作模式] 复制失败:', error);
      alert('复制失败，请手动复制。');
    }
  };

  const handleSaveGeminiResponse = () => {
    const response = workspace.geminiResponseDraft.trim();
    if (!response) return;

    const assistantMessage: WritingAiMessage = {
      id: generateId(),
      role: 'assistant',
      content: response,
      createdAt: new Date().toISOString(),
    };

    updateWorkspace(prev => {
      const runs = [...prev.geminiRuns];
      if (runs.length > 0 && !runs[0].response) {
        runs[0] = { ...runs[0], response };
      }

      const baseNext: WritingWorkspace = {
        ...prev,
        aiMessages: [...prev.aiMessages, assistantMessage],
        geminiRuns: runs,
        geminiResponseDraft: '',
      };

      if (!prev.selectedBenchmarkNovelId || !prev.selectedBenchmarkChapterId) {
        return {
          ...baseNext,
          globalPlan: {
            ...prev.globalPlan,
            globalStoryline: prev.globalPlan.globalStoryline
              ? `${prev.globalPlan.globalStoryline}\n\n${response}`
              : response,
          },
        };
      }

      const nextBenchmarkNovels = prev.benchmarkNovels.map(book => {
        if (book.id !== prev.selectedBenchmarkNovelId) return book;
        return {
          ...book,
          chapters: book.chapters.map(ch => {
            if (ch.id !== prev.selectedBenchmarkChapterId) return ch;
            const nextContent = ch.content ? `${ch.content}\n\n${response}` : response;
            return {
              ...ch,
              content: nextContent,
              originalEndIndex: ch.originalStartIndex + nextContent.length,
            };
          }),
        };
      });

      return {
        ...baseNext,
        benchmarkNovels: nextBenchmarkNovels,
      };
    }, true);
  };

  const handleLoadGeminiRun = (run: WritingGeminiRun) => {
    updateWorkspace(prev => ({
      ...prev,
      geminiTaskType: run.taskType,
      geminiInstruction: run.instruction,
      geminiDraftPayload: run.payload,
      geminiResponseDraft: run.response || '',
    }), true);
  };

  const handleApplyPromptTemplate = () => {
    const template = buildPromptTemplate(workspace.geminiTaskType);
    updateWorkspace(prev => ({
      ...prev,
      geminiInstruction: template,
    }), true);
  };

  const handleGlobalPlanFieldChange = (
    field: keyof WritingWorkspace['globalPlan'],
    value: string
  ) => {
    updateWorkspace(prev => ({
      ...prev,
      globalPlan: {
        ...prev.globalPlan,
        [field]: value,
      },
    }));
  };

  const handleRoughPlanFieldChange = (
    field: keyof WritingWorkspace['roughPlan'],
    value: string
  ) => {
    updateWorkspace(prev => ({
      ...prev,
      roughPlan: {
        ...prev.roughPlan,
        [field]: value,
      },
    }));
  };

  const handleScopeTypeChange = (type: WritingScopeType) => {
    updateWorkspace(prev => ({
      ...prev,
      planningScope: {
        ...prev.planningScope,
        type,
        chapterPlanId:
          type === 'single'
            ? prev.planningScope.chapterPlanId || prev.selectedChapterPlanId || prev.chapterPlans[0]?.id || null
            : prev.planningScope.chapterPlanId,
      },
    }), true);
  };

  const handleScopeRangeChange = (field: 'rangeStartChapter' | 'rangeEndChapter', rawValue: string) => {
    const parsed = Math.max(1, Number(rawValue || '1'));
    updateWorkspace(prev => {
      const nextScope = { ...prev.planningScope, [field]: parsed };
      if (field === 'rangeStartChapter' && nextScope.rangeEndChapter < parsed) {
        nextScope.rangeEndChapter = parsed;
      }
      if (field === 'rangeEndChapter' && parsed < nextScope.rangeStartChapter) {
        nextScope.rangeStartChapter = parsed;
      }
      return {
        ...prev,
        planningScope: nextScope,
      };
    });
  };

  const handleScopeChapterPlanChange = (chapterPlanId: string) => {
    updateWorkspace(prev => ({
      ...prev,
      planningScope: {
        ...prev.planningScope,
        chapterPlanId: chapterPlanId || null,
      },
      selectedChapterPlanId: chapterPlanId || prev.selectedChapterPlanId,
    }), true);
  };

  const resetGlobalPlan = () => {
    if (!window.confirm('确定清空全局人设与主线内容吗？')) return;
    updateWorkspace(prev => ({
      ...prev,
      globalPlan: {
        premiseAndCast: '',
        globalStoryline: '',
        worldRules: '',
      },
    }), true);
  };

  const bootstrapRoughFromGlobal = () => {
    const globalInfo = workspace.globalPlan;
    const nextCoarsePlot = [
      '【从全局方案生成的粗糙剧情初稿】',
      `核心人设: ${globalInfo.premiseAndCast || '（待补充）'}`,
      `主线目标: ${globalInfo.globalStoryline || '（待补充）'}`,
      `世界规则: ${globalInfo.worldRules || '（待补充）'}`,
      '',
      '建议按阶段拆成 3-5 段推进，并补充每段的冲突升级与阶段钩子。',
    ].join('\n');

    updateWorkspace(prev => ({
      ...prev,
      roughPlan: {
        coarsePlot: nextCoarsePlot,
        stageOutline: prev.roughPlan.stageOutline,
        unresolvedQuestions: prev.roughPlan.unresolvedQuestions,
      },
    }), true);
  };

  const resetRoughPlan = () => {
    if (!window.confirm('确定清空粗糙剧情模块吗？')) return;
    updateWorkspace(prev => ({
      ...prev,
      roughPlan: {
        coarsePlot: '',
        stageOutline: '',
        unresolvedQuestions: '',
      },
    }), true);
  };

  const bootstrapChapterPlanFromUpstream = () => {
    if (!workspace.selectedChapterPlanId) return;

    updateWorkspace(prev => {
      const targetId = prev.selectedChapterPlanId;
      const scopeHint = resolveScopeLabel(prev, prev.chapterPlans);
      return {
        ...prev,
        chapterPlans: prev.chapterPlans.map(plan => {
          if (plan.id !== targetId) return plan;
          return {
            ...plan,
            cast: plan.cast || prev.globalPlan.premiseAndCast,
            beatOutline: [
              plan.beatOutline,
              '【从上游生成的章节细化初稿】',
              `作用范围: ${scopeHint}`,
              `粗糙剧情参考: ${prev.roughPlan.coarsePlot || '（待补充）'}`,
              `阶段推进参考: ${prev.roughPlan.stageOutline || '（待补充）'}`,
            ]
              .filter(Boolean)
              .join('\n'),
          };
        }),
      };
    }, true);
  };

  const resetSelectedChapterPlanDetail = () => {
    if (!workspace.selectedChapterPlanId) return;
    if (!window.confirm('确定清空当前章节的细化内容吗？')) return;

    updateWorkspace(prev => ({
      ...prev,
      chapterPlans: prev.chapterPlans.map(plan =>
        plan.id === prev.selectedChapterPlanId
          ? {
              ...plan,
              cast: '',
              beatOutline: '',
              keyLines: '',
            }
          : plan
      ),
    }), true);
  };

  const bootstrapDraftFromChapterPlan = () => {
    if (!workspace.selectedChapterPlanId) return;
    updateWorkspace(prev => ({
      ...prev,
      chapterPlans: prev.chapterPlans.map(plan => {
        if (plan.id !== prev.selectedChapterPlanId) return plan;
        const draftTemplate = [
          `【第${plan.chapterNumber}章 ${plan.title}】`,
          `作用范围: ${resolveScopeLabel(prev, prev.chapterPlans)}`,
          '',
          `出场人物: ${plan.cast || '（待补充）'}`,
          `剧情节拍: ${plan.beatOutline || '（待补充）'}`,
          `关键台词: ${plan.keyLines || '（待补充）'}`,
          '',
          '正文:',
        ].join('\n');
        return {
          ...plan,
          draftText: draftTemplate,
          status: plan.status === 'done' ? 'done' : 'writing',
        };
      }),
    }), true);
  };

  const resetSelectedDraft = () => {
    if (!workspace.selectedChapterPlanId) return;
    if (!window.confirm('确定清空当前章节正文草稿吗？')) return;
    updateWorkspace(prev => ({
      ...prev,
      chapterPlans: prev.chapterPlans.map(plan =>
        plan.id === prev.selectedChapterPlanId
          ? {
              ...plan,
              draftText: '',
            }
          : plan
      ),
    }), true);
  };

  const handleCreateChapterPlan = () => {
    updateWorkspace(prev => {
      const maxChapterNumber = prev.chapterPlans.reduce((max, item) => Math.max(max, item.chapterNumber), 0);
      const nextChapterNumber = maxChapterNumber + 1;
      const newPlan: WritingChapterPlan = {
        id: generateId(),
        chapterNumber: nextChapterNumber,
        title: `第${nextChapterNumber}章`,
        cast: '',
        beatOutline: '',
        keyLines: '',
        draftText: '',
        status: 'planning',
      };
      return {
        ...prev,
        chapterPlans: [...prev.chapterPlans, newPlan],
        selectedChapterPlanId: newPlan.id,
      };
    }, true);
  };

  const handleDeleteChapterPlan = (planId: string) => {
    const target = workspace.chapterPlans.find(item => item.id === planId);
    if (!target) return;
    if (!window.confirm(`确定删除章节策划「${target.title}」吗？`)) return;

    updateWorkspace(prev => ({
      ...prev,
      chapterPlans: prev.chapterPlans.filter(item => item.id !== planId),
      selectedChapterPlanId:
        prev.selectedChapterPlanId === planId ? null : prev.selectedChapterPlanId,
    }), true);
  };

  const handleChapterPlanFieldChange = (
    field: keyof WritingChapterPlan,
    value: string | number
  ) => {
    if (!workspace.selectedChapterPlanId) return;
    const selectedPlanId = workspace.selectedChapterPlanId;

    updateWorkspace(prev => ({
      ...prev,
      chapterPlans: prev.chapterPlans.map(item =>
        item.id === selectedPlanId
          ? {
              ...item,
              [field]: value,
            }
          : item
      ),
    }));
  };

  const handleAddUserMessage = () => {
    const content = askInput.trim();
    if (!content) return;

    const message: WritingAiMessage = {
      id: generateId(),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };

    setAskInput('');
    updateWorkspace(prev => ({
      ...prev,
      aiMessages: [...prev.aiMessages, message],
    }), true);
  };

  const handleGenerateAssistantMessage = () => {
    const benchmarkExcerpt = selectedBenchmarkChapter
      ? selectedBenchmarkChapter.content.replace(/\s+/g, ' ').slice(0, 120)
      : '未选择对标章节';
    const chapterPlanHint = scopeBoundChapterPlan
      ? `第${scopeBoundChapterPlan.chapterNumber}章 ${scopeBoundChapterPlan.title}`
      : '未选择章节策划';

    const content =
      plannerTab === 'global'
        ? `建议先确认主角核心欲望与代价，再按“三段推进”定义主线。对标片段参考：${benchmarkExcerpt}`
        : plannerTab === 'rough'
          ? `建议把主线拆成阶段推进：阶段目标 -> 阻碍 -> 反转 -> 阶段钩子。当前范围：${scopeLabel}。对标片段参考：${benchmarkExcerpt}`
        : plannerTab === 'chapter'
          ? `建议补齐本章冲突链：目标 -> 阻碍 -> 反转 -> 结尾钩子。当前章节：${chapterPlanHint}。对标片段参考：${benchmarkExcerpt}`
          : `建议正文先写“场景目标 + 冲突动作 + 结果反应”，再补细节对白。当前章节：${chapterPlanHint}。`;

    const message: WritingAiMessage = {
      id: generateId(),
      role: 'assistant',
      content,
      createdAt: new Date().toISOString(),
    };

    updateWorkspace(prev => ({
      ...prev,
      aiMessages: [...prev.aiMessages, message],
    }), true);
  };

  const handleAcceptAssistantMessage = (messageId: string) => {
    const targetMessage = workspace.aiMessages.find(m => m.id === messageId && m.role === 'assistant');
    if (!targetMessage) return;

    updateWorkspace(prev => {
      const nextMessages = prev.aiMessages.map(item =>
        item.id === messageId ? { ...item, accepted: true } : item
      );

      if (plannerTab === 'global') {
        return {
          ...prev,
          aiMessages: nextMessages,
          globalPlan: {
            ...prev.globalPlan,
            globalStoryline: prev.globalPlan.globalStoryline
              ? `${prev.globalPlan.globalStoryline}\n\n${targetMessage.content}`
              : targetMessage.content,
          },
        };
      }

      if (plannerTab === 'rough') {
        return {
          ...prev,
          aiMessages: nextMessages,
          roughPlan: {
            ...prev.roughPlan,
            coarsePlot: prev.roughPlan.coarsePlot
              ? `${prev.roughPlan.coarsePlot}\n\n${targetMessage.content}`
              : targetMessage.content,
          },
        };
      }

      if (!prev.selectedChapterPlanId) {
        return { ...prev, aiMessages: nextMessages };
      }

      const selectedPlanId = prev.selectedChapterPlanId;
      return {
        ...prev,
        aiMessages: nextMessages,
        chapterPlans: prev.chapterPlans.map(plan => {
          if (plan.id !== selectedPlanId) return plan;
          if (plannerTab === 'chapter') {
            return {
              ...plan,
              beatOutline: plan.beatOutline
                ? `${plan.beatOutline}\n\n${targetMessage.content}`
                : targetMessage.content,
            };
          }
          return {
            ...plan,
            draftText: plan.draftText
              ? `${plan.draftText}\n\n${targetMessage.content}`
              : targetMessage.content,
          };
        }),
      };
    }, true);
  };

  const saveStatusText = useMemo(() => {
    if (saveError) return `保存失败: ${saveError}`;
    if (isSaving) return '保存中...';
    if (lastSavedAt) return `已保存 ${shortTimeLabel(lastSavedAt)}`;
    return '自动保存已开启';
  }, [isSaving, lastSavedAt, saveError]);

  return (
    <WorkspaceContainer ref={workspaceRef}>
      <Panel style={{ flex: `0 0 ${leftPanelWidth}px`, width: leftPanelWidth }}>
        <SectionTitle>对标小说库</SectionTitle>
        <InlineGroup style={{ justifyContent: 'space-between', marginBottom: SPACING.sm }}>
          <Muted>{workspace.benchmarkNovels.length} 本对标小说</Muted>
          <InlineGroup>
            <Button
              type="button"
              $variant="secondary"
              onClick={() => setIsImportToolsExpanded(prev => !prev)}
            >
              {isImportToolsExpanded ? '收起导入' : '导入工具'}
            </Button>
            <Button
              type="button"
              $variant="secondary"
              onClick={() => setIsBatchToolsExpanded(prev => !prev)}
            >
              {isBatchToolsExpanded ? '收起批量' : '批量勾选'}
            </Button>
          </InlineGroup>
        </InlineGroup>

        {isImportToolsExpanded && (
          <Card>
            <BlockTitle>从本地已导入小说添加</BlockTitle>
            <InlineGroup style={{ marginBottom: SPACING.sm }}>
              <Select
                value={selectedSourceNovelId}
                onChange={(e) => setSelectedSourceNovelId(e.target.value)}
                disabled={isLoadingSources || importableSourceNovels.length === 0}
                aria-label="选择待导入的对标小说"
              >
                {importableSourceNovels.length === 0 ? (
                  <option value="">无可导入小说</option>
                ) : (
                  importableSourceNovels.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))
                )}
              </Select>
              <Button
                type="button"
                onClick={handleImportBenchmarkNovel}
                disabled={!selectedSourceNovelId || isLoadingSources}
              >
                导入
              </Button>
            </InlineGroup>
            <Muted>{isLoadingSources ? '正在加载本地小说...' : '仅导入到当前项目的写作模式工作区。'}</Muted>
          </Card>
        )}

        <Card>
          <InlineGroup style={{ justifyContent: 'space-between', marginBottom: SPACING.sm }}>
            <BlockTitle style={{ margin: 0 }}>已导入对标小说</BlockTitle>
            <Muted>{workspace.benchmarkNovels.length} 本</Muted>
          </InlineGroup>
          <ListBox style={{ maxHeight: 128 }}>
            {workspace.benchmarkNovels.length === 0 ? (
              <Muted style={{ padding: SPACING.sm }}>暂无对标小说</Muted>
            ) : (
              workspace.benchmarkNovels.map(item => (
                <ItemButton
                  key={item.id}
                  $active={item.id === selectedBenchmarkNovel?.id}
                  onClick={() =>
                    updateWorkspace(prev => ({
                      ...prev,
                      selectedBenchmarkNovelId: item.id,
                      selectedBenchmarkChapterId: item.chapters[0]?.id ?? null,
                    }), true)
                  }
                  type="button"
                >
                  <div style={{ fontWeight: 600 }}>{item.title}</div>
                  <InlineGroup style={{ justifyContent: 'space-between', marginTop: SPACING.xs }}>
                    <Muted>{item.chapters.length} 章</Muted>
                    <Button
                      $variant="danger"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveBenchmarkNovel(item.id);
                      }}
                    >
                      移除
                    </Button>
                  </InlineGroup>
                </ItemButton>
              ))
            )}
          </ListBox>
        </Card>

        {isBatchToolsExpanded && (
          <Card>
            <BlockTitle>章节批量勾选</BlockTitle>
            <CompactToolbar>
              <NumberInput
                type="number"
                min={1}
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                aria-label="起始章节序号"
              />
              <Muted>到</Muted>
              <NumberInput
                type="number"
                min={1}
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                aria-label="结束章节序号"
              />
              <Button type="button" $variant="secondary" onClick={handleSelectRangeForCurrentNovel}>
                勾选范围
              </Button>
              <Button type="button" $variant="secondary" onClick={handleClearCheckedChapters}>
                清空
              </Button>
              <Button type="button" onClick={handleAddCheckedChaptersToBasket} disabled={checkedChapterKeys.size === 0}>
                加入素材篮({checkedChapterKeys.size})
              </Button>
            </CompactToolbar>
          </Card>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <InlineGroup style={{ justifyContent: 'space-between', marginBottom: SPACING.sm }}>
            <BlockTitle style={{ margin: 0 }}>章节列表</BlockTitle>
            <InlineGroup>
              <Muted>已勾选 {checkedChapterKeys.size} 章</Muted>
              <Button
                type="button"
                $variant="secondary"
                onClick={handleAddCheckedChaptersToBasket}
                disabled={checkedChapterKeys.size === 0}
              >
                加入素材篮
              </Button>
            </InlineGroup>
          </InlineGroup>
          <ListBox
            style={{ flex: 1, minHeight: 0 }}
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                clearChapterFocus();
              }
            }}
          >
            {!selectedBenchmarkNovel || selectedBenchmarkNovel.chapters.length === 0 ? (
              <Muted style={{ padding: SPACING.sm }}>请选择一部对标小说</Muted>
            ) : (
              selectedBenchmarkNovel.chapters.map(ch => {
                const checked = checkedChapterKeys.has(chapterSelectionKey(selectedBenchmarkNovel.id, ch.id));
                return (
                  <ItemButton
                    key={ch.id}
                    $active={ch.id === selectedBenchmarkChapter?.id}
                    onClick={() =>
                      updateWorkspace(prev => ({
                        ...prev,
                        selectedBenchmarkChapterId: ch.id,
                      }), true)
                    }
                    type="button"
                  >
                    <InlineGroup style={{ justifyContent: 'space-between', width: '100%' }}>
                      <InlineGroup>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleChapterChecked(selectedBenchmarkNovel.id, ch.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span>{ch.title}</span>
                      </InlineGroup>
                    </InlineGroup>
                  </ItemButton>
                );
              })
            )}
          </ListBox>
          <Muted style={{ marginTop: SPACING.xs }}>点击列表空白处可返回全局主线视图</Muted>
        </div>
      </Panel>

      <LeftCenterResizer
        $active={activeResizer === 'left'}
        onMouseDown={startResizingLeft}
        role="separator"
        aria-label="调整对标小说库和写作工作台宽度"
      >
        <ResizerGrip>•••</ResizerGrip>
      </LeftCenterResizer>

      <Panel style={{ flex: 1, minWidth: 0 }}>
        <SectionTitle>写作工作台</SectionTitle>
        <Card style={{ marginBottom: SPACING.sm }}>
          <InlineGroup style={{ justifyContent: 'space-between' }}>
            <BlockTitle style={{ margin: 0 }}>
              {isChapterFocused
                ? `本章视图 · ${selectedBenchmarkChapter?.title || ''}`
                : '全局人设主线视图'}
            </BlockTitle>
            {isChapterFocused ? (
              <Button type="button" $variant="secondary" onClick={clearChapterFocus}>
                返回全局
              </Button>
            ) : (
              <Muted>未选择章节时默认显示全局主线</Muted>
            )}
          </InlineGroup>
        </Card>

        {isChapterFocused ? (
          <Card>
            <BlockTitle>本章内容</BlockTitle>
            <TextArea
              style={{ minHeight: 460 }}
              value={selectedBenchmarkChapter?.content || ''}
              onChange={(e) => handleBenchmarkChapterContentChange(e.target.value)}
              placeholder="在这里编辑当前章节内容..."
            />
          </Card>
        ) : (
          <Card>
            <InlineGroup style={{ justifyContent: 'space-between', marginBottom: SPACING.sm }}>
              <BlockTitle style={{ margin: 0 }}>全局人设主线（Gemini回填）</BlockTitle>
              <Button type="button" $variant="secondary" onClick={resetGlobalPlan}>
                清空
              </Button>
            </InlineGroup>
            <TextArea
              style={{ minHeight: 460 }}
              value={workspace.globalPlan.globalStoryline}
              onChange={(e) => handleGlobalPlanFieldChange('globalStoryline', e.target.value)}
              placeholder="这里主要保留你从 Gemini 回填后的全局主线内容..."
            />
          </Card>
        )}

        <Card>
          <BlockTitle>粘贴 Gemini 回复</BlockTitle>
          <SmallTextArea
            value={workspace.geminiResponseDraft}
            onChange={(e) =>
              updateWorkspace(prev => ({
                ...prev,
                geminiResponseDraft: e.target.value,
              }))
            }
            placeholder="把 Gemini 的回复粘贴到这里，然后写入当前中间视图。"
          />
          <InlineGroup style={{ justifyContent: 'space-between', marginTop: SPACING.sm }}>
            <Button type="button" $variant="secondary" onClick={handleSaveGeminiResponse} disabled={!workspace.geminiResponseDraft.trim()}>
              {isChapterFocused ? '写入本章内容' : '写入全局主线'}
            </Button>
            <Muted>
              {isChapterFocused ? '会追加到本章正文并保留 AI 消息记录' : '会追加到全局主线并保留 AI 消息记录'}
            </Muted>
          </InlineGroup>
        </Card>
      </Panel>

      <LeftCenterResizer
        $active={activeResizer === 'right'}
        onMouseDown={startResizingRight}
        role="separator"
        aria-label="调整写作工作台和AI面板宽度"
      >
        <ResizerGrip>•••</ResizerGrip>
      </LeftCenterResizer>

      <RightPanel style={{ flex: `0 0 ${rightPanelWidth}px`, width: rightPanelWidth }}>
        <SectionTitle>AI讨论与决策</SectionTitle>

        <Card>
          <InlineGroup style={{ justifyContent: 'space-between', marginBottom: SPACING.sm }}>
            <BlockTitle style={{ margin: 0 }}>素材篮</BlockTitle>
            <Muted>{workspace.contextBasket.length} 条</Muted>
          </InlineGroup>
          <ListBox style={{ maxHeight: 170, marginBottom: SPACING.sm }}>
            {workspace.contextBasket.length === 0 ? (
              <Muted style={{ padding: SPACING.sm }}>还没有素材。先在左栏勾选章节并加入素材篮。</Muted>
            ) : (
              workspace.contextBasket.map((item, idx) => (
                <ItemButton key={item.id} type="button">
                  <div style={{ fontWeight: 600, marginBottom: SPACING.xs }}>
                    {idx + 1}. {item.sourceNovelTitle} / {item.sourceChapterTitle}
                  </div>
                  <InlineGroup style={{ justifyContent: 'space-between' }}>
                    <Muted>{item.content.length} 字</Muted>
                    <InlineGroup>
                      <Button
                        type="button"
                        $variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveBasketItem(item.id, -1);
                        }}
                      >
                        ↑
                      </Button>
                      <Button
                        type="button"
                        $variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveBasketItem(item.id, 1);
                        }}
                      >
                        ↓
                      </Button>
                      <Button
                        type="button"
                        $variant="danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeBasketItem(item.id);
                        }}
                      >
                        删
                      </Button>
                    </InlineGroup>
                  </InlineGroup>
                </ItemButton>
              ))
            )}
          </ListBox>
          <InlineGroup style={{ justifyContent: 'space-between' }}>
            <Button type="button" $variant="secondary" onClick={clearBasket}>
              清空素材篮
            </Button>
            <Muted>发送包会自动同步</Muted>
          </InlineGroup>
        </Card>

        <Card>
          <BlockTitle>Gemini 发送包</BlockTitle>
          <label style={labelStyle}>任务类型</label>
          <Select
            value={workspace.geminiTaskType}
            onChange={(e) =>
              updateWorkspace(prev => ({
                ...prev,
                geminiTaskType: e.target.value as GeminiTaskType,
              }))
            }
          >
            {Object.entries(GEMINI_TASK_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <div style={{ height: SPACING.sm }} />
          <InlineGroup style={{ justifyContent: 'space-between', marginBottom: SPACING.xs }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>提示词（可编辑，内嵌来源平台）</label>
            <Button type="button" $variant="secondary" onClick={handleApplyPromptTemplate}>
              填入模板
            </Button>
          </InlineGroup>
          <SmallTextArea
            value={workspace.geminiInstruction}
            onChange={(e) =>
              updateWorkspace(prev => ({
                ...prev,
                geminiInstruction: e.target.value,
              }))
            }
            placeholder={buildPromptTemplate(workspace.geminiTaskType)}
          />
          <div style={{ height: SPACING.sm }} />
          <label style={labelStyle}>发送文本预览</label>
          <TextArea
            style={{ minHeight: 220 }}
            value={autoGeminiPayload}
            readOnly
            placeholder="填写提示词并勾选章节后，这里会自动生成发送包。"
          />
          <InlineGroup style={{ justifyContent: 'space-between', marginTop: SPACING.sm }}>
            <Button type="button" onClick={handleGenerateGeminiPayload} disabled={workspace.contextBasket.length === 0}>
              记录到发送历史
            </Button>
            <Button type="button" $variant="secondary" onClick={handleCopyGeminiPayload}>
              复制到剪贴板
            </Button>
          </InlineGroup>
        </Card>

        <Card>
          <InlineGroup style={{ justifyContent: 'space-between', marginBottom: SPACING.sm }}>
            <BlockTitle style={{ margin: 0 }}>发送包历史</BlockTitle>
            <Muted>{workspace.geminiRuns.length} 条</Muted>
          </InlineGroup>
          <ListBox style={{ maxHeight: 130 }}>
            {workspace.geminiRuns.length === 0 ? (
              <Muted style={{ padding: SPACING.sm }}>暂无历史</Muted>
            ) : (
              workspace.geminiRuns.slice(0, 10).map(run => (
                <ItemButton key={run.id} type="button" onClick={() => handleLoadGeminiRun(run)}>
                  <InlineGroup style={{ justifyContent: 'space-between' }}>
                    <span>{shortTimeLabel(run.createdAt)} · {GEMINI_TASK_LABELS[run.taskType]}</span>
                    <Muted>{run.contextItemIds.length} 素材</Muted>
                  </InlineGroup>
                </ItemButton>
              ))
            )}
          </ListBox>
        </Card>

        <Divider />

        <ChatList>
          {workspace.aiMessages.length === 0 ? (
            <Muted>还没有讨论记录。你可以先提问，再用“模拟AI回复”验证流程。</Muted>
          ) : (
            workspace.aiMessages.map(message => (
              <ChatBubble key={message.id} $role={message.role}>
                <div style={{ fontWeight: 600, marginBottom: SPACING.xs }}>
                  {message.role === 'user' ? '你' : 'AI'} · {shortTimeLabel(message.createdAt)}
                </div>
                <div>{message.content}</div>
                {message.role === 'assistant' && (
                  <InlineGroup style={{ marginTop: SPACING.sm, justifyContent: 'space-between' }}>
                    <Muted>{message.accepted ? '已采纳' : '未采纳'}</Muted>
                    <Button
                      type="button"
                      $variant="secondary"
                      onClick={() => handleAcceptAssistantMessage(message.id)}
                    >
                      采纳到当前页签
                    </Button>
                  </InlineGroup>
                )}
              </ChatBubble>
            ))
          )}
        </ChatList>

        <label style={labelStyle}>提问 / 追问</label>
        <SmallTextArea
          value={askInput}
          onChange={(e) => setAskInput(e.target.value)}
          placeholder="输入你对人设、剧情、章节细化或正文写作的问题..."
        />
        <InlineGroup style={{ justifyContent: 'space-between', marginTop: SPACING.sm }}>
          <Button type="button" $variant="secondary" onClick={handleGenerateAssistantMessage}>
            模拟AI回复
          </Button>
          <Button type="button" onClick={handleAddUserMessage} disabled={!askInput.trim()}>
            发送问题
          </Button>
        </InlineGroup>
      </RightPanel>
    </WorkspaceContainer>
  );
};

export default WritingModeWorkspace;

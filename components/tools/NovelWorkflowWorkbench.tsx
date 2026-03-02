import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from '@emotion/styled';
import { COLORS, SPACING, FONTS, BORDERS, SHADOWS } from '../../styles';
import { splitTextIntoChapters } from '../../utils';
import { novelsApi } from '../../api';
import type { Novel } from '../../types';

type PromptStage = 'global' | 'chapter_plan' | 'chapter_draft';
type ChapterSelectMode = 'first' | 'count' | 'range' | 'manual';

interface BenchmarkChapter {
  id: string;
  chapterNumber: number;
  title: string;
  content: string;
}

interface BenchmarkNovel {
  id: string;
  title: string;
  author: string;
  summary: string;
  openingChapters: string;
  chapters: BenchmarkChapter[];
}

interface GlobalRound {
  id: string;
  question: string;
  answer: string;
  accepted: string;
  openQuestions: string;
  createdAt: number;
}

type ChapterPlanStatus = 'planning' | 'ready';
type ChapterDraftStatus = 'drafting' | 'ready';

interface ChapterPlan {
  id: string;
  chapterNumber: number;
  title: string;
  characterSetup: string;
  detailedPlot: string;
  supportingRoles: string;
  keyLines: string;
  notes: string;
  status: ChapterPlanStatus;
}

interface ChapterDraft {
  id: string;
  chapterNumber: number;
  title: string;
  sourcePlanHint: string;
  content: string;
  notes: string;
  status: ChapterDraftStatus;
}

interface WorkflowState {
  benchmarkNovels: BenchmarkNovel[];
  benchmarkIdeaPrompt: string;
  globalRounds: GlobalRound[];
  globalCharacterCore: string;
  globalPlotCore: string;
  globalToneAndRules: string;
  chapterPlans: ChapterPlan[];
  chapterDrafts: ChapterDraft[];
}

interface GeminiApiPart {
  text?: string;
}

interface GeminiApiCandidate {
  finishReason?: string;
  content?: {
    parts?: GeminiApiPart[];
  };
}

interface GeminiApiResponse {
  candidates?: GeminiApiCandidate[];
  error?: {
    message?: string;
  };
}

const STORAGE_KEY = 'novel_workflow_workbench_v1';
const GEMINI_KEY_STORAGE_KEY = 'novel_workflow_workbench_gemini_key';
const DEFAULT_BENCHMARK_IDEA_PROMPT = [
  '请你基于我选择的对标章节，给出“本书开局或当前阶段”的大概思路。',
  '要求：',
  '1. 先总结可借鉴的结构与节奏。',
  '2. 给出我的小说可以直接执行的推进思路（分 3-6 条）。',
  '3. 指出容易踩雷的点，并给替代方案。',
  '4. 先给思路，不要直接写整章正文。',
].join('\n');

const DEFAULT_STATE: WorkflowState = {
  benchmarkNovels: [],
  benchmarkIdeaPrompt: DEFAULT_BENCHMARK_IDEA_PROMPT,
  globalRounds: [],
  globalCharacterCore: '',
  globalPlotCore: '',
  globalToneAndRules: '',
  chapterPlans: [],
  chapterDrafts: [],
};

const Workbench = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.lg};
`;

const Intro = styled.div`
  border: 1px solid ${COLORS.borderLight};
  border-radius: ${BORDERS.radius};
  background: ${COLORS.gray100};
  padding: ${SPACING.md};
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.text};
  line-height: 1.7;
`;

const BoardScroll = styled.div`
  overflow-x: auto;
  padding-bottom: 2px;
`;

const Board = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(420px, 1fr));
  gap: ${SPACING.lg};
  min-width: 1320px;
  align-items: start;
`;

const Lane = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.lg};
  min-width: 0;
`;

const LaneTitle = styled.div`
  font-size: 12px;
  color: ${COLORS.textLight};
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
`;

const Section = styled.section`
  border: 1px solid ${COLORS.borderLight};
  border-radius: ${BORDERS.radius};
  background: ${COLORS.white};
  padding: ${SPACING.md};
  box-shadow: ${SHADOWS.small};
  display: flex;
  flex-direction: column;
  gap: ${SPACING.sm};
`;

const SectionTitle = styled.h4`
  margin: 0;
  color: ${COLORS.dark};
  font-size: ${FONTS.sizeLarge};
`;

const Hint = styled.p`
  margin: 0;
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.textLight};
  line-height: 1.7;
`;

const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${SPACING.sm};
  align-items: center;
`;

const Label = styled.label`
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.textLight};
  min-width: 120px;
`;

const Input = styled.input`
  border: 1px solid ${COLORS.border};
  border-radius: ${BORDERS.radius};
  padding: ${SPACING.xs} ${SPACING.sm};
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.text};
  background: ${COLORS.white};
  min-height: 34px;

  &:focus {
    outline: none;
    border-color: ${COLORS.primary};
    box-shadow: 0 0 0 2px ${COLORS.highlightBackground};
  }
`;

const NumberInput = styled(Input)`
  width: 110px;
`;

const Select = styled.select`
  border: 1px solid ${COLORS.border};
  border-radius: ${BORDERS.radius};
  padding: ${SPACING.xs} ${SPACING.sm};
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.text};
  background: ${COLORS.white};
  min-height: 34px;

  &:focus {
    outline: none;
    border-color: ${COLORS.primary};
    box-shadow: 0 0 0 2px ${COLORS.highlightBackground};
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  box-sizing: border-box;
  border: 1px solid ${COLORS.border};
  border-radius: ${BORDERS.radius};
  padding: ${SPACING.sm};
  min-height: 96px;
  resize: vertical;
  font-size: ${FONTS.sizeSmall};
  line-height: 1.7;
  color: ${COLORS.text};
  background: ${COLORS.white};

  &:focus {
    outline: none;
    border-color: ${COLORS.primary};
    box-shadow: 0 0 0 2px ${COLORS.highlightBackground};
  }
`;

const SmallTextArea = styled(TextArea)`
  min-height: 72px;
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' | 'danger' }>`
  border-radius: ${BORDERS.radius};
  border: 1px solid
    ${({ variant }) => {
      if (variant === 'secondary') return COLORS.border;
      if (variant === 'danger') return COLORS.danger;
      return COLORS.primary;
    }};
  background: ${({ variant }) => {
    if (variant === 'secondary') return COLORS.white;
    if (variant === 'danger') return COLORS.danger;
    return COLORS.primary;
  }};
  color: ${({ variant }) => (variant === 'secondary' ? COLORS.text : COLORS.white)};
  font-size: ${FONTS.sizeSmall};
  padding: ${SPACING.xs} ${SPACING.md};
  cursor: pointer;
  min-height: 34px;

  &:hover:not(:disabled) {
    background: ${({ variant }) => {
      if (variant === 'secondary') return COLORS.gray100;
      if (variant === 'danger') return COLORS.dangerHover;
      return COLORS.primaryHover;
    }};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const CardList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.sm};
`;

const Card = styled.div`
  border: 1px solid ${COLORS.borderLight};
  border-radius: ${BORDERS.radius};
  background: ${COLORS.gray100};
  padding: ${SPACING.sm};
  display: flex;
  flex-direction: column;
  gap: ${SPACING.xs};
`;

const CardTitle = styled.div`
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.dark};
  font-weight: 600;
`;

const MetaText = styled.div`
  font-size: 12px;
  color: ${COLORS.textLight};
`;

const Chip = styled.span<{ tone?: 'ready' | 'pending' }>`
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 12px;
  border: 1px solid ${({ tone }) => (tone === 'ready' ? COLORS.success : COLORS.warning)};
  color: ${({ tone }) => (tone === 'ready' ? COLORS.success : COLORS.warningHover)};
  background: ${COLORS.white};
`;

const Result = styled.pre`
  margin: 0;
  border: 1px solid ${COLORS.borderLight};
  border-radius: ${BORDERS.radius};
  padding: ${SPACING.sm};
  background: ${COLORS.gray100};
  color: ${COLORS.text};
  font-size: ${FONTS.sizeSmall};
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.7;
`;

const CheckboxWrap = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.text};
`;

const Divider = styled.hr`
  width: 100%;
  border: 0;
  border-top: 1px solid ${COLORS.borderLight};
  margin: ${SPACING.xs} 0;
`;

const EmptyHint = styled.div`
  border: 1px dashed ${COLORS.border};
  border-radius: ${BORDERS.radius};
  padding: ${SPACING.sm};
  color: ${COLORS.textLight};
  font-size: ${FONTS.sizeSmall};
  background: ${COLORS.gray100};
`;

const ChapterListWrap = styled.div`
  border: 1px solid ${COLORS.borderLight};
  border-radius: ${BORDERS.radius};
  background: ${COLORS.white};
  max-height: 280px;
  overflow: auto;
  display: flex;
  flex-direction: column;
`;

const ChapterListItem = styled.div<{ $active?: boolean }>`
  border: 0;
  border-bottom: 1px solid ${COLORS.borderLight};
  background: ${({ $active }) => ($active ? COLORS.highlightBackground : COLORS.white)};
  color: ${COLORS.text};
  text-align: left;
  font-size: ${FONTS.sizeSmall};
  padding: ${SPACING.xs} ${SPACING.sm};
  cursor: pointer;

  &:last-of-type {
    border-bottom: 0;
  }

  &:hover {
    background: ${COLORS.gray100};
  }
`;

const UploadDropZone = styled.div<{ $active?: boolean }>`
  border: 1px dashed ${({ $active }) => ($active ? COLORS.primary : COLORS.border)};
  border-radius: ${BORDERS.radius};
  padding: ${SPACING.xs} ${SPACING.sm};
  background: ${({ $active }) => ($active ? COLORS.highlightBackground : COLORS.gray100)};
  color: ${COLORS.textLight};
  font-size: ${FONTS.sizeSmall};
`;

const newId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const sortByChapter = <T extends { chapterNumber: number }>(items: T[]) =>
  [...items].sort((a, b) => a.chapterNumber - b.chapterNumber);

const safeParsePositiveInt = (value: string, fallback: number) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const safeParseNonNegativeInt = (value: string, fallback: number) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const sortBenchmarkChapters = (chapters: BenchmarkChapter[]) =>
  [...chapters].sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));

const isSameStringArray = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const normalizeBenchmarkChapters = (chapters: unknown): BenchmarkChapter[] => {
  if (!Array.isArray(chapters)) return [];
  return sortBenchmarkChapters(
    chapters
      .map((item, index) => {
        const raw = item as Partial<BenchmarkChapter>;
        const chapterNumber =
          typeof raw.chapterNumber === 'number' && Number.isFinite(raw.chapterNumber) && raw.chapterNumber > 0
            ? raw.chapterNumber
            : index + 1;
        return {
          id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : newId('benchmark_chapter'),
          chapterNumber,
          title: typeof raw.title === 'string' ? raw.title : `第${chapterNumber}章`,
          content: typeof raw.content === 'string' ? raw.content : '',
        };
      })
      .filter(item => item.title.trim() || item.content.trim())
  );
};

const sleep = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));

const loadState = (storageKey: string): WorkflowState => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<WorkflowState>;
    return {
      benchmarkNovels: Array.isArray(parsed.benchmarkNovels)
        ? parsed.benchmarkNovels.map((item, index) => {
            const rawNovel = item as Partial<BenchmarkNovel>;
            return {
              id: typeof rawNovel.id === 'string' && rawNovel.id.trim() ? rawNovel.id : newId('benchmark'),
              title: typeof rawNovel.title === 'string' ? rawNovel.title : `对标小说 ${index + 1}`,
              author: typeof rawNovel.author === 'string' ? rawNovel.author : '',
              summary: typeof rawNovel.summary === 'string' ? rawNovel.summary : '',
              openingChapters: typeof rawNovel.openingChapters === 'string' ? rawNovel.openingChapters : '',
              chapters: normalizeBenchmarkChapters(rawNovel.chapters),
            };
          })
        : [],
      benchmarkIdeaPrompt:
        typeof parsed.benchmarkIdeaPrompt === 'string' && parsed.benchmarkIdeaPrompt.trim()
          ? parsed.benchmarkIdeaPrompt
          : DEFAULT_BENCHMARK_IDEA_PROMPT,
      globalRounds: Array.isArray(parsed.globalRounds) ? parsed.globalRounds : [],
      globalCharacterCore: typeof parsed.globalCharacterCore === 'string' ? parsed.globalCharacterCore : '',
      globalPlotCore: typeof parsed.globalPlotCore === 'string' ? parsed.globalPlotCore : '',
      globalToneAndRules: typeof parsed.globalToneAndRules === 'string' ? parsed.globalToneAndRules : '',
      chapterPlans: Array.isArray(parsed.chapterPlans) ? parsed.chapterPlans : [],
      chapterDrafts: Array.isArray(parsed.chapterDrafts) ? parsed.chapterDrafts : [],
    };
  } catch (error) {
    console.warn('加载小说流程工作台数据失败，已回退默认值', error);
    return DEFAULT_STATE;
  }
};

const loadRememberedKey = () => {
  try {
    return localStorage.getItem(GEMINI_KEY_STORAGE_KEY) ?? '';
  } catch (error) {
    console.warn('加载 Gemini Key 失败', error);
    return '';
  }
};

const stageNameMap: Record<PromptStage, string> = {
  global: '全局人设/剧情',
  chapter_plan: '章节详细规划',
  chapter_draft: '章节正文撰写',
};

interface NovelWorkflowWorkbenchProps {
  storageScopeId?: string;
}

const NovelWorkflowWorkbench: React.FC<NovelWorkflowWorkbenchProps> = ({ storageScopeId }) => {
  const workflowStorageKey = `${STORAGE_KEY}:${storageScopeId || 'global'}`;
  const [workflow, setWorkflow] = useState<WorkflowState>(() => loadState(workflowStorageKey));

  const [promptStage, setPromptStage] = useState<PromptStage>('global');
  const [promptTask, setPromptTask] = useState('');
  const [promptExtraConstraints, setPromptExtraConstraints] = useState('');
  const [targetChapterText, setTargetChapterText] = useState('');
  const [selectedBenchmarkIds, setSelectedBenchmarkIds] = useState<string[]>([]);
  const [selectedBenchmarkChapterIds, setSelectedBenchmarkChapterIds] = useState<string[]>([]);
  const [activeBenchmarkNovelId, setActiveBenchmarkNovelId] = useState<string | null>(null);
  const [activeBenchmarkChapterId, setActiveBenchmarkChapterId] = useState<string | null>(null);
  const [chapterSelectMode, setChapterSelectMode] = useState<ChapterSelectMode>('count');
  const [selectChapterCountText, setSelectChapterCountText] = useState('3');
  const [selectRangeStartText, setSelectRangeStartText] = useState('1');
  const [selectRangeEndText, setSelectRangeEndText] = useState('3');
  const [benchmarkGeneratedPrompt, setBenchmarkGeneratedPrompt] = useState('');
  const [benchmarkIdeaResponse, setBenchmarkIdeaResponse] = useState('');
  const [benchmarkIdeaFinishReason, setBenchmarkIdeaFinishReason] = useState('');
  const [benchmarkIdeaError, setBenchmarkIdeaError] = useState('');
  const [benchmarkPromptCopyMessage, setBenchmarkPromptCopyMessage] = useState('');
  const [importableNovels, setImportableNovels] = useState<Novel[]>([]);
  const [isLoadingImportableNovels, setIsLoadingImportableNovels] = useState(false);
  const [importNovelError, setImportNovelError] = useState('');
  const [selectedImportNovelId, setSelectedImportNovelId] = useState('');
  const [isImportingNovel, setIsImportingNovel] = useState(false);
  const [pendingUploadBenchmarkId, setPendingUploadBenchmarkId] = useState<string | null>(null);
  const [activeDropBenchmarkId, setActiveDropBenchmarkId] = useState<string | null>(null);
  const [selectedRoundIds, setSelectedRoundIds] = useState<string[]>([]);
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [lastAiResponse, setLastAiResponse] = useState('');
  const [lastFinishReason, setLastFinishReason] = useState('');
  const [lastError, setLastError] = useState('');

  const rememberedKey = useMemo(() => loadRememberedKey(), []);
  const [geminiApiKey, setGeminiApiKey] = useState(rememberedKey);
  const [rememberApiKey, setRememberApiKey] = useState(Boolean(rememberedKey));
  const [geminiModel, setGeminiModel] = useState('gemini-2.5-flash');
  const [maxOutputTokens, setMaxOutputTokens] = useState(1800);
  const [temperature, setTemperature] = useState(0.85);
  const [autoContinueOnMaxTokens, setAutoContinueOnMaxTokens] = useState(true);
  const [maxContinuations, setMaxContinuations] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');

  const requestQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const txtFileInputRef = useRef<HTMLInputElement>(null);
  const [pendingRequests, setPendingRequests] = useState(0);

  useEffect(() => {
    setWorkflow(loadState(workflowStorageKey));
    setSelectedBenchmarkIds([]);
    setSelectedBenchmarkChapterIds([]);
    setActiveBenchmarkNovelId(null);
    setActiveBenchmarkChapterId(null);
    setBenchmarkGeneratedPrompt('');
    setBenchmarkIdeaResponse('');
    setBenchmarkIdeaFinishReason('');
    setBenchmarkIdeaError('');
    setBenchmarkPromptCopyMessage('');
    setImportNovelError('');
    setSelectedImportNovelId('');
    setPendingUploadBenchmarkId(null);
    setActiveDropBenchmarkId(null);
    setSelectedRoundIds([]);
    setSelectedPlanIds([]);
    setGeneratedPrompt('');
    setLastAiResponse('');
    setLastFinishReason('');
    setLastError('');
    setCopyMessage('');
  }, [workflowStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(workflowStorageKey, JSON.stringify(workflow));
    } catch (error) {
      console.warn('保存小说流程工作台数据失败，可能是 localStorage 空间不足。', error);
    }
  }, [workflow, workflowStorageKey]);

  useEffect(() => {
    if (!rememberApiKey) {
      localStorage.removeItem(GEMINI_KEY_STORAGE_KEY);
      return;
    }
    if (geminiApiKey.trim()) {
      localStorage.setItem(GEMINI_KEY_STORAGE_KEY, geminiApiKey.trim());
    }
  }, [rememberApiKey, geminiApiKey]);

  useEffect(() => {
    let cancelled = false;
    const loadImportableNovels = async () => {
      setIsLoadingImportableNovels(true);
      try {
        const novels = await novelsApi.getAll();
        if (cancelled) return;
        const sorted = [...novels].sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
        setImportableNovels(sorted);
        if (!selectedImportNovelId && sorted.length) {
          setSelectedImportNovelId(sorted[0].id);
        }
        setImportNovelError('');
      } catch (error) {
        if (cancelled) return;
        setImportNovelError(error instanceof Error ? error.message : '加载小说列表失败');
      } finally {
        if (!cancelled) {
          setIsLoadingImportableNovels(false);
        }
      }
    };

    loadImportableNovels();
    return () => {
      cancelled = true;
    };
  }, [workflowStorageKey]);

  useEffect(() => {
    const novels = workflow.benchmarkNovels;
    if (!novels.length) {
      if (activeBenchmarkNovelId !== null) setActiveBenchmarkNovelId(null);
      if (activeBenchmarkChapterId !== null) setActiveBenchmarkChapterId(null);
      if (selectedBenchmarkChapterIds.length) setSelectedBenchmarkChapterIds([]);
      if (selectedBenchmarkIds.length) setSelectedBenchmarkIds([]);
      return;
    }

    const novelIds = new Set(novels.map(item => item.id));
    if (!activeBenchmarkNovelId || !novelIds.has(activeBenchmarkNovelId)) {
      setActiveBenchmarkNovelId(novels[0].id);
      return;
    }

    const activeNovel = novels.find(item => item.id === activeBenchmarkNovelId) || null;
    const activeNovelChapters = activeNovel ? sortBenchmarkChapters(activeNovel.chapters) : [];
    const activeChapterIds = new Set(activeNovelChapters.map(item => item.id));
    if (!activeNovelChapters.length) {
      if (activeBenchmarkChapterId !== null) {
        setActiveBenchmarkChapterId(null);
      }
    } else if (!activeBenchmarkChapterId || !activeChapterIds.has(activeBenchmarkChapterId)) {
      setActiveBenchmarkChapterId(activeNovelChapters[0].id);
    }

    const validChapterIds = new Set(novels.flatMap(item => item.chapters.map(chapter => chapter.id)));
    const filteredChapterSelection = selectedBenchmarkChapterIds.filter(item => validChapterIds.has(item));
    if (!isSameStringArray(filteredChapterSelection, selectedBenchmarkChapterIds)) {
      setSelectedBenchmarkChapterIds(filteredChapterSelection);
    }

    const filteredBenchmarkIds = selectedBenchmarkIds.filter(item => novelIds.has(item));
    if (!isSameStringArray(filteredBenchmarkIds, selectedBenchmarkIds)) {
      setSelectedBenchmarkIds(filteredBenchmarkIds);
    }
  }, [
    workflow.benchmarkNovels,
    activeBenchmarkNovelId,
    activeBenchmarkChapterId,
    selectedBenchmarkChapterIds,
    selectedBenchmarkIds,
  ]);

  useEffect(() => {
    if (!importableNovels.length) {
      if (selectedImportNovelId) setSelectedImportNovelId('');
      return;
    }
    const validIds = new Set(importableNovels.map(item => item.id));
    if (!selectedImportNovelId || !validIds.has(selectedImportNovelId)) {
      setSelectedImportNovelId(importableNovels[0].id);
    }
  }, [importableNovels, selectedImportNovelId]);

  const chapterPlansSorted = useMemo(() => sortByChapter(workflow.chapterPlans), [workflow.chapterPlans]);
  const chapterDraftsSorted = useMemo(() => sortByChapter(workflow.chapterDrafts), [workflow.chapterDrafts]);

  const selectedBenchmarks = useMemo(
    () => workflow.benchmarkNovels.filter(item => selectedBenchmarkIds.includes(item.id)),
    [workflow.benchmarkNovels, selectedBenchmarkIds]
  );
  const selectedRounds = useMemo(
    () => workflow.globalRounds.filter(item => selectedRoundIds.includes(item.id)),
    [workflow.globalRounds, selectedRoundIds]
  );
  const selectedPlans = useMemo(
    () => chapterPlansSorted.filter(item => selectedPlanIds.includes(item.id)),
    [chapterPlansSorted, selectedPlanIds]
  );
  const activeBenchmarkNovel = useMemo(
    () => workflow.benchmarkNovels.find(item => item.id === activeBenchmarkNovelId) || null,
    [workflow.benchmarkNovels, activeBenchmarkNovelId]
  );
  const activeBenchmarkChapters = useMemo(
    () => (activeBenchmarkNovel ? sortBenchmarkChapters(activeBenchmarkNovel.chapters) : []),
    [activeBenchmarkNovel]
  );
  const activeBenchmarkChapter = useMemo(
    () => activeBenchmarkChapters.find(item => item.id === activeBenchmarkChapterId) || null,
    [activeBenchmarkChapters, activeBenchmarkChapterId]
  );
  const selectedBenchmarkChapterContexts = useMemo(() => {
    const selectedIdSet = new Set(selectedBenchmarkChapterIds);
    const collected: Array<{
      novelId: string;
      novelTitle: string;
      novelAuthor: string;
      chapterId: string;
      chapterNumber: number;
      chapterTitle: string;
      chapterContent: string;
    }> = [];

    workflow.benchmarkNovels.forEach((novel, novelOrder) => {
      sortBenchmarkChapters(novel.chapters).forEach((chapter, chapterOrder) => {
        if (!selectedIdSet.has(chapter.id)) return;
        collected.push({
          novelId: novel.id,
          novelTitle: novel.title || `对标小说 ${novelOrder + 1}`,
          novelAuthor: novel.author || '',
          chapterId: chapter.id,
          chapterNumber: chapter.chapterNumber || chapterOrder + 1,
          chapterTitle: chapter.title || `第${chapterOrder + 1}章`,
          chapterContent: chapter.content || '',
        });
      });
    });

    return collected;
  }, [workflow.benchmarkNovels, selectedBenchmarkChapterIds]);

  const toggleSelected = (id: string, selectedIds: string[], setSelectedIds: (next: string[]) => void) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(item => item !== id));
      return;
    }
    setSelectedIds([...selectedIds, id]);
  };

  const addBenchmark = () => {
    const next: BenchmarkNovel = {
      id: newId('benchmark'),
      title: '',
      author: '',
      summary: '',
      openingChapters: '',
      chapters: [],
    };
    setWorkflow(prev => ({
      ...prev,
      benchmarkNovels: [...prev.benchmarkNovels, next],
    }));
    setSelectedBenchmarkIds(prev => [...prev, next.id]);
    setActiveBenchmarkNovelId(next.id);
  };

  const updateBenchmark = (id: string, patch: Partial<BenchmarkNovel>) => {
    setWorkflow(prev => ({
      ...prev,
      benchmarkNovels: prev.benchmarkNovels.map(item => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const deleteBenchmark = (id: string) => {
    setWorkflow(prev => ({
      ...prev,
      benchmarkNovels: prev.benchmarkNovels.filter(item => item.id !== id),
    }));
    setSelectedBenchmarkIds(prev => prev.filter(item => item !== id));
  };

  const addBenchmarkChapter = (benchmarkId: string) => {
    setWorkflow(prev => ({
      ...prev,
      benchmarkNovels: prev.benchmarkNovels.map(item => {
        if (item.id !== benchmarkId) return item;
        const sorted = sortBenchmarkChapters(item.chapters);
        const nextChapterNumber = sorted.length ? Math.max(...sorted.map(chapter => chapter.chapterNumber || 0)) + 1 : 1;
        const nextChapter: BenchmarkChapter = {
          id: newId('benchmark_chapter'),
          chapterNumber: nextChapterNumber,
          title: `第${nextChapterNumber}章`,
          content: '',
        };
        return {
          ...item,
          chapters: [...sorted, nextChapter],
        };
      }),
    }));
  };

  const updateBenchmarkChapter = (benchmarkId: string, chapterId: string, patch: Partial<BenchmarkChapter>) => {
    setWorkflow(prev => ({
      ...prev,
      benchmarkNovels: prev.benchmarkNovels.map(item => {
        if (item.id !== benchmarkId) return item;
        return {
          ...item,
          chapters: sortBenchmarkChapters(
            item.chapters.map(chapter => (chapter.id === chapterId ? { ...chapter, ...patch } : chapter))
          ),
        };
      }),
    }));
  };

  const deleteBenchmarkChapter = (benchmarkId: string, chapterId: string) => {
    setWorkflow(prev => ({
      ...prev,
      benchmarkNovels: prev.benchmarkNovels.map(item => {
        if (item.id !== benchmarkId) return item;
        return {
          ...item,
          chapters: item.chapters.filter(chapter => chapter.id !== chapterId),
        };
      }),
    }));
    setSelectedBenchmarkChapterIds(prev => prev.filter(item => item !== chapterId));
    if (activeBenchmarkChapterId === chapterId) {
      setActiveBenchmarkChapterId(null);
    }
  };

  const splitBenchmarkOpeningToChapters = (benchmarkId: string) => {
    const novel = workflow.benchmarkNovels.find(item => item.id === benchmarkId);
    if (!novel) return;

    const raw = novel.openingChapters.trim();
    if (!raw) {
      window.alert('请先在“章节原文”中粘贴文本，再执行拆章。');
      return;
    }

    const parsed = splitTextIntoChapters(raw);
    const chapters: BenchmarkChapter[] = parsed.map((chapter, index) => ({
      id: newId('benchmark_chapter'),
      chapterNumber: index + 1,
      title: chapter.title || `第${index + 1}章`,
      content: chapter.content || '',
    }));
    const normalized = normalizeBenchmarkChapters(chapters);

    if (!normalized.length) {
      window.alert('未识别到章节标题，建议手动新增章节。');
      return;
    }

    setWorkflow(prev => ({
      ...prev,
      benchmarkNovels: prev.benchmarkNovels.map(item => (item.id === benchmarkId ? { ...item, chapters: normalized } : item)),
    }));
    setActiveBenchmarkNovelId(benchmarkId);
    setActiveBenchmarkChapterId(normalized[0].id);
    setSelectedBenchmarkChapterIds(normalized.slice(0, 1).map(item => item.id));
  };

  const convertTextToBenchmarkChapters = (rawText: string): BenchmarkChapter[] => {
    const normalizedText = rawText.replace(/\r\n|\r/g, '\n').trim();
    if (!normalizedText) return [];

    const parsed = splitTextIntoChapters(normalizedText);
    return parsed.map((chapter, index) => ({
      id: newId('benchmark_chapter'),
      chapterNumber: index + 1,
      title: chapter.title || `第${index + 1}章`,
      content: chapter.content || '',
    }));
  };

  const applyBenchmarkTextImport = (benchmarkId: string, text: string, fallbackTitle?: string) => {
    const chapters = normalizeBenchmarkChapters(convertTextToBenchmarkChapters(text));
    if (!chapters.length) {
      setImportNovelError('TXT 内容为空，无法拆章。');
      return;
    }

    const openingPreview = chapters
      .slice(0, 3)
      .map(chapter => `第${chapter.chapterNumber}章 ${chapter.title}\n${chapter.content}`)
      .join('\n\n')
      .trim();

    setWorkflow(prev => ({
      ...prev,
      benchmarkNovels: prev.benchmarkNovels.map(item => {
        if (item.id !== benchmarkId) return item;
        return {
          ...item,
          title: item.title.trim() ? item.title : fallbackTitle || item.title,
          openingChapters: openingPreview,
          chapters,
        };
      }),
    }));
    setActiveBenchmarkNovelId(benchmarkId);
    setActiveBenchmarkChapterId(chapters[0].id);
    setSelectedBenchmarkChapterIds(chapters.slice(0, 3).map(item => item.id));
    setImportNovelError('');
  };

  const handleUploadTxtForBenchmark = async (benchmarkId: string, file: File) => {
    const isTxt = file.name.toLowerCase().endsWith('.txt') || file.type.includes('text');
    if (!isTxt) {
      setImportNovelError('仅支持 .txt 文件。');
      return;
    }

    try {
      const text = await file.text();
      applyBenchmarkTextImport(benchmarkId, text, file.name.replace(/\.txt$/i, ''));
    } catch (error) {
      setImportNovelError(error instanceof Error ? error.message : '读取 TXT 失败');
    }
  };

  const triggerBenchmarkTxtPicker = (benchmarkId: string) => {
    setPendingUploadBenchmarkId(benchmarkId);
    txtFileInputRef.current?.click();
  };

  const importAnalyzedNovelToBenchmark = async (mode: 'current' | 'new') => {
    if (!selectedImportNovelId) {
      setImportNovelError('请先选择要导入的小说。');
      return;
    }

    setIsImportingNovel(true);
    try {
      const sourceNovel = await novelsApi.getById(selectedImportNovelId);
      const sourceChapters = (sourceNovel.chapters && sourceNovel.chapters.length > 0)
        ? [...sourceNovel.chapters].sort((a, b) => (a.originalStartIndex || 0) - (b.originalStartIndex || 0))
        : splitTextIntoChapters(sourceNovel.text || '');

      const mappedChapters = normalizeBenchmarkChapters(
        sourceChapters.map((chapter, index) => ({
          id: newId('benchmark_chapter'),
          chapterNumber: index + 1,
          title: chapter.title || `第${index + 1}章`,
          content: chapter.content || '',
        }))
      );

      if (!mappedChapters.length) {
        setImportNovelError('选中的小说没有可导入的章节。');
        return;
      }

      const openingPreview = mappedChapters
        .slice(0, 3)
        .map(chapter => `第${chapter.chapterNumber}章 ${chapter.title}\n${chapter.content}`)
        .join('\n\n')
        .trim();

      let targetBenchmarkId = activeBenchmarkNovelId;
      if (mode === 'new' || !targetBenchmarkId) {
        targetBenchmarkId = newId('benchmark');
      }

      const finalBenchmarkId = targetBenchmarkId;
      setWorkflow(prev => {
        const exists = prev.benchmarkNovels.some(item => item.id === finalBenchmarkId);
        const nextNovels = exists
          ? prev.benchmarkNovels.map(item => {
              if (item.id !== finalBenchmarkId) return item;
              return {
                ...item,
                title: sourceNovel.title || item.title,
                author: sourceNovel.author || item.author || '',
                openingChapters: openingPreview,
                chapters: mappedChapters,
              };
            })
          : [
              ...prev.benchmarkNovels,
              {
                id: finalBenchmarkId,
                title: sourceNovel.title || '',
                author: sourceNovel.author || '',
                summary: '',
                openingChapters: openingPreview,
                chapters: mappedChapters,
              },
            ];

        return {
          ...prev,
          benchmarkNovels: nextNovels,
        };
      });

      setActiveBenchmarkNovelId(finalBenchmarkId);
      setActiveBenchmarkChapterId(mappedChapters[0].id);
      setSelectedBenchmarkChapterIds(mappedChapters.slice(0, 3).map(item => item.id));
      setSelectedBenchmarkIds(prev => (prev.includes(finalBenchmarkId) ? prev : [...prev, finalBenchmarkId]));
      setImportNovelError('');
    } catch (error) {
      setImportNovelError(error instanceof Error ? error.message : '导入失败');
    } finally {
      setIsImportingNovel(false);
    }
  };

  const applyBenchmarkChapterSelection = () => {
    if (!activeBenchmarkNovel) {
      setBenchmarkIdeaError('请先选择一本对标小说。');
      return;
    }

    const chapters = activeBenchmarkChapters;
    if (!chapters.length) {
      setBenchmarkIdeaError('当前对标小说还没有章节。');
      return;
    }

    let selected: BenchmarkChapter[] = [];
    if (chapterSelectMode === 'manual') {
      selected = chapters.filter(item => selectedBenchmarkChapterIds.includes(item.id));
    } else if (chapterSelectMode === 'first') {
      selected = chapters.slice(0, 1);
    } else if (chapterSelectMode === 'count') {
      const count = Math.max(1, Math.min(3, safeParsePositiveInt(selectChapterCountText, 3)));
      selected = chapters.slice(0, count);
    } else if (chapterSelectMode === 'range') {
      const start = safeParsePositiveInt(selectRangeStartText, 1);
      const end = safeParsePositiveInt(selectRangeEndText, start);
      const minNumber = Math.min(start, end);
      const maxNumber = Math.max(start, end);
      selected = chapters.filter(item => item.chapterNumber >= minNumber && item.chapterNumber <= maxNumber);
    }

    if (!selected.length) {
      setBenchmarkIdeaError('没有可用的章节选择，请调整条件后重试。');
      return;
    }

    setSelectedBenchmarkChapterIds(selected.map(item => item.id));
    setActiveBenchmarkChapterId(selected[0].id);
    setBenchmarkIdeaError('');
  };

  const toggleBenchmarkChapterSelected = (chapterId: string) => {
    setSelectedBenchmarkChapterIds(prev =>
      prev.includes(chapterId) ? prev.filter(item => item !== chapterId) : [...prev, chapterId]
    );
  };

  const addGlobalRound = () => {
    const next: GlobalRound = {
      id: newId('global_round'),
      question: '',
      answer: '',
      accepted: '',
      openQuestions: '',
      createdAt: Date.now(),
    };
    setWorkflow(prev => ({
      ...prev,
      globalRounds: [next, ...prev.globalRounds],
    }));
    setSelectedRoundIds(prev => [...prev, next.id]);
  };

  const updateGlobalRound = (id: string, patch: Partial<GlobalRound>) => {
    setWorkflow(prev => ({
      ...prev,
      globalRounds: prev.globalRounds.map(item => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const deleteGlobalRound = (id: string) => {
    setWorkflow(prev => ({
      ...prev,
      globalRounds: prev.globalRounds.filter(item => item.id !== id),
    }));
    setSelectedRoundIds(prev => prev.filter(item => item !== id));
  };

  const addChapterPlan = () => {
    const nextNumber = workflow.chapterPlans.length
      ? Math.max(...workflow.chapterPlans.map(item => item.chapterNumber || 0)) + 1
      : 1;
    const next: ChapterPlan = {
      id: newId('chapter_plan'),
      chapterNumber: nextNumber,
      title: `第${nextNumber}章`,
      characterSetup: '',
      detailedPlot: '',
      supportingRoles: '',
      keyLines: '',
      notes: '',
      status: 'planning',
    };
    setWorkflow(prev => ({
      ...prev,
      chapterPlans: sortByChapter([...prev.chapterPlans, next]),
    }));
    setSelectedPlanIds(prev => [...prev, next.id]);
  };

  const updateChapterPlan = (id: string, patch: Partial<ChapterPlan>) => {
    setWorkflow(prev => ({
      ...prev,
      chapterPlans: sortByChapter(prev.chapterPlans.map(item => (item.id === id ? { ...item, ...patch } : item))),
    }));
  };

  const deleteChapterPlan = (id: string) => {
    setWorkflow(prev => ({
      ...prev,
      chapterPlans: prev.chapterPlans.filter(item => item.id !== id),
    }));
    setSelectedPlanIds(prev => prev.filter(item => item !== id));
  };

  const addChapterDraft = () => {
    const nextNumber = workflow.chapterDrafts.length
      ? Math.max(...workflow.chapterDrafts.map(item => item.chapterNumber || 0)) + 1
      : 1;
    const next: ChapterDraft = {
      id: newId('chapter_draft'),
      chapterNumber: nextNumber,
      title: `第${nextNumber}章正文`,
      sourcePlanHint: '',
      content: '',
      notes: '',
      status: 'drafting',
    };
    setWorkflow(prev => ({
      ...prev,
      chapterDrafts: sortByChapter([...prev.chapterDrafts, next]),
    }));
  };

  const updateChapterDraft = (id: string, patch: Partial<ChapterDraft>) => {
    setWorkflow(prev => ({
      ...prev,
      chapterDrafts: sortByChapter(prev.chapterDrafts.map(item => (item.id === id ? { ...item, ...patch } : item))),
    }));
  };

  const deleteChapterDraft = (id: string) => {
    setWorkflow(prev => ({
      ...prev,
      chapterDrafts: prev.chapterDrafts.filter(item => item.id !== id),
    }));
  };

  const buildPrompt = () => {
    const stage = promptStage;
    const targetChapter = targetChapterText.trim();
    const sections: string[] = [];

    if (stage === 'global') {
      sections.push('你是长篇网文策划编辑。目标是先做全局人设和剧情方案，不要直接写章节正文。');
    }
    if (stage === 'chapter_plan') {
      sections.push('你是章节编剧。目标是产出可执行的章节级详细规划，不要直接写正文。');
    }
    if (stage === 'chapter_draft') {
      sections.push('你是小说正文写作助手。目标是在既定规划下写出可直接使用的章节正文。');
    }

    if (selectedBenchmarks.length) {
      const block = selectedBenchmarks
        .map((item, index) => {
          const selectedChapters = sortBenchmarkChapters(item.chapters).filter(chapter =>
            selectedBenchmarkChapterIds.includes(chapter.id)
          );
          const parts = [
            `# 对标 ${index + 1}`,
            `标题: ${item.title || '(未填写)'}`,
            `作者: ${item.author || '(未填写)'}`,
            item.summary ? `风格/卖点: ${item.summary}` : '',
            item.openingChapters ? `开篇参考片段: ${item.openingChapters}` : '',
            selectedChapters.length
              ? [
                  `选中章节（${selectedChapters.length}章）:`,
                  selectedChapters
                    .map(
                      chapter =>
                        `- 第${chapter.chapterNumber}章 ${chapter.title}\n${chapter.content || '(无正文内容)'}`
                    )
                    .join('\n\n'),
                ].join('\n')
              : '',
          ].filter(Boolean);
          return parts.join('\n');
        })
        .join('\n\n');
      sections.push(`【对标小说】\n${block}`);
    }

    if (workflow.globalCharacterCore.trim() || workflow.globalPlotCore.trim() || workflow.globalToneAndRules.trim()) {
      sections.push(
        [
          '【全局已定基线】',
          workflow.globalCharacterCore.trim() ? `人设基线:\n${workflow.globalCharacterCore.trim()}` : '',
          workflow.globalPlotCore.trim() ? `剧情基线:\n${workflow.globalPlotCore.trim()}` : '',
          workflow.globalToneAndRules.trim() ? `文风/规则:\n${workflow.globalToneAndRules.trim()}` : '',
        ]
          .filter(Boolean)
          .join('\n\n')
      );
    }

    if (selectedRounds.length) {
      const block = selectedRounds
        .map((item, index) =>
          [
            `# 讨论轮次 ${index + 1}`,
            item.question ? `问题:\n${item.question}` : '',
            item.answer ? `回答:\n${item.answer}` : '',
            item.accepted ? `我认可的部分:\n${item.accepted}` : '',
            item.openQuestions ? `仍需追问:\n${item.openQuestions}` : '',
          ]
            .filter(Boolean)
            .join('\n')
        )
        .join('\n\n');
      sections.push(`【全局讨论历史】\n${block}`);
    }

    if (selectedPlans.length) {
      const block = selectedPlans
        .map(item =>
          [
            `# 第${item.chapterNumber}章 ${item.title || ''}`.trim(),
            item.characterSetup ? `出场人物:\n${item.characterSetup}` : '',
            item.detailedPlot ? `详细剧情:\n${item.detailedPlot}` : '',
            item.supportingRoles ? `龙套/作用:\n${item.supportingRoles}` : '',
            item.keyLines ? `关键台词:\n${item.keyLines}` : '',
            item.notes ? `备注:\n${item.notes}` : '',
          ]
            .filter(Boolean)
            .join('\n')
        )
        .join('\n\n');
      sections.push(`【章节规划参考】\n${block}`);
    }

    if (targetChapter) {
      sections.push(`【目标章节】\n${targetChapter}`);
    }

    if (promptExtraConstraints.trim()) {
      sections.push(`【额外约束】\n${promptExtraConstraints.trim()}`);
    }

    sections.push(`【本轮任务】\n${promptTask.trim() || '请根据上下文给出最可执行的输出方案。'}`);

    if (stage === 'global') {
      sections.push(
        [
          '【输出格式要求】',
          '1. 人设方案（主角、核心配角、关系冲突）',
          '2. 主线剧情方案（阶段目标、转折点、冲突升级）',
          '3. 多个可选方向（每个方向的优缺点）',
          '4. 建议我下一轮追问的问题（不少于5个）',
          '注意：不要写正文。',
        ].join('\n')
      );
    }

    if (stage === 'chapter_plan') {
      sections.push(
        [
          '【输出格式要求】',
          '1. 本章目标与冲突',
          '2. 场景分解（按场景顺序）',
          '3. 出场人物与动机（含龙套）',
          '4. 关键台词候选',
          '5. 和上下章衔接建议',
          '注意：不要写正文。',
        ].join('\n')
      );
    }

    if (stage === 'chapter_draft') {
      sections.push(
        [
          '【输出格式要求】',
          '1. 直接输出章节正文',
          '2. 如果需要分段，请使用自然段',
          '3. 禁止复述“规划说明”，只写正文',
          '4. 若内容较长可在结尾标记“待续写”',
        ].join('\n')
      );
    }

    const prompt = sections.join('\n\n').trim();
    setGeneratedPrompt(prompt);
    setCopyMessage('');
    return prompt;
  };

  const copyPrompt = async () => {
    const value = generatedPrompt.trim() || buildPrompt();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage('提示词已复制。');
    } catch (error) {
      console.error(error);
      setCopyMessage('复制失败，请手动复制。');
    }
  };

  const buildBenchmarkIdeaPrompt = () => {
    if (!selectedBenchmarkChapterContexts.length) {
      setBenchmarkIdeaError('请先在左栏选择至少 1 章对标章节。');
      setBenchmarkGeneratedPrompt('');
      return '';
    }

    const chapterBlock = selectedBenchmarkChapterContexts
      .map((item, index) =>
        [
          `# 对标章节 ${index + 1}`,
          `小说: ${item.novelTitle}${item.novelAuthor ? `（${item.novelAuthor}）` : ''}`,
          `章节: 第${item.chapterNumber}章 ${item.chapterTitle}`,
          '内容:',
          item.chapterContent || '(无正文内容)',
        ].join('\n')
      )
      .join('\n\n');

    const taskPrompt = workflow.benchmarkIdeaPrompt.trim() || DEFAULT_BENCHMARK_IDEA_PROMPT;
    const prompt = [
      '你是一名资深网络小说策划编辑。请基于我提供的对标章节，输出可执行的写作思路。',
      `【已选对标章节（共 ${selectedBenchmarkChapterContexts.length} 章）】\n${chapterBlock}`,
      `【我的提示词】\n${taskPrompt}`,
      [
        '【输出格式】',
        '1. 大概思路（总览）',
        '2. 可执行步骤（3-6 条）',
        '3. 节奏建议（如何推进冲突）',
        '4. 风险提醒（容易写崩的点）',
      ].join('\n'),
      '注意：先给思路，不要直接输出完整章节正文。',
    ]
      .join('\n\n')
      .trim();

    setBenchmarkGeneratedPrompt(prompt);
    setBenchmarkIdeaError('');
    setBenchmarkPromptCopyMessage('');
    return prompt;
  };

  const copyBenchmarkIdeaPrompt = async () => {
    const value = benchmarkGeneratedPrompt.trim() || buildBenchmarkIdeaPrompt();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setBenchmarkPromptCopyMessage('章节提示词已复制。');
    } catch (error) {
      console.error(error);
      setBenchmarkPromptCopyMessage('复制失败，请手动复制。');
    }
  };

  const enqueueRequest = <T,>(task: () => Promise<T>): Promise<T> => {
    setPendingRequests(prev => prev + 1);
    const next = requestQueueRef.current
      .catch(() => undefined)
      .then(task);

    requestQueueRef.current = next.then(
      () => undefined,
      () => undefined
    );

    return next.finally(() => {
      setPendingRequests(prev => Math.max(0, prev - 1));
    });
  };

  const callGeminiOnce = async (prompt: string) => {
    const key = geminiApiKey.trim();
    if (!key) {
      throw new Error('请先填写 Gemini API Key。');
    }

    const model = geminiModel.trim() || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(key)}`;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: maxOutputTokens,
            temperature: temperature,
          },
        }),
      });

      if ((response.status === 429 || response.status === 503) && attempt < 3) {
        const delay = 1000 * 2 ** attempt;
        await sleep(delay);
        continue;
      }

      const data = (await response.json()) as GeminiApiResponse;
      if (!response.ok) {
        const message = data?.error?.message || `Gemini 请求失败（HTTP ${response.status}）`;
        throw new Error(message);
      }

      const candidate = data.candidates?.[0];
      const text =
        candidate?.content?.parts
          ?.map(part => part.text || '')
          .join('')
          .trim() || '';

      if (!text) {
        throw new Error('Gemini 返回为空，请尝试缩短上下文或重试。');
      }

      return {
        text,
        finishReason: candidate?.finishReason || '',
      };
    }

    throw new Error('请求多次重试后仍失败，请稍后重试。');
  };

  const generateWithGemini = async () => {
    const basePrompt = generatedPrompt.trim() || buildPrompt();
    if (!basePrompt) {
      setLastError('提示词为空，无法生成。');
      return;
    }

    setIsGenerating(true);
    setLastError('');
    setLastAiResponse('');
    setLastFinishReason('');

    try {
      const task = async () => {
        let combined = '';
        let finalFinishReason = '';
        const continuationLimit = autoContinueOnMaxTokens ? Math.max(0, maxContinuations) : 0;

        for (let round = 0; round <= continuationLimit; round += 1) {
          const currentPrompt =
            round === 0
              ? basePrompt
              : [
                  basePrompt,
                  '上一次回答因输出长度触达上限而中断。',
                  '请从上一次最后一句继续写，不要重复前文，不要重写已写内容。',
                  `已生成末尾（仅供衔接）：\n${combined.slice(-800)}`,
                ].join('\n\n');

          const result = await callGeminiOnce(currentPrompt);
          combined = combined ? `${combined}\n${result.text}` : result.text;
          finalFinishReason = result.finishReason;

          if (result.finishReason !== 'MAX_TOKENS') {
            break;
          }
        }

        setLastAiResponse(combined);
        setLastFinishReason(finalFinishReason);
      };

      await enqueueRequest(task);
    } catch (error) {
      console.error(error);
      setLastError(error instanceof Error ? error.message : '生成失败');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateBenchmarkIdeaWithGemini = async () => {
    const basePrompt = benchmarkGeneratedPrompt.trim() || buildBenchmarkIdeaPrompt();
    if (!basePrompt) return;

    setIsGenerating(true);
    setBenchmarkIdeaError('');
    setBenchmarkIdeaResponse('');
    setBenchmarkIdeaFinishReason('');

    try {
      const task = async () => {
        let combined = '';
        let finalFinishReason = '';
        const continuationLimit = autoContinueOnMaxTokens ? Math.max(0, maxContinuations) : 0;

        for (let round = 0; round <= continuationLimit; round += 1) {
          const currentPrompt =
            round === 0
              ? basePrompt
              : [
                  basePrompt,
                  '上一次回答因输出长度触达上限而中断。',
                  '请从上一次最后一句继续写，不要重复前文，不要重写已写内容。',
                  `已生成末尾（仅供衔接）：\n${combined.slice(-800)}`,
                ].join('\n\n');

          const result = await callGeminiOnce(currentPrompt);
          combined = combined ? `${combined}\n${result.text}` : result.text;
          finalFinishReason = result.finishReason;

          if (result.finishReason !== 'MAX_TOKENS') {
            break;
          }
        }

        setBenchmarkIdeaResponse(combined);
        setBenchmarkIdeaFinishReason(finalFinishReason);
      };

      await enqueueRequest(task);
    } catch (error) {
      console.error(error);
      setBenchmarkIdeaError(error instanceof Error ? error.message : '生成失败');
    } finally {
      setIsGenerating(false);
    }
  };

  const saveAiResponseToWorkflow = () => {
    const text = lastAiResponse.trim();
    if (!text) return;

    const targetChapter = safeParsePositiveInt(targetChapterText, 1);

    if (promptStage === 'global') {
      const next: GlobalRound = {
        id: newId('global_round'),
        question: promptTask.trim() || '未命名问题',
        answer: text,
        accepted: '',
        openQuestions: '',
        createdAt: Date.now(),
      };
      setWorkflow(prev => ({
        ...prev,
        globalRounds: [next, ...prev.globalRounds],
      }));
      setSelectedRoundIds(prev => [...prev, next.id]);
      return;
    }

    if (promptStage === 'chapter_plan') {
      const next: ChapterPlan = {
        id: newId('chapter_plan'),
        chapterNumber: targetChapter,
        title: `第${targetChapter}章（AI草稿）`,
        characterSetup: '',
        detailedPlot: text,
        supportingRoles: '',
        keyLines: '',
        notes: '由 Prompt 工作台自动保存',
        status: 'planning',
      };
      setWorkflow(prev => ({
        ...prev,
        chapterPlans: sortByChapter([...prev.chapterPlans, next]),
      }));
      setSelectedPlanIds(prev => [...prev, next.id]);
      return;
    }

    const next: ChapterDraft = {
      id: newId('chapter_draft'),
      chapterNumber: targetChapter,
      title: `第${targetChapter}章正文（AI草稿）`,
      sourcePlanHint: '',
      content: text,
      notes: '由 Prompt 工作台自动保存',
      status: 'drafting',
    };
    setWorkflow(prev => ({
      ...prev,
      chapterDrafts: sortByChapter([...prev.chapterDrafts, next]),
    }));
  };

  const clearAllData = () => {
    if (!window.confirm('确定清空“小说流程工作台”里的所有数据吗？此操作不可撤销。')) {
      return;
    }
    setWorkflow(DEFAULT_STATE);
    setSelectedBenchmarkIds([]);
    setSelectedBenchmarkChapterIds([]);
    setActiveBenchmarkNovelId(null);
    setActiveBenchmarkChapterId(null);
    setBenchmarkGeneratedPrompt('');
    setBenchmarkIdeaResponse('');
    setBenchmarkIdeaFinishReason('');
    setBenchmarkIdeaError('');
    setBenchmarkPromptCopyMessage('');
    setImportNovelError('');
    setPendingUploadBenchmarkId(null);
    setActiveDropBenchmarkId(null);
    setSelectedRoundIds([]);
    setSelectedPlanIds([]);
    setGeneratedPrompt('');
    setLastAiResponse('');
    setLastFinishReason('');
    setLastError('');
    setCopyMessage('');
  };

  return (
    <Workbench>
      <input
        ref={txtFileInputRef}
        type="file"
        accept=".txt,text/plain"
        style={{ display: 'none' }}
        onChange={event => {
          const file = event.target.files?.[0];
          const targetBenchmarkId = pendingUploadBenchmarkId;
          event.target.value = '';
          setPendingUploadBenchmarkId(null);
          if (!file || !targetBenchmarkId) return;
          void handleUploadTxtForBenchmark(targetBenchmarkId, file);
        }}
      />
      <Intro>
        这个工作台按你的流程拆成 4 个阶段：对标小说库、全局人设/剧情多轮讨论、章节详细规划、章节正文草稿。每个阶段都能独立推进，你可以一边继续规划后续章节，一边开始写前面章节正文。
      </Intro>

      <BoardScroll>
        <Board>
          <Lane>
            <LaneTitle>基础输入区</LaneTitle>
      <Section>
        <Row>
          <SectionTitle>1) 对标小说库</SectionTitle>
          <Button type="button" onClick={addBenchmark}>新增对标小说</Button>
        </Row>
        <Hint>
          左栏用于管理多本对标小说。每本小说可拆成章节，点击章节即可查看/编辑正文，并选择 1-3 章或范围章节发给 Gemini。
        </Hint>
        <Row>
          <Label style={{ flex: 1, minWidth: 240 }}>
            从已分析小说导入
            <Select
              value={selectedImportNovelId}
              onChange={event => setSelectedImportNovelId(event.target.value)}
              disabled={isLoadingImportableNovels || !importableNovels.length}
            >
              {!importableNovels.length && <option value="">暂无可导入小说</option>}
              {importableNovels.map(item => (
                <option key={item.id} value={item.id}>
                  {(item.title || '未命名小说') + `（${item.chapters?.length || 0}章）`}
                </option>
              ))}
            </Select>
          </Label>
          <Button
            type="button"
            variant="secondary"
            onClick={() => importAnalyzedNovelToBenchmark('current')}
            disabled={isImportingNovel || isLoadingImportableNovels || !selectedImportNovelId}
          >
            {isImportingNovel ? '导入中...' : '导入到当前对标'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => importAnalyzedNovelToBenchmark('new')}
            disabled={isImportingNovel || isLoadingImportableNovels || !selectedImportNovelId}
          >
            {isImportingNovel ? '导入中...' : '导入为新对标'}
          </Button>
        </Row>
        {importNovelError && <Result>{importNovelError}</Result>}
        {!workflow.benchmarkNovels.length && <EmptyHint>还没有对标小说。点击“新增对标小说”开始。</EmptyHint>}
        <CardList>
          {workflow.benchmarkNovels.map((item, index) => {
            const isActiveNovel = item.id === activeBenchmarkNovelId;
            const chapters = sortBenchmarkChapters(item.chapters);
            const selectedCount = chapters.filter(chapter => selectedBenchmarkChapterIds.includes(chapter.id)).length;
            return (
              <Card key={item.id}>
                <Row>
                  <CardTitle>{`对标 #${index + 1}${item.title ? ` · ${item.title}` : ''}`}</CardTitle>
                  <MetaText>{`章节 ${chapters.length} | 已选 ${selectedCount}`}</MetaText>
                  <Button type="button" variant="secondary" onClick={() => setActiveBenchmarkNovelId(item.id)}>
                    {isActiveNovel ? '当前小说' : '设为当前'}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => addBenchmarkChapter(item.id)}>
                    新增章节
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => triggerBenchmarkTxtPicker(item.id)}>
                    上传TXT
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => splitBenchmarkOpeningToChapters(item.id)}>
                    自动拆章
                  </Button>
                  <Button type="button" variant="danger" onClick={() => deleteBenchmark(item.id)}>
                    删除
                  </Button>
                  <CheckboxWrap>
                    <input
                      type="checkbox"
                      checked={selectedBenchmarkIds.includes(item.id)}
                      onChange={() => toggleSelected(item.id, selectedBenchmarkIds, setSelectedBenchmarkIds)}
                    />
                    带入旧 Prompt Builder
                  </CheckboxWrap>
                </Row>
                <Row>
                  <Label>
                    标题
                    <Input
                      value={item.title}
                      onChange={event => updateBenchmark(item.id, { title: event.target.value })}
                      placeholder="例如：某本对标小说"
                    />
                  </Label>
                  <Label>
                    作者
                    <Input
                      value={item.author}
                      onChange={event => updateBenchmark(item.id, { author: event.target.value })}
                      placeholder="作者名"
                    />
                  </Label>
                </Row>
                <Label>
                  风格/卖点摘要
                  <SmallTextArea
                    value={item.summary}
                    onChange={event => updateBenchmark(item.id, { summary: event.target.value })}
                    placeholder="节奏、爽点、人物关系、语言风格..."
                  />
                </Label>
                <Label>
                  章节原文（可粘贴多章后点击“自动拆章”）
                  <TextArea
                    value={item.openingChapters}
                    onChange={event => updateBenchmark(item.id, { openingChapters: event.target.value })}
                    placeholder="可粘贴整段章节文本，自动拆章会按“第X章/Chapter”等标题切分"
                  />
                </Label>
                <UploadDropZone
                  $active={activeDropBenchmarkId === item.id}
                  onDragEnter={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    setActiveDropBenchmarkId(item.id);
                  }}
                  onDragOver={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    setActiveDropBenchmarkId(item.id);
                  }}
                  onDragLeave={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (activeDropBenchmarkId === item.id) {
                      setActiveDropBenchmarkId(null);
                    }
                  }}
                  onDrop={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    setActiveDropBenchmarkId(null);
                    const file = event.dataTransfer?.files?.[0];
                    if (!file) return;
                    void handleUploadTxtForBenchmark(item.id, file);
                  }}
                >
                  拖拽 `.txt` 到这里，自动分章并覆盖当前对标小说的章节内容。
                </UploadDropZone>

                {isActiveNovel && (
                  <>
                    <Divider />
                    {!chapters.length ? (
                      <EmptyHint>当前小说还没有章节。可点击“新增章节”手动添加，或粘贴原文后点“自动拆章”。</EmptyHint>
                    ) : (
                      <>
                        <Hint>点击章节可查看内容；勾选后会带入“章节思路提示词”。</Hint>
                        <ChapterListWrap>
                          {chapters.map(chapter => {
                            const isSelected = selectedBenchmarkChapterIds.includes(chapter.id);
                            const isActive = activeBenchmarkChapterId === chapter.id;
                            return (
                              <ChapterListItem
                                key={chapter.id}
                                $active={isActive}
                                onClick={() => setActiveBenchmarkChapterId(chapter.id)}
                              >
                                <Row style={{ justifyContent: 'space-between' }}>
                                  <CardTitle>{`第${chapter.chapterNumber}章 ${chapter.title || ''}`.trim()}</CardTitle>
                                  <CheckboxWrap>
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onClick={event => event.stopPropagation()}
                                      onChange={() => toggleBenchmarkChapterSelected(chapter.id)}
                                    />
                                    选中
                                  </CheckboxWrap>
                                </Row>
                              </ChapterListItem>
                            );
                          })}
                        </ChapterListWrap>

                        {activeBenchmarkChapter && (
                          <>
                            <Row>
                              <Label>
                                章节号
                                <NumberInput
                                  type="number"
                                  min={1}
                                  value={activeBenchmarkChapter.chapterNumber}
                                  onChange={event =>
                                    updateBenchmarkChapter(item.id, activeBenchmarkChapter.id, {
                                      chapterNumber: safeParsePositiveInt(event.target.value, activeBenchmarkChapter.chapterNumber),
                                    })
                                  }
                                />
                              </Label>
                              <Label style={{ flex: 1 }}>
                                章节标题
                                <Input
                                  value={activeBenchmarkChapter.title}
                                  onChange={event =>
                                    updateBenchmarkChapter(item.id, activeBenchmarkChapter.id, { title: event.target.value })
                                  }
                                />
                              </Label>
                              <Button
                                type="button"
                                variant="danger"
                                onClick={() => deleteBenchmarkChapter(item.id, activeBenchmarkChapter.id)}
                              >
                                删除当前章
                              </Button>
                            </Row>
                            <Label>
                              当前章节内容
                              <TextArea
                                value={activeBenchmarkChapter.content}
                                onChange={event =>
                                  updateBenchmarkChapter(item.id, activeBenchmarkChapter.id, { content: event.target.value })
                                }
                                placeholder="这里放这一章的正文内容"
                              />
                            </Label>
                          </>
                        )}
                      </>
                    )}
                  </>
                )}
              </Card>
            );
          })}
        </CardList>

        <Divider />
        <SectionTitle>对标章节提问（Gemini）</SectionTitle>
        <Hint>支持“第一章 / 前1-3章 / 范围”选择，提示词有默认模板，可直接改。</Hint>
        <Row>
          <Label>
            章节选择
            <Select value={chapterSelectMode} onChange={event => setChapterSelectMode(event.target.value as ChapterSelectMode)}>
              <option value="first">只选第一章</option>
              <option value="count">选前 1-3 章</option>
              <option value="range">按章节范围</option>
              <option value="manual">手动勾选</option>
            </Select>
          </Label>
          {chapterSelectMode === 'count' && (
            <Label>
              章数（1-3）
              <NumberInput
                type="number"
                min={1}
                max={3}
                value={selectChapterCountText}
                onChange={event => setSelectChapterCountText(event.target.value)}
              />
            </Label>
          )}
          {chapterSelectMode === 'range' && (
            <>
              <Label>
                起始章
                <NumberInput
                  type="number"
                  min={1}
                  value={selectRangeStartText}
                  onChange={event => setSelectRangeStartText(event.target.value)}
                />
              </Label>
              <Label>
                结束章
                <NumberInput
                  type="number"
                  min={1}
                  value={selectRangeEndText}
                  onChange={event => setSelectRangeEndText(event.target.value)}
                />
              </Label>
            </>
          )}
          <Button type="button" variant="secondary" onClick={applyBenchmarkChapterSelection}>
            应用章节选择
          </Button>
          <Button type="button" variant="secondary" onClick={() => setSelectedBenchmarkChapterIds([])}>
            清空已选
          </Button>
        </Row>
        <MetaText>
          {`当前已选 ${selectedBenchmarkChapterContexts.length} 章${
            activeBenchmarkNovel ? `（当前小说：${activeBenchmarkNovel.title || '未命名'}）` : ''
          }`}
        </MetaText>
        <Label>
          提示词（默认可改）
          <TextArea
            value={workflow.benchmarkIdeaPrompt}
            onChange={event => setWorkflow(prev => ({ ...prev, benchmarkIdeaPrompt: event.target.value }))}
            placeholder={DEFAULT_BENCHMARK_IDEA_PROMPT}
          />
        </Label>
        <Row>
          <Button type="button" onClick={buildBenchmarkIdeaPrompt}>生成章节提示词</Button>
          <Button type="button" variant="secondary" onClick={copyBenchmarkIdeaPrompt}>复制章节提示词</Button>
          <Button type="button" onClick={generateBenchmarkIdeaWithGemini} disabled={isGenerating}>
            {isGenerating ? '生成中...' : '发送给 Gemini 生成思路'}
          </Button>
          {benchmarkPromptCopyMessage && <MetaText>{benchmarkPromptCopyMessage}</MetaText>}
        </Row>
        <TextArea value={benchmarkGeneratedPrompt} readOnly placeholder="发送给 Gemini 的提示词会显示在这里" />
      </Section>

      <Section>
        <SectionTitle>补充) 全局人设/剧情（多轮讨论）</SectionTitle>
        <Hint>这里不要求一次定稿。先讨论，再把你认可的部分沉淀到“全局基线”。</Hint>
        <Row>
          <Label style={{ flex: 1 }}>
            全局人设基线
            <TextArea
              value={workflow.globalCharacterCore}
              onChange={event => setWorkflow(prev => ({ ...prev, globalCharacterCore: event.target.value }))}
              placeholder="主角定位、配角关系、核心矛盾..."
            />
          </Label>
        </Row>
        <Row>
          <Label style={{ flex: 1 }}>
            全局剧情基线
            <TextArea
              value={workflow.globalPlotCore}
              onChange={event => setWorkflow(prev => ({ ...prev, globalPlotCore: event.target.value }))}
              placeholder="大阶段目标、关键转折、风险点..."
            />
          </Label>
        </Row>
        <Row>
          <Label style={{ flex: 1 }}>
            文风/规则约束
            <SmallTextArea
              value={workflow.globalToneAndRules}
              onChange={event => setWorkflow(prev => ({ ...prev, globalToneAndRules: event.target.value }))}
              placeholder="比如第一人称/第三人称、禁止越级战力、避免术语堆砌..."
            />
          </Label>
        </Row>

        <Row>
          <Button type="button" onClick={addGlobalRound}>新增一轮讨论</Button>
        </Row>
        {!workflow.globalRounds.length && <EmptyHint>暂无讨论记录。可用下方 Prompt Builder 生成后再保存。</EmptyHint>}
        <CardList>
          {workflow.globalRounds.map((item, index) => (
            <Card key={item.id}>
              <Row>
                <CardTitle>讨论轮次 #{workflow.globalRounds.length - index}</CardTitle>
                <MetaText>{new Date(item.createdAt).toLocaleString('zh-CN')}</MetaText>
                <Button type="button" variant="danger" onClick={() => deleteGlobalRound(item.id)}>删除</Button>
                <CheckboxWrap>
                  <input
                    type="checkbox"
                    checked={selectedRoundIds.includes(item.id)}
                    onChange={() => toggleSelected(item.id, selectedRoundIds, setSelectedRoundIds)}
                  />
                  带入提示词
                </CheckboxWrap>
              </Row>
              <Label>
                本轮问题
                <SmallTextArea
                  value={item.question}
                  onChange={event => updateGlobalRound(item.id, { question: event.target.value })}
                  placeholder="你本轮提问的重点"
                />
              </Label>
              <Label>
                AI 回答
                <TextArea
                  value={item.answer}
                  onChange={event => updateGlobalRound(item.id, { answer: event.target.value })}
                  placeholder="可粘贴 Gemini 或 Cherry 的回答"
                />
              </Label>
              <Row>
                <Label style={{ flex: 1 }}>
                  我认可的部分
                  <SmallTextArea
                    value={item.accepted}
                    onChange={event => updateGlobalRound(item.id, { accepted: event.target.value })}
                    placeholder="保留为后续稳定上下文"
                  />
                </Label>
                <Label style={{ flex: 1 }}>
                  下一轮要追问
                  <SmallTextArea
                    value={item.openQuestions}
                    onChange={event => updateGlobalRound(item.id, { openQuestions: event.target.value })}
                    placeholder="继续打磨的问题列表"
                  />
                </Label>
              </Row>
            </Card>
          ))}
        </CardList>
      </Section>

          </Lane>
          <Lane>
            <LaneTitle>章节执行区</LaneTitle>

      <Section>
        <SectionTitle>2) Gemini 返回的大概思路</SectionTitle>
        <Hint>这里显示左栏“对标章节提问”返回的结果。</Hint>
        <MetaText>{`当前已选对标章节：${selectedBenchmarkChapterContexts.length} 章`}</MetaText>
        {benchmarkIdeaFinishReason && <MetaText>finishReason: {benchmarkIdeaFinishReason}</MetaText>}
        {benchmarkIdeaError && <Result>{benchmarkIdeaError}</Result>}
        <TextArea value={benchmarkIdeaResponse} readOnly placeholder="Gemini 返回的“大概思路”会显示在这里" />
      </Section>

      <Section>
        <Row>
          <SectionTitle>3) 章节详细规划（不写正文）</SectionTitle>
          <Button type="button" onClick={addChapterPlan}>新增章节规划</Button>
        </Row>
        <Hint>按章记录“出场人物 + 具体剧情 + 龙套作用 + 关键台词”，可先做 1-30，再继续 31+。</Hint>
        {!chapterPlansSorted.length && <EmptyHint>暂无章节规划。可从 Prompt Builder 自动保存一条。</EmptyHint>}
        <CardList>
          {chapterPlansSorted.map(item => (
            <Card key={item.id}>
              <Row>
                <CardTitle>第{item.chapterNumber}章</CardTitle>
                <Chip tone={item.status === 'ready' ? 'ready' : 'pending'}>
                  {item.status === 'ready' ? '可写正文' : '规划中'}
                </Chip>
                <Button type="button" variant="danger" onClick={() => deleteChapterPlan(item.id)}>删除</Button>
                <CheckboxWrap>
                  <input
                    type="checkbox"
                    checked={selectedPlanIds.includes(item.id)}
                    onChange={() => toggleSelected(item.id, selectedPlanIds, setSelectedPlanIds)}
                  />
                  带入提示词
                </CheckboxWrap>
              </Row>
              <Row>
                <Label>
                  章节号
                  <NumberInput
                    type="number"
                    min={1}
                    value={item.chapterNumber}
                    onChange={event =>
                      updateChapterPlan(item.id, {
                        chapterNumber: safeParsePositiveInt(event.target.value, item.chapterNumber),
                      })
                    }
                  />
                </Label>
                <Label style={{ flex: 1 }}>
                  标题
                  <Input
                    value={item.title}
                    onChange={event => updateChapterPlan(item.id, { title: event.target.value })}
                  />
                </Label>
                <Label>
                  状态
                  <Select
                    value={item.status}
                    onChange={event => updateChapterPlan(item.id, { status: event.target.value as ChapterPlanStatus })}
                  >
                    <option value="planning">规划中</option>
                    <option value="ready">可写正文</option>
                  </Select>
                </Label>
              </Row>
              <Label>
                出场人物与定位
                <SmallTextArea
                  value={item.characterSetup}
                  onChange={event => updateChapterPlan(item.id, { characterSetup: event.target.value })}
                  placeholder="主角/配角/龙套及动机"
                />
              </Label>
              <Label>
                详细剧情（按场景）
                <TextArea
                  value={item.detailedPlot}
                  onChange={event => updateChapterPlan(item.id, { detailedPlot: event.target.value })}
                  placeholder="场景1、场景2、冲突节点、转折..."
                />
              </Label>
              <Row>
                <Label style={{ flex: 1 }}>
                  龙套作用
                  <SmallTextArea
                    value={item.supportingRoles}
                    onChange={event => updateChapterPlan(item.id, { supportingRoles: event.target.value })}
                  />
                </Label>
                <Label style={{ flex: 1 }}>
                  关键台词
                  <SmallTextArea
                    value={item.keyLines}
                    onChange={event => updateChapterPlan(item.id, { keyLines: event.target.value })}
                  />
                </Label>
              </Row>
              <Label>
                备注
                <SmallTextArea
                  value={item.notes}
                  onChange={event => updateChapterPlan(item.id, { notes: event.target.value })}
                />
              </Label>
            </Card>
          ))}
        </CardList>
      </Section>

      <Section>
        <Row>
          <SectionTitle>4) 章节正文草稿</SectionTitle>
          <Button type="button" onClick={addChapterDraft}>新增正文草稿</Button>
        </Row>
        <Hint>可以在继续规划后续章节时，同时从前面章节开始写正文。</Hint>
        {!chapterDraftsSorted.length && <EmptyHint>暂无正文草稿。可从 Prompt Builder 自动保存一条。</EmptyHint>}
        <CardList>
          {chapterDraftsSorted.map(item => (
            <Card key={item.id}>
              <Row>
                <CardTitle>第{item.chapterNumber}章正文</CardTitle>
                <Chip tone={item.status === 'ready' ? 'ready' : 'pending'}>
                  {item.status === 'ready' ? '已定稿' : '写作中'}
                </Chip>
                <Button type="button" variant="danger" onClick={() => deleteChapterDraft(item.id)}>删除</Button>
              </Row>
              <Row>
                <Label>
                  章节号
                  <NumberInput
                    type="number"
                    min={1}
                    value={item.chapterNumber}
                    onChange={event =>
                      updateChapterDraft(item.id, {
                        chapterNumber: safeParsePositiveInt(event.target.value, item.chapterNumber),
                      })
                    }
                  />
                </Label>
                <Label style={{ flex: 1 }}>
                  标题
                  <Input
                    value={item.title}
                    onChange={event => updateChapterDraft(item.id, { title: event.target.value })}
                  />
                </Label>
                <Label>
                  状态
                  <Select
                    value={item.status}
                    onChange={event => updateChapterDraft(item.id, { status: event.target.value as ChapterDraftStatus })}
                  >
                    <option value="drafting">写作中</option>
                    <option value="ready">已定稿</option>
                  </Select>
                </Label>
              </Row>
              <Label>
                对应规划提示（可填：使用了哪条章节规划）
                <Input
                  value={item.sourcePlanHint}
                  onChange={event => updateChapterDraft(item.id, { sourcePlanHint: event.target.value })}
                  placeholder="例如：对应第12章章节规划"
                />
              </Label>
              <Label>
                正文内容
                <TextArea
                  value={item.content}
                  onChange={event => updateChapterDraft(item.id, { content: event.target.value })}
                  placeholder="这里放章节正文"
                />
              </Label>
              <Label>
                修订备注
                <SmallTextArea
                  value={item.notes}
                  onChange={event => updateChapterDraft(item.id, { notes: event.target.value })}
                />
              </Label>
            </Card>
          ))}
        </CardList>
      </Section>

          </Lane>
          <Lane>
            <LaneTitle>提示词与生成区</LaneTitle>

      <Section>
        <SectionTitle>Prompt Builder + Gemini（可选）</SectionTitle>
        <Hint>你可以只用“生成提示词 + 复制到 Cherry”，也可以直接用 Gemini API。两种方式可并行。</Hint>
        <Row>
          <Label>
            任务阶段
            <Select value={promptStage} onChange={event => setPromptStage(event.target.value as PromptStage)}>
              <option value="global">全局人设/剧情</option>
              <option value="chapter_plan">章节详细规划</option>
              <option value="chapter_draft">章节正文撰写</option>
            </Select>
          </Label>
          <Label>
            目标章节（可空）
            <NumberInput
              type="number"
              min={1}
              value={targetChapterText}
              onChange={event => setTargetChapterText(event.target.value)}
              placeholder="如 1 / 31"
            />
          </Label>
        </Row>
        <Label>
          本轮任务描述
          <TextArea
            value={promptTask}
            onChange={event => setPromptTask(event.target.value)}
            placeholder="描述你本轮要 AI 做的事情，比如“给我3套主角成长路线并说明优缺点”"
          />
        </Label>
        <Label>
          额外约束（可选）
          <SmallTextArea
            value={promptExtraConstraints}
            onChange={event => setPromptExtraConstraints(event.target.value)}
            placeholder="例如：节奏偏快、每场景要有冲突、避免过度旁白"
          />
        </Label>

        <Divider />
        <Hint>选择要带入的上下文：</Hint>
        <Row>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setSelectedBenchmarkIds(workflow.benchmarkNovels.map(item => item.id))}
          >
            对标全选
          </Button>
          <Button type="button" variant="secondary" onClick={() => setSelectedBenchmarkIds([])}>
            清空对标
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setSelectedRoundIds(workflow.globalRounds.map(item => item.id))}
          >
            讨论全选
          </Button>
          <Button type="button" variant="secondary" onClick={() => setSelectedRoundIds([])}>
            清空讨论
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setSelectedPlanIds(chapterPlansSorted.map(item => item.id))}
          >
            规划全选
          </Button>
          <Button type="button" variant="secondary" onClick={() => setSelectedPlanIds([])}>
            清空规划
          </Button>
        </Row>
        <MetaText>
          当前上下文：对标 {selectedBenchmarkIds.length} 条 / 讨论 {selectedRoundIds.length} 条 / 章节规划 {selectedPlanIds.length} 条
        </MetaText>

        <Row>
          <Button type="button" onClick={buildPrompt}>生成提示词</Button>
          <Button type="button" variant="secondary" onClick={copyPrompt}>复制提示词</Button>
          {copyMessage && <MetaText>{copyMessage}</MetaText>}
        </Row>
        <TextArea value={generatedPrompt} readOnly placeholder="生成后的提示词会显示在这里" />

        <Divider />
        <Hint>Gemini（前端直连，本机自用）。如只用 Cherry，可跳过下面配置。</Hint>
        <Row>
          <Label style={{ flex: 1 }}>
            API Key
            <Input
              type="password"
              value={geminiApiKey}
              onChange={event => setGeminiApiKey(event.target.value)}
              placeholder="AIza..."
            />
          </Label>
          <Label>
            模型
            <Input value={geminiModel} onChange={event => setGeminiModel(event.target.value)} placeholder="gemini-2.5-flash" />
          </Label>
        </Row>
        <Row>
          <Label>
            maxOutputTokens
            <NumberInput
              type="number"
              min={64}
              max={8192}
              value={maxOutputTokens}
              onChange={event => setMaxOutputTokens(safeParsePositiveInt(event.target.value, 1800))}
            />
          </Label>
          <Label>
            temperature (x100)
            <NumberInput
              type="number"
              min={0}
              max={200}
              value={Math.round(temperature * 100)}
              onChange={event => {
                const value = safeParseNonNegativeInt(event.target.value, 85);
                setTemperature(Math.min(2, Math.max(0, value / 100)));
              }}
            />
          </Label>
          <Label>
            自动续写次数
            <NumberInput
              type="number"
              min={0}
              max={5}
              value={maxContinuations}
              onChange={event => setMaxContinuations(safeParseNonNegativeInt(event.target.value, 1))}
            />
          </Label>
        </Row>
        <Row>
          <CheckboxWrap>
            <input
              type="checkbox"
              checked={autoContinueOnMaxTokens}
              onChange={event => setAutoContinueOnMaxTokens(event.target.checked)}
            />
            `MAX_TOKENS` 时自动续写
          </CheckboxWrap>
          <CheckboxWrap>
            <input
              type="checkbox"
              checked={rememberApiKey}
              onChange={event => setRememberApiKey(event.target.checked)}
            />
            本机记住 API Key（localStorage）
          </CheckboxWrap>
        </Row>
        <Row>
          <Button type="button" onClick={generateWithGemini} disabled={isGenerating}>
            {isGenerating ? `生成中...` : '调用 Gemini'}
          </Button>
          <Button type="button" variant="secondary" onClick={saveAiResponseToWorkflow} disabled={!lastAiResponse.trim()}>
            保存当前 AI 结果到工作流
          </Button>
          <MetaText>
            队列中请求: {pendingRequests} | 当前阶段: {stageNameMap[promptStage]}
          </MetaText>
        </Row>
        {lastFinishReason && <MetaText>finishReason: {lastFinishReason}</MetaText>}
        {lastError && <Result>{lastError}</Result>}
        <TextArea value={lastAiResponse} readOnly placeholder="Gemini 返回内容会显示在这里" />
      </Section>

      <Section>
        <Row>
          <SectionTitle>数据管理</SectionTitle>
          <Button type="button" variant="danger" onClick={clearAllData}>清空工作台数据</Button>
        </Row>
        <Hint>数据保存在当前浏览器 localStorage，不依赖后端。若换浏览器或清缓存会丢失。</Hint>
      </Section>
          </Lane>
        </Board>
      </BoardScroll>
    </Workbench>
  );
};

export default NovelWorkflowWorkbench;

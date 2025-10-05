import React, { useState, useRef, useEffect, CSSProperties } from 'react';
import styled from '@emotion/styled';
import type { Novel, Tag, Annotation, User } from "../types";
import { COLORS, SPACING, FONTS, SHADOWS, BORDERS, panelStyles as basePanelStyles } from '../../styles';

import TagPanel from '../TagPanel';
import { ContentPanel } from '../ContentPanel';
import FilterResultsPanel from '../FilterResultsPanel';
import ChapterListView from '../tagpanel/ChapterListView'; // Import ChapterListView
import { usePanelResizer, MIN_PANEL_PERCENTAGE } from './hooks/usePanelResizer';
import { useNovelEditorState } from './hooks/useNovelEditorState';
import StorylinePanel from '../storyline/StorylinePanel';
import StorylineTrackerPanel from '../storyline/StorylineTrackerPanel';
import { novelsApi, annotationsApi } from '../../api';
import { tagCompatApi as tagsApi } from '../../api/tagCompat';


interface NovelEditorPageProps {
  novel: Novel;
  allUserTags: Tag[];
  allUserAnnotations: Annotation[];
  setNovels: React.Dispatch<React.SetStateAction<Novel[]>>;
  setAllUserTags: React.Dispatch<React.SetStateAction<Tag[]>>;
  setAllUserAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>;
  onNavigateBack: () => void;
  currentUser: User;
  onUpdateTagName: (tagId: string, newName: string) => void;
  novelDataCache?: React.MutableRefObject<Map<string, {
    tags: Tag[];
    annotations: Annotation[];
    timestamp: number;
  }>>;
}

export type EditorMode = 'edit' | 'annotation' | 'read' | 'storyline'; 

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

const NovelEditorPage: React.FC<NovelEditorPageProps> = ({
  novel, allUserTags, allUserAnnotations, setNovels, setAllUserTags, setAllUserAnnotations,
  onNavigateBack, currentUser, onUpdateTagName, novelDataCache
}) => {
  const mainContentAreaRef = useRef<HTMLDivElement>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>('annotation');
  const [isLoadingNovelData, setIsLoadingNovelData] = useState(false);
  const [loadedAnnotationsForNovelIds, setLoadedAnnotationsForNovelIds] = useState<Set<string>>(new Set());

  // 🆕 进入编辑器时加载小说全文、标签和标注
  useEffect(() => {
    const loadNovelData = async () => {
      try {
        const startTime = performance.now();
        console.log('[NovelEditor] 开始加载小说数据:', novel.id);

        // 🔧 先清理其他小说的数据，只保留全局数据和当前小说数据
        setAllUserTags(prev => prev.filter(t => t.novelId === null || t.novelId === novel.id));
        setAllUserAnnotations(prev => prev.filter(a => a.novelId === novel.id));

        // ✅ 检查缓存（5分钟内有效）
        const CACHE_TTL = 5 * 60 * 1000; // 5分钟
        const cached = novelDataCache?.current.get(novel.id);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
          console.log('[NovelEditor] ✅ 使用缓存数据，跳过加载');
          // 从缓存恢复数据（只需要补充，因为上面已经过滤过了）
          setAllUserTags(prev => {
            const globalTags = prev.filter(t => t.novelId === null);
            const currentNovelTags = prev.filter(t => t.novelId === novel.id);
            // 如果当前小说标签为空，才从缓存恢复
            if (currentNovelTags.length === 0) {
              return [...globalTags, ...cached.tags];
            }
            return prev;
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

        // ✅ 检查本地状态缓存（同一会话内）
        const currentNovelTags = allUserTags.filter(t => t.novelId === novel.id);
        const currentNovelAnnotations = allUserAnnotations.filter(a => a.novelId === novel.id);
        if (loadedAnnotationsForNovelIds.has(novel.id) && currentNovelTags.length > 0 && currentNovelAnnotations.length > 0) {
          console.log('[NovelEditor] ✅ 该小说数据已在本地缓存，跳过加载');
          return;
        }

        setIsLoadingNovelData(true);

        // 1. 如果小说全文为空，加载全文
        if (!novel.text || novel.text.trim() === '') {
          console.log('[NovelEditor] 加载小说全文...');
          const t1 = performance.now();
          const fullNovel = await novelsApi.getById(novel.id);
          console.log('[NovelEditor] 小说全文加载完成，耗时:', (performance.now() - t1).toFixed(2), 'ms');
          setNovels(prev => prev.map(n => n.id === novel.id ? fullNovel : n));
        }

        // 2. 🆕 加载该小说的标签 + 全局标签
        console.log('[NovelEditor] 加载标签...');
        const t2 = performance.now();
        const [novelTags, allTags] = await Promise.all([
          tagsApi.getAll({ novelId: novel.id }),  // 该小说的标签
          tagsApi.getAll()                         // 所有标签（用于获取全局标签）
        ]);
        const t2_1 = performance.now();
        console.log('[NovelEditor] API 调用完成，耗时:', (t2_1 - t2).toFixed(2), 'ms');
        console.log('[NovelEditor] 返回的标签数量 - 小说:', novelTags.length, '全部:', allTags.length);

        const t2_2 = performance.now();
        const globalTags = allTags.filter(t => t.novelId === null); // 筛选全局标签
        console.log('[NovelEditor] 筛选全局标签完成，耗时:', (performance.now() - t2_2).toFixed(2), 'ms', '数量:', globalTags.length);

        // 🆕 确保当前小说有「待标注」标签
        const PENDING_TAG_NAME = '待标注';
        const PENDING_TAG_COLOR = '#cccccc';
        let finalNovelTags = [...novelTags];

        const hasPendingTag = novelTags.some(t => t.name === PENDING_TAG_NAME);
        if (!hasPendingTag) {
          console.log('[NovelEditor] 为小说创建「待标注」标签...');
          try {
            const newPendingTag = await tagsApi.create({
              name: PENDING_TAG_NAME,
              color: PENDING_TAG_COLOR,
              parentId: null,
              novelId: novel.id, // 小说级别的标签
            });
            finalNovelTags.push(newPendingTag);
            console.log('[NovelEditor] 「待标注」标签创建成功');
          } catch (error) {
            console.error('创建待标注标签失败:', error);
          }
        }

        // 🔧 只保留当前小说的标签和全局标签，删除其他小说的标签
        const t2_3 = performance.now();
        const allTagsMap = new Map<string, Tag>();
        [...globalTags, ...finalNovelTags].forEach(tag => {
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

        // 🆕 保存到缓存
        if (novelDataCache) {
          novelDataCache.current.set(novel.id, {
            tags: Array.from(allTagsMap.values()).filter(t => t.novelId === novel.id),
            annotations: formattedAnnotations,
            timestamp: Date.now(),
          });
          console.log('[NovelEditor] 数据已保存到缓存');
        }

        const endTime = performance.now();
        console.log('[NovelEditor] ✅ 全部加载完成，总耗时:', (endTime - startTime).toFixed(2), 'ms');

        // 数据更新完成后才关闭 loading，避免中间状态渲染
        const t6 = performance.now();
        setIsLoadingNovelData(false);
        console.log('[NovelEditor] setIsLoadingNovelData(false) 完成，耗时:', (performance.now() - t6).toFixed(2), 'ms');
      } catch (error) {
        console.error('❌ 加载小说数据错误:', error);
        alert('加载小说数据失败，请刷新重试');
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
    editorMode, 
  });

  const {
    panelWidths,
    handleMouseDownOnResizer,
    hoveredResizer,
    setHoveredResizer,
  } = usePanelResizer({
    initialWidths: [15, 20, 40, 25],
    minPercentage: MIN_PANEL_PERCENTAGE,
    mainContentAreaRef,
  });

  const contentPanelViewMode = (editorMode === 'read' && (editorState.activeTagId || editorState.globalFilterTagName)) ? 'snippet' : 'full';

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
        <ModeToggleContainer role="radiogroup" aria-label="编辑模式选择">
          <ModeToggleButton
            isActive={editorMode === 'edit'}
            onClick={() => setEditorMode('edit')}
            role="radio"
            aria-checked={editorMode === 'edit'}
            title="画本模式：用于编辑小说原文或章节内容。"
          >
            画本模式
          </ModeToggleButton>
          <ModeToggleButton
            isActive={editorMode === 'annotation'}
            onClick={() => setEditorMode('annotation')}
            role="radio"
            aria-checked={editorMode === 'annotation'}
            title="标注模式：用于预览文本、划词选择并应用标签进行标注。"
          >
            标注模式
          </ModeToggleButton>
          <ModeToggleButton
            isActive={editorMode === 'read'}
            onClick={() => setEditorMode('read')}
            role="radio"
            aria-checked={editorMode === 'read'}
            title="阅读模式：用于查阅小说内容、已标注的片段。"
          >
            阅读模式
          </ModeToggleButton>
          <ModeToggleButton
            isActive={editorMode === 'storyline'}
            onClick={() => setEditorMode('storyline')}
            role="radio"
            aria-checked={editorMode === 'storyline'}
            title="剧情线模式：梳理剧情脉络，追踪故事线发展。"
          >
            剧情线模式
          </ModeToggleButton>
        </ModeToggleContainer>
      </EditorHeader>
      <MainContentArea ref={mainContentAreaRef}>
        <ChapterListPanel style={{ flexBasis: `${panelWidths[0]}%` }}>
            <ChapterListView
                chapters={novel.chapters || []}
                selectedChapterId={editorState.selectedChapterId}
                onSelectChapter={editorState.handleSelectChapter}
                onDeleteChapter={editorState.handleDeleteChapter}
                onRenameChapter={editorState.handleRenameChapter}
            />
        </ChapterListPanel>
        <Resizer
          isHovered={hoveredResizer === 0}
          onMouseDown={(e) => handleMouseDownOnResizer(e, 0)}
          onMouseEnter={() => setHoveredResizer(0)}
          onMouseLeave={() => setHoveredResizer(null)}
          role="separator"
          aria-label="调整章节和标签面板宽度"
        >
          <ResizerIcon>•••</ResizerIcon>
        </Resizer>
        
        {editorMode === 'storyline' ? (
          <StorylinePanel
            style={{ flexBasis: `${panelWidths[1]}%` }}
            storylines={novel.storylines || []}
            activeStorylineId={editorState.activeStorylineId}
            onAddStoryline={editorState.handleAddStoryline}
            onUpdateStoryline={editorState.handleUpdateStoryline}
            onDeleteStoryline={editorState.handleDeleteStoryline}
            onSelectStoryline={editorState.handleSelectStoryline}
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
            editorMode={editorMode}
            onTagGlobalSearch={editorState.handleTagGlobalSearch}
            currentSelection={editorState.currentSelection}
            onCreatePendingAnnotation={editorState.handleCreatePendingAnnotation}
          />
        )}
        
        <Resizer
          isHovered={hoveredResizer === 1}
          onMouseDown={(e) => handleMouseDownOnResizer(e, 1)}
          onMouseEnter={() => setHoveredResizer(1)}
          onMouseLeave={() => setHoveredResizer(null)}
          role="separator"
          aria-label="调整标签面板和内容面板宽度"
        >
          <ResizerIcon>•••</ResizerIcon>
        </Resizer>
        <ContentPanel
          style={{ flexBasis: `${panelWidths[2]}%` }}
          novel={novel}
          onNovelTextChange={editorState.handleNovelTextChange}
          onChapterTextChange={editorState.handleChapterTextChange}
          onTextSelection={editorState.handleTextSelection}
          annotations={editorState.annotationsForCurrentNovel}
          getTagById={editorState.getTagById}
          selectedChapter={editorState.currentChapterDetails}
          viewMode={contentPanelViewMode}
          activeFilterTagDetails={editorState.activeTagDetails}
          globalFilterTagName={editorState.globalFilterTagName}
          allNovelTags={editorState.currentUserTags}
          editorMode={editorMode}
          onDeleteAnnotation={editorState.handleDeleteAnnotation}
          currentSelection={editorState.currentSelection}
          // Storyline props
          onAddPlotAnchor={editorState.handleAddPlotAnchor}
          onDeletePlotAnchor={editorState.handleDeletePlotAnchor}
          onUpdatePlotAnchor={editorState.handleUpdatePlotAnchor}
          scrollToAnchorId={editorState.scrollToAnchorId}
          onScrollToAnchorComplete={() => editorState.setScrollToAnchorId(null)}
          // Chapter navigation
          onSelectChapter={editorState.handleSelectChapter}
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

        {editorMode === 'storyline' ? (
           <StorylineTrackerPanel
             style={{ flexBasis: `${panelWidths[3]}%` }}
             plotAnchors={novel.plotAnchors || []}
             storylines={novel.storylines || []}
             activeStorylineId={editorState.activeStorylineId}
             onSelectAnchor={editorState.setScrollToAnchorId}
             onUpdateAnchor={editorState.handleUpdatePlotAnchor}
             onDeleteAnchor={editorState.handleDeletePlotAnchor}
           />
        ) : (
          <FilterResultsPanel
            style={{ flexBasis: `${panelWidths[3]}%` }}
            annotations={editorState.annotationsToDisplayOrFilter} 
            getTagById={editorState.getTagById}
            activeFilterTag={editorState.activeTagDetails} 
            globalFilterTagName={editorState.globalFilterTagName} 
            onTagClick={editorState.selectTagForReadMode} 
            onTagDoubleClick={editorState.handleTagGlobalSearch} 
            allUserTags={editorState.currentUserTags}
            onDeleteAnnotation={editorState.handleDeleteAnnotation}
          />
        )}
      </MainContentArea>
    </EditorPageContainer>
  );
};

export default NovelEditorPage;
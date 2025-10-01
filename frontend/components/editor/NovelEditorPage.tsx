import React, { useState, useRef, CSSProperties } from 'react';
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
  onNavigateBack, currentUser, onUpdateTagName
}) => {
  const mainContentAreaRef = useRef<HTMLDivElement>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>('annotation'); 
  
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
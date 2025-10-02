import React, { useMemo, useState, CSSProperties, useEffect, useRef } from 'react';
import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import type { Annotation, Tag, Novel, Chapter, SelectionDetails, Storyline, PlotAnchor } from '../types';
import { 
    COLORS, SPACING, FONTS, SHADOWS, 
    panelStyles, globalPlaceholderTextStyles, BORDERS
} from "../styles";
import { getAllDescendantTagIds, getContrastingTextColor, getAllAncestorTagIds } from "../utils";
import type { EditorMode } from './editor/NovelEditorPage';
import PlotAnchorPopover from './storyline/PlotAnchorPopover';


interface ContentPanelProps {
  novel: Novel;
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
}

const Panel = styled.div({
  ...panelStyles,
  minWidth: '280px',
});

const Title = styled.h2`
  font-size: ${FONTS.sizeH3};
  color: ${COLORS.dark};
  margin-bottom: ${SPACING.md};
  display: flex;
  align-items: center;
  flex-wrap: wrap;
`;

const NovelInput = styled.textarea`
  width: 100%;
  padding: ${SPACING.md};
  border: 1px solid ${COLORS.border};
  border-radius: ${BORDERS.radius};
  box-sizing: border-box;
  margin-bottom: ${SPACING.md};
  font-family: inherit;
  font-size: 0.95rem;
  resize: vertical;
  background-color: ${COLORS.white};
  
  /* Always grow to fill the available space in the panel */
  flex-grow: 1;
  /* Set a reasonable minimum height */
  min-height: 300px; 

  &:focus {
    border-color: ${COLORS.primary};
    box-shadow: 0 0 0 0.2rem ${COLORS.primary}40;
    outline: none;
  }
`;

const ContentPreviewContainer = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  min-height: 0; // for flexbox overflow fix
`;

const ContentDisplay = styled.div<{ isFullNovelEditMode?: boolean }>`
  border: 1px solid ${COLORS.borderLight};
  padding: ${SPACING.md};
  overflow-y: auto;
  background-color: ${COLORS.white};
  white-space: pre-wrap;
  word-wrap: break-word;
  font-size: ${FONTS.sizeBase};
  line-height: 1.6;
  border-radius: ${BORDERS.radius};
  user-select: text;
  position: relative;

  /* Default styles */
  flex-grow: 1;
  min-height: 200px;
  
  /* Minimized styles when full novel is being edited above */
  ${props => props.isFullNovelEditMode && `
    flex-grow: 0;
    flex-shrink: 0;
    height: 35%; /* Occupy a smaller portion of the panel */
    max-height: 250px;
    min-height: 150px;
  `}
`;

const AnnotatedSpan = styled.span<{ isMisaligned?: boolean; }>`
  padding: 0.1em 0; /* Remove horizontal padding */
  border-radius: 3px;
  margin: 0; /* Remove margin */
  
  /* Use a consistent outline style and only change color to prevent reflow. */
  outline: 2px solid transparent;
  outline-style: solid; /* Explicitly set for all states */
  transition: outline-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out, background-color 0.15s ease-in-out;

  ${props => {
    if (props.isMisaligned) return `
      outline-color: ${COLORS.warning}; /* Changed from dashed to solid with warning color */
      box-shadow: 0 0 5px ${COLORS.warning}80;
    `;
    return ''; 
  }}
`;

const SnippetContainer = styled.div<{ isMisaligned?: boolean; bgColor?: string }>`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.xs};
  margin-bottom: ${SPACING.md};
  position: relative;
  padding: ${SPACING.md};
  border: 1px solid ${props => props.isMisaligned ? COLORS.warning : 'rgba(0,0,0,0.1)'};
  border-radius: ${BORDERS.radius};
  background-color: ${props => props.isMisaligned ? `${COLORS.warning}20` : (props.bgColor || COLORS.white)};
  box-shadow: ${SHADOWS.small};
`;

const SnippetParagraph = styled.p`
  flex-grow: 1;
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  line-height: 1.6;
  padding-right: ${SPACING.lg}; /* Make space for delete button */
`;

const DeleteSnippetButton = styled.button<{ effectiveColor?: string }>`
  background-color: transparent;
  color: ${props => props.effectiveColor || COLORS.danger};
  padding: 0 ${SPACING.xs};
  font-size: 1.2em;
  line-height: 1;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  min-width: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: none;
  cursor: pointer;
  position: absolute;
  top: ${SPACING.sm};
  right: ${SPACING.sm};
  transition: background-color 0.2s, opacity 0.2s;
  opacity: 0.7;

  &:hover {
    opacity: 1;
    background-color: rgba(0, 0, 0, 0.1);
  }
`;

const SnippetSourceNovel = styled.p<{ effectiveColor?: string }>`
  font-size: ${FONTS.sizeSmall};
  color: ${props => props.effectiveColor || COLORS.textLighter};
  opacity: 0.8;
  margin: 0;
  font-style: italic;
`;

const Placeholder = styled.p(globalPlaceholderTextStyles);

// --- Storyline specific components ---
const ParagraphWrapper = styled.div`
  position: relative;
  padding-top: 2px;
  padding-bottom: 2px;
  &:hover > .add-anchor-btn {
    opacity: 1;
  }
`;

const AddAnchorButton = styled.button`
  position: absolute;
  top: -1px;
  left: -28px; /* Position to the left of the paragraph */
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid ${COLORS.gray300};
  background-color: ${COLORS.white};
  color: ${COLORS.primary};
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 16px;
  line-height: 1;
  opacity: 0;
  transition: opacity 0.2s, background-color 0.2s, box-shadow 0.2s;
  z-index: 5;
  box-shadow: ${SHADOWS.small};

  &:hover {
    background-color: ${COLORS.primary};
    color: ${COLORS.white};
  }
`;

const AnchorLine = styled.div<{ color: string }>`
  position: absolute;
  left: 0;
  right: 0;
  top: -1px; /* Position between paragraphs */
  height: 3px;
  background-color: ${props => props.color};
  opacity: 0.7;
  pointer-events: none; /* Allow clicks to pass through */
`;

const AnchorContainer = styled.div`
  position: relative;
  height: 0; /* Doesn't take up space in the flow */
`;

const flashAnimation = keyframes`
  0% { background-color: ${COLORS.primary}80; }
  100% { background-color: transparent; }
`;

const AnchorMarker = styled.div<{ colors: string[] }>`
  position: absolute;
  top: 0px;
  left: -8px; /* Position to the left of the content */
  right: -8px;
  height: 5px;
  cursor: pointer;
  z-index: 2;

  &[data-is-scrolling-to='true'] {
    animation: ${flashAnimation} 1.5s ease-out;
  }
  
  &:hover .anchor-tooltip {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
  }
`;

const AnchorLineSegment = styled.div`
  height: 100%;
  float: left;
`;

const AnchorTooltip = styled.div`
  position: absolute;
  bottom: 100%;
  left: 0;
  margin-bottom: 4px;
  background-color: ${COLORS.dark};
  color: ${COLORS.white};
  padding: ${SPACING.xs} ${SPACING.sm};
  border-radius: ${BORDERS.radius};
  font-size: ${FONTS.sizeSmall};
  white-space: pre-wrap;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s, visibility 0.2s, transform 0.2s;
  transform: translateY(4px);
  z-index: 20;
  max-width: 300px;
  pointer-events: none; /* Don't interfere with hover */
`;


export const ContentPanel: React.FC<ContentPanelProps> = ({
  novel, onNovelTextChange, onChapterTextChange, onTextSelection, annotations, getTagById, selectedChapter, style,
  viewMode, activeFilterTagDetails, globalFilterTagName, allNovelTags, editorMode,
  onDeleteAnnotation,
  currentSelection,
  onAddPlotAnchor, onDeletePlotAnchor, onUpdatePlotAnchor,
  scrollToAnchorId, onScrollToAnchorComplete
}) => {
  const [editedText, setEditedText] = useState('');
  const [popoverState, setPopoverState] = useState<{ anchor: PlotAnchor | null; position: number; target: HTMLElement } | null>(null);

  const anchorRefs = useRef<Map<string, HTMLDivElement>>(new Map());

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

  useEffect(() => {
    // This effect syncs the local state with the prop from above.
    // It runs when the user selects a new chapter or when the underlying novel text is updated from the parent.
    const sourceText = selectedChapter ? selectedChapter.content : novel.text;
    setEditedText(sourceText);
  }, [selectedChapter, novel.text]);

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

  const textForPreview = useMemo(() => {
    if (viewMode === 'snippet' && editorMode !== 'storyline') return ''; 
    return selectedChapter ? selectedChapter.content : novel.text;
  }, [novel.text, selectedChapter, viewMode, editorMode]);

  const displayOffsetForPreview = useMemo(() => {
    if (viewMode === 'snippet' && editorMode !== 'storyline') return 0;
    return selectedChapter ? selectedChapter.originalStartIndex : 0;
  }, [selectedChapter, viewMode, editorMode]);


  // 缓存标签深度计算，避免重复计算
  const tagDepthCache = useMemo(() => {
    const cache = new Map<string, number>();
    allNovelTags.forEach(tag => {
      cache.set(tag.id, getAllAncestorTagIds(tag.id, allNovelTags).length);
    });
    return cache;
  }, [allNovelTags]);

  const displayedContentOrSnippets = useMemo(() => {
    // --- STORYLINE MODE RENDERER ---
    if (editorMode === 'storyline') {
      const text = textForPreview;
      const paragraphs = text.split('\n');
      let charIndex = displayOffsetForPreview;

      const plotAnchors = novel.plotAnchors || [];
      const storylines = novel.storylines || [];
      const storylineMap = new Map(storylines.map(s => [s.id, s]));

      return (
        <div>
          {paragraphs.map((p, index) => {
            const pStart = charIndex;
            const pEnd = pStart + p.length;
            const positionForNewAnchor = pStart; // Anchor is at the beginning of the paragraph
            charIndex = pEnd + 1; // +1 for newline

            // Find anchors that belong *before* this paragraph
            const anchorsHere = plotAnchors.filter(anchor => anchor.position === positionForNewAnchor);
            
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
    }
    
    // --- OTHER MODES RENDERER (ANNOTATION, READ) ---

    if (viewMode === 'snippet') {
      let snippets: { id: string; text: string; tags: Tag[]; originalAnnotationId: string; isPotentiallyMisaligned?: boolean; sourceNovelId?: string; sourceNovelTitle?: string; }[] = [];
      
      if (globalFilterTagName) {
        const lowerGlobalFilterTagName = globalFilterTagName.toLowerCase();
        const matchingGlobalTagIds = allNovelTags
            .filter(t => t.name.toLowerCase() === lowerGlobalFilterTagName)
            .map(t => t.id);
        if (matchingGlobalTagIds.length === 0) return <Placeholder>全局搜索: 未找到 "{globalFilterTagName}" 标签。</Placeholder>;

        snippets = annotations
            .filter(ann => ann.tagIds.some(tid => matchingGlobalTagIds.includes(tid)))
            .sort((a,b) => a.startIndex - b.startIndex)
            .map(ann => ({
                id: ann.id,
                text: ann.text,
                tags: ann.tagIds.map(tid => allNovelTags.find(t => t.id === tid)).filter(Boolean) as Tag[],
                originalAnnotationId: ann.id,
                isPotentiallyMisaligned: ann.isPotentiallyMisaligned,
                sourceNovelId: ann.novelId,
                // ✅ 阅读模式下在单本小说内搜索，不显示来源小说（因为就是当前小说）
                sourceNovelTitle: undefined
            }));
        if (snippets.length === 0) return <Placeholder>在 "{novel.title}" 中未找到与 "{globalFilterTagName}" 相关的标注。</Placeholder>;

      } else if (activeFilterTagDetails) {
        const tagAndDescendantIds = new Set([activeFilterTagDetails.id, ...getAllDescendantTagIds(activeFilterTagDetails.id, allNovelTags)]);

        snippets = annotations
          .filter(ann => ann.tagIds.some(tid => tagAndDescendantIds.has(tid)))
          .sort((a,b) => a.startIndex - b.startIndex)
          .map(ann => ({
              id: ann.id,
              text: ann.text,
              tags: ann.tagIds.map(tid => allNovelTags.find(t => t.id === tid)).filter(Boolean) as Tag[],
              originalAnnotationId: ann.id,
              isPotentiallyMisaligned: ann.isPotentiallyMisaligned,
              sourceNovelId: ann.novelId,
              // ✅ 阅读模式下在单本小说内搜索，不显示来源小说（因为就是当前小说）
              sourceNovelTitle: undefined
            }));
        if (snippets.length === 0) return <Placeholder>标签 "{activeFilterTagDetails.name}" (含子标签) 在当前小说中无标注。</Placeholder>;
      
      } else {
        return <Placeholder>阅读模式下请选择标签或全局搜索以查看片段。</Placeholder>;
      }

      return (
        <React.Fragment>
          {snippets.map(snippet => {
            let primaryTagForSnippetColor: Tag | null = null;
            if (snippet.tags.length > 0) {
                // FIX: This logic was rewritten to be more robust and ensure the type remains `Tag | null`.
                // It correctly selects the deepest tag, sorting by name as a tie-breaker.
                let deepestLevel = -1;
                let candidateTags: Tag[] = [];

                for (const tag of snippet.tags) {
                    const depth = tagDepthCache.get(tag.id) ?? 0;
                    if (depth > deepestLevel) {
                        deepestLevel = depth;
                        candidateTags = [tag];
                    } else if (depth === deepestLevel) {
                        candidateTags.push(tag);
                    }
                }
                
                primaryTagForSnippetColor = candidateTags.length > 0
                    ? [...candidateTags].sort((a, b) => a.name.localeCompare(b.name))[0]
                    : null;
            }
            const bgColor = primaryTagForSnippetColor ? primaryTagForSnippetColor.color : COLORS.white;
            const textColor = primaryTagForSnippetColor ? getContrastingTextColor(bgColor) : COLORS.text;
            
            return (
              <SnippetContainer 
                key={snippet.id} 
                isMisaligned={snippet.isPotentiallyMisaligned} 
                title={snippet.isPotentiallyMisaligned ? "此标注可能已错位" : undefined}
                bgColor={bgColor}
              >
                {snippet.sourceNovelTitle && <SnippetSourceNovel effectiveColor={textColor}>来自: {snippet.sourceNovelTitle}</SnippetSourceNovel>}
                <SnippetParagraph style={{ color: textColor }}>{snippet.text}</SnippetParagraph>
                {onDeleteAnnotation && (
                  <DeleteSnippetButton 
                    effectiveColor={textColor}
                    onClick={() => onDeleteAnnotation(snippet.originalAnnotationId)} 
                    aria-label={`删除标注: ${snippet.text.substring(0,20)}...`} 
                    title="删除此标注"
                  >
                    ✕
                  </DeleteSnippetButton>
                )}
              </SnippetContainer>
            );
          })}
        </React.Fragment>
      );
    }

    const currentDisplayText = textForPreview;
    if (!currentDisplayText.trim() && (editorMode === 'read' || (editorMode === 'edit' && !novel.text && !selectedChapter))) {
      const placeholderMsg = selectedChapter 
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
         return <span>{currentDisplayText}</span>;
    }
    if (!currentDisplayText.trim() && relevantAnnotations.length === 0) { 
        return <Placeholder>{editorMode === 'edit' ? "开始编辑文本..." : "无内容可预览。"}</Placeholder>;
    }

    let lastIndex = 0;
    const parts: (string | React.ReactElement)[] = [];
    
    relevantAnnotations.forEach((ann) => {
      const annStartInView = Math.max(0, ann.startIndex - displayOffsetForPreview);
      const annEndInView = Math.min(currentDisplayText.length, ann.endIndex - displayOffsetForPreview);

      if (annStartInView >= currentDisplayText.length || annEndInView <= 0 || annStartInView >= annEndInView) return;

      if (annStartInView > lastIndex) {
        parts.push(currentDisplayText.substring(lastIndex, annStartInView));
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
            const activeHierarchyTagIds = new Set([
                activeFilterTagId,
                ...getAllDescendantTagIds(activeFilterTagId, allNovelTags)
            ]);
            
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
          key={`${ann.id}-${ann.startIndex}-${ann.tagIds.join('-')}`}
          style={{ backgroundColor: bgColor, color: color }}
          isMisaligned={ann.isPotentiallyMisaligned}
          title={title}
        >
          {currentDisplayText.substring(renderStart, annEndInView)}
        </AnnotatedSpan>
      );
      lastIndex = Math.max(lastIndex, annEndInView);
    });

    if (lastIndex < currentDisplayText.length) {
      parts.push(currentDisplayText.substring(lastIndex));
    }
    
    return parts.map((part, i) => <React.Fragment key={`part-${i}`}>{part}</React.Fragment>);
  }, [
    viewMode, activeFilterTagDetails, globalFilterTagName,
    allNovelTags, tagDepthCache,
    textForPreview, annotations, getTagById, displayOffsetForPreview, selectedChapter,
    onDeleteAnnotation, editorMode, novel.text, novel.id, novel.title,
    novel.plotAnchors, novel.storylines // Storyline dependencies
  ]);

  const panelTitle = useMemo(() => {
    if (editorMode === 'edit') {
        return selectedChapter ? `画本模式: ${selectedChapter.title}` : "画本模式: 小说原文";
    }
    if (editorMode === 'annotation') {
        return selectedChapter ? `标注模式: ${selectedChapter.title}` : "标注模式: 全文预览与标注";
    }
    if (editorMode === 'read') {
        if (viewMode === 'snippet') {
          if (globalFilterTagName) return `片段: 全局搜索 "${globalFilterTagName}"`;
          return activeFilterTagDetails ? `片段: ${activeFilterTagDetails.name} (含子标签)` : "片段阅读";
        }
        return selectedChapter ? `阅读模式: ${selectedChapter.title}` : "阅读模式: 小说原文";
    }
    if (editorMode === 'storyline') {
        return selectedChapter ? `剧情线模式: ${selectedChapter.title}` : "剧情线模式: 小说原文";
    }
    return "内容";
  }, [viewMode, selectedChapter, activeFilterTagDetails, globalFilterTagName, editorMode]);
  
  const isFullNovelEditMode = editorMode === 'edit' && !selectedChapter;

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


  return (
    <Panel style={style}>
      <Title>{panelTitle}</Title>

      {editorMode === 'edit' && (
        <NovelInput
          key={selectedChapter ? selectedChapter.id : 'full-novel'}
          value={editedText}
          onChange={(e) => setEditedText(e.target.value)}
          onBlur={handleTextareaBlur}
          placeholder={selectedChapter ? "编辑当前章节内容..." : "在此处粘贴或输入您的小说文本..."}
          aria-label={selectedChapter ? `编辑章节: ${selectedChapter.title}` : "小说文本输入"}
        />
      )}

      {(editorMode === 'annotation' || editorMode === 'read' || editorMode === 'storyline') && (
        <ContentPreviewContainer>
          <ContentDisplay 
            id="content-display-area" 
            onMouseUp={editorMode === 'annotation' ? onTextSelection : undefined}
            role="article"
            aria-live="polite"
            isFullNovelEditMode={isFullNovelEditMode}
          >
            {displayedContentOrSnippets}
          </ContentDisplay>
        </ContentPreviewContainer>
      )}

      {popoverState && (
        <PlotAnchorPopover
          targetElement={popoverState.target}
          storylines={novel.storylines || []}
          existingAnchor={popoverState.anchor}
          onSave={handleSaveAnchor}
          onDelete={handleDeleteAnchor}
          onClose={() => setPopoverState(null)}
        />
      )}
    </Panel>
  );
};
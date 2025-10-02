import React, { useState, useMemo, useEffect } from 'react';
import styled from '@emotion/styled';
import type { Novel, Tag, Annotation, User } from "../types";
import { COLORS, SPACING, FONTS, SHADOWS, BORDERS, panelStyles, globalPlaceholderTextStyles } from '../../styles';
import { getAllDescendantTagIds, getContrastingTextColor, getAllAncestorTagIds } from "../../utils";
import TagList from '../tagpanel/TagList';
import { annotationsApi } from '../../api';

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
  gap: ${SPACING.lg};
`;

const Panel = styled.div(panelStyles);

const LeftPanel = styled(Panel)`
  flex-basis: 30%;
  min-width: 250px;
`;

const RightPanel = styled(Panel)`
  flex-basis: 70%;
  min-width: 300px;
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

const AnnotationList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  flex-grow: 1;
  overflow-y: auto;
`;

const DeleteButton = styled.button`
  background-color: transparent;
  color: ${COLORS.danger};
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
  transition: background-color 0.2s, color 0.2s;

  &:hover {
    background-color: ${COLORS.danger}20;
    color: ${COLORS.dangerHover};
  }
`;

const AnnotationItem = styled.li`
  background-color: ${COLORS.white};
  border: 1px solid ${COLORS.gray300};
  padding: ${SPACING.md};
  margin-bottom: ${SPACING.md};
  border-radius: ${BORDERS.radius};
  box-shadow: ${SHADOWS.small};
  position: relative;
`;

const AnnotationText = styled.p`
  margin: 0 0 ${SPACING.sm} 0;
  font-style: italic;
  color: ${COLORS.text};
  word-break: break-word;
  line-height: 1.6;
`;

const SourceNovelText = styled.p`
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.textLight};
  margin-bottom: ${SPACING.sm};
`;

const SourceNovelLink = styled.span`
  color: ${COLORS.primary};
  cursor: pointer;
  text-decoration: underline;
`;

const TagPillContainer = styled.div`
  margin-top: ${SPACING.sm};
`;

const TagGroupRow = styled.div`
  margin-bottom: ${SPACING.xs};

  &:last-of-type {
    margin-bottom: 0;
  }
`;

const TagPill = styled.span<{ bgColor: string; textColor: string; isPrimary: boolean }>`
  padding: ${SPACING.xs} ${SPACING.sm};
  border-radius: 3px;
  font-size: 0.9em;
  margin: 2px ${SPACING.xs} 2px 0;
  display: inline-block;
  white-space: nowrap;
  border: 1px solid rgba(0,0,0,0.1);
  cursor: pointer;
  background-color: ${props => props.bgColor};
  color: ${props => props.textColor};
  font-weight: ${props => props.isPrimary ? 'bold' : 'normal'};
  opacity: ${props => props.isPrimary ? 1 : 0.7};
  transition: opacity 0.2s, transform 0.2s;

  &:hover {
    opacity: 1;
    transform: translateY(-1px);
  }
`;

const Placeholder = styled.p(globalPlaceholderTextStyles);

const GlobalTagSearchPage: React.FC<GlobalTagSearchPageProps> = ({
  allUserTags,
  allUserAnnotations,
  novels,
  currentUser,
  navigateTo,
  onDeleteAnnotationGlobally,
  setAllUserAnnotations,
}) => {
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isLoadingAnnotations, setIsLoadingAnnotations] = useState(false);
  const [hasLoadedAllAnnotations, setHasLoadedAllAnnotations] = useState(false);

  // 🆕 首次打开全局搜索页面时，加载所有标注数据（不加载小说文本）
  useEffect(() => {
    const loadAllAnnotations = async () => {
      if (hasLoadedAllAnnotations || isLoadingAnnotations) return;

      try {
        setIsLoadingAnnotations(true);
        const allAnnotations = await annotationsApi.getAll(); // 加载所有标注（后端只返回标注数据，不含小说文本）

        // 合并到全局状态，保留已有的标注
        setAllUserAnnotations(prev => {
          const existingIds = new Set(prev.map(a => a.id));
          const newAnnotations = allAnnotations.filter(a => !existingIds.has(a.id));
          return [...prev, ...newAnnotations];
        });

        setHasLoadedAllAnnotations(true);
      } catch (error) {
        console.error('加载所有标注失败:', error);
        alert('加载标注数据失败，请刷新重试');
      } finally {
        setIsLoadingAnnotations(false);
      }
    };

    loadAllAnnotations();
  }, [hasLoadedAllAnnotations, isLoadingAnnotations, setAllUserAnnotations]);

  const filteredTags = useMemo(() => {
    if (!tagSearchQuery.trim()) {
      return allUserTags;
    }
    return allUserTags.filter(tag =>
      tag.name.toLowerCase().includes(tagSearchQuery.toLowerCase())
    );
  }, [allUserTags, tagSearchQuery]);

  const displayedAnnotations = useMemo(() => {
    if (!selectedTag) {
      return [];
    }
    const tagAndDescendantIds = new Set([selectedTag.id, ...getAllDescendantTagIds(selectedTag.id, allUserTags)]);
    return allUserAnnotations
      .filter(ann => ann.tagIds.some(tid => tagAndDescendantIds.has(tid)))
      .sort((a, b) => {
        const novelA = novels.find(n => n.id === a.novelId)?.title || '';
        const novelB = novels.find(n => n.id === b.novelId)?.title || '';
        if (novelA.localeCompare(novelB) !== 0) {
          return novelA.localeCompare(novelB);
        }
        return a.startIndex - b.startIndex;
      });
  }, [selectedTag, allUserAnnotations, allUserTags, novels]);

  const getNovelTitleById = (novelId: string): string => {
    return novels.find(n => n.id === novelId)?.title || '未知小说';
  };

  const getTagById = (tagId: string): Tag | undefined => {
    return allUserTags.find(t => t.id === tagId);
  };

  const handleTagSelectForSearch = (tagId: string | null) => {
    if (!tagId) {
      setSelectedTag(null);
      return;
    }
    const tag = getTagById(tagId);
    setSelectedTag(tag || null);
  };

  const confirmDeleteAnnotation = (annotationId: string) => {
    if (window.confirm("您确定要删除此标注吗？")) {
      onDeleteAnnotationGlobally(annotationId);
    }
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
      <MainContent>
        <LeftPanel>
          <SearchInput
            type="text"
            placeholder="搜索标签名称..."
            value={tagSearchQuery}
            onChange={(e) => setTagSearchQuery(e.target.value)}
            aria-label="搜索标签"
          />
          <TagListContainer>
            {filteredTags.length > 0 ? (
              <TagList
                tags={filteredTags}
                activeTagId={selectedTag?.id || null}
                editorMode="read"
                onApplyTagToSelection={() => {}}
                onSelectTagForReadMode={handleTagSelectForSearch}
                onUpdateTagParent={() => {}}
                onUpdateTagColor={() => {}}
                onUpdateTagName={() => {}}
                onTagGlobalSearch={() => {}}
              />
            ) : (
              <Placeholder>没有找到匹配的标签。</Placeholder>
            )}
          </TagListContainer>
        </LeftPanel>
        <RightPanel>
          <ResultsTitle>
            {selectedTag ? `标签 "${selectedTag.name}" (含子标签) 的标注结果` : '请在左侧选择一个标签以查看标注'}
          </ResultsTitle>
          {displayedAnnotations.length > 0 ? (
            <AnnotationList>
              {displayedAnnotations.map(ann => {
                const tagsForAnnotation = ann.tagIds
                  .map(tagId => getTagById(tagId))
                  .filter((tag): tag is Tag => !!tag);

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
                              const isPrimaryFilterTag = selectedTag && (tag.id === selectedTag.id || getAllDescendantTagIds(selectedTag.id, allUserTags).includes(tag.id));
                              return (
                                <TagPill
                                  key={tag.id}
                                  bgColor={tag.color}
                                  textColor={getContrastingTextColor(tag.color)}
                                  isPrimary={!!isPrimaryFilterTag}
                                  onClick={() => handleTagSelectForSearch(tag.id)}
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
            selectedTag && <Placeholder>此标签下没有找到任何标注。</Placeholder>
          )}
        </RightPanel>
      </MainContent>
    </PageContainer>
  );
};

export default GlobalTagSearchPage;
import React, { useState, useMemo } from 'react';
import styled from '@emotion/styled';
import type { Chapter } from "../types";
import { COLORS, SPACING, FONTS, globalPlaceholderTextStyles, BORDERS } from '../../styles';

interface ChapterListViewProps {
  chapters: Chapter[];
  selectedChapterId: string | null;
  onSelectChapter: (id: string | null) => void;
}

const CHAPTERS_PER_PAGE = 100;

const Title = styled.h2`
  font-size: ${FONTS.sizeH3};
  color: ${COLORS.dark};
  margin-bottom: ${SPACING.lg};
`;

const PaginationContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${SPACING.sm};
  margin-bottom: ${SPACING.md};
  padding: ${SPACING.xs} 0;
`;

const PaginationInfo = styled.span`
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.textLight};
`;

const PaginationButtons = styled.div`
  display: flex;
  gap: ${SPACING.xs};
`;

const PageButton = styled.button<{ disabled?: boolean }>`
  padding: ${SPACING.xs} ${SPACING.sm};
  font-size: ${FONTS.sizeSmall};
  background-color: ${props => props.disabled ? COLORS.gray200 : COLORS.primary};
  color: ${props => props.disabled ? COLORS.textLight : COLORS.white};
  border: none;
  border-radius: ${BORDERS.radius};
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  transition: background-color 0.2s;

  &:hover:not(:disabled) {
    background-color: ${COLORS.primaryHover};
  }
`;

const List = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  flex-grow: 1;
  overflow-y: auto;
`;

const ListItem = styled.li<{ isActive: boolean }>`
  padding: ${SPACING.sm};
  margin-bottom: ${SPACING.xs};
  border-radius: ${FONTS.sizeSmall};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: ${SPACING.sm};
  transition: background-color 0.1s, border-color 0.1s, color 0.1s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border: 1px solid ${props => (props.isActive ? COLORS.primary : COLORS.borderLight)};
  background-color: ${props => (props.isActive ? COLORS.highlightBackground : 'transparent')};
  color: ${props => (props.isActive ? COLORS.primary : COLORS.text)};
  font-weight: ${props => (props.isActive ? 'bold' : 'normal')};

  &:hover {
    background-color: ${props => (props.isActive ? COLORS.highlightBackground : COLORS.gray100)};
    border-color: ${props => (props.isActive ? COLORS.primary : COLORS.gray400)};
  }
`;

const Placeholder = styled.p(globalPlaceholderTextStyles);

const ChapterListView: React.FC<ChapterListViewProps> = ({
  chapters, selectedChapterId, onSelectChapter
}) => {
  const [currentPage, setCurrentPage] = useState(1);

  // 排序后的章节列表
  const sortedChapters = useMemo(() => {
    return [...chapters].sort((a, b) => a.originalStartIndex - b.originalStartIndex);
  }, [chapters]);

  // 总页数
  const totalPages = Math.ceil(sortedChapters.length / CHAPTERS_PER_PAGE);

  // 当前页的章节
  const currentChapters = useMemo(() => {
    const startIndex = (currentPage - 1) * CHAPTERS_PER_PAGE;
    const endIndex = startIndex + CHAPTERS_PER_PAGE;
    return sortedChapters.slice(startIndex, endIndex);
  }, [sortedChapters, currentPage]);

  // 当选中的章节不在当前页时，自动跳转到对应页
  React.useEffect(() => {
    if (selectedChapterId) {
      const selectedIndex = sortedChapters.findIndex(ch => ch.id === selectedChapterId);
      if (selectedIndex !== -1) {
        const targetPage = Math.floor(selectedIndex / CHAPTERS_PER_PAGE) + 1;
        if (targetPage !== currentPage) {
          setCurrentPage(targetPage);
        }
      }
    }
  }, [selectedChapterId, sortedChapters, currentPage]);

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  const renderChapters = (): React.ReactElement[] => {
    return currentChapters.map(chapter => {
      const isActive = selectedChapterId === chapter.id;
      return (
        <ListItem
          key={chapter.id}
          isActive={isActive}
          onClick={() => onSelectChapter(isActive ? null : chapter.id)}
          role="option"
          aria-selected={isActive}
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectChapter(isActive ? null : chapter.id); }}
          title={chapter.title}
        >
          {chapter.title}
        </ListItem>
      );
    });
  };

  return (
    <>
      <Title>章节列表</Title>
      {(chapters && chapters.length > 0) ? (
        <>
          {totalPages > 1 && (
            <PaginationContainer>
              <PaginationInfo>
                第 {currentPage}/{totalPages} 页 (共 {chapters.length} 章)
              </PaginationInfo>
              <PaginationButtons>
                <PageButton onClick={handlePrevPage} disabled={currentPage === 1}>
                  上一页
                </PageButton>
                <PageButton onClick={handleNextPage} disabled={currentPage === totalPages}>
                  下一页
                </PageButton>
              </PaginationButtons>
            </PaginationContainer>
          )}
          <List role="listbox" aria-label="小说章节">
            {renderChapters()}
          </List>
        </>
      ) : (
        <Placeholder>当前小说未分章或无章节。请先在内容面板进行"自动分章"。</Placeholder>
      )}
    </>
  );
};

export default ChapterListView;
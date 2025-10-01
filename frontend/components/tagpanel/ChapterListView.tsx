import React from 'react';
import styled from '@emotion/styled';
import type { Chapter } from "../types";
import { COLORS, SPACING, FONTS, globalPlaceholderTextStyles } from '../../styles';

interface ChapterListViewProps {
  chapters: Chapter[];
  selectedChapterId: string | null;
  onSelectChapter: (id: string | null) => void;
}

const Title = styled.h2`
  font-size: ${FONTS.sizeH3};
  color: ${COLORS.dark};
  margin-bottom: ${SPACING.lg};
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

  const renderChapters = (): React.ReactElement[] => {
    return chapters
      .sort((a, b) => a.originalStartIndex - b.originalStartIndex)
      .map(chapter => {
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
        <List role="listbox" aria-label="小说章节">
          {renderChapters()}
        </List>
      ) : (
        <Placeholder>当前小说未分章或无章节。请先在内容面板进行“自动分章”。</Placeholder>
      )}
    </>
  );
};

export default ChapterListView;
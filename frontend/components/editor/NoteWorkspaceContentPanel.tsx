import React, { CSSProperties, useMemo } from 'react';
import styled from '@emotion/styled';
import type { Chapter } from '../../types';
import { COLORS, FONTS, SPACING, panelStyles, globalPlaceholderTextStyles, BORDERS } from '../../styles';
import ChapterRichTextEditor from './ChapterRichTextEditor';

interface NoteWorkspaceContentPanelProps {
  editorMode: 'edit' | 'read';
  selectedChapter: Chapter | null;
  onSaveChapterHtml: (chapterId: string, html: string) => Promise<void>;
  style?: CSSProperties;
}

const Panel = styled.div({
  ...panelStyles,
  minWidth: '280px',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
});

const Title = styled.h2`
  font-size: ${FONTS.sizeH3};
  color: ${COLORS.dark};
  margin-bottom: ${SPACING.md};
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${SPACING.sm};
  flex-wrap: wrap;
`;

const ChapterTitle = styled.span`
  font-weight: bold;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ModeBadge = styled.span`
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.textLight};
  white-space: nowrap;
`;

const Placeholder = styled.p(globalPlaceholderTextStyles);

const ReadFrame = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid ${COLORS.borderLight};
  border-radius: ${BORDERS.radius};
  padding: ${SPACING.md};
  background: ${COLORS.white};

  & p:first-of-type {
    margin-top: 0;
  }

  & p:last-of-type {
    margin-bottom: 0;
  }
`;

const NoteWorkspaceContentPanel: React.FC<NoteWorkspaceContentPanelProps> = ({
  editorMode,
  selectedChapter,
  onSaveChapterHtml,
  style,
}) => {
  const panelTitle = useMemo(() => {
    const title = selectedChapter?.title || '未选择章节';
    return { title, modeText: editorMode === 'edit' ? '画本模式' : '阅读模式' };
  }, [editorMode, selectedChapter?.title]);

  return (
    <Panel style={style}>
      <Title>
        <ChapterTitle title={panelTitle.title}>{panelTitle.title}</ChapterTitle>
        <ModeBadge>{panelTitle.modeText}</ModeBadge>
      </Title>

      {editorMode === 'edit' ? (
        <ChapterRichTextEditor
          chapter={selectedChapter}
          onSave={async (html) => {
            if (!selectedChapter) return;
            await onSaveChapterHtml(selectedChapter.id, html);
          }}
          placeholder="在这里写笔记内容…"
        />
      ) : selectedChapter ? (
        <ReadFrame>
          {selectedChapter.htmlContent?.trim() ? (
            <div style={{ whiteSpace: 'normal' }} dangerouslySetInnerHTML={{ __html: selectedChapter.htmlContent }} />
          ) : (
            <div style={{ whiteSpace: 'pre-wrap' }}>{selectedChapter.content || ''}</div>
          )}
        </ReadFrame>
      ) : (
        <Placeholder>请先在左侧选择章节，或点击“新建章节”。</Placeholder>
      )}
    </Panel>
  );
};

export default NoteWorkspaceContentPanel;


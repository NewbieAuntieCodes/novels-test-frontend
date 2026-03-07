import React, { useEffect, useState } from 'react';
import styled from '@emotion/styled';
import type { Tag } from '../../types';
import { COLORS, SPACING, FONTS, BORDERS, SHADOWS } from '../../styles';
import { tagCompatApi } from '../../api/tagCompat';
import ReferenceEntriesPanel from './ReferenceEntriesPanel';
import { useReferenceEntries } from './hooks/useReferenceEntries';

interface ReferenceLibraryPageProps {
  onBack: () => void;
}

type LibraryTab = 'references' | 'notes';

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
  gap: ${SPACING.lg};
`;

const Tabs = styled.div`
  display: flex;
  gap: ${SPACING.xs};
  align-items: center;
`;

const TabButton = styled.button<{ $active?: boolean }>`
  padding: ${SPACING.xs} ${SPACING.md};
  border-radius: ${BORDERS.radius};
  border: 1px solid ${props => (props.$active ? COLORS.primary : COLORS.border)};
  background: ${props => (props.$active ? COLORS.primary : COLORS.white)};
  color: ${props => (props.$active ? COLORS.white : COLORS.text)};
  cursor: pointer;
  font-size: ${FONTS.sizeSmall};
  transition: background-color 0.2s;

  &:hover {
    background: ${props => (props.$active ? COLORS.primaryHover : COLORS.gray100)};
  }
`;

const Title = styled.h1`
  margin: 0;
  font-size: ${FONTS.sizeH2};
  color: ${COLORS.dark};
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${SPACING.md};
`;

const TagHint = styled.div`
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.textLight};
`;

const BaseButton = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: ${SPACING.sm} ${SPACING.lg};
  border-radius: ${BORDERS.radius};
  border: 1px solid ${props => (props.variant === 'secondary' ? COLORS.border : COLORS.primary)};
  background: ${props => (props.variant === 'secondary' ? COLORS.white : COLORS.primary)};
  color: ${props => (props.variant === 'secondary' ? COLORS.text : COLORS.white)};
  cursor: pointer;
  font-size: ${FONTS.sizeSmall};
  transition: background-color 0.2s, box-shadow 0.2s;

  &:hover:not(:disabled) {
    background: ${props => (props.variant === 'secondary' ? COLORS.gray100 : COLORS.primaryHover)};
    box-shadow: ${SHADOWS.small};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    box-shadow: none;
  }
`;

const MainContent = styled.main`
  display: flex;
  flex-grow: 1;
  overflow: hidden;
  padding: ${SPACING.lg};
`;

const ReferenceLibraryPage: React.FC<ReferenceLibraryPageProps> = ({ onBack }) => {
  const [tab, setTab] = useState<LibraryTab>('references');
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tagLoadError, setTagLoadError] = useState<string | null>(null);

  const { entries: allReferenceEntries, isLoading: isLoadingReferenceEntries } = useReferenceEntries(undefined);

  useEffect(() => {
    const loadTags = async () => {
      setTagLoadError(null);
      try {
        const tags = await tagCompatApi.getAll({});
        setAllTags(tags);
      } catch (err) {
        setAllTags([]);
        setTagLoadError(err instanceof Error ? err.message : '加载标签失败');
      }
    };

    loadTags();
  }, []);

  return (
    <PageContainer>
      <Header>
        <Title>资料库</Title>
        <Tabs>
          <TabButton type="button" $active={tab === 'references'} onClick={() => setTab('references')}>
            资料
          </TabButton>
          <TabButton type="button" $active={tab === 'notes'} onClick={() => setTab('notes')}>
            笔记
          </TabButton>
        </Tabs>
        <HeaderRight>
          {tagLoadError ? (
            <TagHint style={{ color: COLORS.danger }}>{tagLoadError}</TagHint>
          ) : (
            <TagHint>可在资料条目中关联标签</TagHint>
          )}
          <BaseButton type="button" variant="secondary" onClick={onBack}>
            返回项目
          </BaseButton>
        </HeaderRight>
      </Header>

      <MainContent>
        {tab === 'references' ? (
          <ReferenceEntriesPanel
            style={{ height: '100%', width: '100%' }}
            filterNovelId={undefined}
            newEntryNovelId={null}
            allTags={allTags}
            activeTag={null}
            includeDescendantTags
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
            <TagHint>笔记已独立到“笔记”页面（支持词条分组、卡片和文件夹分类）。</TagHint>
            <BaseButton type="button" onClick={() => (window.location.hash = '#/notes')}>
              打开笔记
            </BaseButton>
            {!isLoadingReferenceEntries && allReferenceEntries.length === 0 && (
              <TagHint>提示：当前资料库暂无资料条目。</TagHint>
            )}
          </div>
        )}
      </MainContent>
    </PageContainer>
  );
};

export default ReferenceLibraryPage;

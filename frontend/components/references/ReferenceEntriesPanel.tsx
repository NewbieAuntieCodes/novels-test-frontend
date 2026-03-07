import React, { CSSProperties, useMemo, useState } from 'react';
import styled from '@emotion/styled';
import type { ReferenceEntry, ReferenceScope, ReferenceSourceType, Tag } from '../../types';
import { getAllDescendantTagIds, getContrastingTextColor, getLeafTagIds } from '../../utils';
import { COLORS, SPACING, FONTS, BORDERS, SHADOWS, panelStyles, globalPlaceholderTextStyles } from '../../styles';
import ReferenceEntryModal from './ReferenceEntryModal';
import { useReferenceEntries } from './hooks/useReferenceEntries';

type ScopeFilter = 'all' | ReferenceScope;

interface ReferenceEntriesPanelProps {
  style?: CSSProperties;
  filterNovelId?: string | null;
  newEntryNovelId?: string | null;
  allTags: Tag[];
  activeTag: Tag | null | undefined;
  globalFilterTagName?: string | null;
  includeDescendantTags?: boolean;
}

const Panel = styled.div({
  ...panelStyles,
  minWidth: '220px',
  backgroundColor: COLORS.gray100,
});

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${SPACING.sm};
  margin-bottom: ${SPACING.md};
`;

const Title = styled.h2`
  font-size: ${FONTS.sizeH3};
  color: ${COLORS.dark};
  margin: 0;
`;

const SmallButton = styled.button<{ $variant?: 'primary' | 'danger' | 'ghost' }>`
  padding: ${SPACING.xs} ${SPACING.sm};
  border-radius: ${BORDERS.radius};
  border: 1px solid ${props => {
    if (props.$variant === 'danger') return COLORS.danger;
    if (props.$variant === 'primary') return COLORS.primary;
    return COLORS.border;
  }};
  background: ${props => {
    if (props.$variant === 'danger') return COLORS.danger;
    if (props.$variant === 'primary') return COLORS.primary;
    return COLORS.white;
  }};
  color: ${props => (props.$variant === 'ghost' ? COLORS.text : COLORS.white)};
  cursor: pointer;
  font-size: ${FONTS.sizeSmall};
  transition: background-color 0.2s, box-shadow 0.2s;
  white-space: nowrap;

  &:hover:not(:disabled) {
    box-shadow: ${SHADOWS.small};
    background: ${props => {
      if (props.$variant === 'danger') return COLORS.dangerHover;
      if (props.$variant === 'primary') return COLORS.primaryHover;
      return COLORS.gray100;
    }};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    box-shadow: none;
  }
`;

const ScopeButtons = styled.div`
  display: flex;
  gap: ${SPACING.xs};
  flex-wrap: wrap;
  margin-bottom: ${SPACING.md};
`;

const ScopeButton = styled.button<{ $active?: boolean }>`
  padding: ${SPACING.xs} ${SPACING.sm};
  border-radius: 999px;
  border: 1px solid ${props => (props.$active ? COLORS.primary : COLORS.border)};
  background: ${props => (props.$active ? COLORS.primary : COLORS.white)};
  color: ${props => (props.$active ? COLORS.white : COLORS.text)};
  cursor: pointer;
  font-size: ${FONTS.sizeSmall};

  &:hover {
    background: ${props => (props.$active ? COLORS.primaryHover : COLORS.gray100)};
  }
`;

const SearchInput = styled.input`
  width: 100%;
  padding: ${SPACING.sm};
  border: ${BORDERS.width} ${BORDERS.style} ${BORDERS.color};
  border-radius: ${BORDERS.radius};
  box-sizing: border-box;
  background-color: ${COLORS.white};
  font-size: ${FONTS.sizeSmall};
  margin-bottom: ${SPACING.md};

  &:focus {
    border-color: ${COLORS.primary};
    box-shadow: 0 0 0 0.2rem ${COLORS.primary}40;
    outline: none;
  }
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.sm};
  flex: 1;
  min-height: 0;
`;

const Card = styled.div`
  background: ${COLORS.white};
  border: 1px solid ${COLORS.gray300};
  border-radius: ${BORDERS.radius};
  padding: ${SPACING.md};
  box-shadow: ${SHADOWS.small};
  position: relative;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 10px rgba(0,0,0,0.06);
  }
`;

const CardTitle = styled.h3`
  margin: 0 0 ${SPACING.xs} 0;
  font-size: ${FONTS.sizeBase};
  color: ${COLORS.dark};
  padding-right: 90px;
  word-break: break-word;
`;

const CardMeta = styled.div`
  display: flex;
  gap: ${SPACING.sm};
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: ${SPACING.sm};
  color: ${COLORS.textLight};
  font-size: ${FONTS.sizeSmall};
`;

const Badge = styled.span<{ $bg: string; $color: string }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px ${SPACING.sm};
  border-radius: 999px;
  background: ${props => props.$bg};
  color: ${props => props.$color};
  border: 1px solid rgba(0,0,0,0.12);
`;

const Preview = styled.p`
  margin: 0;
  color: ${COLORS.text};
  line-height: 1.6;
  font-size: ${FONTS.sizeSmall};
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 5.2em;
  overflow: hidden;
`;

const CardActions = styled.div`
  position: absolute;
  top: ${SPACING.sm};
  right: ${SPACING.sm};
  display: flex;
  gap: ${SPACING.xs};
`;

const TagPills = styled.div`
  margin-top: ${SPACING.sm};
  display: flex;
  flex-wrap: wrap;
  gap: ${SPACING.xs};
`;

const TagPill = styled.span<{ $bg: string; $color: string }>`
  padding: 2px ${SPACING.sm};
  border-radius: 999px;
  font-size: ${FONTS.sizeSmall};
  background: ${props => props.$bg};
  color: ${props => props.$color};
  border: 1px solid rgba(0,0,0,0.12);
  opacity: 0.95;
`;

const Placeholder = styled.div(globalPlaceholderTextStyles);

const toScopeLabel = (scope: ReferenceScope): string => {
  if (scope === 'reality') return '现实资料';
  if (scope === 'work') return '作品资料';
  return '设定资料';
};

const scopeBg = (scope: ReferenceScope): string => {
  if (scope === 'reality') return COLORS.info;
  if (scope === 'work') return COLORS.secondary;
  return COLORS.primary;
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const ReferenceEntriesPanel: React.FC<ReferenceEntriesPanelProps> = ({
  style,
  filterNovelId,
  newEntryNovelId = null,
  allTags,
  activeTag,
  globalFilterTagName,
  includeDescendantTags = true,
}) => {
  const { entries, isLoading, error, createEntry, updateEntry, deleteEntry } = useReferenceEntries(filterNovelId);

  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [query, setQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ReferenceEntry | null>(null);

  const filteredEntries = useMemo(() => {
    let result = entries;

    // 标签过滤（与标注逻辑保持一致）
    if (globalFilterTagName) {
      const lower = globalFilterTagName.toLowerCase();
      const matchingIds = allTags.filter(t => t.name.toLowerCase() === lower).map(t => t.id);
      if (matchingIds.length === 0) {
        result = [];
      } else {
        result = result.filter(e => e.tagIds.some(id => matchingIds.includes(id)));
      }
    } else if (activeTag) {
      const descendants = getAllDescendantTagIds(activeTag.id, allTags);
      const descendantSet = new Set(descendants);

      if (!includeDescendantTags) {
        result = result.filter(e => e.tagIds.includes(activeTag.id) && !e.tagIds.some(id => descendantSet.has(id)));
      } else {
        const relevant = new Set([activeTag.id, ...descendants]);
        result = result.filter(e => e.tagIds.some(id => relevant.has(id)));
      }
    }

    if (scopeFilter !== 'all') {
      result = result.filter(e => e.scope === scopeFilter);
    }

    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter(e =>
        (e.title || '').toLowerCase().includes(q) ||
        (e.content || '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [entries, allTags, activeTag, globalFilterTagName, includeDescendantTags, scopeFilter, query]);

  const openCreate = () => {
    setEditingEntry(null);
    setIsModalOpen(true);
  };

  const openEdit = (entry: ReferenceEntry) => {
    setEditingEntry(entry);
    setIsModalOpen(true);
  };

  const handleSave = async (payload: {
    title: string;
    content: string;
    scope: ReferenceScope;
    tagIds: string[];
    novelId: string | null;
    sourceType?: ReferenceSourceType;
    sourceUrl?: string;
  }) => {
    if (editingEntry) {
      await updateEntry(editingEntry.id, payload);
    } else {
      await createEntry(payload);
    }
  };

  const handleDelete = async (entry: ReferenceEntry) => {
    if (!window.confirm(`确定删除资料「${entry.title}」吗？`)) return;
    await deleteEntry(entry.id);
  };

  return (
    <Panel style={style}>
      <TitleRow>
        <Title>资料</Title>
        <SmallButton type="button" $variant="primary" onClick={openCreate}>
          + 新建
        </SmallButton>
      </TitleRow>

      <ScopeButtons>
        <ScopeButton $active={scopeFilter === 'all'} onClick={() => setScopeFilter('all')}>全部</ScopeButton>
        <ScopeButton $active={scopeFilter === 'reality'} onClick={() => setScopeFilter('reality')}>现实资料</ScopeButton>
        <ScopeButton $active={scopeFilter === 'work'} onClick={() => setScopeFilter('work')}>作品资料</ScopeButton>
        <ScopeButton $active={scopeFilter === 'setting'} onClick={() => setScopeFilter('setting')}>设定资料</ScopeButton>
      </ScopeButtons>

      <SearchInput
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="按标题/内容搜索资料"
      />

      {error && (
        <div style={{ color: COLORS.danger, fontSize: FONTS.sizeSmall, marginBottom: SPACING.md }}>
          {error}
        </div>
      )}

      {isLoading ? (
        <Placeholder>正在加载资料...</Placeholder>
      ) : filteredEntries.length === 0 ? (
        <Placeholder>暂无资料</Placeholder>
      ) : (
        <List>
          {filteredEntries.map(entry => {
            const scopeLabel = toScopeLabel(entry.scope);
            const scopeColor = scopeBg(entry.scope);
            const leafIds = getLeafTagIds(entry.tagIds || [], allTags);
            const leafTags = leafIds
              .map(id => allTags.find(t => t.id === id))
              .filter((t): t is Tag => Boolean(t));

            return (
              <Card key={entry.id} onClick={() => openEdit(entry)} title="点击查看/编辑">
                <CardActions onClick={e => e.stopPropagation()}>
                  <SmallButton type="button" $variant="ghost" onClick={() => openEdit(entry)}>
                    编辑
                  </SmallButton>
                  <SmallButton type="button" $variant="danger" onClick={() => handleDelete(entry)}>
                    删除
                  </SmallButton>
                </CardActions>

                <CardTitle>{entry.title}</CardTitle>
                <CardMeta>
                  <Badge $bg={scopeColor} $color={COLORS.white}>{scopeLabel}</Badge>
                  <span>更新 {formatDate(entry.updatedAt)}</span>
                </CardMeta>
                <Preview>{entry.content}</Preview>

                {leafTags.length > 0 && (
                  <TagPills>
                    {leafTags.map(t => (
                      <TagPill
                        key={t.id}
                        $bg={t.color}
                        $color={getContrastingTextColor(t.color)}
                      >
                        {t.name}
                      </TagPill>
                    ))}
                  </TagPills>
                )}
              </Card>
            );
          })}
        </List>
      )}

      <ReferenceEntryModal
        isOpen={isModalOpen}
        novelId={editingEntry?.novelId ?? newEntryNovelId}
        allTags={allTags}
        activeTag={activeTag}
        entry={editingEntry}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
      />
    </Panel>
  );
};

export default ReferenceEntriesPanel;

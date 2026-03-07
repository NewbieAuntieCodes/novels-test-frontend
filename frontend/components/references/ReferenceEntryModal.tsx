import React, { useEffect, useMemo, useState } from 'react';
import styled from '@emotion/styled';
import type { ReferenceEntry, ReferenceScope, ReferenceSourceType, Tag } from '../../types';
import {
  applySameRootTagReplacement,
  getAllAncestorTagIds,
  getAllDescendantTagIds,
  getLeafTagIds,
  getContrastingTextColor,
} from '../../utils';
import { COLORS, SPACING, FONTS, SHADOWS, BORDERS } from '../../styles';

interface ReferenceEntryModalProps {
  isOpen: boolean;
  novelId: string | null;
  allTags: Tag[];
  activeTag: Tag | null | undefined;
  entry: ReferenceEntry | null;
  onClose: () => void;
  onSave: (payload: {
    title: string;
    content: string;
    scope: ReferenceScope;
    tagIds: string[];
    novelId: string | null;
    sourceType?: ReferenceSourceType;
    sourceUrl?: string;
  }) => Promise<void>;
}

const Overlay = styled.div<{ $open: boolean }>`
  display: ${props => (props.$open ? 'flex' : 'none')};
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const Modal = styled.div`
  background-color: ${COLORS.white};
  padding: ${SPACING.xl};
  border-radius: ${SPACING.md};
  box-shadow: ${SHADOWS.large};
  width: min(820px, calc(100vw - 32px));
  max-height: calc(100vh - 48px);
  overflow: auto;
  box-sizing: border-box;
`;

const Title = styled.h2`
  margin: 0 0 ${SPACING.lg} 0;
  font-size: ${FONTS.sizeH2};
  color: ${COLORS.dark};
`;

const FormRow = styled.div`
  display: flex;
  gap: ${SPACING.md};
  flex-wrap: wrap;
`;

const FormGroup = styled.div`
  margin-bottom: ${SPACING.lg};
  flex: 1;
  min-width: 220px;
`;

const Label = styled.label`
  display: block;
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.textLight};
  margin-bottom: ${SPACING.xs};
  font-weight: 600;
`;

const Input = styled.input`
  width: 100%;
  padding: ${SPACING.sm};
  border: ${BORDERS.width} ${BORDERS.style} ${BORDERS.color};
  border-radius: ${BORDERS.radius};
  font-size: ${FONTS.sizeBase};
  box-sizing: border-box;

  &:focus {
    border-color: ${COLORS.primary};
    box-shadow: 0 0 0 0.2rem ${COLORS.primary}40;
    outline: none;
  }
`;

const Select = styled.select`
  width: 100%;
  padding: ${SPACING.sm};
  border: ${BORDERS.width} ${BORDERS.style} ${BORDERS.color};
  border-radius: ${BORDERS.radius};
  font-size: ${FONTS.sizeBase};
  box-sizing: border-box;
  background-color: ${COLORS.white};

  &:focus {
    border-color: ${COLORS.primary};
    box-shadow: 0 0 0 0.2rem ${COLORS.primary}40;
    outline: none;
  }
`;

const Textarea = styled.textarea`
  width: 100%;
  padding: ${SPACING.sm};
  border: ${BORDERS.width} ${BORDERS.style} ${BORDERS.color};
  border-radius: ${BORDERS.radius};
  font-size: ${FONTS.sizeBase};
  box-sizing: border-box;
  min-height: 260px;
  resize: vertical;
  line-height: 1.6;

  &:focus {
    border-color: ${COLORS.primary};
    box-shadow: 0 0 0 0.2rem ${COLORS.primary}40;
    outline: none;
  }
`;

const TagPills = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${SPACING.xs};
`;

const TagPill = styled.button<{ $bg: string; $color: string }>`
  border: 1px solid rgba(0,0,0,0.12);
  background: ${props => props.$bg};
  color: ${props => props.$color};
  padding: 2px ${SPACING.sm};
  border-radius: 999px;
  cursor: pointer;
  font-size: ${FONTS.sizeSmall};
  line-height: 1.6;
  display: inline-flex;
  align-items: center;
  gap: ${SPACING.xs};

  &:hover {
    filter: brightness(0.98);
  }
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

const TagSearchResults = styled.div`
  border: 1px solid ${COLORS.borderLight};
  border-radius: ${BORDERS.radius};
  max-height: 220px;
  overflow: auto;
  background: ${COLORS.white};
`;

const TagSearchItem = styled.button`
  width: 100%;
  text-align: left;
  padding: ${SPACING.sm};
  border: none;
  border-bottom: 1px solid ${COLORS.gray200};
  background: transparent;
  cursor: pointer;
  color: ${COLORS.text};

  &:hover {
    background: ${COLORS.gray100};
  }

  &:last-of-type {
    border-bottom: none;
  }
`;

const ButtonRow = styled.div`
  display: flex;
  gap: ${SPACING.md};
  justify-content: flex-end;
  margin-top: ${SPACING.xl};
`;

const ErrorBox = styled.div`
  color: ${COLORS.danger};
  font-size: ${FONTS.sizeSmall};
  margin-top: ${SPACING.sm};
  padding: ${SPACING.sm};
  background-color: ${COLORS.danger}10;
  border-radius: ${BORDERS.radius};
  border: 1px solid ${COLORS.danger}40;
`;

const toScopeLabel = (scope: ReferenceScope): string => {
  if (scope === 'reality') return '现实资料';
  if (scope === 'work') return '作品资料';
  return '设定资料';
};

const ReferenceEntryModal: React.FC<ReferenceEntryModalProps> = ({
  isOpen,
  novelId,
  allTags,
  activeTag,
  entry,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [scope, setScope] = useState<ReferenceScope>('work');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [sourceType, setSourceType] = useState<ReferenceSourceType>('unknown');
  const [sourceUrl, setSourceUrl] = useState('');
  const [tagQuery, setTagQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setTitle(entry?.title ?? '');
    setContent(entry?.content ?? '');
    setScope(entry?.scope ?? 'work');
    setSourceType(entry?.sourceType ?? 'unknown');
    setSourceUrl(entry?.sourceUrl ?? '');

    const initialTags = entry?.tagIds ?? [];
    if (initialTags.length > 0) {
      setTagIds(initialTags);
    } else if (activeTag) {
      setTagIds(applySameRootTagReplacement([], activeTag.id, allTags));
    } else {
      setTagIds([]);
    }

    setTagQuery('');
    setIsSaving(false);
    setError(null);
  }, [isOpen, entry, activeTag, allTags]);

  const leafTags = useMemo(() => {
    const leafIds = getLeafTagIds(tagIds, allTags);
    return leafIds
      .map(id => allTags.find(t => t.id === id))
      .filter((t): t is Tag => Boolean(t));
  }, [tagIds, allTags]);

  const filteredTagResults = useMemo(() => {
    const q = tagQuery.trim().toLowerCase();
    if (!q) return [];
    return allTags
      .filter(t => t.name.toLowerCase().includes(q))
      .slice(0, 30);
  }, [tagQuery, allTags]);

  const applyTag = (tagId: string) => {
    setTagIds(prev => applySameRootTagReplacement(prev, tagId, allTags));
    setTagQuery('');
  };

  const removeLeafRoot = (leafTagId: string) => {
    const ancestors = getAllAncestorTagIds(leafTagId, allTags);
    const rootId = ancestors.length > 0 ? ancestors[ancestors.length - 1] : leafTagId;
    const sameRootIds = new Set([rootId, ...getAllDescendantTagIds(rootId, allTags)]);
    setTagIds(prev => prev.filter(id => !sameRootIds.has(id)));
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSaving) {
      onClose();
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('请填写标题');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onSave({
        title: title.trim(),
        content,
        scope,
        tagIds,
        novelId,
        sourceType: sourceType === 'unknown' ? undefined : sourceType,
        sourceUrl: sourceUrl.trim() ? sourceUrl.trim() : undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Overlay $open={isOpen} onClick={handleOverlayClick}>
      <Modal>
        <Title>{entry ? '编辑资料' : '新建资料'}</Title>

        <FormGroup>
          <Label htmlFor="ref-title">标题</Label>
          <Input
            id="ref-title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="例如：同变式（英伦时期货币）"
            disabled={isSaving}
          />
        </FormGroup>

        <FormRow>
          <FormGroup>
            <Label htmlFor="ref-scope">数据范围</Label>
            <Select
              id="ref-scope"
              value={scope}
              onChange={e => setScope(e.target.value as ReferenceScope)}
              disabled={isSaving}
            >
              <option value="reality">{toScopeLabel('reality')}</option>
              <option value="work">{toScopeLabel('work')}</option>
              <option value="setting">{toScopeLabel('setting')}</option>
            </Select>
          </FormGroup>

          <FormGroup>
            <Label htmlFor="ref-sourceType">来源（可选）</Label>
            <Select
              id="ref-sourceType"
              value={sourceType}
              onChange={e => setSourceType(e.target.value as ReferenceSourceType)}
              disabled={isSaving}
            >
              <option value="unknown">不指定</option>
              <option value="web">网页</option>
              <option value="ai">AI整理</option>
              <option value="note">作者笔记</option>
              <option value="novel">原文引用</option>
            </Select>
          </FormGroup>
        </FormRow>

        <FormGroup>
          <Label htmlFor="ref-sourceUrl">链接（可选）</Label>
          <Input
            id="ref-sourceUrl"
            value={sourceUrl}
            onChange={e => setSourceUrl(e.target.value)}
            placeholder="https://..."
            disabled={isSaving}
          />
        </FormGroup>

        <FormGroup>
          <Label>关联标签</Label>
          <FormRow style={{ marginBottom: SPACING.sm }}>
            {activeTag && (
              <SmallButton
                type="button"
                $variant="primary"
                onClick={() => applyTag(activeTag.id)}
                disabled={isSaving}
                title="使用当前选中的标签（同根替换）"
              >
                使用当前标签：{activeTag.name}
              </SmallButton>
            )}
            <SmallButton
              type="button"
              $variant="ghost"
              onClick={() => setTagIds([])}
              disabled={isSaving}
              title="清空所有标签"
            >
              清空标签
            </SmallButton>
          </FormRow>

          <TagPills>
            {leafTags.length > 0 ? (
              leafTags.map(t => (
                <TagPill
                  key={t.id}
                  type="button"
                  $bg={t.color}
                  $color={getContrastingTextColor(t.color)}
                  onClick={() => removeLeafRoot(t.id)}
                  title="点击移除该根标签体系"
                >
                  {t.name} <span style={{ opacity: 0.9 }}>×</span>
                </TagPill>
              ))
            ) : (
              <span style={{ color: COLORS.textLight, fontSize: FONTS.sizeSmall }}>
                未关联标签（建议至少关联一个）
              </span>
            )}
          </TagPills>

          <div style={{ marginTop: SPACING.md }}>
            <Label htmlFor="ref-tagSearch">添加/替换标签（搜索）</Label>
            <Input
              id="ref-tagSearch"
              value={tagQuery}
              onChange={e => setTagQuery(e.target.value)}
              placeholder="输入标签名关键字"
              disabled={isSaving}
            />
            {filteredTagResults.length > 0 && (
              <TagSearchResults>
                {filteredTagResults.map(t => (
                  <TagSearchItem
                    key={t.id}
                    type="button"
                    onClick={() => applyTag(t.id)}
                  >
                    {t.name}
                  </TagSearchItem>
                ))}
              </TagSearchResults>
            )}
          </div>
        </FormGroup>

        <FormGroup>
          <Label htmlFor="ref-content">内容</Label>
          <Textarea
            id="ref-content"
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="粘贴你从网上/GPT整理的资料，或记录设定。"
            disabled={isSaving}
          />
        </FormGroup>

        {error && <ErrorBox>{error}</ErrorBox>}

        <ButtonRow>
          <SmallButton type="button" $variant="ghost" onClick={onClose} disabled={isSaving}>
            取消
          </SmallButton>
          <SmallButton
            type="button"
            $variant="primary"
            onClick={handleSave}
            disabled={!title.trim() || isSaving}
          >
            {isSaving ? '保存中...' : '保存'}
          </SmallButton>
        </ButtonRow>
      </Modal>
    </Overlay>
  );
};

export default ReferenceEntryModal;

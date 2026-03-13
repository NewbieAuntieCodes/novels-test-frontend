import React, { useState, useEffect, useRef, useMemo } from 'react';
import styled from '@emotion/styled';
import type { Storyline, PlotAnchor } from "../types";
import { COLORS, SPACING, FONTS, BORDERS, SHADOWS } from '../../styles';
import type { StorylineDerivedData } from './storylineTree';
import { flattenStorylineRows } from './storylineTree';
import { useVirtualRows } from './useVirtualRows';

interface PlotAnchorPopoverProps {
  targetElement: HTMLElement;
  storylines: Storyline[];
  storylineDerivedData: StorylineDerivedData;
  existingAnchor: PlotAnchor | null;
  collapsedStorylineIds: Set<string>;
  onToggleStorylineCollapsed: (storylineId: string) => void;
  onSave: (description: string, storylineIds: string[]) => void;
  onDelete: () => void;
  onClose: () => void;
}

const PopoverBackdrop = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: transparent; /* Allows clicks to pass through to close */
  z-index: 99;
`;

const PopoverContent = styled.div`
  position: absolute;
  background-color: ${COLORS.white};
  border-radius: ${BORDERS.radius};
  box-shadow: ${SHADOWS.medium};
  padding: ${SPACING.md};
  width: 300px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: ${SPACING.md};
`;

const Header = styled.h4`
  font-size: ${FONTS.sizeBase};
  color: ${COLORS.dark};
  margin: 0;
  border-bottom: 1px solid ${COLORS.borderLight};
  padding-bottom: ${SPACING.sm};
`;

const DescriptionTextarea = styled.textarea`
  width: 100%;
  min-height: 80px;
  padding: ${SPACING.sm};
  border: ${BORDERS.width} ${BORDERS.style} ${BORDERS.color};
  border-radius: ${BORDERS.radius};
  box-sizing: border-box;
  font-family: inherit;
  font-size: ${FONTS.sizeSmall};
  resize: vertical;
  background-color: ${COLORS.white};
  color: ${COLORS.text};

  &::placeholder {
    color: ${COLORS.gray500};
  }

  &:focus {
    border-color: ${COLORS.primary};
    box-shadow: 0 0 0 0.2rem ${COLORS.primary}40;
    outline: none;
  }
`;

const SearchInput = styled.input`
  width: 100%;
  padding: ${SPACING.sm};
  border: ${BORDERS.width} ${BORDERS.style} ${BORDERS.color};
  border-radius: ${BORDERS.radius};
  box-sizing: border-box;
  font-size: ${FONTS.sizeSmall};
  background-color: ${COLORS.white};
  color: ${COLORS.text};

  &::placeholder {
    color: ${COLORS.gray500};
  }

  &:focus {
    border-color: ${COLORS.primary};
    box-shadow: 0 0 0 0.2rem ${COLORS.primary}40;
    outline: none;
  }
`;

const StorylineList = styled.div`
  max-height: 190px;
  overflow-y: auto;
  border: 1px solid ${COLORS.borderLight};
  border-radius: ${BORDERS.radius};
  padding: ${SPACING.xs};
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const StorylineRow = styled.div<{
  level: number;
  isMatched: boolean;
}>`
  display: flex;
  align-items: center;
  gap: ${SPACING.sm};
  padding: ${SPACING.xs};
  padding-left: ${({ level }) => `${level * 16 + 4}px`};
  border-radius: ${BORDERS.radius};
  background-color: ${({ isMatched }) => (isMatched ? COLORS.gray100 : 'transparent')};

  &:hover {
    background-color: ${COLORS.gray100};
  }
`;

const CollapseButton = styled.button`
  width: 16px;
  height: 16px;
  border: none;
  padding: 0;
  background: transparent;
  color: ${COLORS.textLight};
  cursor: pointer;
  border-radius: 4px;
  line-height: 1;
  flex-shrink: 0;

  &:hover {
    background-color: ${COLORS.gray200};
    color: ${COLORS.text};
  }
`;

const CollapseSpacer = styled.span`
  width: 16px;
  height: 16px;
  display: inline-block;
  flex-shrink: 0;
`;

const CheckboxColorSwatch = styled.span`
  width: 14px;
  height: 14px;
  border-radius: 3px;
  display: inline-block;
  flex-shrink: 0;
`;

const StorylineName = styled.span`
  flex: 1;
  min-width: 0;
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.text};
  word-break: break-word;
  line-height: 1.4;
`;

const SearchEmpty = styled.div`
  padding: ${SPACING.md};
  text-align: center;
  color: ${COLORS.textLighter};
  font-size: ${FONTS.sizeSmall};
`;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const SaveButton = styled.button`
  padding: ${SPACING.sm} ${SPACING.lg};
  background-color: ${COLORS.primary};
  color: ${COLORS.white};
  border: none;
  border-radius: ${BORDERS.radius};
  cursor: pointer;
  &:hover { background-color: ${COLORS.primaryHover}; }
`;

const DeleteButton = styled.button`
  background: none;
  border: none;
  color: ${COLORS.danger};
  cursor: pointer;
  &:hover { text-decoration: underline; }
`;
const POPOVER_ROW_HEIGHT = 32;

const PlotAnchorPopover: React.FC<PlotAnchorPopoverProps> = ({
  targetElement,
  storylines,
  storylineDerivedData,
  existingAnchor,
  collapsedStorylineIds,
  onToggleStorylineCollapsed,
  onSave,
  onDelete,
  onClose,
}) => {
  const { childrenByParentId, parentByStorylineId } = storylineDerivedData;
  const [description, setDescription] = useState(existingAnchor?.description || '');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(existingAnchor?.storylineIds || []));
  const [searchQuery, setSearchQuery] = useState('');
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const popoverRef = useRef<HTMLDivElement>(null);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const visibleStorylineIds = useMemo(() => {
    if (!normalizedSearch) return null;

    const matchedIds = new Set<string>();
    storylines.forEach((storyline) => {
      if (storyline.name.toLowerCase().includes(normalizedSearch)) {
        matchedIds.add(storyline.id);
      }
    });

    const visible = new Set<string>();
    matchedIds.forEach((id) => {
      let current: string | null = id;
      while (current) {
        visible.add(current);
        current = parentByStorylineId.get(current) ?? null;
      }
    });

    return visible;
  }, [storylines, normalizedSearch, parentByStorylineId]);

  const flatStorylineRows = useMemo(
    () =>
      flattenStorylineRows({
        childrenByParentId,
        collapsedStorylineIds,
        visibleStorylineIds,
        forceExpand: Boolean(normalizedSearch),
      }),
    [childrenByParentId, collapsedStorylineIds, normalizedSearch, visibleStorylineIds]
  );
  const {
    containerRef: listContainerRef,
    visibleItems: visibleStorylineRows,
    paddingTop,
    paddingBottom,
  } = useVirtualRows(flatStorylineRows, POPOVER_ROW_HEIGHT, 8);

  useEffect(() => {
    const rect = targetElement.getBoundingClientRect();
    const popoverHeight = popoverRef.current?.offsetHeight || 350; // Estimate height
    
    let top = rect.bottom + window.scrollY;
    // If it overflows the viewport, position it above the target
    if (top + popoverHeight > window.innerHeight) {
        top = rect.top + window.scrollY - popoverHeight - 5;
    }

    setPosition({
      top: top,
      left: rect.left + window.scrollX,
    });
  }, [targetElement]);

  useEffect(() => {
    setDescription(existingAnchor?.description || '');
    setSelectedIds(new Set(existingAnchor?.storylineIds || []));
    setSearchQuery('');
  }, [existingAnchor]);

  useEffect(() => {
    const validIds = new Set(storylines.map((storyline) => storyline.id));
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (validIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [storylines]);

  const handleCheckboxChange = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSaveClick = () => {
    if (selectedIds.size > 0) {
      onSave(description.trim(), Array.from(selectedIds));
      return;
    }
    alert("请至少选择一个故事线。");
  };

  const renderedStorylineNodes = visibleStorylineRows.map(({ storyline, level, hasVisibleChildren, isCollapsed }) => {
    const isMatched = normalizedSearch.length > 0 && storyline.name.toLowerCase().includes(normalizedSearch);

    return (
      <StorylineRow
        key={storyline.id}
        level={level}
        isMatched={isMatched}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('button') || target.tagName === 'INPUT') return;
          handleCheckboxChange(storyline.id);
        }}
      >
        {hasVisibleChildren ? (
          <CollapseButton
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleStorylineCollapsed(storyline.id);
            }}
            title={isCollapsed ? '展开子剧情' : '折叠子剧情'}
            aria-label={isCollapsed ? '展开子剧情' : '折叠子剧情'}
          >
            {isCollapsed ? '▸' : '▾'}
          </CollapseButton>
        ) : (
          <CollapseSpacer />
        )}
        <input
          type="checkbox"
          checked={selectedIds.has(storyline.id)}
          onChange={() => handleCheckboxChange(storyline.id)}
        />
        <CheckboxColorSwatch style={{ backgroundColor: storyline.color }} />
        <StorylineName title={storyline.name}>{storyline.name}</StorylineName>
      </StorylineRow>
    );
  });

  return (
    <>
      <PopoverBackdrop onClick={onClose} />
      <PopoverContent ref={popoverRef} style={position}>
        <Header>{existingAnchor ? '编辑剧情锚点' : '新建剧情锚点'}</Header>
        <DescriptionTextarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="输入锚点描述 (例如：初遇云芝)"
          autoFocus
        />
        <SearchInput
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索剧情线名称"
          aria-label="搜索剧情线"
        />
        <StorylineList ref={listContainerRef} style={{ paddingTop, paddingBottom }}>
          {storylines.length === 0 ? (
            <SearchEmpty>请先在左侧创建故事线</SearchEmpty>
          ) : flatStorylineRows.length > 0 ? (
            renderedStorylineNodes
          ) : (
            <SearchEmpty>未找到匹配的剧情线</SearchEmpty>
          )}
        </StorylineList>
        <ButtonContainer>
          {existingAnchor && <DeleteButton onClick={onDelete}>删除</DeleteButton>}
          <SaveButton onClick={handleSaveClick}>保存</SaveButton>
        </ButtonContainer>
      </PopoverContent>
    </>
  );
};

export default PlotAnchorPopover;

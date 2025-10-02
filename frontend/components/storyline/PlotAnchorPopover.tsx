import React, { useState, useEffect, useRef } from 'react';
import styled from '@emotion/styled';
import type { Storyline, PlotAnchor } from "../types";
import { COLORS, SPACING, FONTS, BORDERS, SHADOWS } from '../../styles';

interface PlotAnchorPopoverProps {
  targetElement: HTMLElement;
  storylines: Storyline[];
  existingAnchor: PlotAnchor | null;
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

const StorylineList = styled.div`
  max-height: 150px;
  overflow-y: auto;
  border: 1px solid ${COLORS.borderLight};
  border-radius: ${BORDERS.radius};
  padding: ${SPACING.sm};
  display: flex;
  flex-direction: column;
  gap: ${SPACING.xs};
`;

const StorylineCheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: ${SPACING.sm};
  cursor: pointer;
  padding: ${SPACING.xs};
  border-radius: ${BORDERS.radius};
  &:hover {
    background-color: ${COLORS.gray100};
  }
`;

const CheckboxColorSwatch = styled.span`
  width: 14px;
  height: 14px;
  border-radius: 3px;
  display: inline-block;
  flex-shrink: 0;
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

const PlotAnchorPopover: React.FC<PlotAnchorPopoverProps> = ({
  targetElement,
  storylines,
  existingAnchor,
  onSave,
  onDelete,
  onClose,
}) => {
  const [description, setDescription] = useState(existingAnchor?.description || '');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(existingAnchor?.storylineIds || []));
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const popoverRef = useRef<HTMLDivElement>(null);

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
    if (description.trim() && selectedIds.size > 0) {
      onSave(description.trim(), Array.from(selectedIds));
    } else {
      alert("锚点描述和至少一个故事线为必填项。");
    }
  };

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
        <StorylineList>
          {storylines.length > 0 ? storylines.map(sl => (
            <StorylineCheckboxLabel key={sl.id}>
              <input
                type="checkbox"
                checked={selectedIds.has(sl.id)}
                onChange={() => handleCheckboxChange(sl.id)}
              />
              <CheckboxColorSwatch style={{ backgroundColor: sl.color }} />
              <span>{sl.name}</span>
            </StorylineCheckboxLabel>
          )) : <p style={{color: COLORS.textLighter, fontSize: FONTS.sizeSmall, textAlign: 'center'}}>请先在左侧创建故事线</p>}
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
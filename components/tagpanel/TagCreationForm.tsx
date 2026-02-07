import React, { useState, useEffect, useRef } from 'react';
import styled from '@emotion/styled';
import type { Tag } from "../types";
import { getNextColor } from "../../utils";
import { COLORS, SPACING, FONTS, BORDERS, SHADOWS } from '../../styles';

interface TagCreationFormProps {
  tags: Tag[];
  onAddTag: (name: string, color: string, parentId: string | null) => void;
  activeTagId: string | null;
  entityLabel?: string;
}

const TagForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.md};
`;

const InputGroup = styled.div`
  display: flex;
  gap: ${SPACING.elementGap};
  align-items: center;
`;

const BaseInput = styled.input`
  padding: ${SPACING.sm};
  border: ${BORDERS.width} ${BORDERS.style} ${BORDERS.color};
  border-radius: ${BORDERS.radius};
  box-sizing: border-box;
  background-color: ${COLORS.white};
  font-size: ${FONTS.sizeSmall};
  width: 100%;

  &:focus {
    border-color: ${COLORS.primary};
    box-shadow: 0 0 0 0.2rem ${COLORS.primary}40;
    outline: none;
  }
`;

const TagInput = styled(BaseInput)`
  flex-grow: 1;
`;

const ColorInput = styled.input`
  min-width: 40px;
  max-width: 50px;
  height: 38px;
  padding: 2px;
  border: 1px solid ${COLORS.border};
  border-radius: ${BORDERS.radius};
  box-sizing: border-box;
  cursor: pointer;
`;

const AddButton = styled.button`
  padding: ${SPACING.sm} ${SPACING.lg};
  background-color: ${COLORS.primary};
  color: ${COLORS.white};
  border: none;
  border-radius: ${BORDERS.radius};
  cursor: pointer;
  transition: background-color 0.2s, box-shadow 0.2s;
  font-size: ${FONTS.sizeSmall};
  align-self: flex-start;

  &:hover {
    background-color: ${COLORS.primaryHover};
    box-shadow: ${SHADOWS.small};
  }
`;

const ParentHint = styled.div`
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.textLight};
  margin-top: -${SPACING.xs};
  display: flex;
  gap: ${SPACING.sm};
  align-items: center;
`;

const ParentName = styled.span`
  color: ${COLORS.text};
  font-weight: 600;
`;

const ClearParentButton = styled.button`
  padding: 0;
  border: none;
  background: none;
  color: ${COLORS.primary};
  cursor: pointer;
  font-size: ${FONTS.sizeSmall};

  &:hover:not(:disabled) {
    text-decoration: underline;
  }

  &:disabled {
    color: ${COLORS.gray400};
    cursor: not-allowed;
    text-decoration: none;
  }
`;

const TagCreationForm: React.FC<TagCreationFormProps> = ({
  tags, onAddTag, activeTagId, entityLabel
}) => {
  const label = entityLabel || '标签';
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(getNextColor());
  const [selectedParentIdForForm, setSelectedParentIdForForm] = useState<string | null>(null);
  const lastActiveTagIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Only follow activeTagId when it changes (avoid overriding manual "top-level"
    // after the tag list refreshes due to create/delete).
    if (activeTagId === lastActiveTagIdRef.current) return;
    lastActiveTagIdRef.current = activeTagId;

    if (activeTagId && tags.find(t => t.id === activeTagId)) {
      setSelectedParentIdForForm(activeTagId);
      return;
    }

    if (!activeTagId) {
      setSelectedParentIdForForm(null);
    }
  }, [activeTagId, tags]);

  useEffect(() => {
    if (!selectedParentIdForForm) return;
    if (!tags.find(t => t.id === selectedParentIdForForm)) {
      setSelectedParentIdForForm(null);
    }
  }, [selectedParentIdForForm, tags]);

  const handleSubmitTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) {
      alert(`${label}名称不能为空。`);
      return;
    }
    onAddTag(newTagName, newTagColor, selectedParentIdForForm);
    setNewTagName('');
    setNewTagColor(getNextColor());
  };

  const parentName = selectedParentIdForForm
    ? (tags.find(t => t.id === selectedParentIdForForm)?.name ?? null)
    : null;

  return (
    <TagForm onSubmit={handleSubmitTag}>
      <InputGroup>
        <TagInput
          type="text"
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          placeholder={`新${label}名称`}
          aria-label={`新${label}名称`}
          required
        />
        <ColorInput
          type="color"
          value={newTagColor}
          onChange={(e) => setNewTagColor(e.target.value)}
          aria-label="新标签颜色"
        />
      </InputGroup>
      <ParentHint>
        <span>{`将创建为：`}</span>
        <ParentName>{parentName ? `${parentName} 的子${label}` : `顶级${label}`}</ParentName>
        {selectedParentIdForForm && (
          <ClearParentButton
            type="button"
            onClick={() => setSelectedParentIdForForm(null)}
            title="设为顶级"
          >
            设为顶级
          </ClearParentButton>
        )}
      </ParentHint>
      <AddButton type="submit">
        添加{label}
      </AddButton>
    </TagForm>
  );
};

export default TagCreationForm;

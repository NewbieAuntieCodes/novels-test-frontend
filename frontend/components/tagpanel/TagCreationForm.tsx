import React, { useState, useEffect } from 'react';
import styled from '@emotion/styled';
import type { Tag } from "../types";
import { getNextColor } from "../../utils";
import { COLORS, SPACING, FONTS, BORDERS, SHADOWS } from '../../styles';

interface TagCreationFormProps {
  tags: Tag[];
  onAddTag: (name: string, color: string, parentId: string | null) => void;
  activeTagId: string | null;
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

const ParentTagSelect = styled.select`
  padding: ${SPACING.sm};
  border: ${BORDERS.width} ${BORDERS.style} ${BORDERS.color};
  border-radius: ${BORDERS.radius};
  box-sizing: border-box;
  background-color: ${COLORS.white};
  font-size: ${FONTS.sizeSmall};
  width: 100%;
  min-width: 150px;
  
  &:focus {
    border-color: ${COLORS.primary};
    box-shadow: 0 0 0 0.2rem ${COLORS.primary}40;
    outline: none;
  }
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


const TagCreationForm: React.FC<TagCreationFormProps> = ({
  tags, onAddTag, activeTagId
}) => {
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(getNextColor());
  const [selectedParentIdForForm, setSelectedParentIdForForm] = useState<string | null>(null);

  useEffect(() => {
    if (activeTagId && tags.find(t => t.id === activeTagId)) {
      setSelectedParentIdForForm(activeTagId);
    }
  }, [activeTagId, tags]);

  const handleSubmitTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) {
      alert("标签名称不能为空。");
      return;
    }
    onAddTag(newTagName, newTagColor, selectedParentIdForForm);
    setNewTagName('');
    setNewTagColor(getNextColor());
  };

  return (
    <TagForm onSubmit={handleSubmitTag}>
      <InputGroup>
        <TagInput
          type="text"
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          placeholder="新标签名称"
          aria-label="新标签名称"
          required
        />
        <ColorInput
          type="color"
          value={newTagColor}
          onChange={(e) => setNewTagColor(e.target.value)}
          aria-label="新标签颜色"
        />
      </InputGroup>
      <InputGroup>
        <ParentTagSelect
          value={selectedParentIdForForm || ''}
          onChange={(e) => setSelectedParentIdForForm(e.target.value || null)}
          aria-label="父标签 (可选)"
        >
          <option value="">无父标签 (顶级)</option>
          {tags.sort((a, b) => a.name.localeCompare(b.name)).map(tag => (
            <option key={tag.id} value={tag.id}>{tag.name}</option>
          ))}
        </ParentTagSelect>
      </InputGroup>
      <AddButton type="submit">
        添加标签
      </AddButton>
    </TagForm>
  );
};

export default TagCreationForm;
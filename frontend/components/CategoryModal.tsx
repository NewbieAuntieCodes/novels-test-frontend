import React, { useState } from 'react';
import styled from '@emotion/styled';
import { COLORS, SPACING, FONTS, BORDERS, SHADOWS } from '../styles';

interface CategoryModalProps {
  isOpen: boolean;
  novelTitle: string;
  currentCategory: string | null;
  currentSubcategory: string | null;
  onClose: () => void;
  onSave: (category: string, subcategory: string) => void;
}

const MAIN_CATEGORIES = ['男频小说', '女频小说', '电影剧本', '电视剧剧本'];

const Overlay = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: ${props => (props.isOpen ? 'flex' : 'none')};
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const Modal = styled.div`
  background: white;
  border-radius: ${BORDERS.radius};
  padding: ${SPACING.xl};
  max-width: 500px;
  width: 90%;
  box-shadow: ${SHADOWS.large};
`;

const Title = styled.h2`
  font-size: ${FONTS.sizeH3};
  color: ${COLORS.dark};
  margin-bottom: ${SPACING.lg};
`;

const Label = styled.label`
  display: block;
  font-weight: 500;
  margin-bottom: ${SPACING.xs};
  color: ${COLORS.text};
`;

const Select = styled.select`
  width: 100%;
  padding: ${SPACING.sm} ${SPACING.md};
  border: 1px solid ${COLORS.border};
  border-radius: ${BORDERS.radius};
  font-size: ${FONTS.sizeBase};
  margin-bottom: ${SPACING.lg};
  background-color: ${COLORS.white};
  cursor: pointer;

  &:focus {
    border-color: ${COLORS.primary};
    outline: none;
    box-shadow: 0 0 0 0.2rem ${COLORS.primary}40;
  }
`;

const Input = styled.input`
  width: 100%;
  padding: ${SPACING.sm} ${SPACING.md};
  border: 1px solid ${COLORS.border};
  border-radius: ${BORDERS.radius};
  font-size: ${FONTS.sizeBase};
  margin-bottom: ${SPACING.lg};
  box-sizing: border-box;

  &:focus {
    border-color: ${COLORS.primary};
    outline: none;
    box-shadow: 0 0 0 0.2rem ${COLORS.primary}40;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: ${SPACING.md};
  justify-content: flex-end;
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: ${SPACING.sm} ${SPACING.lg};
  border-radius: ${BORDERS.radius};
  font-size: ${FONTS.sizeBase};
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid ${props => (props.variant === 'primary' ? COLORS.primary : COLORS.border)};
  background-color: ${props => (props.variant === 'primary' ? COLORS.primary : COLORS.white)};
  color: ${props => (props.variant === 'primary' ? COLORS.white : COLORS.text)};

  &:hover {
    background-color: ${props => (props.variant === 'primary' ? COLORS.primaryDark : COLORS.gray100)};
  }
`;

const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  novelTitle,
  currentCategory,
  currentSubcategory,
  onClose,
  onSave,
}) => {
  const [category, setCategory] = useState(currentCategory || '');
  const [subcategory, setSubcategory] = useState(currentSubcategory || '');

  const handleSave = () => {
    if (!category) {
      alert('请选择分类');
      return;
    }
    onSave(category, subcategory);
  };

  const handleCancel = () => {
    setCategory(currentCategory || '');
    setSubcategory(currentSubcategory || '');
    onClose();
  };

  return (
    <Overlay isOpen={isOpen} onClick={handleCancel}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <Title>分类作品: {novelTitle}</Title>

        <Label>选择分类</Label>
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">-- 无 --</option>
          {MAIN_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </Select>

        <Label>选择子分类 (可选)</Label>
        <Input
          type="text"
          value={subcategory}
          onChange={(e) => setSubcategory(e.target.value)}
          placeholder="输入自定义子分类"
        />

        <ButtonGroup>
          <Button variant="secondary" onClick={handleCancel}>
            取消
          </Button>
          <Button variant="primary" onClick={handleSave}>
            保存
          </Button>
        </ButtonGroup>
      </Modal>
    </Overlay>
  );
};

export default CategoryModal;

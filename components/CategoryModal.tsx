import React, { useState, useEffect } from 'react';
import styled from '@emotion/styled';
import { COLORS, SPACING, FONTS, BORDERS, SHADOWS } from '../styles';
import type { Novel } from './types';
import { MAIN_CATEGORIES, normalizeMainCategory } from '../constants/categories';

interface CategoryModalProps {
  isOpen: boolean;
  novelTitle: string;
  currentCategory: string | null;
  currentSubcategory: string | null;
  allNovels: Novel[]; // 添加所有小说数据，用于提取已有子分类
  onClose: () => void;
  onSave: (category: string, subcategory: string) => void;
}


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

const AutocompleteContainer = styled.div`
  position: relative;
  margin-bottom: ${SPACING.lg};
`;

const AutocompleteInput = styled.input`
  width: 100%;
  padding: ${SPACING.sm} ${SPACING.md};
  border: 1px solid ${COLORS.border};
  border-radius: ${BORDERS.radius};
  font-size: ${FONTS.sizeBase};
  box-sizing: border-box;

  &:focus {
    border-color: ${COLORS.primary};
    outline: none;
    box-shadow: 0 0 0 0.2rem ${COLORS.primary}40;
  }
`;

const SuggestionsList = styled.ul<{ show: boolean }>`
  display: ${props => (props.show ? 'block' : 'none')};
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid ${COLORS.border};
  border-top: none;
  border-radius: 0 0 ${BORDERS.radius} ${BORDERS.radius};
  max-height: 200px;
  overflow-y: auto;
  list-style: none;
  padding: 0;
  margin: 0;
  z-index: 1001;
  box-shadow: ${SHADOWS.small};
`;

const SuggestionItem = styled.li`
  padding: ${SPACING.sm} ${SPACING.md};
  cursor: pointer;
  transition: background-color 0.15s;

  &:hover {
    background-color: ${COLORS.gray100};
  }

  &:last-child {
    border-radius: 0 0 ${BORDERS.radius} ${BORDERS.radius};
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
  allNovels,
  onClose,
  onSave,
}) => {
  const [category, setCategory] = useState(normalizeMainCategory(currentCategory) || '');
  const [subcategory, setSubcategory] = useState(currentSubcategory || '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setCategory(normalizeMainCategory(currentCategory) || '');
    setSubcategory(currentSubcategory || '');
    setShowSuggestions(false);
  }, [isOpen, currentCategory, currentSubcategory]);

  // 获取当前大分类下的所有已有子分类
  const getSubcategoriesForCategory = (cat: string): string[] => {
    const subcategories = allNovels
      .filter(novel => normalizeMainCategory(novel.category) === cat && novel.subcategory)
      .map(novel => novel.subcategory!)
      .filter((value, index, self) => self.indexOf(value) === index); // 去重
    return subcategories.sort();
  };

  // 当大分类改变时，更新建议列表
  useEffect(() => {
    if (category) {
      const suggestions = getSubcategoriesForCategory(category);
      setFilteredSuggestions(suggestions);
    } else {
      setFilteredSuggestions([]);
    }
  }, [category, allNovels]);

  // 处理子分类输入变化
  const handleSubcategoryChange = (value: string) => {
    setSubcategory(value);

    if (category && value) {
      const allSuggestions = getSubcategoriesForCategory(category);
      const filtered = allSuggestions.filter(s =>
        s.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else if (category) {
      const allSuggestions = getSubcategoriesForCategory(category);
      setFilteredSuggestions(allSuggestions);
      setShowSuggestions(allSuggestions.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  // 选择建议项
  const handleSelectSuggestion = (suggestion: string) => {
    setSubcategory(suggestion);
    setShowSuggestions(false);
  };

  const handleSave = () => {
    if (!category) {
      alert('请选择分类');
      return;
    }
    onSave(category, subcategory);
  };

  const handleCancel = () => {
    setCategory(normalizeMainCategory(currentCategory) || '');
    setSubcategory(currentSubcategory || '');
    setShowSuggestions(false);
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
        <AutocompleteContainer>
          <AutocompleteInput
            type="text"
            value={subcategory}
            onChange={(e) => handleSubcategoryChange(e.target.value)}
            onFocus={() => category && filteredSuggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder="输入或选择子分类"
          />
          <SuggestionsList show={showSuggestions}>
            {filteredSuggestions.map((suggestion, index) => (
              <SuggestionItem
                key={index}
                onClick={() => handleSelectSuggestion(suggestion)}
              >
                {suggestion}
              </SuggestionItem>
            ))}
          </SuggestionsList>
        </AutocompleteContainer>

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

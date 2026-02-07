import React, { useState, useEffect, DragEvent, useRef } from 'react';
import styled from '@emotion/styled';
import type { TagTemplate, TagTemplateDefinition } from "../types";
import { getNextColor } from "../../utils";
import { COLORS, SPACING, FONTS, SHADOWS, BORDERS } from '../../styles';

// Props for the main modal component
interface TagTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: TagTemplate[];
  onUpdateTemplates: (templates: TagTemplate[]) => void;
}

// Props for the individual editable tag item in the tree
interface EditableTagItemProps {
  tag: TagTemplateDefinition;
  level: number;
  onUpdate: (updatedTag: Partial<TagTemplateDefinition>) => void;
  onDelete: () => void;
  onDragStart: (e: DragEvent, tagName: string) => void;
  onDragOver: (e: DragEvent, tagName: string) => void;
  onDragLeave: (e: DragEvent) => void;
  onDrop: (e: DragEvent, parentName: string) => void;
  isDragOver: boolean;
}

// --- Styled Components ---

const ModalBackdrop = styled.div<{ isOpen: boolean }>`
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: ${props => (props.isOpen ? 'flex' : 'none')};
  justify-content: center; align-items: center; z-index: 1000;
  opacity: ${props => (props.isOpen ? 1 : 0)};
  transition: opacity 0.2s;
`;

const ModalContent = styled.div`
  background: ${COLORS.white}; padding: ${SPACING.xl};
  border-radius: ${BORDERS.radius}; box-shadow: ${SHADOWS.medium};
  max-width: 600px; width: 90%; max-height: 85vh;
  display: flex; flex-direction: column;
`;

const ModalHeader = styled.div`
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: ${SPACING.md}; padding-bottom: ${SPACING.md};
  border-bottom: 1px solid ${COLORS.borderLight};
`;

const ModalTitle = styled.h2`
  margin: 0; font-size: ${FONTS.sizeH2}; color: ${COLORS.dark};
`;

const CloseButton = styled.button`
  background: none; border: none; font-size: 1.5rem; cursor: pointer;
  color: ${COLORS.gray600}; line-height: 1; padding: 0 ${SPACING.sm};
  &:hover { color: ${COLORS.dark}; }
`;

const TemplateTabs = styled.div`
  display: flex; border-bottom: 1px solid ${COLORS.borderLight};
  margin-bottom: ${SPACING.md}; flex-shrink: 0; flex-wrap: wrap;
`;

const TabButton = styled.button<{ isActive: boolean }>`
  padding: ${SPACING.sm} ${SPACING.md}; border: none; background: none; cursor: pointer;
  font-size: ${FONTS.sizeBase};
  color: ${props => (props.isActive ? COLORS.primary : COLORS.textLight)};
  font-weight: ${props => (props.isActive ? '600' : 'normal')};
  border-bottom: 2px solid ${props => (props.isActive ? COLORS.primary : 'transparent')};
  margin-bottom: -1px; transition: all 0.2s ease-in-out;
  &:hover { color: ${COLORS.primary}; }
`;

const AddTabButton = styled(TabButton)`
  font-weight: bold; color: ${COLORS.success};
`;

const TemplatesContainer = styled.div`
  overflow-y: auto; flex-grow: 1; padding-right: ${SPACING.sm};
`;

const ActiveTemplateHeader = styled.div`
  display: flex; align-items: center; gap: ${SPACING.md};
  margin-bottom: ${SPACING.lg};
`;

const GenreTitle = styled.h3`
  font-size: ${FONTS.sizeH3}; color: ${COLORS.gray800}; margin: 0;
`;

const ActionButton = styled.button`
  background: none; border: none; cursor: pointer; padding: ${SPACING.xs};
  font-size: 1em; color: ${COLORS.textLighter};
  &:hover { color: ${COLORS.primary}; }
`;

const AddTagForm = styled.form`
  padding: ${SPACING.md}; margin-bottom: ${SPACING.lg};
  border: 1px solid ${COLORS.borderLight}; border-radius: ${BORDERS.radius};
  display: flex; flex-direction: column; gap: ${SPACING.md};
`;

const FormRow = styled.div`
  display: flex; gap: ${SPACING.elementGap}; align-items: center;
`;

const BaseInput = styled.input`
  padding: ${SPACING.sm}; border: ${BORDERS.width} ${BORDERS.style} ${BORDERS.color};
  border-radius: ${BORDERS.radius}; box-sizing: border-box; background-color: ${COLORS.white};
  font-size: ${FONTS.sizeSmall}; width: 100%;
  &:focus {
    border-color: ${COLORS.primary};
    box-shadow: 0 0 0 0.2rem ${COLORS.primary}40;
    outline: none;
  }
`;

const TagInput = styled(BaseInput)` flex-grow: 1; `;
const ColorInput = styled.input`
  min-width: 40px; max-width: 50px; height: 38px; padding: 2px;
  border: 1px solid ${COLORS.border}; border-radius: ${BORDERS.radius};
  box-sizing: border-box; cursor: pointer;
`;
const ParentSelect = styled.select`
  padding: ${SPACING.sm}; border: ${BORDERS.width} ${BORDERS.style} ${BORDERS.color};
  border-radius: ${BORDERS.radius}; background-color: ${COLORS.white};
  font-size: ${FONTS.sizeSmall}; width: 100%;
  &:focus {
    border-color: ${COLORS.primary};
    box-shadow: 0 0 0 0.2rem ${COLORS.primary}40;
    outline: none;
  }
`;

const SubmitButton = styled.button`
  padding: ${SPACING.sm} ${SPACING.lg}; background-color: ${COLORS.primary};
  color: ${COLORS.white}; border: none; border-radius: ${BORDERS.radius};
  cursor: pointer; transition: background-color 0.2s; font-size: ${FONTS.sizeSmall};
  align-self: flex-start;
  &:hover { background-color: ${COLORS.primaryHover}; }
`;

const TagTreeList = styled.ul<{ isDragOver: boolean }>`
  list-style: none; padding: 0; margin: 0;
  outline: 2px dashed ${props => (props.isDragOver ? COLORS.primary : 'transparent')};
  transition: outline-color 0.2s; min-height: 50px;
`;

const StyledTagTreeItem = styled.li<{ level: number; isDragOver: boolean }>`
  display: flex; align-items: center; gap: ${SPACING.sm};
  padding: ${SPACING.xs} ${SPACING.sm};
  padding-left: ${props => props.level * 20 + 8}px;
  border-radius: ${BORDERS.radius};
  background-color: ${props => props.isDragOver ? COLORS.highlightBackground : 'transparent'};
  &:hover { background-color: ${COLORS.gray100}; }
`;

const TemplateTagColorSwatch = styled.label`
  display: inline-block;
  width: 16px;
  height: 16px;
  border-radius: 3px;
  border: none;
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.1);
  cursor: pointer;
  flex-shrink: 0;
  position: relative;
`;

const HiddenColorInput = styled.input`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
`;

const EditableTagName = styled.span`
  font-size: ${FONTS.sizeBase}; color: ${COLORS.text};
  flex-grow: 1; cursor: text;
`;
const InlineNameInput = styled(BaseInput)`
  padding: 2px; height: auto; font-size: inherit; flex-grow: 1;
`;

// --- EditableTagItem Component ---

const EditableTagItem: React.FC<EditableTagItemProps> = ({ tag, level, onUpdate, onDelete, onDragStart, onDragOver, onDragLeave, onDrop, isDragOver }) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [name, setName] = useState(tag.name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(tag.name);
  }, [tag.name]);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleNameBlur = () => {
    setIsEditingName(false);
    if (name.trim() && name.trim() !== tag.name) {
      onUpdate({ name: name.trim() });
    } else {
      setName(tag.name); // Revert if empty or unchanged
    }
  };
  
  return (
    <StyledTagTreeItem
      level={level}
      isDragOver={isDragOver}
      draggable
      onDragStart={(e) => onDragStart(e, tag.name)}
      onDragOver={(e) => onDragOver(e, tag.name)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, tag.name)}
    >
      <TemplateTagColorSwatch style={{ backgroundColor: tag.color }} title="点击修改颜色">
        <HiddenColorInput
          type="color"
          value={tag.color}
          onChange={e => onUpdate({ color: e.target.value })}
        />
      </TemplateTagColorSwatch>
      {isEditingName ? (
        <InlineNameInput
          ref={nameInputRef}
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={handleNameBlur}
          onKeyDown={e => e.key === 'Enter' && handleNameBlur()}
        />
      ) : (
        <EditableTagName onDoubleClick={() => setIsEditingName(true)}>{tag.name}</EditableTagName>
      )}
      <ActionButton onClick={() => setIsEditingName(true)} title="重命名">✏️</ActionButton>
      <ActionButton onClick={onDelete} title="删除">🗑️</ActionButton>
    </StyledTagTreeItem>
  );
};

// --- Main Modal Component ---

const TagTemplateModal: React.FC<TagTemplateModalProps> = ({ isOpen, onClose, templates, onUpdateTemplates }) => {
  const [activeGenre, setActiveGenre] = useState<string>('');
  
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(getNextColor());
  const [newTagParent, setNewTagParent] = useState<string>('');

  const [draggedTagName, setDraggedTagName] = useState<string | null>(null);
  const [dragOverTagName, setDragOverTagName] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
        const isValidGenre = templates.some(t => t.genre === activeGenre);
        if ((!isValidGenre || !activeGenre) && templates.length > 0) {
            setActiveGenre(templates[0].genre);
        } else if (templates.length === 0) {
            setActiveGenre('');
        }
    }
  }, [isOpen, templates, activeGenre]);

  const activeTemplate = templates.find(t => t.genre === activeGenre);

  // --- Handlers ---
  const handleAddTemplate = () => {
    const newGenre = prompt("输入新模板名称 (题材):");
    if (newGenre && !templates.some(t => t.genre === newGenre)) {
      onUpdateTemplates([...templates, { genre: newGenre, tags: [] }]);
      setActiveGenre(newGenre);
    } else if (newGenre) {
      alert("该模板名称已存在。");
    }
  };

  const handleRenameTemplate = () => {
    if (!activeTemplate) return;
    const newGenre = prompt("输入新的模板名称:", activeTemplate.genre);
    if (newGenre && newGenre !== activeTemplate.genre && !templates.some(t => t.genre === newGenre)) {
      onUpdateTemplates(templates.map(t => t.genre === activeGenre ? { ...t, genre: newGenre } : t));
      setActiveGenre(newGenre);
    } else if (newGenre) {
      alert("该模板名称已存在或未更改。");
    }
  };

  const handleDeleteTemplate = () => {
    if (!activeTemplate || !confirm(`确定要删除模板 "${activeTemplate.genre}" 吗?`)) return;
    const newTemplates = templates.filter(t => t.genre !== activeGenre);
    onUpdateTemplates(newTemplates);
    setActiveGenre(newTemplates.length > 0 ? newTemplates[0].genre : '');
  };
  
  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTemplate || !newTagName.trim()) return;
    if (activeTemplate.tags.some(t => t.name === newTagName.trim())) {
      alert("该标签名称已存在于此模板中。");
      return;
    }
    const newTag: TagTemplateDefinition = {
      name: newTagName.trim(),
      color: newTagColor,
      parentName: newTagParent || undefined,
    };
    const updatedTemplate = { ...activeTemplate, tags: [...activeTemplate.tags, newTag] };
    onUpdateTemplates(templates.map(t => t.genre === activeGenre ? updatedTemplate : t));
    setNewTagName('');
    setNewTagColor(getNextColor());
    setNewTagParent('');
  };

  const handleUpdateTag = (tagName: string, updates: Partial<TagTemplateDefinition>) => {
    if (!activeTemplate) return;
    
    // If renaming, check for uniqueness
    if (updates.name && updates.name !== tagName && activeTemplate.tags.some(t => t.name === updates.name)) {
        alert("该标签名称已存在于此模板中。");
        return;
    }

    const updatedTags = activeTemplate.tags.map(tag =>
      tag.name === tagName ? { ...tag, ...updates } : tag
    );

    // If a tag was renamed, we need to update all its children's parentName
    if (updates.name) {
        for(let i=0; i<updatedTags.length; i++) {
            if (updatedTags[i].parentName === tagName) {
                updatedTags[i].parentName = updates.name;
            }
        }
    }
    
    const updatedTemplate = { ...activeTemplate, tags: updatedTags };
    onUpdateTemplates(templates.map(t => t.genre === activeGenre ? updatedTemplate : t));
  };
  
  const handleDeleteTag = (tagName: string) => {
    if (!activeTemplate) return;
    const tagToDelete = activeTemplate.tags.find(t => t.name === tagName);
    if (!tagToDelete) return;

    const children = activeTemplate.tags.filter(t => t.parentName === tagName);
    const remainingTags = activeTemplate.tags
      .filter(t => t.name !== tagName)
      .map(t => {
        if (children.some(child => child.name === t.name)) {
          return { ...t, parentName: tagToDelete.parentName };
        }
        return t;
      });
    
    const updatedTemplate = { ...activeTemplate, tags: remainingTags };
    onUpdateTemplates(templates.map(t => t.genre === activeGenre ? updatedTemplate : t));
  };

  // --- Drag & Drop Handlers ---
  const handleDragStart = (e: DragEvent, tagName: string) => {
    setDraggedTagName(tagName);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e: DragEvent, targetTagName: string) => {
    e.preventDefault();
    if (targetTagName !== draggedTagName) {
      setDragOverTagName(targetTagName);
    }
  };
  const handleDragLeave = (e: DragEvent) => {
    setDragOverTagName(null);
  };
  const handleDrop = (e: DragEvent, parentName: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedTagName || draggedTagName === parentName) return;
    
    // Prevent dropping onto a descendant
    let currentParent = parentName;
    while(currentParent) {
        if (currentParent === draggedTagName) {
            alert("不能将标签移动到其自己的子标签下。");
            setDraggedTagName(null);
            setDragOverTagName(null);
            return;
        }
        currentParent = activeTemplate?.tags.find(t => t.name === currentParent)?.parentName || null;
    }
    
    handleUpdateTag(draggedTagName, { parentName: parentName || undefined });
    setDraggedTagName(null);
    setDragOverTagName(null);
  };


  const renderTagTree = (parentName?: string, level: number = 0): React.ReactNode => {
    if (!activeTemplate) return null;
    return activeTemplate.tags
      .filter(tag => tag.parentName === parentName)
      .sort((a,b) => a.name.localeCompare(b.name))
      .map(tag => (
        <React.Fragment key={tag.name}>
          <EditableTagItem
            tag={tag}
            level={level}
            onUpdate={(updates) => handleUpdateTag(tag.name, updates)}
            onDelete={() => handleDeleteTag(tag.name)}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            isDragOver={dragOverTagName === tag.name}
          />
          {renderTagTree(tag.name, level + 1)}
        </React.Fragment>
      ));
  };

  return (
    <ModalBackdrop isOpen={isOpen} onClick={onClose}>
      <ModalContent onClick={e => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>编辑标签模板</ModalTitle>
          <CloseButton onClick={onClose} aria-label="关闭">&times;</CloseButton>
        </ModalHeader>
        <TemplateTabs>
          {templates.map(template => (
            <TabButton key={template.genre} isActive={template.genre === activeGenre} onClick={() => setActiveGenre(template.genre)}>
              {template.genre}
            </TabButton>
          ))}
          <AddTabButton isActive={false} onClick={handleAddTemplate}>+</AddTabButton>
        </TemplateTabs>

        <TemplatesContainer>
          {activeTemplate && (
            <>
              <ActiveTemplateHeader>
                <GenreTitle>{activeTemplate.genre}</GenreTitle>
                <ActionButton onClick={handleRenameTemplate} title="重命名模板">✏️</ActionButton>
                <ActionButton onClick={handleDeleteTemplate} title="删除模板">🗑️</ActionButton>
              </ActiveTemplateHeader>

              <AddTagForm onSubmit={handleAddTag}>
                 <FormRow>
                    <TagInput type="text" value={newTagName} onChange={e => setNewTagName(e.target.value)} placeholder="新标签名称" required />
                    <ColorInput type="color" value={newTagColor} onChange={e => setNewTagColor(e.target.value)} />
                 </FormRow>
                 <FormRow>
                    <ParentSelect value={newTagParent} onChange={e => setNewTagParent(e.target.value)}>
                        <option value="">作为顶级标签</option>
                        {activeTemplate.tags.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                    </ParentSelect>
                 </FormRow>
                 <SubmitButton type="submit">添加标签</SubmitButton>
              </AddTagForm>

              <TagTreeList 
                isDragOver={dragOverTagName === null}
                onDragOver={(e) => { e.preventDefault(); setDragOverTagName(null); }}
                onDrop={(e) => handleDrop(e, null)}
              >
                {renderTagTree()}
              </TagTreeList>
            </>
          )}
        </TemplatesContainer>
      </ModalContent>
    </ModalBackdrop>
  );
};

export default TagTemplateModal;
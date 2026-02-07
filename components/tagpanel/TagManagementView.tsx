import React, { useEffect, useMemo, useState } from 'react';
import styled from '@emotion/styled';
import type { Tag, SelectionDetails, TagTemplate, TagTemplateDefinition } from "../../types";
import type { EditorMode } from '../editor/NovelEditorPage';
import { COLORS, SPACING, FONTS, globalPlaceholderTextStyles, BORDERS, SHADOWS } from '../../styles';
import { PENDING_ANNOTATION_TAG_NAME } from '../../utils';

import TagCreationForm from './TagCreationForm';
import TagList from './TagList';

const TEMPLATE_PANEL_STORAGE_KEY = 'tagManagement_templatePanelExpanded_v1';

interface TagManagementViewProps {
  tags: Tag[]; // These are allUserTags filtered by current user
  onAddTag: (name: string, color: string, parentId: string | null) => void;
  activeTagId: string | null; // A global tag ID
  onUpdateTagParent: (tagId: string, newParentId: string | null) => void;
  onUpdateTagColor: (tagId: string, newColor: string) => void;
  onUpdateTagName: (tagId: string, newName: string) => void;
  onDeleteTag: (tagId: string) => void;
  editorMode: EditorMode;
  onApplyTagToSelection: (tagId: string) => void; // Applies a global tag
  onSelectTagForReadMode: (tagId: string | null) => void; // Selects a global tag
  onTagGlobalSearch?: (tagName: string) => void;
  currentSelection: SelectionDetails | null;
  onCreatePendingAnnotation: () => void;
  onDeleteAnnotationsInSelection: () => void;
  entityLabel?: string; // 标签模式=标签；笔记模式=词条
  showSelectionActions?: boolean;
  templates?: TagTemplate[];
  onUpdateTemplates?: (templates: TagTemplate[]) => void;
  onImportTagTemplate?: (template: TagTemplate) => Promise<void> | void;
  defaultTemplateName?: string;
}

const Title = styled.h2`
  font-size: ${FONTS.sizeH3};
  color: ${COLORS.dark};
  margin: 0;
`;

const TagManagementContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  min-height: 0; /* Important for flex-grow in a scrollable container */
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${SPACING.sm};
  margin-bottom: ${SPACING.md};
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${SPACING.sm};
`;

const TemplateToggleButton = styled.button<{ isExpanded: boolean }>`
  padding: ${SPACING.xs} ${SPACING.sm};
  font-size: ${FONTS.sizeSmall};
  border-radius: ${BORDERS.radius};
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid ${props => (props.isExpanded ? COLORS.primary : COLORS.gray300)};
  background-color: ${props => (props.isExpanded ? COLORS.primary : COLORS.gray200)};
  color: ${props => (props.isExpanded ? COLORS.white : COLORS.text)};
  white-space: nowrap;

  &:hover:not(:disabled) {
    background-color: ${props => (props.isExpanded ? COLORS.primaryHover : COLORS.gray300)};
    box-shadow: ${SHADOWS.small};
  }

  &:disabled {
    background-color: ${COLORS.gray200};
    border-color: ${COLORS.gray300};
    color: ${COLORS.gray500};
    cursor: not-allowed;
  }
`;

const TagListContainer = styled.div`
  flex-grow: 1;
  overflow-y: auto;
  min-height: 150px;
  margin-top: ${SPACING.lg};
`;

const Placeholder = styled.div({
  ...globalPlaceholderTextStyles,
  p: {
    margin: 0,
    padding: 0,
  },
  'p:last-of-type': {
    marginTop: SPACING.xs,
    fontSize: FONTS.sizeSmall,
    color: COLORS.textLighter,
  },
});

const ActionButtonRow = styled.div`
  display: flex;
  gap: ${SPACING.sm};
  margin-bottom: ${SPACING.md};
`;

const PendingActionButton = styled.button`
  padding: ${SPACING.xs} ${SPACING.md};
  flex: 1;
  background-color: ${COLORS.warning};
  color: ${COLORS.dark};
  border: 1px solid #e6a700;
  border-radius: ${BORDERS.radius};
  cursor: pointer;
  transition: all 0.2s;
  font-size: ${FONTS.sizeSmall};
  font-weight: 600;

  &:hover:not(:disabled) {
    background-color: #ffca2c;
    border-color: #e6a700;
    box-shadow: ${SHADOWS.small};
  }

  &:disabled {
    background-color: ${COLORS.gray200};
    border-color: ${COLORS.gray300};
    color: ${COLORS.gray500};
    cursor: not-allowed;
  }
`;

const DeleteActionButton = styled.button`
  padding: ${SPACING.xs} ${SPACING.md};
  flex: 1;
  background-color: ${COLORS.danger};
  color: white;
  border: 1px solid #c82333;
  border-radius: ${BORDERS.radius};
  cursor: pointer;
  transition: all 0.2s;
  font-size: ${FONTS.sizeSmall};
  font-weight: 600;

  &:hover:not(:disabled) {
    background-color: #c82333;
    border-color: #bd2130;
    box-shadow: ${SHADOWS.small};
  }

  &:disabled {
    background-color: ${COLORS.gray200};
    border-color: ${COLORS.gray300};
    color: ${COLORS.gray500};
    cursor: not-allowed;
  }
`;

const TemplateBox = styled.div`
  border: 1px solid ${COLORS.gray300};
  background-color: ${COLORS.gray100};
  border-radius: ${BORDERS.radius};
  padding: ${SPACING.md};
  margin-bottom: ${SPACING.lg};
`;

const TemplateHeader = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${SPACING.sm};
  margin-bottom: ${SPACING.sm};
`;

const TemplateTitle = styled.div`
  font-weight: bold;
  color: ${COLORS.dark};
`;

const TemplateMeta = styled.div`
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.textLight};
`;

const TemplateRow = styled.div`
  display: flex;
  gap: ${SPACING.sm};
  align-items: center;
  margin-top: ${SPACING.sm};
`;

const TemplateInput = styled.input`
  flex: 1;
  padding: ${SPACING.sm};
  border: ${BORDERS.width} ${BORDERS.style} ${BORDERS.color};
  border-radius: ${BORDERS.radius};
  background-color: ${COLORS.white};
  font-size: ${FONTS.sizeSmall};
  box-sizing: border-box;

  &:focus {
    border-color: ${COLORS.primary};
    box-shadow: 0 0 0 0.2rem ${COLORS.primary}40;
    outline: none;
  }
`;

const TemplateSelect = styled.select`
  flex: 1;
  padding: ${SPACING.sm};
  border: ${BORDERS.width} ${BORDERS.style} ${BORDERS.color};
  border-radius: ${BORDERS.radius};
  background-color: ${COLORS.white};
  font-size: ${FONTS.sizeSmall};
  box-sizing: border-box;

  &:focus {
    border-color: ${COLORS.primary};
    box-shadow: 0 0 0 0.2rem ${COLORS.primary}40;
    outline: none;
  }
`;

const TemplateButton = styled.button`
  padding: ${SPACING.sm} ${SPACING.lg};
  background-color: ${COLORS.secondary};
  color: ${COLORS.white};
  border: none;
  border-radius: ${BORDERS.radius};
  cursor: pointer;
  transition: background-color 0.2s, box-shadow 0.2s;
  font-size: ${FONTS.sizeSmall};
  white-space: nowrap;

  &:hover:not(:disabled) {
    background-color: ${COLORS.secondaryHover};
    box-shadow: ${SHADOWS.small};
  }

  &:disabled {
    background-color: ${COLORS.gray300};
    cursor: not-allowed;
  }
`;

const TemplateHint = styled.div`
  margin-top: ${SPACING.sm};
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.textLight};
  line-height: 1.4;
`;

const TagManagementView: React.FC<TagManagementViewProps> = ({
  tags, onAddTag, activeTagId,
  onUpdateTagParent, onUpdateTagColor, onUpdateTagName, onDeleteTag,
  editorMode, onApplyTagToSelection, onSelectTagForReadMode,
  onTagGlobalSearch,
  currentSelection,
  onCreatePendingAnnotation,
  onDeleteAnnotationsInSelection,
  entityLabel,
  showSelectionActions,
  templates,
  onUpdateTemplates,
  onImportTagTemplate,
  defaultTemplateName,
}) => {
  const label = entityLabel || '标签';
  const templateOptions = useMemo(() => (templates ?? []).map(t => t.genre), [templates]);
  const [templateName, setTemplateName] = useState<string>(defaultTemplateName ?? '');
  const [selectedTemplateGenre, setSelectedTemplateGenre] = useState<string>('');
  const [isImporting, setIsImporting] = useState<boolean>(false);

  useEffect(() => {
    if (!defaultTemplateName) return;
    setTemplateName(prev => (prev.trim() ? prev : defaultTemplateName));
  }, [defaultTemplateName]);

  useEffect(() => {
    if (selectedTemplateGenre) return;
    if (!templateOptions.length) return;
    setSelectedTemplateGenre(templateOptions[0]);
  }, [selectedTemplateGenre, templateOptions]);

  const buildTemplateDefinitions = useMemo(() => {
    const usableTags = tags.filter(t => t.name !== PENDING_ANNOTATION_TAG_NAME);
    const byParent = new Map<string | null, Tag[]>();
    for (const tag of usableTags) {
      const list = byParent.get(tag.parentId ?? null) ?? [];
      list.push(tag);
      byParent.set(tag.parentId ?? null, list);
    }

    const visited = new Set<string>();
    const result: TagTemplateDefinition[] = [];

    const sortInPlace = (list: Tag[]) => {
      list.sort((a, b) => a.name.localeCompare(b.name));
      return list;
    };

    const walk = (parentId: string | null, parentName?: string) => {
      const children = sortInPlace([...(byParent.get(parentId) ?? [])]);
      for (const child of children) {
        if (visited.has(child.id)) continue;
        visited.add(child.id);
        result.push({
          name: child.name,
          color: child.color,
          parentName,
        });
        walk(child.id, child.name);
      }
    };

    walk(null, undefined);

    // Defensive: if tree has missing parents or cycles, still keep unvisited nodes as roots.
    const leftovers = sortInPlace(usableTags.filter(t => !visited.has(t.id)));
    for (const tag of leftovers) {
      result.push({ name: tag.name, color: tag.color });
      walk(tag.id, tag.name);
    }

    return result;
  }, [tags]);

  const canUseTemplates = label === '标签' && Boolean(templates) && Boolean(onUpdateTemplates);
  const [isTemplateExpanded, setIsTemplateExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem(TEMPLATE_PANEL_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!canUseTemplates) return;
    try {
      localStorage.setItem(TEMPLATE_PANEL_STORAGE_KEY, isTemplateExpanded ? '1' : '0');
    } catch {
      // ignore
    }
  }, [canUseTemplates, isTemplateExpanded]);

  const handleSaveTemplate = () => {
    if (!templates || !onUpdateTemplates) return;

    const genre = templateName.trim();
    if (!genre) {
      alert('请输入模板名称');
      return;
    }

    if (buildTemplateDefinitions.length === 0) {
      alert(`当前没有可保存的${label}`);
      return;
    }

    const nextTemplate: TagTemplate = { genre, tags: buildTemplateDefinitions };
    const exists = templates.some(t => t.genre === genre);
    if (exists && !window.confirm(`模板 "${genre}" 已存在，是否覆盖？`)) {
      return;
    }

    const nextTemplates = exists
      ? templates.map(t => (t.genre === genre ? nextTemplate : t))
      : [...templates, nextTemplate];

    onUpdateTemplates(nextTemplates);
    alert(`已保存模板 "${genre}"（${buildTemplateDefinitions.length} 个${label}）`);
  };

  const handleImportTemplate = async () => {
    if (!templates || !onImportTagTemplate) return;
    const genre = selectedTemplateGenre.trim();
    if (!genre) {
      alert('请选择要导入的模板');
      return;
    }
    const template = templates.find(t => t.genre === genre);
    if (!template) {
      alert('未找到该模板');
      return;
    }
    if (!window.confirm(`确认导入模板 "${genre}" 到当前小说的${label}树？`)) {
      return;
    }

    setIsImporting(true);
    try {
      await Promise.resolve(onImportTagTemplate(template));
      alert(`导入完成（模板: "${genre}"）`);
    } catch (error) {
      console.error('导入模板失败:', error);
      alert(`导入失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <TagManagementContainer>
      <HeaderRow>
        <Title>{label}管理</Title>
        <HeaderActions>
          {canUseTemplates && (
            <TemplateToggleButton
              type="button"
              isExpanded={isTemplateExpanded}
              onClick={() => setIsTemplateExpanded((prev) => !prev)}
              aria-expanded={isTemplateExpanded}
              title={isTemplateExpanded ? '收起模板' : '展开模板'}
            >
              模板
            </TemplateToggleButton>
          )}
        </HeaderActions>
      </HeaderRow>

      {canUseTemplates && isTemplateExpanded && (
        <TemplateBox>
          <TemplateHeader>
            <TemplateTitle>模板</TemplateTitle>
            <TemplateMeta>{templateOptions.length} 个可用模板</TemplateMeta>
          </TemplateHeader>

          <TemplateRow>
            <TemplateInput
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="模板名称（例如：修仙小说）"
              aria-label="模板名称"
            />
            <TemplateButton onClick={handleSaveTemplate} title="把当前小说的标签树保存为模板">
              保存模板
            </TemplateButton>
          </TemplateRow>

          <TemplateRow>
            <TemplateSelect
              value={selectedTemplateGenre}
              onChange={(e) => setSelectedTemplateGenre(e.target.value)}
              aria-label="选择要导入的模板"
              disabled={templateOptions.length === 0 || isImporting}
            >
              {templateOptions.length === 0 ? (
                <option value="">暂无模板</option>
              ) : (
                templateOptions.map((genre) => (
                  <option key={genre} value={genre}>{genre}</option>
                ))
              )}
            </TemplateSelect>
            <TemplateButton
              onClick={handleImportTemplate}
              disabled={!onImportTagTemplate || templateOptions.length === 0 || isImporting}
              title="把模板中的标签树导入到当前小说（会自动合并同名同父级标签）"
            >
              {isImporting ? '导入中...' : '导入模板'}
            </TemplateButton>
          </TemplateRow>

          <TemplateHint>
            导入时会按层级自动合并公共前缀（同名且父级相同的标签不会重复创建）。
          </TemplateHint>
        </TemplateBox>
      )}

      {editorMode === 'annotation' && (
        <>
          {showSelectionActions !== false && (
            <ActionButtonRow>
            <PendingActionButton
              disabled={!currentSelection || !currentSelection.text.trim()}
              onClick={onCreatePendingAnnotation}
              title={!currentSelection || !currentSelection.text.trim() ? "请先在内容面板划词选择文本" : `标记已选择的文本: "${currentSelection.text.substring(0, 20)}..."`}
            >
              📌 标记待办
            </PendingActionButton>
            <DeleteActionButton
              disabled={!currentSelection || !currentSelection.text.trim()}
              onClick={onDeleteAnnotationsInSelection}
              title={!currentSelection || !currentSelection.text.trim() ? "请先在内容面板划词选择文本" : "删除选区内的所有标注"}
            >
              🗑️ 删除标记
            </DeleteActionButton>
            </ActionButtonRow>
          )}
          <TagCreationForm
            tags={tags}
            onAddTag={onAddTag}
            activeTagId={activeTagId}
            entityLabel={label}
          />
        </>
      )}

      {editorMode === 'tag' && (
        <TagCreationForm
          tags={tags}
          onAddTag={onAddTag}
          activeTagId={activeTagId}
          entityLabel={label}
        />
      )}

      <TagListContainer>
        {tags.length > 0 ? (
          <TagList
            tags={tags}
            activeTagId={activeTagId}
            editorMode={editorMode}
            onUpdateTagParent={onUpdateTagParent}
            onUpdateTagColor={onUpdateTagColor}
            onUpdateTagName={onUpdateTagName}
            onDeleteTag={onDeleteTag}
            onApplyTagToSelection={onApplyTagToSelection}
            onSelectTagForReadMode={onSelectTagForReadMode}
            onTagGlobalSearch={onTagGlobalSearch}
            entityLabel={label}
          />
        ) : (
          <Placeholder>
            <p>您还没有任何{label}。</p>
             {editorMode === 'annotation' && (
                <p>使用上方表单创建一个。</p>
            )}
          </Placeholder>
        )}
      </TagListContainer>
    </TagManagementContainer>
  );
};

export default TagManagementView;

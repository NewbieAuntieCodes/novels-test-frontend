import React, { useState, CSSProperties } from 'react';
import styled from '@emotion/styled';
import type { Novel, User, TagTemplate } from "../types";
import { COLORS, SPACING, FONTS, SHADOWS, BORDERS, globalPlaceholderTextStyles } from '../../styles';
import { tagTemplates as staticTagTemplates } from '../tagpanel/tagTemplates';
import TagTemplateModal from './TagTemplateModal'; // Import the new modal component
import CategoryModal from '../CategoryModal';

const MAIN_CATEGORIES = ['男频小说', '女频小说', '电影剧本', '电视剧剧本'];

interface NovelProjectsPageProps {
  novels: Novel[];
  currentUser: User;
  onCreateNovel: (title: string, initialText?: string, templateGenre?: string) => string | undefined;
  onUploadNovel: (title: string, text: string) => string | null | undefined;
  onSelectNovel: (id: string) => void;
  onDeleteNovel: (id: string) => void;
  onUpdateNovelCategory: (novelId: string, category: string, subcategory: string) => void;
  onLogout: () => void;
  onNavigateToTagSearch: () => void;
  tagTemplates: TagTemplate[];
  onUpdateTemplates: (templates: TagTemplate[]) => void;
}

const ProjectsPage = styled.div<{ isDragging?: boolean }>`
  padding: ${SPACING.xl};
  display: flex;
  flex-direction: column;
  gap: ${SPACING.sectionGap};
  height: 100%;
  box-sizing: border-box;
  overflow-y: auto;
  background-color: ${COLORS.background};
  position: relative;

  ${props => props.isDragging && `
    &::after {
      content: '拖放 .txt 文件到此处上传';
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 123, 255, 0.1);
      border: 3px dashed ${COLORS.primary};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: ${FONTS.sizeH2};
      color: ${COLORS.primary};
      font-weight: 600;
      z-index: 1000;
      pointer-events: none;
    }
  `}
`;

const ProjectsHeader = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid ${COLORS.gray300};
  padding-bottom: ${SPACING.lg};
  flex-wrap: wrap;
  gap: ${SPACING.md};
`;

const HeaderTitle = styled.h1`
  margin: 0;
  font-size: ${FONTS.sizeH1};
  color: ${COLORS.dark};
`;

const UserInfo = styled.div`
  display: flex;
  align-items: center;
  gap: ${SPACING.lg};
`;

const WelcomeText = styled.span`
  font-size: ${FONTS.sizeBase};
  color: ${COLORS.textLight};
`;

const BaseButton = styled.button`
  padding: ${SPACING.sm} ${SPACING.lg};
  background-color: ${COLORS.primary};
  color: ${COLORS.white};
  border: none;
  border-radius: ${BORDERS.radius};
  cursor: pointer;
  transition: background-color 0.2s, box-shadow 0.2s;
  font-size: ${FONTS.sizeSmall};
  text-align: center;
  text-decoration: none;
  display: inline-block;

  &:hover:not(:disabled) {
    background-color: ${COLORS.primaryHover};
    box-shadow: ${SHADOWS.small};
  }

  &:disabled {
    background-color: ${COLORS.gray300};
    cursor: not-allowed;
    opacity: 0.7;
  }
`;

const LogoutButton = styled(BaseButton)`
  background-color: ${COLORS.danger};
  padding: ${SPACING.sm} ${SPACING.md};

  &:hover:not(:disabled) {
    background-color: ${COLORS.dangerHover};
  }
`;

const Section = styled.section`
  background-color: ${COLORS.white};
  padding: ${SPACING.xl};
  border-radius: ${SPACING.md};
  box-shadow: ${SHADOWS.small};
`;

const SectionTitle = styled.h3`
  margin-top: 0;
  margin-bottom: ${SPACING.lg};
  font-size: ${FONTS.sizeH3};
  color: ${COLORS.gray800};
`;

const NovelActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${SPACING.lg};
  align-items: stretch;
`;

const CreateNovelGroup = styled.div`
  display: flex;
  gap: ${SPACING.lg};
  align-items: flex-end; /* Align to bottom for clean look */
  flex-grow: 1;
  flex-wrap: wrap;
`;

const InputContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  min-width: 200px; /* Prevent shrinking too much */
`;

const SelectContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 180px;
`;

const FieldLabel = styled.label`
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.textLight};
  margin-bottom: ${SPACING.xs};
  margin-left: ${SPACING.xs};
`;

const TitleInput = styled.input`
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

const TemplateSelect = styled.select`
  padding: ${SPACING.sm};
  border: ${BORDERS.width} ${BORDERS.style} ${BORDERS.color};
  border-radius: ${BORDERS.radius};
  background-color: ${COLORS.white};
  font-size: ${FONTS.sizeSmall};
  height: 38px; /* Match input height */
  
  &:focus {
    border-color: ${COLORS.primary};
    box-shadow: 0 0 0 0.2rem ${COLORS.primary}40;
    outline: none;
  }
`;

const CreateButton = styled(BaseButton)`
  white-space: nowrap;
  height: 38px; /* Match input height */
`;

const UploadButton = styled(BaseButton)`
  background-color: ${COLORS.success};
  &:hover:not(:disabled) {
    background-color: ${COLORS.successHover};
  }
`;

const GlobalTagSearchButton = styled(BaseButton)`
  background-color: ${COLORS.info};
  padding: ${SPACING.sm} ${SPACING.md};
  &:hover:not(:disabled) {
    background-color: ${COLORS.infoHover};
  }
`;

const TemplateViewButton = styled(BaseButton)`
  background-color: ${COLORS.secondary};
  &:hover:not(:disabled) {
    background-color: ${COLORS.secondaryHover};
  }
`;

const NovelList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const NovelItem = styled.li`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${SPACING.lg};
  border-bottom: 1px solid ${COLORS.gray200};
  transition: background-color 0.15s;
  gap: ${SPACING.md};

  &:hover {
    background-color: ${COLORS.gray100};
  }
`;

const NovelInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.xs};
  flex-grow: 1;
`;

const NovelTitle = styled.span`
  font-size: ${FONTS.sizeLarge};
  color: ${COLORS.primary};
  cursor: pointer;
  font-weight: 500;
  word-break: break-word;

  &:hover {
    text-decoration: underline;
  }
`;

const NovelCategoryInfo = styled.div`
  display: flex;
  gap: ${SPACING.sm};
  align-items: center;
  flex-wrap: wrap;
`;

const CategoryTag = styled.span`
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.white};
  background-color: ${COLORS.info};
  padding: ${SPACING.xs} ${SPACING.sm};
  border-radius: ${SPACING.xs};
  white-space: nowrap;
`;

const SubcategoryTag = styled.span`
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.info};
  background-color: ${COLORS.gray100};
  padding: ${SPACING.xs} ${SPACING.sm};
  border-radius: ${SPACING.xs};
  white-space: nowrap;
  border: 1px solid ${COLORS.info};
`;

const NovelItemActions = styled.div`
  display: flex;
  gap: ${SPACING.elementGap};
  flex-shrink: 0;
`;

const EditNovelButton = styled(BaseButton)`
  padding: ${SPACING.xs} ${SPACING.md};
`;

const CategoryButton = styled(BaseButton)`
  background-color: ${COLORS.info};
  padding: ${SPACING.xs} ${SPACING.md};

  &:hover:not(:disabled) {
    background-color: ${COLORS.infoHover};
  }
`;

const DeleteNovelButton = styled(BaseButton)`
  background-color: ${COLORS.danger};
  padding: ${SPACING.xs} ${SPACING.md};

  &:hover:not(:disabled) {
    background-color: ${COLORS.dangerHover};
  }
`;

const HiddenFileInput = styled.input`
  display: none;
`;

const Placeholder = styled.p(globalPlaceholderTextStyles);

const ToolsContainer = styled.div`
    display: flex;
    gap: ${SPACING.elementGap};
    align-items: center;
    flex-wrap: wrap;
`;

const CategoryFilterSection = styled.div`
  display: flex;
  gap: ${SPACING.md};
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: ${SPACING.lg};
`;

const CategoryFilterLabel = styled.span`
  font-size: ${FONTS.sizeBase};
  color: ${COLORS.text};
  font-weight: 500;
`;

const CategoryFilterButton = styled.button<{ isActive: boolean }>`
  padding: ${SPACING.sm} ${SPACING.lg};
  background-color: ${props => (props.isActive ? COLORS.primary : COLORS.white)};
  color: ${props => (props.isActive ? COLORS.white : COLORS.text)};
  border: ${BORDERS.width} ${BORDERS.style} ${props => (props.isActive ? COLORS.primary : COLORS.border)};
  border-radius: ${BORDERS.radius};
  cursor: pointer;
  transition: all 0.2s;
  font-size: ${FONTS.sizeSmall};

  &:hover {
    background-color: ${props => (props.isActive ? COLORS.primaryDark : COLORS.gray100)};
    border-color: ${props => (props.isActive ? COLORS.primaryDark : COLORS.primary)};
  }
`;

const SubcategorySection = styled.div`
  margin-bottom: ${SPACING.lg};
`;

const SubcategoryGroup = styled.div`
  margin-bottom: ${SPACING.xl};
`;

const SubcategoryTitle = styled.h4`
  font-size: ${FONTS.sizeLarge};
  color: ${COLORS.gray700};
  margin: 0 0 ${SPACING.md} 0;
  padding-left: ${SPACING.md};
  border-left: 3px solid ${COLORS.primary};
`;

const NovelProjectsPage: React.FC<NovelProjectsPageProps> = ({
  novels, currentUser, onCreateNovel, onUploadNovel, onSelectNovel, onDeleteNovel, onUpdateNovelCategory, onLogout,
  onNavigateToTagSearch, tagTemplates, onUpdateTemplates
}) => {
  const [newNovelTitle, setNewNovelTitle] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [categoryModalNovel, setCategoryModalNovel] = useState<Novel | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleCreate = () => {
    if (newNovelTitle.trim()) {
      const newNovelId = onCreateNovel(newNovelTitle.trim(), '', selectedTemplate || undefined);
      if (newNovelId) {
        onSelectNovel(newNovelId);
      }
      setNewNovelTitle('');
      setSelectedTemplate('');
    } else {
      alert("小说标题不能为空。");
    }
  };

  const processFile = async (file: File) => {
    if (file.type === "text/plain" || file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        const titleFromFile = file.name.replace(/\.[^/.]+$/, "");
        if (text !== null && text !== undefined) {
          try {
            setIsUploading(true);
            const newNovelId = await onUploadNovel(titleFromFile || "未命名小说", text);
            if (newNovelId) {
              onSelectNovel(newNovelId);
            }
          } catch (error) {
            console.error("上传失败:", error);
          } finally {
            setIsUploading(false);
          }
        } else {
          alert("文件内容为空或读取失败。");
        }
      };
      reader.onerror = () => {
        alert("读取文件时出错。");
        setIsUploading(false);
      };
      reader.readAsText(file);
    } else {
      alert("请上传 .txt 格式的文本文件。");
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await processFile(file);
      event.target.value = '';
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await processFile(files[0]);
    }
  };

  const confirmDelete = (novelId: string, novelTitle: string) => {
    if (window.confirm(`您确定要删除小说 "${novelTitle}" 吗？此操作不可撤销。`)) {
      onDeleteNovel(novelId);
    }
  };

  const handleCategoryModalSave = (category: string, subcategory: string) => {
    if (categoryModalNovel) {
      onUpdateNovelCategory(categoryModalNovel.id, category, subcategory);
      setCategoryModalNovel(null);
    }
  };

  // 筛选小说
  const filteredNovels = selectedCategoryFilter
    ? novels.filter(novel => novel.category === selectedCategoryFilter)
    : novels;

  // 按子分类分组
  const novelsBySubcategory = filteredNovels.reduce((acc, novel) => {
    const subcategory = novel.subcategory || '未分类';
    if (!acc[subcategory]) {
      acc[subcategory] = [];
    }
    acc[subcategory].push(novel);
    return acc;
  }, {} as Record<string, Novel[]>);

  const subcategories = Object.keys(novelsBySubcategory).sort();

  return (
    <ProjectsPage
      isDragging={isDragging}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <ProjectsHeader>
        <HeaderTitle>我的小说项目</HeaderTitle>
        <UserInfo>
          <WelcomeText>欢迎，{currentUser.username}！</WelcomeText>
          <LogoutButton onClick={onLogout}>
            登出
          </LogoutButton>
        </UserInfo>
      </ProjectsHeader>

      <Section>
        <SectionTitle>操作与工具</SectionTitle>
        <NovelActions>
          <CreateNovelGroup>
            <InputContainer>
              <FieldLabel htmlFor="new-novel-title">新小说标题</FieldLabel>
              <TitleInput
                id="new-novel-title"
                type="text"
                value={newNovelTitle}
                onChange={(e) => setNewNovelTitle(e.target.value)}
                placeholder="输入新小说标题"
                aria-label="新小说标题"
              />
            </InputContainer>
            <SelectContainer>
              <FieldLabel htmlFor="template-select">标签模板 (可选)</FieldLabel>
              <TemplateSelect
                id="template-select"
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                aria-label="选择标签模板"
              >
                <option value="">不使用模板</option>
                {tagTemplates.map(template => (
                  <option key={template.genre} value={template.genre}>
                    {template.genre}
                  </option>
                ))}
              </TemplateSelect>
            </SelectContainer>
            <CreateButton onClick={handleCreate}>
              创建并编辑
            </CreateButton>
          </CreateNovelGroup>
          <ToolsContainer>
            <HiddenFileInput
              type="file"
              id="novel-file-input-projects"
              accept=".txt,text/plain"
              onChange={handleFileChange}
              aria-hidden="true"
            />
            <TemplateViewButton onClick={() => setIsTemplateModalOpen(true)}>
              编辑模板
            </TemplateViewButton>
            <UploadButton
              type="button"
              onClick={() => document.getElementById('novel-file-input-projects')?.click()}
              aria-label="上传小说文件"
              disabled={isUploading}
            >
              {isUploading ? '上传中，请稍候...' : '上传小说 (.txt)'}
            </UploadButton>
            <GlobalTagSearchButton
              type="button"
              onClick={onNavigateToTagSearch}
              aria-label="全局标签搜索"
            >
              全局标签搜索
            </GlobalTagSearchButton>
          </ToolsContainer>
        </NovelActions>
      </Section>

      <Section>
        <SectionTitle>已有小说</SectionTitle>

        {/* 分类筛选按钮 */}
        <CategoryFilterSection>
          <CategoryFilterLabel>筛选分类：</CategoryFilterLabel>
          <CategoryFilterButton
            isActive={selectedCategoryFilter === null}
            onClick={() => setSelectedCategoryFilter(null)}
          >
            全部
          </CategoryFilterButton>
          {MAIN_CATEGORIES.map(category => (
            <CategoryFilterButton
              key={category}
              isActive={selectedCategoryFilter === category}
              onClick={() => setSelectedCategoryFilter(category)}
            >
              {category}
            </CategoryFilterButton>
          ))}
        </CategoryFilterSection>

        {novels.length === 0 ? (
          <Placeholder>您还没有任何小说项目。尝试创建一个或上传一个吧！</Placeholder>
        ) : filteredNovels.length === 0 ? (
          <Placeholder>没有符合筛选条件的小说。</Placeholder>
        ) : (
          <SubcategorySection>
            {subcategories.map(subcategory => (
              <SubcategoryGroup key={subcategory}>
                <SubcategoryTitle>{subcategory}</SubcategoryTitle>
                <NovelList>
                  {novelsBySubcategory[subcategory].map(novel => (
                    <NovelItem key={novel.id}>
                      <NovelInfo>
                        <NovelTitle
                          onClick={() => onSelectNovel(novel.id)}
                          tabIndex={0}
                          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectNovel(novel.id)}
                        >
                          {novel.title}
                        </NovelTitle>
                        {(novel.category || novel.subcategory) && (
                          <NovelCategoryInfo>
                            {novel.category && <CategoryTag>{novel.category}</CategoryTag>}
                            {novel.subcategory && <SubcategoryTag>{novel.subcategory}</SubcategoryTag>}
                          </NovelCategoryInfo>
                        )}
                      </NovelInfo>
                      <NovelItemActions>
                        <CategoryButton onClick={() => setCategoryModalNovel(novel)}>
                          分类
                        </CategoryButton>
                        <EditNovelButton onClick={() => onSelectNovel(novel.id)}>
                          编辑
                        </EditNovelButton>
                        <DeleteNovelButton onClick={() => confirmDelete(novel.id, novel.title)}>
                          删除
                        </DeleteNovelButton>
                      </NovelItemActions>
                    </NovelItem>
                  ))}
                </NovelList>
              </SubcategoryGroup>
            ))}
          </SubcategorySection>
        )}
      </Section>
      <TagTemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        templates={tagTemplates}
        onUpdateTemplates={onUpdateTemplates}
      />
      <CategoryModal
        isOpen={!!categoryModalNovel}
        novelTitle={categoryModalNovel?.title || ''}
        currentCategory={categoryModalNovel?.category || null}
        currentSubcategory={categoryModalNovel?.subcategory || null}
        onClose={() => setCategoryModalNovel(null)}
        onSave={handleCategoryModalSave}
      />
    </ProjectsPage>
  );
};

export default NovelProjectsPage;

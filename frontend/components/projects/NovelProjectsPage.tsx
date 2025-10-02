import React, { useState, CSSProperties } from 'react';
import styled from '@emotion/styled';
import type { Novel, User, TagTemplate } from "../types";
import { COLORS, SPACING, FONTS, SHADOWS, BORDERS, globalPlaceholderTextStyles } from '../../styles';
import { tagTemplates as staticTagTemplates } from '../tagpanel/tagTemplates';
import TagTemplateModal from './TagTemplateModal'; // Import the new modal component

interface NovelProjectsPageProps {
  novels: Novel[];
  currentUser: User;
  onCreateNovel: (title: string, initialText?: string, templateGenre?: string) => string | undefined;
  onUploadNovel: (title: string, text: string) => string | null | undefined;
  onSelectNovel: (id: string) => void;
  onDeleteNovel: (id: string) => void;
  onLogout: () => void;
  onNavigateToTagSearch: () => void;
  tagTemplates: TagTemplate[];
  onUpdateTemplates: (templates: TagTemplate[]) => void;
}

const ProjectsPage = styled.div`
  padding: ${SPACING.xl};
  display: flex;
  flex-direction: column;
  gap: ${SPACING.sectionGap};
  height: 100%;
  box-sizing: border-box;
  overflow-y: auto;
  background-color: ${COLORS.background};
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

const NovelTitle = styled.span`
  font-size: ${FONTS.sizeLarge};
  color: ${COLORS.primary};
  cursor: pointer;
  font-weight: 500;
  flex-grow: 1;
  word-break: break-word;

  &:hover {
    text-decoration: underline;
  }
`;

const NovelItemActions = styled.div`
  display: flex;
  gap: ${SPACING.elementGap};
  flex-shrink: 0;
`;

const EditNovelButton = styled(BaseButton)`
  padding: ${SPACING.xs} ${SPACING.md};
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

const NovelProjectsPage: React.FC<NovelProjectsPageProps> = ({
  novels, currentUser, onCreateNovel, onUploadNovel, onSelectNovel, onDeleteNovel, onLogout,
  onNavigateToTagSearch, tagTemplates, onUpdateTemplates
}) => {
  const [newNovelTitle, setNewNovelTitle] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

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

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === "text/plain") {
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
      event.target.value = '';
    }
  };

  const confirmDelete = (novelId: string, novelTitle: string) => {
    if (window.confirm(`您确定要删除小说 "${novelTitle}" 吗？此操作不可撤销。`)) {
      onDeleteNovel(novelId);
    }
  };

  return (
    <ProjectsPage>
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
        {novels.length === 0 ? (
          <Placeholder>您还没有任何小说项目。尝试创建一个或上传一个吧！</Placeholder>
        ) : (
          <NovelList>
            {novels.map(novel => (
              <NovelItem key={novel.id}>
                <NovelTitle
                  onClick={() => onSelectNovel(novel.id)}
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectNovel(novel.id)}
                >
                  {novel.title}
                </NovelTitle>
                <NovelItemActions>
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
        )}
      </Section>
      <TagTemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        templates={tagTemplates}
        onUpdateTemplates={onUpdateTemplates}
      />
    </ProjectsPage>
  );
};

export default NovelProjectsPage;

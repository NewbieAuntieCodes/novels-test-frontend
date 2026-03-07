import React, { useEffect, useMemo, useRef, useState, CSSProperties } from 'react';
import styled from '@emotion/styled';
import type { Novel, User, TagTemplate } from "../types";
import { COLORS, SPACING, FONTS, SHADOWS, BORDERS, globalPlaceholderTextStyles } from '../../styles';
import { tagTemplates as staticTagTemplates } from '../tagpanel/tagTemplates';
import TagTemplateModal from './TagTemplateModal'; // Import the new modal component
import CategoryModal from '../CategoryModal';
import EditNovelModal from './EditNovelModal';
import AuthorNovelsModal from './AuthorNovelsModal';
import DeleteChaptersModal from './DeleteChaptersModal';
import { getNovelBackupBadgeLabel, NOVEL_BACKUP_META_CHANGED_EVENT } from '../../utils/novelBackupMeta';
import { MAIN_CATEGORIES, normalizeMainCategory } from '../../constants/categories';

const normalizeSearchQuery = (value: string) =>
  value.replace(/\s+/g, ' ').trim().toLowerCase();

interface NovelProjectsPageProps {
  novels: Novel[];
  currentUser: User;
  onCreateNovel: (title: string, initialText?: string, templateGenre?: string, projectMode?: 'tag' | 'note') => Promise<string | undefined>;
  onUploadNovel: (title: string, text: string, projectMode?: 'tag' | 'note') => Promise<string | null | undefined>;
  onAppendNovel: (novelId: string, text: string) => Promise<void>;
  onSelectNovel: (id: string) => void;
  onDeleteNovel: (id: string) => void;
  onDeleteChaptersAfter: (novelId: string, keepChapterCount: number) => Promise<void>;
  onUpdateNovelCategory: (novelId: string, category: string, subcategory: string) => void;
  onUpdateNovelInfo: (novelId: string, title: string, author: string) => void;
  onExportData: () => void;
  onExportNovelData: (novelId: string) => void | Promise<void>;
  onImportData: (file: File) => void;
  onLogout: () => void;
  onNavigateToTagSearch: () => void;
  onNavigateToTools: () => void;
  onNavigateToReferenceLibrary: () => void;
  onNavigateToNotes: () => void;
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

const ModeSelect = styled(TemplateSelect)``;

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

const ToolsButton = styled(BaseButton)`
  background-color: ${COLORS.secondary};
  padding: ${SPACING.sm} ${SPACING.md};
  &:hover:not(:disabled) {
    background-color: ${COLORS.secondaryHover};
  }
`;

const ExportButton = styled(BaseButton)`
  background-color: ${COLORS.gray700};
  &:hover:not(:disabled) {
    background-color: ${COLORS.gray800};
  }
`;

const ImportButton = styled(BaseButton)`
  background-color: ${COLORS.warning};
  &:hover:not(:disabled) {
    background-color: ${COLORS.warningHover};
  }
`;

const ReferenceLibraryButton = styled(BaseButton)`
  background-color: ${COLORS.primary};
  padding: ${SPACING.sm} ${SPACING.md};
  &:hover:not(:disabled) {
    background-color: ${COLORS.primaryHover};
  }
`;

const NotesButton = styled(BaseButton)`
  background-color: ${COLORS.gray700};
  padding: ${SPACING.sm} ${SPACING.md};
  &:hover:not(:disabled) {
    background-color: ${COLORS.gray800};
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

const NovelTitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${SPACING.md};
  flex-wrap: wrap;
`;

const BackupStatusBadge = styled.span`
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.danger};
  background-color: ${COLORS.dangerLight};
  border: 1px solid ${COLORS.danger};
  padding: 1px ${SPACING.sm};
  border-radius: 999px;
  font-weight: 700;
  line-height: 1.4;
  white-space: nowrap;
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

const AuthorTag = styled.span`
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.primary};
  background-color: ${COLORS.gray100};
  padding: ${SPACING.xs} ${SPACING.sm};
  border-radius: ${SPACING.xs};
  border: 1px solid ${COLORS.primary};
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    background-color: ${COLORS.primaryLight};
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

const ProjectModeTag = styled.span`
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.white};
  background-color: ${COLORS.secondary};
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

const AppendButton = styled(BaseButton)`
  background-color: ${COLORS.success};
  padding: ${SPACING.xs} ${SPACING.md};

  &:hover:not(:disabled) {
    background-color: ${COLORS.successHover};
  }
`;

const DeleteChaptersButton = styled(BaseButton)`
  background-color: ${COLORS.warning};
  padding: ${SPACING.xs} ${SPACING.md};

  &:hover:not(:disabled) {
    background-color: ${COLORS.warningHover};
  }
`;

const ExportNovelButton = styled(BaseButton)`
  background-color: ${COLORS.secondary};
  padding: ${SPACING.xs} ${SPACING.md};

  &:hover:not(:disabled) {
    background-color: ${COLORS.secondaryHover};
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

const NovelSearchContainer = styled.div`
  margin-left: auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex: 1 1 260px;
`;

const NovelSearchInputWrapper = styled.div`
  position: relative;
  width: min(520px, 100%);
`;

const NovelSearchInput = styled.input`
  padding: ${SPACING.sm} ${SPACING.xl} ${SPACING.sm} ${SPACING.sm};
  border: ${BORDERS.width} ${BORDERS.style} ${BORDERS.color};
  border-radius: ${BORDERS.radius};
  box-sizing: border-box;
  background-color: ${COLORS.white};
  font-size: ${FONTS.sizeSmall};
  width: 100%;
  height: 38px;

  &:focus {
    border-color: ${COLORS.primary};
    box-shadow: 0 0 0 0.2rem ${COLORS.primary}40;
    outline: none;
  }
`;

const NovelSearchClearButton = styled.button`
  position: absolute;
  top: 50%;
  right: ${SPACING.sm};
  transform: translateY(-50%);
  border: none;
  background: transparent;
  color: ${COLORS.gray600};
  cursor: pointer;
  padding: 0;
  font-size: ${FONTS.sizeBase};
  line-height: 1;

  &:hover {
    color: ${COLORS.gray800};
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 0.2rem ${COLORS.primary}40;
    border-radius: ${BORDERS.radius};
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
  novels, currentUser, onCreateNovel, onUploadNovel, onAppendNovel, onSelectNovel, onDeleteNovel, onDeleteChaptersAfter, onUpdateNovelCategory, onUpdateNovelInfo, onExportData, onExportNovelData, onImportData, onLogout,
  onNavigateToTagSearch, onNavigateToTools, onNavigateToReferenceLibrary, onNavigateToNotes, tagTemplates, onUpdateTemplates
}) => {
  const [newNovelTitle, setNewNovelTitle] = useState('');
  const [projectMode, setProjectMode] = useState<'tag' | 'note'>('tag');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [categoryModalNovel, setCategoryModalNovel] = useState<Novel | null>(null);
  const [editModalNovel, setEditModalNovel] = useState<Novel | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [novelSearchText, setNovelSearchText] = useState('');
  const [debouncedNovelSearchQuery, setDebouncedNovelSearchQuery] = useState('');
  const novelSearchInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [appendingNovelId, setAppendingNovelId] = useState<string | null>(null);
  const [authorModalAuthor, setAuthorModalAuthor] = useState<string | null>(null);
  const [deleteChaptersModalNovel, setDeleteChaptersModalNovel] = useState<Novel | null>(null);
  const [backupMetaVersion, setBackupMetaVersion] = useState(0);

  useEffect(() => {
    const handler = () => setBackupMetaVersion(v => v + 1);
    window.addEventListener(NOVEL_BACKUP_META_CHANGED_EVENT, handler as EventListener);
    return () => window.removeEventListener(NOVEL_BACKUP_META_CHANGED_EVENT, handler as EventListener);
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedNovelSearchQuery(normalizeSearchQuery(novelSearchText));
    }, 200);

    return () => window.clearTimeout(handle);
  }, [novelSearchText]);

  useEffect(() => {
    if (projectMode === 'note' && selectedTemplate) {
      setSelectedTemplate('');
    }
  }, [projectMode, selectedTemplate]);

  const handleCreate = async () => {
    if (newNovelTitle.trim()) {
      const newNovelId = await onCreateNovel(newNovelTitle.trim(), '', selectedTemplate || undefined, projectMode);
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
            const newNovelId = await onUploadNovel(titleFromFile || "未命名小说", text, projectMode);
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

  const handleBackupImportChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        await onImportData(file);
      } catch (err) {
        console.error('导入数据失败', err);
        alert('导入数据失败，请检查备份文件格式');
      } finally {
        event.target.value = '';
      }
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

  const handleEditModalSave = async (title: string, author: string): Promise<void> => {
    if (editModalNovel) {
      await onUpdateNovelInfo(editModalNovel.id, title, author);
      setEditModalNovel(null);
    }
  };

  const handleAuthorClick = (author: string) => {
    setAuthorModalAuthor(author);
  };

  const getNovelsByAuthor = (author: string): Novel[] => {
    return novels.filter(novel => novel.author === author);
  };

  const handleAppendFile = async (novelId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,text/plain';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && (file.type === 'text/plain' || file.name.endsWith('.txt'))) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const text = e.target?.result as string;
          if (text) {
            try {
              setAppendingNovelId(novelId);
              await onAppendNovel(novelId, text);
            } catch (error) {
              console.error('追加内容失败:', error);
              alert('追加内容失败，请重试');
            } finally {
              setAppendingNovelId(null);
            }
          }
        };
        reader.onerror = () => {
          alert('读取文件时出错');
          setAppendingNovelId(null);
        };
        reader.readAsText(file);
      } else {
        alert('请上传 .txt 格式的文本文件');
      }
    };
    input.click();
  };

  // 筛选小说（分类 + 搜索）
  const filteredNovels = useMemo(() => {
    const categoryFiltered = selectedCategoryFilter
      ? novels.filter(novel => normalizeMainCategory(novel.category) === selectedCategoryFilter)
      : novels;

    if (!debouncedNovelSearchQuery) return categoryFiltered;

    const parts = debouncedNovelSearchQuery.split(' ').filter(Boolean);
    return categoryFiltered.filter(novel => {
      const haystack = `${novel.title} ${novel.author ?? ''}`.toLowerCase();
      return parts.every(part => haystack.includes(part));
    });
  }, [selectedCategoryFilter, novels, debouncedNovelSearchQuery]);

  const backupBadgeByNovelId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getNovelBackupBadgeLabel>>();
    filteredNovels.forEach(novel => {
      map.set(novel.id, getNovelBackupBadgeLabel(currentUser.id, novel.id));
    });
    return map;
  }, [filteredNovels, currentUser.id, backupMetaVersion]);

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
              <FieldLabel htmlFor="project-mode-select">默认工作区</FieldLabel>
              <ModeSelect
                id="project-mode-select"
                value={projectMode}
                onChange={(e) => setProjectMode(e.target.value as 'tag' | 'note')}
                aria-label="选择默认工作区"
              >
                <option value="tag">标签工作区</option>
                <option value="note">笔记工作区</option>
              </ModeSelect>
            </SelectContainer>
            <SelectContainer>
              <FieldLabel htmlFor="template-select">标签模板 (仅标签工作区)</FieldLabel>
              <TemplateSelect
                id="template-select"
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                aria-label="选择标签模板"
                disabled={projectMode !== 'tag'}
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
            <HiddenFileInput
              type="file"
              id="backup-file-input"
              accept=".json,application/json"
              onChange={handleBackupImportChange}
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
            <NotesButton
              type="button"
              onClick={onNavigateToNotes}
              aria-label="笔记"
            >
              笔记
            </NotesButton>
            <ReferenceLibraryButton
              type="button"
              onClick={onNavigateToReferenceLibrary}
              aria-label="资料库"
            >
              资料库
            </ReferenceLibraryButton>
            <ToolsButton
              type="button"
              onClick={onNavigateToTools}
              aria-label="工具辅助"
            >
              工具辅助
            </ToolsButton>
            <ExportButton
              type="button"
              onClick={onExportData}
              aria-label="导出本地数据"
            >
              导出数据
            </ExportButton>
            <ImportButton
              type="button"
              onClick={() => document.getElementById('backup-file-input')?.click()}
              aria-label="导入本地数据"
            >
              导入数据
            </ImportButton>
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
          <NovelSearchContainer>
            <NovelSearchInputWrapper>
              <NovelSearchInput
                ref={novelSearchInputRef}
                type="text"
                value={novelSearchText}
                onChange={(e) => setNovelSearchText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setNovelSearchText('');
                    e.preventDefault();
                  }
                }}
                placeholder="搜索小说名 / 作者..."
                aria-label="搜索小说"
              />
              {novelSearchText.trim() !== '' && (
                <NovelSearchClearButton
                  type="button"
                  onClick={() => {
                    setNovelSearchText('');
                    novelSearchInputRef.current?.focus();
                  }}
                  aria-label="清空搜索"
                  title="清空搜索"
                >
                  x
                </NovelSearchClearButton>
              )}
            </NovelSearchInputWrapper>
          </NovelSearchContainer>
        </CategoryFilterSection>

        {novels.length === 0 ? (
          <Placeholder>您还没有任何小说项目。尝试创建一个或上传一个吧！</Placeholder>
        ) : filteredNovels.length === 0 ? (
          <Placeholder>没有符合筛选/搜索条件的小说。</Placeholder>
        ) : (
          <SubcategorySection>
            {subcategories.map(subcategory => (
              <SubcategoryGroup key={subcategory}>
                <SubcategoryTitle>{subcategory}</SubcategoryTitle>
                <NovelList>
                  {novelsBySubcategory[subcategory].map(novel => (
                    <NovelItem key={novel.id}>
                      <NovelInfo>
                        <NovelTitleRow>
                          <NovelTitle
                            onClick={() => onSelectNovel(novel.id)}
                            tabIndex={0}
                            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectNovel(novel.id)}
                          >
                            {novel.title}
                          </NovelTitle>
                          {(() => {
                            const label = backupBadgeByNovelId.get(novel.id) || null;
                            if (!label) return null;
                            return (
                              <BackupStatusBadge title={label === '更新' ? '本书已修改但未导出' : '本书尚未导出'}>
                                {label}
                              </BackupStatusBadge>
                            );
                          })()}
                          {novel.projectMode === 'note' && <ProjectModeTag title="默认打开笔记工作区">默认：笔记</ProjectModeTag>}
                          {novel.author && (
                            <AuthorTag onClick={() => handleAuthorClick(novel.author!)}>
                              作者：{novel.author}
                            </AuthorTag>
                          )}
                        </NovelTitleRow>
                          {(() => {
                            const displayCategory = normalizeMainCategory(novel.category);
                            if (!displayCategory && !novel.subcategory) return null;
                            return (
                              <NovelCategoryInfo>
                                {displayCategory && <CategoryTag>{displayCategory}</CategoryTag>}
                                {novel.subcategory && <SubcategoryTag>{novel.subcategory}</SubcategoryTag>}
                              </NovelCategoryInfo>
                            );
                          })()}
                      </NovelInfo>
                      <NovelItemActions>
                        <CategoryButton onClick={() => setCategoryModalNovel(novel)}>
                          分类
                        </CategoryButton>
                        <EditNovelButton onClick={() => setEditModalNovel(novel)}>
                          编辑
                        </EditNovelButton>
                        <ExportNovelButton onClick={() => onExportNovelData(novel.id)}>
                          导出本书
                        </ExportNovelButton>
                        <AppendButton
                          onClick={() => handleAppendFile(novel.id)}
                          disabled={appendingNovelId === novel.id}
                        >
                          {appendingNovelId === novel.id ? '追加中...' : '继续上传'}
                        </AppendButton>
                        <DeleteChaptersButton
                          onClick={() => setDeleteChaptersModalNovel(novel)}
                          disabled={!novel.chapters || novel.chapters.length <= 1}
                        >
                          删除后续章节
                        </DeleteChaptersButton>
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
        allNovels={novels}
        onClose={() => setCategoryModalNovel(null)}
        onSave={handleCategoryModalSave}
      />
      <EditNovelModal
        isOpen={!!editModalNovel}
        novelTitle={editModalNovel?.title || ''}
        novelAuthor={editModalNovel?.author}
        onClose={() => setEditModalNovel(null)}
        onSave={handleEditModalSave}
      />
      <AuthorNovelsModal
        isOpen={!!authorModalAuthor}
        authorName={authorModalAuthor || ''}
        novels={authorModalAuthor ? getNovelsByAuthor(authorModalAuthor) : []}
        onClose={() => setAuthorModalAuthor(null)}
        onSelectNovel={onSelectNovel}
      />
      <DeleteChaptersModal
        isOpen={!!deleteChaptersModalNovel}
        novel={deleteChaptersModalNovel}
        onClose={() => setDeleteChaptersModalNovel(null)}
        onConfirm={onDeleteChaptersAfter}
      />
    </ProjectsPage>
  );
};

export default NovelProjectsPage;

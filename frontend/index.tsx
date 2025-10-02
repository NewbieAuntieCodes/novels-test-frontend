import React, { useState, useEffect, useCallback, useMemo, useTransition, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import styled from '@emotion/styled';
import type { Novel, Tag, Annotation, Chapter, User, TagTemplate } from './types';
import { generateId, splitTextIntoChapters, PENDING_ANNOTATION_TAG_NAME, PENDING_ANNOTATION_TAG_COLOR } from './utils';
import { FONTS, SPACING, COLORS } from './styles'; // Import shared styles
import { tagTemplates as initialTagTemplates } from './components/tagpanel/tagTemplates';
import { bootstrapDemoData } from './data/bootstrap';
import { authApi, novelsApi, tagsApi, annotationsApi, TokenManager } from './api';


import LoginPage from './components/auth/LoginPage';
import RegistrationPage from './components/auth/RegistrationPage';
import NovelProjectsPage from './components/projects/NovelProjectsPage';
import NovelEditorPage from './components/editor/NovelEditorPage';
import GlobalTagSearchPage from './components/search/GlobalTagSearchPage'; // Import new page

type Page = 'login' | 'register' | 'projects' | 'editNovel' | 'tagSearch'; // Added 'tagSearch'

const AppContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  font-family: ${FONTS.fontFamily};
`;

const Loading = styled.p`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  font-size: 1.2em;
  color: ${COLORS.textLighter};
  padding: ${SPACING.xl};
`;

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>('login');
  const [editingNovelId, setEditingNovelId] = useState<string | null>(null);

  const [novels, setNovels] = useState<Novel[]>([]);
  const [allUserTags, setAllUserTags] = useState<Tag[]>([]);
  const [allUserAnnotations, setAllUserAnnotations] = useState<Annotation[]>([]);
  const [tagTemplates, setTagTemplates] = useState<TagTemplate[]>(initialTagTemplates);

  // 🆕 缓存已加载的小说数据，避免重复加载（缓存5分钟）
  const novelDataCache = useRef<Map<string, {
    tags: Tag[];
    annotations: Annotation[];
    timestamp: number;
  }>>(new Map());

  // --- Routing ---
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, '');
      if (!currentUser) {
        if (hash === 'register') {
          setCurrentPage('register');
        } else {
          setCurrentPage('login');
          if (hash !== 'login' && hash !== 'register') window.location.hash = '#/login';
        }
        return;
      }

      if (hash.startsWith('edit/')) {
        const novelId = hash.substring('edit/'.length);
        if (novels.find(n => n.id === novelId)) {
          setEditingNovelId(novelId);
          setCurrentPage('editNovel');
        } else {
          window.location.hash = '#/projects';
          setCurrentPage('projects');
          setEditingNovelId(null);
        }
      } else if (hash === 'tag-search') { // Added route for tag search page
        setCurrentPage('tagSearch');
        setEditingNovelId(null);
      } else if (hash === 'projects' || hash === '') {
        setCurrentPage('projects');
        setEditingNovelId(null);
      } else if (hash === 'login' || hash === 'register') {
         window.location.hash = '#/projects';
         setCurrentPage('projects');
      } else {
        window.location.hash = '#/projects';
        setCurrentPage('projects');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [currentUser, novels]);

  const navigateTo = (path: string) => {
    window.location.hash = path;
  };

  // --- Auth Handlers ---
  const handleLogin = async (username: string, password: string) => {
    try {
      const response = await authApi.login(username, password);
      TokenManager.setToken(response.token);

      const user: User = { id: response.user.id, username: response.user.username };
      setCurrentUser(user);

      // 从后端加载用户数据（优化：登录时不加载标注和小说标签）
      const novelsData = await novelsApi.getAll();  // ⚠️ text 字段为空，打开编辑器时再加载

      setNovels(novelsData);

      // 🔧 只加载全局标签（novelId=null），小说标签在编辑器内按需加载
      const globalTagsData = await tagsApi.getAll(); // 后端会返回所有标签
      const globalTags = globalTagsData.filter(t => t.novelId === null);
      setAllUserTags(globalTags);

      // 🆕 确保全局"待标注"标签存在
      const hasPendingTag = globalTags.some(
        t => t.name === PENDING_ANNOTATION_TAG_NAME
      );
      if (!hasPendingTag) {
        try {
          const newPendingTag = await tagsApi.create({
            name: PENDING_ANNOTATION_TAG_NAME,
            color: PENDING_ANNOTATION_TAG_COLOR,
            parentId: null,
            novelId: null, // 全局标签
          });
          setAllUserTags(prev => [...prev, newPendingTag]);
        } catch (error) {
          console.error('创建待标注标签失败:', error);
        }
      }
      setAllUserAnnotations([]); // 初始为空，编辑器内加载

      navigateTo('#/projects');
    } catch (error) {
      alert(`登录失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleRegister = async (username: string, password: string) => {
    try {
      await authApi.register(username, password);
      alert(`用户 "${username}" 注册成功！请登录。`);
      navigateTo('#/login');
    } catch (error) {
      alert(`注册失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleLogout = () => {
    TokenManager.removeToken();
    setCurrentUser(null);
    setEditingNovelId(null);
    setNovels([]);
    setAllUserTags([]);
    setAllUserAnnotations([]);
    novelDataCache.current.clear(); // 清空缓存
    navigateTo('#/login');
  };

  // --- Data Handlers ---
  const handleCreateNovel = (title: string, initialText: string = '', templateGenre?: string) => {
    if (!currentUser) return undefined;
    if (!title.trim()){
      alert("小说标题不能为空。");
      return undefined;
    }

    // Handle tag template application
    if (templateGenre) {
      const template = tagTemplates.find(t => t.genre === templateGenre);
      if (template) {
        setAllUserTags(prevTags => {
          const userTags = prevTags.filter(t => t.userId === currentUser.id);
          // FIX: Explicitly type the Map to ensure correct type inference for its values.
          const nameToTagMap: Map<string, Tag> = new Map(userTags.map(t => [t.name, t]));
          const tagsToAdd: Tag[] = [];
  
          template.tags.forEach(tagDef => {
            if (!nameToTagMap.has(tagDef.name)) {
              const newTag: Tag = {
                id: generateId(),
                name: tagDef.name,
                color: tagDef.color,
                parentId: null, // Will be linked in the next step
                userId: currentUser.id,
              };
              tagsToAdd.push(newTag);
              nameToTagMap.set(newTag.name, newTag);
            }
          });
  
          tagsToAdd.forEach(newTag => {
            const tagDef = template.tags.find(t => t.name === newTag.name);
            if (tagDef?.parentName) {
              const parentTag = nameToTagMap.get(tagDef.parentName);
              if (parentTag) {
                newTag.parentId = parentTag.id;
              }
            }
          });
  
          return tagsToAdd.length > 0 ? [...prevTags, ...tagsToAdd] : prevTags;
        });
      }
    }

    const normalizedInitialText = initialText.replace(/\r\n|\r/g, '\n');
    const chapters = splitTextIntoChapters(normalizedInitialText);
    const newNovel: Novel = {
      id: generateId(),
      title: title.trim(),
      text: normalizedInitialText,
      userId: currentUser.id,
      chapters: chapters,
      storylines: [],
      plotAnchors: [],
    };
    setNovels(prev => [...prev, newNovel]);
    return newNovel.id;
  };

  const handleUploadNovel = async (title: string, text: string): Promise<string | null> => {
    if (!currentUser) return null;
    if (!title.trim()) {
      alert("小说标题不能为空。");
      return null;
    }

    try {
      const normalizedText = text.replace(/\r\n|\r/g, '\n');
      // 不再在前端分章，由后端处理（性能优化）

      const newNovel = await novelsApi.create({
        title: title.trim(),
        text: normalizedText,
        // chapters 字段不传，让后端自动分章
        storylines: [],
        plotAnchors: [],
      });

      setNovels(prev => [...prev, newNovel]);
      alert(`小说 "${title}" 已成功上传并自动分章。`);
      return newNovel.id;
    } catch (error) {
      alert(`上传失败: ${error instanceof Error ? error.message : '未知错误'}`);
      return null;
    }
  };
  
  const handleDeleteNovel = async (novelId: string) => {
    if (!currentUser) return;
    try {
      await novelsApi.delete(novelId);
      setNovels(prev => prev.filter(n => n.id !== novelId));
      setAllUserAnnotations(prev => prev.filter(a => a.novelId !== novelId));
      if (editingNovelId === novelId) {
        navigateTo("#/projects");
      }
    } catch (error) {
      alert(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleUpdateTagName = async (tagId: string, newName: string) => {
    if (!currentUser) return;

    // 先更新本地状态,提供即时反馈
    setAllUserTags(prevTags =>
      prevTags.map(tag =>
        tag.id === tagId && tag.userId === currentUser.id
        ? { ...tag, name: newName }
        : tag
      )
    );

    // 然后保存到后端
    try {
      await tagsApi.update(tagId, { name: newName });
    } catch (error) {
      console.error('更新标签名称到后端失败:', error);
      alert('更新标签名称失败,请稍后重试');
    }
  };
  
  const handleUpdateTagColor = (tagId: string, newColor: string) => { 
    setAllUserTags(prevTags =>
      prevTags.map(tag =>
        (tag.id === tagId && tag.userId === currentUser?.id)
        ? { ...tag, color: newColor }
        : tag
      )
    );
  };

  const handleDeleteAnnotationGlobally = (annotationId: string) => {
    setAllUserAnnotations(prev => prev.filter(ann => ann.id !== annotationId && ann.userId === currentUser?.id));
  };


  const renderPage = () => {
    if (!currentUser) {
      switch (currentPage) {
        case 'register':
          return <RegistrationPage onRegister={handleRegister} onNavigateToLogin={() => navigateTo('#/login')} />;
        case 'login':
        default:
          return <LoginPage onLogin={handleLogin} onNavigateToRegister={() => navigateTo('#/register')} />;
      }
    }

    switch (currentPage) {
      case 'projects':
        return (
          <NovelProjectsPage
            novels={novels.filter(n => n.userId === currentUser.id)}
            onCreateNovel={handleCreateNovel}
            onUploadNovel={handleUploadNovel}
            onSelectNovel={(novelId) => navigateTo(`#/edit/${novelId}`)}
            onDeleteNovel={handleDeleteNovel}
            onLogout={handleLogout}
            currentUser={currentUser}
            onNavigateToTagSearch={() => navigateTo('#/tag-search')}
            tagTemplates={tagTemplates}
            onUpdateTemplates={setTagTemplates}
          />
        );
      case 'editNovel':
        if (editingNovelId) {
          const novelToEdit = novels.find(n => n.id === editingNovelId && n.userId === currentUser.id);
          if (novelToEdit) {
            return (
              <NovelEditorPage
                key={editingNovelId}
                novel={novelToEdit}
                allUserTags={allUserTags.filter(t => t.userId === currentUser.id)}
                allUserAnnotations={allUserAnnotations.filter(a => a.userId === currentUser.id)}
                setNovels={setNovels}
                setAllUserTags={setAllUserTags}
                setAllUserAnnotations={setAllUserAnnotations}
                onNavigateBack={() => navigateTo('#/projects')}
                currentUser={currentUser}
                onUpdateTagName={handleUpdateTagName}
                novelDataCache={novelDataCache}
              />
            );
          }
        }
        navigateTo('#/projects');
        return <Loading>正在加载项目...</Loading>;
      case 'tagSearch':
        return (
          <GlobalTagSearchPage
            allUserTags={allUserTags.filter(t => t.userId === currentUser.id)}
            allUserAnnotations={allUserAnnotations.filter(a => a.userId === currentUser.id)}
            novels={novels.filter(n => n.userId === currentUser.id)}
            currentUser={currentUser}
            navigateTo={navigateTo}
            onDeleteAnnotationGlobally={handleDeleteAnnotationGlobally}
            setAllUserAnnotations={setAllUserAnnotations}
          />
        );
      default:
        navigateTo('#/projects');
        return <Loading>正在加载...</Loading>;
    }
  };

  return <AppContainer>{renderPage()}</AppContainer>;
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  // 🔧 生产环境禁用 StrictMode，避免重复加载和性能问题
  root.render(<App />);
}
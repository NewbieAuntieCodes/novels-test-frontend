import React, { useState, useEffect, useCallback, useMemo, useTransition, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import styled from '@emotion/styled';
import type { Novel, Tag, Annotation, Chapter, User, TagTemplate } from './types';
import { generateId, splitTextIntoChapters, PENDING_ANNOTATION_TAG_NAME, PENDING_ANNOTATION_TAG_COLOR } from './utils';
import { FONTS, SPACING, COLORS } from './styles'; // Import shared styles
import { tagTemplates as initialTagTemplates } from './components/tagpanel/tagTemplates';
import { bootstrapDemoData } from './data/bootstrap';
import { authApi, novelsApi, annotationsApi, TokenManager } from './api';
import { tagCompatApi as tagsApi } from './api/tagCompat';
import { LRUCache } from './utils/LRUCache';
import { exportNovelData, exportUserData, importNovelData, importUserData } from './storage/localDb';
import { markNovelExported } from './utils/novelBackupMeta';
import { loadTagTemplates, saveTagTemplates } from './utils/tagTemplateStorage';


import LoginPage from './components/auth/LoginPage';
import RegistrationPage from './components/auth/RegistrationPage';
import NovelProjectsPage from './components/projects/NovelProjectsPage';
import NovelEditorPage from './components/editor/NovelEditorPage';
import GlobalTagSearchPage from './components/search/GlobalTagSearchPage'; // Import new page
import ToolsPage from './components/tools/ToolsPage';
import ReferenceLibraryPage from './components/references/ReferenceLibraryPage';
import NotesLibraryPage from './components/notes/NotesLibraryPage';

type Page = 'login' | 'register' | 'projects' | 'editNovel' | 'tagSearch' | 'tools' | 'referenceLibrary' | 'notesLibrary'; // Added 'tagSearch' + 'tools'

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
  const [tagTemplates, setTagTemplates] = useState<TagTemplate[]>(() => loadTagTemplates(initialTagTemplates));
  const [isBootstrapping, setIsBootstrapping] = useState<boolean>(true);

  useEffect(() => {
    saveTagTemplates(tagTemplates);
  }, [tagTemplates]);

  // 🆕 使用 LRU 缓存管理小说数据（最多缓存 5 本，5分钟TTL）
  const novelDataCache = useRef<LRUCache<string, {
    tags: Tag[];
    terms: Tag[];
    annotations: Annotation[];
    timestamp: number;
  }>>(new LRUCache(5));

  // ?? 缓存小说全文/章节，避免重复加载大文本（最多缓存 2 本，5分钟TTL）
  const novelContentCache = useRef<LRUCache<string, {
    novel: Novel;
    timestamp: number;
  }>>(new LRUCache(2));

  // 尝试恢复本地会话
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const session = await authApi.getUserFromSession();
        if (session) {
          const user: User = { id: session.user.id, username: session.user.username };
          setCurrentUser(user);
          await loadUserData();
        }
      } catch (err) {
        console.warn('自动登录失败', err);
      } finally {
        setIsBootstrapping(false);
      }
    };

    restoreSession();
  }, []);

  // --- Routing ---
  useEffect(() => {
    if (isBootstrapping) return;

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
      } else if (hash === 'tools') {
        setCurrentPage('tools');
        setEditingNovelId(null);
      } else if (hash === 'references') {
        setCurrentPage('referenceLibrary');
        setEditingNovelId(null);
      } else if (hash === 'notes') {
        setCurrentPage('notesLibrary');
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
  }, [currentUser, novels, isBootstrapping]);

  const navigateTo = (path: string) => {
    window.location.hash = path;
  };

  const loadUserData = useCallback(async () => {
    const [novelsData, globalTagsData, annotationsData] = await Promise.all([
      novelsApi.getAll(),
      tagsApi.getAll({ novelId: 'global' }),
      annotationsApi.getAll(),
    ]);

    setNovels(novelsData);
    setAllUserTags(globalTagsData);
    setAllUserAnnotations(annotationsData);
  }, []);

  // 🆕 退出编辑器时清理重量级数据
  const handleNavigateBackFromEditor = useCallback((novelId: string) => {
    // 1. 清理当前小说的 text 和 chapters，只保留元数据
    setNovels(prev => prev.map(n => {
      if (n.id === novelId) {
        const hasText = n.text && n.text.trim() !== '';
        const hasChapters = n.chapters && n.chapters.length > 0;
        if (hasText && hasChapters) {
          novelContentCache.current.set(novelId, { novel: n, timestamp: Date.now() });
        }
        return {
          ...n,
          text: '', // 清空正文
          chapters: (n.chapters || []).map(ch => ({ ...ch, content: '' })), // 清空章节内容（保留章节元信息）
        };
      }
      return n;
    }));

    // 2. 清理标注状态，只保留全局标签
    setAllUserTags(prev => prev.filter(t => t.novelId === null));
    setAllUserAnnotations([]);

    // 3. 返回项目页
    navigateTo('#/projects');
  }, []);

  // --- Auth Handlers ---
  const handleLogin = async (username: string, password: string) => {
    try {
      const response = await authApi.login(username, password);
      TokenManager.setToken(response.token, response.user.id);

      const user: User = { id: response.user.id, username: response.user.username };
      setCurrentUser(user);

      await loadUserData();

      navigateTo('#/projects');
    } catch (error) {
      alert(`登录失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleRegister = async (username: string, password: string) => {
    try {
      const response = await authApi.register(username, password);
      const user: User = { id: response.user.id, username: response.user.username };
      setCurrentUser(user);
      TokenManager.setToken(response.token, response.user.id);
      await loadUserData();
      alert(`用户 "${username}" 注册成功并已自动登录！`);
      navigateTo('#/projects');
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
    novelContentCache.current.clear();
    navigateTo('#/login');
  };

  // --- Data Handlers ---
  const handleCreateNovel = async (
    title: string,
    initialText: string = '',
    templateGenre?: string,
    projectMode: 'tag' | 'note' = 'tag'
  ): Promise<string | undefined> => {
    if (!currentUser) return undefined;
    if (!title.trim()){
      alert("小说标题不能为空。");
      return undefined;
    }

    // Handle tag template application
    if (projectMode === 'tag' && templateGenre) {
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
    const newNovel = await novelsApi.create({
      id: generateId(),
      title: title.trim(),
      text: normalizedInitialText,
      chapters,
      storylines: [],
      plotAnchors: [],
      projectMode,
    });
    setNovels(prev => [...prev, newNovel]);
    return newNovel.id;
  };

  const handleUploadNovel = async (title: string, text: string, projectMode: 'tag' | 'note' = 'tag'): Promise<string | null> => {
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
        projectMode,
      });

      setNovels(prev => [...prev, newNovel]);
      alert(`小说 "${title}" 已成功上传并自动分章。`);
      return newNovel.id;
    } catch (error) {
      alert(`上传失败: ${error instanceof Error ? error.message : '未知错误'}`);
      return null;
    }
  };

  const handleAppendNovel = async (novelId: string, text: string): Promise<void> => {
    if (!currentUser) return;

    try {
      const normalizedText = text.replace(/\r\n|\r/g, '\n');
      const result = await novelsApi.appendContent(novelId, normalizedText);

      // 更新小说列表中的数据
      setNovels(prev =>
        prev.map(novel =>
          novel.id === novelId ? result.novel : novel
        )
      );

      // 清空该小说的缓存，强制编辑器重新加载
      novelDataCache.current.delete(novelId);
      novelContentCache.current.delete(novelId);

      alert(`成功追加内容，新增 ${result.appendedChaptersCount} 个章节。`);
    } catch (error) {
      alert(`追加内容失败: ${error instanceof Error ? error.message : '未知错误'}`);
      throw error;
    }
  };

  const handleDeleteChaptersAfter = async (novelId: string, keepChapterCount: number): Promise<void> => {
    if (!currentUser) return;

    try {
      const result = await novelsApi.deleteChaptersAfter(novelId, keepChapterCount);

      // 更新小说列表中的数据
      setNovels(prev =>
        prev.map(novel =>
          novel.id === novelId ? result.novel : novel
        )
      );

      // 更新标注列表（移除已删除的标注）
      setAllUserAnnotations(prev =>
        prev.filter(annotation => {
          if (annotation.novelId !== novelId) return true;
          // 检查标注是否在保留的文本范围内
          const novel = result.novel;
          if (novel.chapters && novel.chapters.length > 0) {
            const lastChapter = novel.chapters[novel.chapters.length - 1];
            return annotation.startIndex < lastChapter.originalEndIndex;
          }
          return true;
        })
      );

      // 清空该小说的缓存，强制编辑器重新加载
      novelDataCache.current.delete(novelId);

      alert(
        `删除成功！\n` +
        `删除章节数：${result.deletedChaptersCount}\n` +
        `删除标注数：${result.deletedAnnotationsCount}\n` +
        `截断标注数：${result.truncatedAnnotationsCount}\n` +
        `删除剧情锚点数：${result.deletedPlotAnchorsCount}`
      );
    } catch (error) {
      alert(`删除章节失败: ${error instanceof Error ? error.message : '未知错误'}`);
      throw error;
    }
  };

  const handleDeleteNovel = async (novelId: string) => {
    if (!currentUser) return;
    try {
      await novelsApi.delete(novelId);
      setNovels(prev => prev.filter(n => n.id !== novelId));
      setAllUserAnnotations(prev => prev.filter(a => a.novelId !== novelId));
      novelDataCache.current.delete(novelId);
      novelContentCache.current.delete(novelId);
      if (editingNovelId === novelId) {
        navigateTo("#/projects");
      }
    } catch (error) {
      alert(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleUpdateNovelCategory = async (novelId: string, category: string, subcategory: string) => {
    if (!currentUser) return;

    // 先更新本地状态，提供即时反馈
    setNovels(prevNovels =>
      prevNovels.map(novel =>
        novel.id === novelId
          ? { ...novel, category, subcategory }
          : novel
      )
    );

    // 然后保存到后端
    try {
      await novelsApi.update(novelId, { category, subcategory });
    } catch (error) {
      alert(`更新分类失败: ${error instanceof Error ? error.message : '未知错误'}`);
      // 如果失败，重新加载小说列表
      const novelsData = await novelsApi.getAll();
      setNovels(novelsData);
    }
  };

  const handleUpdateNovelInfo = async (novelId: string, title: string, author: string): Promise<void> => {
    if (!currentUser) {
      throw new Error('用户未登录');
    }

    // 先更新本地状态，提供即时反馈
    setNovels(prevNovels =>
      prevNovels.map(novel =>
        novel.id === novelId
          ? { ...novel, title, author: author || null }
          : novel
      )
    );

    // 然后保存到后端
    try {
      await novelsApi.update(novelId, { title, author: author || null });
    } catch (error) {
      // 如果失败，重新加载小说列表恢复到之前的状态
      const novelsData = await novelsApi.getAll();
      setNovels(novelsData);
      // 向上层抛出错误，让弹窗可以显示错误信息
      throw new Error(`更新小说信息失败: ${error instanceof Error ? error.message : '未知错误'}`);
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

    tagsApi.update(tagId, { color: newColor }).catch(err => {
      console.error('更新标签颜色失败', err);
    });
  };

  const handleDeleteTag = async (tagId: string) => {
    if (!currentUser) return;

    // 先更新本地状态
    setAllUserTags(prevTags => prevTags.filter(tag => tag.id !== tagId));
    // 同时删除所有使用该标签的标注
    setAllUserAnnotations(prev => prev.filter(ann => ann.tagIds && !ann.tagIds.includes(tagId)));

    // 然后保存到后端
    try {
      await tagsApi.delete(tagId);
    } catch (error) {
      console.error('删除标签到后端失败:', error);
      alert('删除标签失败,请稍后重试');
      // 如果失败，重新加载标签和标注
      const tagsData = await tagsApi.getAll();
      const globalTags = tagsData.filter(t => t.novelId === null);
      setAllUserTags(globalTags);
      const annotationsData = await annotationsApi.getAll();
      setAllUserAnnotations(annotationsData);
    }
  };

  const handleDeleteAnnotationGlobally = (annotationId: string) => {
    annotationsApi.delete(annotationId).catch(err => console.error('删除标注失败', err));
    setAllUserAnnotations(prev => prev.filter(ann => ann.id !== annotationId && ann.userId === currentUser?.id));
  };

  const handleExportData = async () => {
    if (!currentUser) return;
    try {
      const backup = await exportUserData(currentUser.id);
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `novel-backup-${currentUser.username}-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(`导出失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const sanitizeFilenamePart = (value: string): string => {
    const trimmed = (value || '').trim();
    const safe = trimmed.replace(/[<>:"/\\|?*\u0000-\u001F]+/g, '_').replace(/\s+/g, ' ');
    return (safe || 'untitled').slice(0, 80);
  };

  const handleExportNovelData = async (novelId: string) => {
    if (!currentUser) return;
    try {
      const novel = novels.find(n => n.id === novelId && n.userId === currentUser.id);
      const backup = await exportNovelData(currentUser.id, novelId);
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `novel-backup-${currentUser.username}-${sanitizeFilenamePart(novel?.title || novelId)}-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      markNovelExported(currentUser.id, novelId, backup.exportedAt);
    } catch (error) {
      alert(`导出失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleImportData = async (file: File) => {
    if (!currentUser) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);

      const inferredScope: 'user' | 'novel' =
        payload?.exportScope === 'novel' || (payload?.exportedNovelId && Array.isArray(payload?.novels) && payload.novels.length === 1)
          ? 'novel'
          : 'user';

      if (inferredScope === 'novel') {
        const novelTitle = payload?.novels?.[0]?.title || payload?.exportedNovelId || '（未命名小说）';
        const ok = window.confirm(`检测到“单本小说导出”：${novelTitle}\n\n将仅导入该小说（不会清空其它小说/数据）。继续？`);
        if (!ok) return;
        await importNovelData(currentUser.id, payload);
      } else {
        const ok = window.confirm('导入“全量备份”会覆盖当前用户的所有本地数据（不可撤销）。继续？');
        if (!ok) return;
        await importUserData(currentUser.id, payload);
      }

      await loadUserData();
      alert('导入成功！');
    } catch (error) {
      console.error('导入失败', error);
      alert(`导入失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };


  const renderPage = () => {
    if (isBootstrapping) {
      return <Loading>正在加载本地数据...</Loading>;
    }

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
              onAppendNovel={handleAppendNovel}
              onSelectNovel={(novelId) => navigateTo(`#/edit/${novelId}`)}
              onDeleteNovel={handleDeleteNovel}
              onDeleteChaptersAfter={handleDeleteChaptersAfter}
              onUpdateNovelCategory={handleUpdateNovelCategory}
              onUpdateNovelInfo={handleUpdateNovelInfo}
              onExportData={handleExportData}
              onExportNovelData={handleExportNovelData}
              onImportData={handleImportData}
              onLogout={handleLogout}
              currentUser={currentUser}
              onNavigateToTagSearch={() => navigateTo('#/tag-search')}
              onNavigateToTools={() => navigateTo('#/tools')}
              onNavigateToReferenceLibrary={() => navigateTo('#/references')}
              onNavigateToNotes={() => navigateTo('#/notes')}
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
                tagTemplates={tagTemplates}
                onUpdateTemplates={setTagTemplates}
                setNovels={setNovels}
                setAllUserTags={setAllUserTags}
                setAllUserAnnotations={setAllUserAnnotations}
                onNavigateBack={() => handleNavigateBackFromEditor(editingNovelId)}
                currentUser={currentUser}
                onUpdateTagName={handleUpdateTagName}
                onDeleteTag={handleDeleteTag}
                novelDataCache={novelDataCache}
                novelContentCache={novelContentCache}
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
      case 'tools':
        return <ToolsPage onBack={() => navigateTo('#/projects')} />;
      case 'referenceLibrary':
        return <ReferenceLibraryPage onBack={() => navigateTo('#/projects')} />;
      case 'notesLibrary':
        return <NotesLibraryPage onBack={() => navigateTo('#/projects')} projects={novels.filter(n => n.userId === currentUser.id)} />;
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

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import styled from '@emotion/styled';
import type { Novel, Tag, Annotation, Chapter, User, TagTemplate } from './types';
import { generateId, splitTextIntoChapters } from './utils';
import { FONTS, SPACING, COLORS } from './styles'; // Import shared styles
import { tagTemplates as initialTagTemplates } from './components/tagpanel/tagTemplates';
import { bootstrapDemoData } from './data/bootstrap';


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
  const handleLogin = (username: string) => {
    const user: User = { id: generateId(), username };
    setCurrentUser(user);
    
    // Bootstrap with demo data for the new user session
    const { novels: demoNovels, tags: demoTags, annotations: demoAnnotations } = bootstrapDemoData();
    setNovels(demoNovels.map(n => ({ ...n, userId: user.id })));
    setAllUserTags(demoTags.map(t => ({ ...t, userId: user.id })));
    setAllUserAnnotations(demoAnnotations.map(a => ({ ...a, userId: user.id })));

    navigateTo('#/projects');
  };

  const handleRegister = (username: string) => {
    alert(`用户 "${username}" 注册成功！请登录。`);
    navigateTo('#/login');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setEditingNovelId(null);
    // Also clear data on logout to prevent data leaking to the next session
    setNovels([]);
    setAllUserTags([]);
    setAllUserAnnotations([]);
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

  const handleUploadNovel = (title: string, text: string): string | null => {
    if (!currentUser) return null;
     if (!title.trim()) {
        alert("小说标题不能为空。");
        return null;
    }

    const normalizedText = text.replace(/\r\n|\r/g, '\n');
    const chapters = splitTextIntoChapters(normalizedText);
    const newNovel: Novel = {
        id: generateId(),
        title: title.trim(),
        text: normalizedText,
        userId: currentUser.id,
        chapters: chapters,
        storylines: [],
        plotAnchors: [],
    };
    setNovels(prev => [...prev, newNovel]);
    alert(`小说 "${title}" 已成功上传并自动分章。`);
    return newNovel.id;
  };
  
  const handleDeleteNovel = (novelId: string) => {
    if (!currentUser) return;
    setNovels(prev => prev.filter(n => n.id !== novelId));
    setAllUserAnnotations(prev => prev.filter(a => a.novelId !== novelId));
    if (editingNovelId === novelId) {
      navigateTo("#/projects");
    }
  };

  const handleUpdateTagName = (tagId: string, newName: string) => {
    if (!currentUser) return;
    setAllUserTags(prevTags =>
      prevTags.map(tag =>
        tag.id === tagId && tag.userId === currentUser.id
        ? { ...tag, name: newName }
        : tag
      )
    );
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
  root.render(<React.StrictMode><App /></React.StrictMode>);
}
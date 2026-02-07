import type { Novel, Tag, Annotation } from '../types';
import { generateId, splitTextIntoChapters, getAllAncestorTagIds, PENDING_ANNOTATION_TAG_NAME, PENDING_ANNOTATION_TAG_COLOR } from '../utils';
import { tagTemplates as initialTagTemplates } from '../components/tagpanel/tagTemplates';
import { defaultNovelsData } from '../components/projects/defaultNovels';
import { annotationsToCreate } from './demoAnnotations';

// --- Demo Data Bootstrapping ---
export const bootstrapDemoData = () => {
  const novelData = defaultNovelsData.find(n => n.title === '谁让他修仙的！');
  if (!novelData) {
    return { novels: [], tags: [], annotations: [] };
  }

  // 1. Create Novel
  const chapters = splitTextIntoChapters(novelData.text);
  const demoNovel: Novel = {
    id: 'demo-novel-1',
    title: novelData.title,
    text: novelData.text,
    chapters: chapters,
    userId: 'unassigned',
    storylines: [],
    plotAnchors: [],
  };

  // 2. Create Tags from Template
  const template = initialTagTemplates.find(t => t.genre === '修仙小说');
  const demoTags: Tag[] = [];
  const nameToIdMap = new Map<string, string>();

  if (template) {
    template.tags.forEach(tagDef => {
      const newTag: Tag = {
        id: generateId(),
        name: tagDef.name,
        color: tagDef.color,
        parentId: null,
        userId: 'unassigned',
      };
      demoTags.push(newTag);
      nameToIdMap.set(newTag.name, newTag.id);
    });

    demoTags.forEach(tag => {
      const tagDef = template.tags.find(t => t.name === tag.name);
      if (tagDef?.parentName) {
        tag.parentId = nameToIdMap.get(tagDef.parentName) || null;
      }
    });
  }
  
  // 2.1 Add the special "Pending Annotation" tag if it doesn't exist
  if (!demoTags.some(tag => tag.name === PENDING_ANNOTATION_TAG_NAME)) {
      const pendingTag: Tag = {
          id: 'system-pending-tag', // Use a stable ID for easy reference
          name: PENDING_ANNOTATION_TAG_NAME,
          color: PENDING_ANNOTATION_TAG_COLOR,
          parentId: null,
          userId: 'unassigned',
      };
      demoTags.push(pendingTag);
  }

  const getTag = (name: string) => demoTags.find(t => t.name === name);

  // 3. Create Annotations based on descriptive phrases
  const demoAnnotations: Annotation[] = [];
  
  annotationsToCreate.forEach(({ text, tagNames }) => {
    const tagIds = new Set<string>();
    tagNames.forEach(tagPath => {
      const leafTagName = tagPath.split('/').pop();
      if (!leafTagName) {
        console.warn(`Invalid tag path found: "${tagPath}"`);
        return; // continue to next tagPath
      }

      const tag = getTag(leafTagName);
      if (tag) {
        tagIds.add(tag.id);
        getAllAncestorTagIds(tag.id, demoTags).forEach(ancestorId => tagIds.add(ancestorId));
      } else {
        console.warn(`Could not find tag with name: "${leafTagName}" from path "${tagPath}" during bootstrap.`);
      }
    });
    
    if (tagIds.size === 0) return;

    let lastIndex = -1;
    while ((lastIndex = demoNovel.text.indexOf(text, lastIndex + 1)) !== -1) {
      const newAnnotation: Annotation = {
        id: generateId(),
        tagIds: Array.from(tagIds),
        text: text,
        startIndex: lastIndex,
        endIndex: lastIndex + text.length,
        novelId: demoNovel.id,
        userId: 'unassigned',
      };
      demoAnnotations.push(newAnnotation);
    }
  });

  return {
    novels: [demoNovel],
    tags: demoTags,
    annotations: demoAnnotations,
  };
};
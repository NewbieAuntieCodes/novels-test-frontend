import type { Tag, Chapter, User } from './types'; // Added User for completeness, though not directly used in these utils

export const generateId = (): string => Math.random().toString(36).substr(2, 9);

export const normalizeTagKey = (tagName: string): string =>
  tagName.trim().toLowerCase().replace(/\s+/g, ' ');

export const normalizeNoteTitleKey = (title: string): string =>
  title.trim().toLowerCase().replace(/\s+/g, '');

// --- Special Tag Constants ---
export const PENDING_ANNOTATION_TAG_NAME = '待标注';
export const PENDING_ANNOTATION_TAG_COLOR = '#adb5bd'; // A neutral gray

export const defaultTagColors: string[] = [
  '#FFADAD', '#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF',
  '#A0C4FF', '#BDB2FF', '#FFC6FF', '#E0BBE4', '#FFB3BA'
];
let colorIndex = 0;
export const getNextColor = (): string => {
  const color = defaultTagColors[colorIndex];
  colorIndex = (colorIndex + 1) % defaultTagColors.length;
  return color;
};

// Expects tags specific to a novel and user
export const getAllAncestorTagIds = (tagId: string, allTagsForNovelAndUser: Tag[]): string[] => {
  let ancestors: string[] = [];
  let currentTag = allTagsForNovelAndUser.find(t => t.id === tagId);
  while (currentTag && currentTag.parentId) {
    ancestors.push(currentTag.parentId);
    currentTag = allTagsForNovelAndUser.find(t => t.id === currentTag!.parentId);
  }
  return ancestors;
};

export const getTagPathLabel = (tagId: string, allTagsForNovelAndUser: Tag[], separator = ' / '): string => {
  const tagById = new Map(allTagsForNovelAndUser.map((tag) => [tag.id, tag]));
  const names: string[] = [];

  const visited = new Set<string>();
  let currentId: string | null | undefined = tagId;
  while (currentId) {
    if (visited.has(currentId)) break;
    visited.add(currentId);

    const tag = tagById.get(currentId);
    if (!tag) break;
    names.unshift(tag.name);
    currentId = tag.parentId;
  }

  return names.join(separator);
};

// Expects tags specific to a novel and user
export const getAllDescendantTagIds = (tagId: string, allTagsForNovelAndUser: Tag[]): string[] => {
  const descendants: string[] = [];
  const queue: string[] = [];
  
  const initialChildren = allTagsForNovelAndUser.filter(t => t.parentId === tagId);
  initialChildren.forEach(child => {
      if (!descendants.includes(child.id)) {
          descendants.push(child.id);
          queue.push(child.id);
      }
  });

  let head = 0;
  while(head < queue.length) {
    const currentParentId = queue[head++];
    const children = allTagsForNovelAndUser.filter(t => t.parentId === currentParentId);
    children.forEach(child => {
      if (!descendants.includes(child.id)) {
         descendants.push(child.id);
         queue.push(child.id);
      }
    });
  }
  return descendants;
};

/**
 * 同根替换：仅替换同一根标签体系下的旧标签，保留其他体系标签。
 * 同时会自动补齐新标签的祖先标签（与标注逻辑保持一致）。
 */
export const applySameRootTagReplacement = (
  existingTagIds: string[],
  newLeafTagId: string,
  allTagsForNovelAndUser: Tag[]
): string[] => {
  const ancestorIds = getAllAncestorTagIds(newLeafTagId, allTagsForNovelAndUser);
  const rootId = ancestorIds.length > 0 ? ancestorIds[ancestorIds.length - 1] : newLeafTagId;
  const sameRootIds = new Set([rootId, ...getAllDescendantTagIds(rootId, allTagsForNovelAndUser)]);

  const kept = existingTagIds.filter(id => !sameRootIds.has(id));
  return Array.from(new Set([...kept, newLeafTagId, ...ancestorIds]));
};

/**
 * 从一组（包含祖先）tagIds 中推断“叶子标签”（用于 UI 展示）。
 * 叶子标签 = 不是任何其他标签祖先的标签。
 */
export const getLeafTagIds = (tagIds: string[], allTagsForNovelAndUser: Tag[]): string[] => {
  const unique = Array.from(new Set(tagIds));
  if (unique.length <= 1) return unique;

  return unique.filter(id => {
    return !unique.some(otherId => {
      if (otherId === id) return false;
      const ancestors = getAllAncestorTagIds(otherId, allTagsForNovelAndUser);
      return ancestors.includes(id);
    });
  });
};


export const getContrastingTextColor = (hexColor: string): string => {
    if (!hexColor || hexColor.length < 4) return '#000000'; // Basic check for valid hex
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return '#000000'; // Check if parsing failed
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
};

const CHAPTER_PATTERNS = [
  // Matches lines like "第X章 Title", "##1, 第X章 Title", "卷一 第X章 Title"
  // markerMatch[0] will be the full title line.
  { regex: /^([^\r\n]*?第(?:[一二三四五六七八九十百千万零〇\d]+)[章节回卷部][^\r\n]*)/gm, titleGroup: 0, contentStartsAfterMatch: true },
  // Matches lines like "楔子 Title", "##, 序章 Title", "简介："
  { regex: /^([^\r\n]*?(?:楔子|序章|序幕|引子|前言|尾声|终章|后记|番外|简介)[^\r\n]*)/gm, titleGroup: 0, contentStartsAfterMatch: true },
  // Matches lines like "Chapter X Title", "## Chapter X Title"
  { regex: /^([^\r\n]*?Chapter\s*\d+[^\r\n]*)/gim, titleGroup: 0, contentStartsAfterMatch: true },
];

export const splitTextIntoChapters = (text: string): Chapter[] => {
  const chapters: Chapter[] = [];
  const normalizedText = text.replace(/\r\n|\r/g, '\n'); // Normalize newlines first

  if (!normalizedText.trim()) return [];

  const matches: { index: number; markerMatch: RegExpExecArray; pattern: typeof CHAPTER_PATTERNS[0]}[] = [];

  CHAPTER_PATTERNS.forEach(patternDetail => {
    let match;
    const regex = new RegExp(patternDetail.regex); // Create a new RegExp instance for each pattern
    
    // Use normalizedText for matching
    while((match = regex.exec(normalizedText)) !== null) {
      matches.push({ index: match.index, markerMatch: [...match] as RegExpExecArray, pattern: patternDetail });
    }
  });

  matches.sort((a,b) => a.index - b.index);

  if (matches.length === 0) {
    chapters.push({
      id: generateId(),
      title: "内容",
      content: normalizedText, // Use normalizedText
      originalStartIndex: 0,
      originalEndIndex: normalizedText.length, // Use normalizedText length
    });
    return chapters;
  }
  
  let lastProcessedContentEnd = 0;

  if (matches[0].index > 0) {
      // Use normalizedText for substring and trim
      const prefaceContent = normalizedText.substring(0, matches[0].index);
      if (prefaceContent.trim()) {
          chapters.push({
              id: generateId(),
              title: "前言/序",
              content: prefaceContent,
              originalStartIndex: 0,
              originalEndIndex: matches[0].index,
          });
      }
      lastProcessedContentEnd = matches[0].index;
  }


  matches.forEach((matchInfo, i) => {
    const { markerMatch } = matchInfo;
    const titleLine = markerMatch[0];
    const chapterTitle = titleLine.trim();
    
    let thisChapterContentStartIndex = matchInfo.index + titleLine.length;
    
    // Use normalizedText for substring and matching
    const textFollowingTitle = normalizedText.substring(thisChapterContentStartIndex);
    const leadingWhitespaceAfterTitleMatch = textFollowingTitle.match(/^[\n\s]*/); // Adjusted to include \n explicitly
    if (leadingWhitespaceAfterTitleMatch) {
        thisChapterContentStartIndex += leadingWhitespaceAfterTitleMatch[0].length;
    }

    const nextMatchInfo = matches[i+1];
    const thisChapterContentEndIndex = nextMatchInfo ? nextMatchInfo.index : normalizedText.length; // Use normalizedText length
    
    const actualContentStartIndex = Math.min(thisChapterContentStartIndex, thisChapterContentEndIndex);

    // Use normalizedText for substring and trim
    const isolatedChapterContent = normalizedText.substring(
        actualContentStartIndex,
        thisChapterContentEndIndex
    );

    if (chapterTitle || isolatedChapterContent.trim() || (thisChapterContentEndIndex > actualContentStartIndex) ) {
        chapters.push({
          id: generateId(),
          title: chapterTitle || `章节 ${chapters.length + 1}`,
          content: isolatedChapterContent,
          originalStartIndex: actualContentStartIndex,
          originalEndIndex: thisChapterContentEndIndex,
        });
    }
    lastProcessedContentEnd = thisChapterContentEndIndex;
  });
  
  if (lastProcessedContentEnd < normalizedText.length) { // Use normalizedText length
      // Use normalizedText for substring and trim
      const remainingContent = normalizedText.substring(lastProcessedContentEnd);
      if (remainingContent.trim()) {
          chapters.push({
              id: generateId(),
              title: `后续内容`,
              content: remainingContent,
              originalStartIndex: lastProcessedContentEnd,
              originalEndIndex: normalizedText.length // Use normalizedText length
          });
      }
  }
  
  let initialProcessedChapters = chapters.filter(ch =>
    ch.title.trim().length > 0 ||
    ch.content.trim().length > 0 ||
    (ch.originalEndIndex > ch.originalStartIndex)
  );

  // Merge "前言/序" with a following specific introductory chapter
  if (initialProcessedChapters.length >= 2) {
    const firstChapter = initialProcessedChapters[0];
    const secondChapter = initialProcessedChapters[1];
    const specificIntroductoryTitles = ["简介", "序章", "楔子", "序幕", "引子"];

    // Content is already normalized as it came from normalizedText
    if (
      firstChapter.title.trim() === "前言/序" &&
      specificIntroductoryTitles.some(introTitle =>
        secondChapter.title.toLowerCase().startsWith(introTitle.toLowerCase())
      )
    ) {
      // 合并时需要从原文重新提取内容，保持索引一致
      const mergedContent = normalizedText.substring(
        firstChapter.originalStartIndex,
        secondChapter.originalEndIndex
      );

      const newFirstChapter: Chapter = {
        ...secondChapter,
        content: mergedContent,
        originalStartIndex: firstChapter.originalStartIndex,
      };
      initialProcessedChapters.splice(0, 2, newFirstChapter);
    }
  }
  
  return initialProcessedChapters;
};

/**
 * 统计文本中的实际字数（不含空格、标点符号）
 * 仅统计中文字符、英文字母、数字
 */
export const countWords = (text: string): number => {
  if (!text) return 0;

  // 匹配中文字符、英文字母、数字
  const matches = text.match(/[\u4e00-\u9fa5a-zA-Z0-9]/g);
  return matches ? matches.length : 0;
};

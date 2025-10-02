export interface Chapter {
  id: string;
  title: string;
  content: string;
  originalStartIndex: number;
  originalEndIndex: number;
}

const generateId = (): string => Math.random().toString(36).substr(2, 9);

const CHAPTER_PATTERNS = [
  { regex: /^([^\r\n]*?第(?:[一二三四五六七八九十百千万零〇\d]+)[章节回卷部][^\r\n]*)/gm, titleGroup: 0, contentStartsAfterMatch: true },
  { regex: /^([^\r\n]*?(?:楔子|序章|序幕|引子|前言|尾声|终章|后记|番外|简介)[^\r\n]*)/gm, titleGroup: 0, contentStartsAfterMatch: true },
  { regex: /^([^\r\n]*?Chapter\s*\d+[^\r\n]*)/gim, titleGroup: 0, contentStartsAfterMatch: true },
];

export const splitTextIntoChapters = (text: string): Chapter[] => {
  const chapters: Chapter[] = [];
  const normalizedText = text.replace(/\r\n|\r/g, '\n');

  if (!normalizedText.trim()) return [];

  const matches: { index: number; markerMatch: RegExpExecArray; pattern: typeof CHAPTER_PATTERNS[0]}[] = [];

  CHAPTER_PATTERNS.forEach(patternDetail => {
    let match;
    const regex = new RegExp(patternDetail.regex);

    while((match = regex.exec(normalizedText)) !== null) {
      matches.push({ index: match.index, markerMatch: [...match] as RegExpExecArray, pattern: patternDetail });
    }
  });

  matches.sort((a,b) => a.index - b.index);

  if (matches.length === 0) {
    chapters.push({
      id: generateId(),
      title: "内容",
      content: normalizedText.trim(),
      originalStartIndex: 0,
      originalEndIndex: normalizedText.length,
    });
    return chapters;
  }

  let lastProcessedContentEnd = 0;

  if (matches[0].index > 0) {
      const prefaceContent = normalizedText.substring(0, matches[0].index).trim();
      if (prefaceContent) {
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

    const textFollowingTitle = normalizedText.substring(thisChapterContentStartIndex);
    const leadingWhitespaceAfterTitleMatch = textFollowingTitle.match(/^[\n\s]*/);
    if (leadingWhitespaceAfterTitleMatch) {
        thisChapterContentStartIndex += leadingWhitespaceAfterTitleMatch[0].length;
    }

    const nextMatchInfo = matches[i+1];
    const thisChapterContentEndIndex = nextMatchInfo ? nextMatchInfo.index : normalizedText.length;

    const actualContentStartIndex = Math.min(thisChapterContentStartIndex, thisChapterContentEndIndex);

    const isolatedChapterContent = normalizedText.substring(
        actualContentStartIndex,
        thisChapterContentEndIndex
    ).trim();

    if (chapterTitle || isolatedChapterContent || (thisChapterContentEndIndex > actualContentStartIndex) ) {
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

  if (lastProcessedContentEnd < normalizedText.length) {
      const remainingContent = normalizedText.substring(lastProcessedContentEnd).trim();
      if (remainingContent) {
          chapters.push({
              id: generateId(),
              title: `后续内容`,
              content: remainingContent,
              originalStartIndex: lastProcessedContentEnd,
              originalEndIndex: normalizedText.length
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

    if (
      firstChapter.title.trim() === "前言/序" &&
      specificIntroductoryTitles.some(introTitle =>
        secondChapter.title.toLowerCase().startsWith(introTitle.toLowerCase())
      )
    ) {
      const mergedContent = firstChapter.content.trim() + (firstChapter.content.trim() && secondChapter.content.trim() ? "\n\n" : "") + secondChapter.content.trim();

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

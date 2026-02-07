import type { Chapter } from '../types';

export interface ChapterTreeNode {
  chapter: Chapter;
  children: ChapterTreeNode[];
  parent: ChapterTreeNode | null;
}

const DEFAULT_LEVEL = 5;

/**
 * 获取章节的级别，未设置时默认为5
 */
export const getChapterLevel = (chapter: Chapter): number => {
  return chapter.level ?? DEFAULT_LEVEL;
};

/**
 * 根据章节的 level 字段构建树状结构
 * 规则：当前章节的父节点为「最近的、级别小于它的前一个章节」
 */
export const buildChapterTree = (chapters: Chapter[]): ChapterTreeNode[] => {
  if (chapters.length === 0) return [];

  const roots: ChapterTreeNode[] = [];
  const stack: ChapterTreeNode[] = []; // 用栈维护可能的父节点

  chapters.forEach(chapter => {
    const currentLevel = getChapterLevel(chapter);
    const node: ChapterTreeNode = {
      chapter,
      children: [],
      parent: null,
    };

    // 从栈顶开始，找到第一个级别小于当前章节的节点作为父节点
    while (stack.length > 0) {
      const potentialParent = stack[stack.length - 1];
      const parentLevel = getChapterLevel(potentialParent.chapter);

      if (parentLevel < currentLevel) {
        // 找到了父节点
        node.parent = potentialParent;
        potentialParent.children.push(node);
        break;
      } else {
        // 当前栈顶节点的级别 >= 当前章节，弹出
        stack.pop();
      }
    }

    // 如果没有找到父节点，说明是根节点
    if (node.parent === null) {
      roots.push(node);
    }

    // 将当前节点压入栈，作为后续章节的潜在父节点
    stack.push(node);
  });

  return roots;
};

/**
 * 扁平化树结构，用于展示（带缩进层级）
 */
export interface FlattenedChapter {
  chapter: Chapter;
  depth: number; // 嵌套深度，根节点为0
  hasChildren: boolean;
  parent: Chapter | null;
}

export const flattenChapterTree = (
  nodes: ChapterTreeNode[],
  depth: number = 0
): FlattenedChapter[] => {
  const result: FlattenedChapter[] = [];

  nodes.forEach(node => {
    result.push({
      chapter: node.chapter,
      depth,
      hasChildren: node.children.length > 0,
      parent: node.parent?.chapter || null,
    });

    if (node.children.length > 0) {
      result.push(...flattenChapterTree(node.children, depth + 1));
    }
  });

  return result;
};

/**
 * 更新章节级别后重新构建树
 */
export const updateChapterLevel = (
  chapters: Chapter[],
  chapterId: string,
  newLevel: number
): Chapter[] => {
  return chapters.map(ch =>
    ch.id === chapterId ? { ...ch, level: newLevel } : ch
  );
};

/**
 * 获取章节的所有子孙章节ID（用于删除时一并删除）
 */
export const getDescendantChapterIds = (
  tree: ChapterTreeNode[],
  chapterId: string
): string[] => {
  const ids: string[] = [];

  const traverse = (nodes: ChapterTreeNode[]) => {
    for (const node of nodes) {
      if (node.chapter.id === chapterId) {
        const collectIds = (n: ChapterTreeNode) => {
          ids.push(n.chapter.id);
          n.children.forEach(collectIds);
        };
        collectIds(node);
        return true;
      }
      if (traverse(node.children)) return true;
    }
    return false;
  };

  traverse(tree);
  return ids;
};

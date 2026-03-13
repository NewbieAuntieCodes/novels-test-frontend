import type { Storyline } from '../../types';
import { defaultTagColors } from '../../utils';

export interface StorylineImportItem {
  path: string;
  color?: string;
}

const isValidHexColor = (color: string): boolean => /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color);

export const parseBulkStorylineInput = (input: string): StorylineImportItem[] => {
  const items: StorylineImportItem[] = [];
  const nameStack: string[] = [];
  const indentWidthStack: number[] = [0];
  const lines = input.split(/\r?\n/);

  const getIndentWidth = (rawLine: string): number => {
    const indentMatch = rawLine.match(/^[\t \u3000]*/);
    const indentRaw = indentMatch ? indentMatch[0] : '';
    return indentRaw
      .replace(/\t/g, '  ')
      .replace(/\u3000/g, '  ')
      .length;
  };

  const resolveIndentLevel = (indentWidth: number): number => {
    if (indentWidth <= 0) {
      indentWidthStack.length = 1;
      return 0;
    }

    let exactLevel = -1;
    for (let i = 0; i < indentWidthStack.length; i += 1) {
      if (indentWidthStack[i] === indentWidth) {
        exactLevel = i;
        break;
      }
    }

    if (exactLevel !== -1) {
      indentWidthStack.length = exactLevel + 1;
      return exactLevel;
    }

    const currentWidth = indentWidthStack[indentWidthStack.length - 1];
    if (indentWidth > currentWidth) {
      indentWidthStack.push(indentWidth);
      return indentWidthStack.length - 1;
    }

    let parentLevel = -1;
    for (let i = indentWidthStack.length - 1; i >= 0; i -= 1) {
      if (indentWidthStack[i] < indentWidth) {
        parentLevel = i;
        break;
      }
    }

    if (parentLevel === -1) {
      indentWidthStack.length = 1;
      indentWidthStack.push(indentWidth);
      return 1;
    }

    indentWidthStack.length = parentLevel + 1;
    indentWidthStack.push(indentWidth);
    return indentWidthStack.length - 1;
  };

  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;
    if (/^(#|\/\/)/.test(line)) continue;

    line = line.replace(/^([-*•]+|\d+[.)])\s+/, '').trim();
    if (!line) continue;

    let color: string | undefined;
    const colorMatch = line.match(/\s(#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}))\s*$/);
    if (colorMatch) {
      color = colorMatch[1];
      line = line.slice(0, line.length - colorMatch[0].length).trim();
    }
    if (!line) continue;

    let segments: string[] = [];
    if (/[>＞]/.test(line)) {
      segments = line
        .split(/[>＞]/)
        .map((segment) => segment.trim())
        .filter(Boolean);
    } else {
      const indentWidth = getIndentWidth(rawLine);
      const indentLevel = resolveIndentLevel(indentWidth);
      nameStack[indentLevel] = line;
      nameStack.length = indentLevel + 1;
      segments = nameStack.filter(Boolean);
    }

    if (segments.length === 0) continue;

    items.push({
      path: segments.join('/'),
      color,
    });
  }

  return items;
};

export const buildPreviewStorylinesFromImportItems = (items: StorylineImportItem[]): Storyline[] => {
  const previewStorylines: Storyline[] = [];
  const existingByKey = new Map<string, Storyline>();
  let colorIndex = 0;

  const getPreviewColor = () => {
    const palette = defaultTagColors.length > 0 ? defaultTagColors : ['#A0C4FF'];
    const nextColor = palette[colorIndex % palette.length];
    colorIndex += 1;
    return nextColor;
  };

  const makeKey = (parentId: string | null, name: string) => `${parentId ?? 'root'}::${name.trim().toLowerCase()}`;

  items.forEach((item) => {
    const segments = (item.path || '')
      .split('/')
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (segments.length === 0) return;

    let currentParentId: string | null = null;
    const pathSegments: string[] = [];

    segments.forEach((segment, index) => {
      const key = makeKey(currentParentId, segment);
      const existing = existingByKey.get(key);
      if (existing) {
        currentParentId = existing.id;
        pathSegments.push(segment);
        return;
      }

      const isLeaf = index === segments.length - 1;
      pathSegments.push(segment);
      const storyline: Storyline = {
        id: `preview-storyline:${pathSegments.join('/')}`,
        name: segment,
        color: isLeaf && item.color && isValidHexColor(item.color) ? item.color : getPreviewColor(),
        parentId: currentParentId,
      };

      previewStorylines.push(storyline);
      existingByKey.set(key, storyline);
      currentParentId = storyline.id;
    });
  });

  return previewStorylines;
};

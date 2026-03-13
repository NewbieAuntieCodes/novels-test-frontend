import type { PlotAnchor, Storyline } from '../../types';

export interface StorylineDerivedData {
  storylineById: Map<string, Storyline>;
  childrenByParentId: Map<string | null, Storyline[]>;
  parentByStorylineId: Map<string, string | null>;
  descendantsByStorylineId: Map<string, string[]>;
  anchorsByStorylineId: Map<string, PlotAnchor[]>;
  anchorCountByStorylineId: Map<string, number>;
}

export interface FlattenedStorylineRow {
  storyline: Storyline;
  level: number;
  hasChildren: boolean;
  hasVisibleChildren: boolean;
  isCollapsed: boolean;
}

export const buildChildrenByParentId = (storylines: Storyline[]): Map<string | null, Storyline[]> => {
  const map = new Map<string | null, Storyline[]>();
  storylines.forEach((storyline) => {
    const key = storyline.parentId ?? null;
    const children = map.get(key) || [];
    children.push(storyline);
    map.set(key, children);
  });
  return map;
};

export const buildParentByStorylineId = (storylines: Storyline[]): Map<string, string | null> => {
  const map = new Map<string, string | null>();
  storylines.forEach((storyline) => {
    map.set(storyline.id, storyline.parentId ?? null);
  });
  return map;
};

export const collectAncestorStorylineIds = (
  storylineId: string | null,
  parentByStorylineId: Map<string, string | null>
): string[] => {
  if (!storylineId) return [];

  const ancestors: string[] = [];
  let current = parentByStorylineId.get(storylineId) ?? null;
  while (current) {
    ancestors.push(current);
    current = parentByStorylineId.get(current) ?? null;
  }
  return ancestors;
};

export const buildDescendantsByStorylineId = (
  storylines: Storyline[],
  childrenByParentId: Map<string | null, Storyline[]>
): Map<string, string[]> => {
  const memo = new Map<string, string[]>();

  const collect = (storylineId: string, path: Set<string>): string[] => {
    const cached = memo.get(storylineId);
    if (cached) return cached;

    if (path.has(storylineId)) {
      return [];
    }

    path.add(storylineId);
    const descendants: string[] = [];
    const children = childrenByParentId.get(storylineId) || [];
    children.forEach((child) => {
      descendants.push(child.id);
      descendants.push(...collect(child.id, path));
    });
    path.delete(storylineId);

    memo.set(storylineId, descendants);
    return descendants;
  };

  storylines.forEach((storyline) => {
    collect(storyline.id, new Set<string>());
  });

  return memo;
};

export const buildAnchorsByStorylineId = (
  storylines: Storyline[],
  plotAnchors: PlotAnchor[]
): Map<string, PlotAnchor[]> => {
  const grouped = new Map<string, PlotAnchor[]>();
  storylines.forEach((storyline) => grouped.set(storyline.id, []));

  const sortedAnchors = [...plotAnchors].sort((a, b) => a.position - b.position);
  sortedAnchors.forEach((anchor) => {
    anchor.storylineIds.forEach((storylineId) => {
      const anchors = grouped.get(storylineId);
      if (anchors) {
        anchors.push(anchor);
      }
    });
  });

  return grouped;
};

export const buildStorylineDerivedData = (
  storylines: Storyline[],
  plotAnchors: PlotAnchor[]
): StorylineDerivedData => {
  const storylineById = new Map(storylines.map((storyline) => [storyline.id, storyline] as const));
  const childrenByParentId = buildChildrenByParentId(storylines);
  const parentByStorylineId = buildParentByStorylineId(storylines);
  const descendantsByStorylineId = buildDescendantsByStorylineId(storylines, childrenByParentId);
  const anchorsByStorylineId = buildAnchorsByStorylineId(storylines, plotAnchors);
  const anchorCountByStorylineId = new Map<string, number>();

  storylines.forEach((storyline) => {
    anchorCountByStorylineId.set(storyline.id, anchorsByStorylineId.get(storyline.id)?.length || 0);
  });

  return {
    storylineById,
    childrenByParentId,
    parentByStorylineId,
    descendantsByStorylineId,
    anchorsByStorylineId,
    anchorCountByStorylineId,
  };
};

export const getDefaultCollapsedStorylineIds = (
  storylines: Storyline[],
  childrenByParentId: Map<string | null, Storyline[]>,
  parentByStorylineId: Map<string, string | null>,
  activeStorylineId: string | null = null
): Set<string> => {
  const collapsed = new Set<string>();
  const activePath = new Set<string>([
    ...(activeStorylineId ? [activeStorylineId] : []),
    ...collectAncestorStorylineIds(activeStorylineId, parentByStorylineId),
  ]);

  storylines.forEach((storyline) => {
    const hasChildren = (childrenByParentId.get(storyline.id) || []).length > 0;
    if (hasChildren && !activePath.has(storyline.id)) {
      collapsed.add(storyline.id);
    }
  });

  return collapsed;
};

export const flattenStorylineRows = ({
  childrenByParentId,
  collapsedStorylineIds,
  visibleStorylineIds = null,
  forceExpand = false,
}: {
  childrenByParentId: Map<string | null, Storyline[]>;
  collapsedStorylineIds: Set<string>;
  visibleStorylineIds?: Set<string> | null;
  forceExpand?: boolean;
}): FlattenedStorylineRow[] => {
  const rows: FlattenedStorylineRow[] = [];

  const walk = (parentId: string | null, level: number) => {
    const currentLevelStorylines = childrenByParentId.get(parentId) || [];
    currentLevelStorylines.forEach((storyline) => {
      if (visibleStorylineIds && !visibleStorylineIds.has(storyline.id)) {
        return;
      }

      const children = childrenByParentId.get(storyline.id) || [];
      const visibleChildren = visibleStorylineIds
        ? children.filter((child) => visibleStorylineIds.has(child.id))
        : children;
      const hasVisibleChildren = visibleChildren.length > 0;
      const isCollapsed = forceExpand ? false : collapsedStorylineIds.has(storyline.id);

      rows.push({
        storyline,
        level,
        hasChildren: children.length > 0,
        hasVisibleChildren,
        isCollapsed,
      });

      if (!isCollapsed && hasVisibleChildren) {
        walk(storyline.id, level + 1);
      }
    });
  };

  walk(null, 0);
  return rows;
};

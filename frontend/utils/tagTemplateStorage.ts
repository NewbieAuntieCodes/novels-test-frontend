import type { TagTemplate, TagTemplateDefinition } from '../types';

const STORAGE_KEY = 'novel_tag_templates_v1';

const isString = (value: unknown): value is string => typeof value === 'string';

const normalizeDefinitions = (raw: unknown): TagTemplateDefinition[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .filter((item) => isString(item.name) && isString(item.color))
    .map((item) => ({
      name: String(item.name),
      color: String(item.color),
      parentName: isString(item.parentName) ? String(item.parentName) : undefined,
    }));
};

const normalizeTemplates = (raw: unknown): TagTemplate[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .filter((item) => isString(item.genre))
    .map((item) => ({
      genre: String(item.genre),
      tags: normalizeDefinitions(item.tags),
    }))
    .filter((tpl) => tpl.genre.trim() !== '' && tpl.tags.length > 0);
};

export const loadTagTemplates = (fallback: TagTemplate[]): TagTemplate[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    const stored = normalizeTemplates(parsed);
    if (stored.length === 0) return fallback;

    // Merge: keep fallback order, replace/override by stored templates with same genre.
    const byGenre = new Map<string, TagTemplate>();
    fallback.forEach((t) => byGenre.set(t.genre, t));
    stored.forEach((t) => byGenre.set(t.genre, t));

    const result: TagTemplate[] = [];
    const seen = new Set<string>();
    for (const base of fallback) {
      const next = byGenre.get(base.genre);
      if (next) {
        result.push(next);
        seen.add(base.genre);
      }
    }
    for (const t of stored) {
      if (seen.has(t.genre)) continue;
      result.push(t);
      seen.add(t.genre);
    }
    return result;
  } catch {
    return fallback;
  }
};

export const saveTagTemplates = (templates: TagTemplate[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch {
    // ignore (storage quota, private mode, etc.)
  }
};


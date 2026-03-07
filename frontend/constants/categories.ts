// 小说分类常量配置

export interface CategoryConfig {
  [key: string]: string[];
}

export const NOVEL_CATEGORIES: CategoryConfig = {
  '男频小说': ['都市高武', '传统仙侠', '东方玄幻', '玄幻脑洞'],
  '女频小说': ['校园青春', '豪门总裁', '职场言情', '古代言情', '现言脑洞'],
  '电影': [],
  '电视剧': [],
  '工具书': [],
};

export const MAIN_CATEGORIES = Object.keys(NOVEL_CATEGORIES);

export const normalizeMainCategory = (category?: string | null): string | null => {
  if (!category) return category ?? null;
  const value = category.trim();
  if (value === '电影剧本') return '电影';
  if (value === '电视剧剧本' || value === '电视剧台词') return '电视剧';
  return value;
};

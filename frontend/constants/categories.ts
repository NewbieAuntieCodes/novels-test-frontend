// 小说分类常量配置

export interface CategoryConfig {
  [key: string]: string[];
}

export const NOVEL_CATEGORIES: CategoryConfig = {
  '男频小说': ['都市高武', '传统仙侠', '东方玄幻', '玄幻脑洞'],
  '女频小说': ['校园青春', '豪门总裁', '职场言情', '古代言情', '现言脑洞'],
  '电视剧台词': [],
  '电影剧本': [],
};

export const MAIN_CATEGORIES = Object.keys(NOVEL_CATEGORIES);

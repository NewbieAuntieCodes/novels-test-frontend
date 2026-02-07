export interface User {
  id: string;
  username: string;
  // passwordHash?: string; // In a real app
}

export interface Chapter {
  id: string;
  title: string;
  content: string;
  htmlContent?: string; // 笔记模式下的富文本HTML（content 仍保存纯文本以兼容索引/检索）
  originalStartIndex: number;
  originalEndIndex: number;
  level?: number; // H1=1, H2=2, H3=3, H4=4, H5=5, 未设置默认为5
}

export interface Tag {
  id:string;
  name: string;
  color: string;
  parentId: string | null;
  novelId: string | null; // 🆕 标签属于特定小说（null表示全局标签，如"待标注"）
  userId: string; // Associated user
  placementType?: 'tag' | 'term'; // 标签树/词条树（默认 tag）
}

export interface Annotation {
  id: string;
  tagIds: string[];
  text: string;
  startIndex: number;
  endIndex: number;
  novelId: string;
  userId: string; // Associated user
  isPotentiallyMisaligned?: boolean; // Added to flag potentially misaligned annotations
}

export interface TagNote {
  id: string;
  tagId?: string;
  tagKey: string;
  tagName: string;
  content: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoteFolder {
  id: string;
  name: string;
  parentId: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  title: string;
  titleKey: string;
  content: string;
  folderId: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export type ReferenceScope = 'reality' | 'work' | 'setting';
export type ReferenceSourceType = 'web' | 'ai' | 'note' | 'novel' | 'unknown';

export interface ReferenceEntry {
  id: string;
  title: string;
  content: string;
  scope: ReferenceScope;
  tagIds: string[];
  novelId: string | null;
  userId: string;
  sourceType?: ReferenceSourceType;
  sourceUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export type ReferenceLinkSourceType = 'tag' | 'novel';

export interface ReferenceLink {
  id: string;
  sourceType: ReferenceLinkSourceType;
  sourceKey: string;
  referenceEntryId: string;
  userId: string;
  createdAt: string;
}

export interface Storyline {
  id: string;
  name: string;
  color: string;
  parentId: string | null;
}

export interface PlotAnchor {
  id: string;
  position: number; // Index in the full novel text
  description: string;
  storylineIds: string[];
  isPending?: boolean; // True if this is a pending anchor (待归类锚点)
}

export interface Novel {
  id: string;
  title: string;
  author?: string | null; // 作者名称
  text: string;
  chapters?: Chapter[];
  noteChapters?: Chapter[]; // 笔记工作区的章节（与正文分离）
  userId: string; // Associated user
  storylines?: Storyline[];
  plotAnchors?: PlotAnchor[];
  category?: string | null; // 大分类：男频小说、女频小说、电影、电视剧、工具书
  subcategory?: string | null; // 子分类：用户自定义
  projectMode?: 'tag' | 'note'; // 默认工作区：标签/笔记（项目同时支持两套工作区）
  createdAt?: string;
  updatedAt?: string;
}

export interface SelectionDetails {
  text: string;
  startIndex: number;
  endIndex: number;
  annotationId?: string; // 如果选区来自 snippet，则包含原始标注 ID
}

// 多段选区支持
export interface MultiSegmentSelection {
  segments: SelectionDetails[];
  isMultiSegment: boolean;
}

// Interfaces for Tag Templates, moved from tagTemplates.ts for global access
export interface TagTemplateDefinition {
  name: string;
  color: string;
  parentName?: string;
}

export interface TagTemplate {
  genre: string;
  tags: TagTemplateDefinition[];
}

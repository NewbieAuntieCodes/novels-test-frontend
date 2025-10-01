export interface User {
  id: string;
  username: string;
  // passwordHash?: string; // In a real app
}

export interface Chapter {
  id: string;
  title: string;
  content: string;
  originalStartIndex: number;
  originalEndIndex: number;
}

export interface Tag {
  id:string;
  name: string;
  color: string;
  parentId: string | null;
  // novelId: string; // REMOVED - Tags are global per user
  userId: string; // Associated user
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
}

export interface Novel {
  id: string;
  title: string;
  text: string;
  chapters?: Chapter[];
  userId: string; // Associated user
  storylines?: Storyline[];
  plotAnchors?: PlotAnchor[];
}

export interface SelectionDetails {
  text: string;
  startIndex: number;
  endIndex: number;
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
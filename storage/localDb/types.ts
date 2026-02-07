import type { Annotation, Novel, Note, NoteFolder, ReferenceEntry, ReferenceLink, TagNote } from '../../types';
import type { TagPlacement } from '../../api/tagPlacements';

export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface TagDefinition {
  id: string;
  name: string;
  color: string;
  userId: string;
  createdAt: string;
}

export interface BackupPayload {
  version: number;
  exportedAt: string;
  exportScope?: 'user' | 'novel';
  exportedNovelId?: string;
  user: { id: string; username: string };
  novels: Novel[];
  annotations: Annotation[];
  tagDefinitions: TagDefinition[];
  tagPlacements: TagPlacement[];
  referenceEntries: ReferenceEntry[];
  tagNotes: TagNote[];
  referenceLinks: ReferenceLink[];
  noteFolders?: NoteFolder[];
  notes?: Note[];
}


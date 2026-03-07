import type { Note, NoteFolder, TagNote } from '../types';
import { generateId, normalizeNoteTitleKey } from '../utils';
import { TokenManager } from './config';
import {
  deleteNote,
  deleteNoteFolder,
  deleteTagNote,
  getNoteById,
  getNoteFolderById,
  listNoteFolders,
  listNotes,
  listTagNotes,
  saveNote,
  saveNoteFolder,
} from '../storage/localDb';

const requireUserId = (): string => {
  const userId = TokenManager.getUserId();
  if (!userId) throw new Error('请先登录');
  return userId;
};

const buildMigratedNoteId = (tagNoteId: string) => `tagNote:${tagNoteId}`;

const migrateSingleTagNote = async (userId: string, legacy: TagNote): Promise<void> => {
  const title = (legacy.tagName || legacy.tagKey || '').trim() || '未命名词条';
  const titleKey = normalizeNoteTitleKey(title);
  if (!titleKey) return;

  const id = buildMigratedNoteId(legacy.id);
  const existing = await getNoteById(id);
  const now = new Date().toISOString();

  const next: Note = existing
    ? {
        ...existing,
        title,
        titleKey,
        content: legacy.content || existing.content || '',
        updatedAt: legacy.updatedAt || existing.updatedAt || now,
      }
    : {
        id,
        userId,
        title,
        titleKey,
        content: legacy.content || '',
        folderId: null,
        createdAt: legacy.createdAt || now,
        updatedAt: legacy.updatedAt || now,
      };

  await saveNote(next);
  await deleteTagNote(legacy.id);
};

const migrateLegacyTagNotesToNotes = async (userId: string): Promise<void> => {
  const legacyNotes = await listTagNotes(userId);
  if (legacyNotes.length === 0) return;

  for (const legacy of legacyNotes) {
    await migrateSingleTagNote(userId, legacy);
  }
};

const migrationPromises = new Map<string, Promise<void>>();

const ensureLegacyMigrated = async (userId: string): Promise<void> => {
  const existing = migrationPromises.get(userId);
  if (existing) return existing;

  const task = (async () => {
    await migrateLegacyTagNotesToNotes(userId);
  })();

  migrationPromises.set(userId, task);
  try {
    await task;
  } catch (err) {
    migrationPromises.delete(userId);
    throw err;
  }
};

export const notesApi = {
  async listFolders(): Promise<NoteFolder[]> {
    const userId = requireUserId();
    await ensureLegacyMigrated(userId);
    return listNoteFolders(userId);
  },

  async createFolder(data: { name: string; parentId?: string | null }): Promise<NoteFolder> {
    const userId = requireUserId();
    const now = new Date().toISOString();
    const name = (data.name || '').trim();
    if (!name) throw new Error('文件夹名称不能为空');

    const folder: NoteFolder = {
      id: crypto.randomUUID?.() ?? generateId(),
      userId,
      name,
      parentId: data.parentId ?? null,
      createdAt: now,
      updatedAt: now,
    };

    await saveNoteFolder(folder);
    return folder;
  },

  async updateFolder(id: string, patch: Partial<Pick<NoteFolder, 'name' | 'parentId'>>): Promise<NoteFolder> {
    const userId = requireUserId();
    const existing = await getNoteFolderById(id);
    if (!existing || existing.userId !== userId) {
      throw new Error('文件夹不存在');
    }

    const next: NoteFolder = {
      ...existing,
      name: patch.name !== undefined ? patch.name.trim() : existing.name,
      parentId: patch.parentId !== undefined ? patch.parentId : existing.parentId,
      updatedAt: new Date().toISOString(),
    };

    if (!next.name) throw new Error('文件夹名称不能为空');

    if (next.parentId === id) {
      throw new Error('无法将文件夹移动到自身下');
    }

    if (patch.parentId !== undefined && patch.parentId !== existing.parentId) {
      if (next.parentId !== null) {
        const parent = await getNoteFolderById(next.parentId);
        if (!parent || parent.userId !== userId) {
          throw new Error('目标父文件夹不存在');
        }
      }

      const allFolders = await listNoteFolders(userId);
      const parentById = new Map(allFolders.map((f) => [f.id, f.parentId] as const));
      const visited = new Set<string>();
      let currentId: string | null | undefined = next.parentId;
      while (currentId) {
        if (currentId === id) {
          throw new Error('无法将文件夹移动到其子文件夹下');
        }
        if (visited.has(currentId)) break;
        visited.add(currentId);
        currentId = parentById.get(currentId) ?? null;
      }
    }

    await saveNoteFolder(next);
    return next;
  },

  async deleteFolder(id: string): Promise<void> {
    const userId = requireUserId();
    const existing = await getNoteFolderById(id);
    if (!existing || existing.userId !== userId) {
      throw new Error('文件夹不存在');
    }
    await deleteNoteFolder(id);
  },

  async listNotes(): Promise<Note[]> {
    const userId = requireUserId();
    await ensureLegacyMigrated(userId);
    return listNotes(userId);
  },

  async createNote(data: { title: string; content?: string; folderId?: string | null }): Promise<Note> {
    const userId = requireUserId();
    const title = (data.title || '').trim();
    if (!title) throw new Error('标题不能为空');

    const titleKey = normalizeNoteTitleKey(title);
    if (!titleKey) throw new Error('标题不能为空');

    const now = new Date().toISOString();
    const note: Note = {
      id: crypto.randomUUID?.() ?? generateId(),
      userId,
      title,
      titleKey,
      content: data.content || '',
      folderId: data.folderId ?? null,
      createdAt: now,
      updatedAt: now,
    };

    await saveNote(note);
    return note;
  },

  async updateNote(id: string, patch: Partial<Pick<Note, 'title' | 'content' | 'folderId'>>): Promise<Note> {
    const userId = requireUserId();
    const existing = await getNoteById(id);
    if (!existing || existing.userId !== userId) {
      throw new Error('笔记不存在');
    }

    const nextTitle = patch.title !== undefined ? patch.title.trim() : existing.title;
    const nextTitleKey = normalizeNoteTitleKey(nextTitle);
    if (!nextTitleKey) throw new Error('标题不能为空');

    const next: Note = {
      ...existing,
      title: nextTitle,
      titleKey: nextTitleKey,
      content: patch.content !== undefined ? patch.content : existing.content,
      folderId: patch.folderId !== undefined ? patch.folderId : existing.folderId,
      updatedAt: new Date().toISOString(),
    };

    await saveNote(next);
    return next;
  },

  async deleteNote(id: string): Promise<void> {
    const userId = requireUserId();
    const existing = await getNoteById(id);
    if (!existing || existing.userId !== userId) {
      throw new Error('笔记不存在');
    }
    await deleteNote(id);
  },
};

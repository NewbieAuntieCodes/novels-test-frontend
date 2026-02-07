export type NovelBackupMeta = {
  lastModifiedAt: string | null;
  lastExportAt: string | null;
};

const STORAGE_PREFIX = 'novelBackupMeta';
export const NOVEL_BACKUP_META_CHANGED_EVENT = 'novelBackupMetaChanged';

const makeKey = (userId: string, novelId: string): string => `${STORAGE_PREFIX}:${userId}:${novelId}`;

const parseIsoMs = (value: string | null | undefined): number => {
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
};

const readMeta = (userId: string, novelId: string): NovelBackupMeta => {
  const key = makeKey(userId, novelId);
  const raw = localStorage.getItem(key);
  if (!raw) return { lastExportAt: null, lastModifiedAt: null };
  try {
    const parsed = JSON.parse(raw) as Partial<NovelBackupMeta> | null;
    return {
      lastExportAt: typeof parsed?.lastExportAt === 'string' ? parsed.lastExportAt : null,
      lastModifiedAt: typeof parsed?.lastModifiedAt === 'string' ? parsed.lastModifiedAt : null,
    };
  } catch {
    return { lastExportAt: null, lastModifiedAt: null };
  }
};

const writeMeta = (userId: string, novelId: string, next: NovelBackupMeta): void => {
  const key = makeKey(userId, novelId);
  localStorage.setItem(key, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(NOVEL_BACKUP_META_CHANGED_EVENT, { detail: { novelId } }));
};

export const getNovelBackupMeta = (userId: string, novelId: string): NovelBackupMeta => readMeta(userId, novelId);

export const clearNovelBackupMeta = (userId: string, novelId: string): void => {
  localStorage.removeItem(makeKey(userId, novelId));
  window.dispatchEvent(new CustomEvent(NOVEL_BACKUP_META_CHANGED_EVENT, { detail: { novelId } }));
};

export const markNovelModified = (userId: string, novelId: string, atIso = new Date().toISOString()): void => {
  const prev = readMeta(userId, novelId);
  writeMeta(userId, novelId, { ...prev, lastModifiedAt: atIso });
};

export const markNovelExported = (userId: string, novelId: string, atIso = new Date().toISOString()): void => {
  const prev = readMeta(userId, novelId);
  writeMeta(userId, novelId, { ...prev, lastExportAt: atIso });
};

export const getNovelBackupBadgeLabel = (userId: string, novelId: string): '未备份' | '更新' | null => {
  const meta = readMeta(userId, novelId);
  const exportMs = parseIsoMs(meta.lastExportAt);
  if (exportMs <= 0) return '未备份';
  const modifiedMs = parseIsoMs(meta.lastModifiedAt);
  if (modifiedMs <= 0) return null;
  return modifiedMs > exportMs ? '更新' : null;
};


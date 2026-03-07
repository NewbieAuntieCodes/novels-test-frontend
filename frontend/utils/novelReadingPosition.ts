export type NovelReadingPosition = {
  chapterId: string | null;
  scrollRatio: number;
  updatedAt: string;
};

const STORAGE_PREFIX = 'novelReadingPosition';

const buildKey = (userId: string, novelId: string) => `${STORAGE_PREFIX}:${userId}:${novelId}`;

const clampRatio = (value: number) => Math.max(0, Math.min(1, value));

export const getNovelReadingPosition = (userId: string, novelId: string): NovelReadingPosition | null => {
  try {
    const raw = localStorage.getItem(buildKey(userId, novelId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const chapterId =
      'chapterId' in parsed && typeof (parsed as { chapterId?: unknown }).chapterId === 'string'
        ? ((parsed as { chapterId?: string }).chapterId ?? null)
        : null;

    const scrollRatioValue = 'scrollRatio' in parsed ? (parsed as { scrollRatio?: unknown }).scrollRatio : undefined;
    if (typeof scrollRatioValue !== 'number' || Number.isNaN(scrollRatioValue)) return null;

    const updatedAtValue = 'updatedAt' in parsed ? (parsed as { updatedAt?: unknown }).updatedAt : undefined;
    const updatedAt = typeof updatedAtValue === 'string' ? updatedAtValue : new Date().toISOString();

    return {
      chapterId,
      scrollRatio: clampRatio(scrollRatioValue),
      updatedAt,
    };
  } catch {
    return null;
  }
};

export const setNovelReadingPosition = (
  userId: string,
  novelId: string,
  position: { chapterId: string | null; scrollRatio: number; updatedAt?: string }
): void => {
  try {
    localStorage.setItem(
      buildKey(userId, novelId),
      JSON.stringify({
        chapterId: position.chapterId,
        scrollRatio: clampRatio(position.scrollRatio),
        updatedAt: position.updatedAt ?? new Date().toISOString(),
      })
    );
  } catch {
    // ignore quota / private mode
  }
};


/**
 * LRU（最近最少使用）缓存实现
 * 用于控制小说数据缓存的容量，避免内存无限膨胀
 */
export class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, V>;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.cache = new Map();
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }
    // 更新访问顺序：删除后重新插入，使其成为最新的
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    // 如果已存在，先删除旧的
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    // 如果超过容量，删除最旧的（Map 的第一个元素）
    else if (this.cache.size >= this.capacity) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    // 插入新值（作为最新的）
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

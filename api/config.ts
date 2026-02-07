// 本地模式 Token 管理（仅用于标记当前登录用户）
const TOKEN_KEY = 'authToken';
const USER_ID_KEY = 'authUserId';

export const TokenManager = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string, userId?: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    if (userId) {
      localStorage.setItem(USER_ID_KEY, userId);
    }
  },

  getUserId(): string | null {
    return localStorage.getItem(USER_ID_KEY);
  },

  setUserId(userId: string): void {
    localStorage.setItem(USER_ID_KEY, userId);
  },

  removeToken(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_ID_KEY);
  }
};

// 由于切换为本地 IndexedDB 存储，不再使用远程请求
export async function apiRequest<T>(): Promise<T> {
  throw new Error('本地模式下不支持直接发起 API 请求');
}

// 本地认证（IndexedDB）
import { TokenManager } from './config';
import { generateId } from '../utils';
import { getUserByUsername, getUserById, saveUser } from '../storage/localDb';

interface AuthResponse {
  token: string;
  user: {
    id: string;
    username: string;
  };
}

const hashPassword = async (password: string): Promise<string> => {
  if (window.crypto?.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return btoa(password);
};

export const authApi = {
  // 注册
  async register(username: string, password: string): Promise<AuthResponse> {
    const existing = await getUserByUsername(username);
    if (existing) {
      throw new Error('用户名已存在');
    }

    const passwordHash = await hashPassword(password);
    const user = await saveUser({
      id: generateId(),
      username,
      passwordHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const token = generateId();
    TokenManager.setToken(token, user.id);

    return {
      token,
      user: { id: user.id, username: user.username },
    };
  },

  // 登录
  async login(username: string, password: string): Promise<AuthResponse> {
    const existing = await getUserByUsername(username);
    if (!existing) {
      throw new Error('用户不存在');
    }

    const passwordHash = await hashPassword(password);
    if (existing.passwordHash !== passwordHash) {
      throw new Error('密码错误');
    }

    const token = generateId();
    TokenManager.setToken(token, existing.id);

    return {
      token,
      user: { id: existing.id, username: existing.username },
    };
  },

  // 用于自动登录（TokenManager 中存有 userId）
  async getUserFromSession(): Promise<AuthResponse | null> {
    const userId = TokenManager.getUserId();
    if (!userId) return null;
    const user = await getUserById(userId);
    if (!user) return null;

    const token = TokenManager.getToken() || generateId();
    TokenManager.setToken(token, user.id);
    return { token, user: { id: user.id, username: user.username } };
  },
};

// 认证相关 API
import { apiRequest } from './config';

interface AuthResponse {
  token: string;
  user: {
    id: string;
    username: string;
  };
}

export const authApi = {
  // 注册
  async register(username: string, password: string): Promise<AuthResponse> {
    return apiRequest<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  // 登录
  async login(username: string, password: string): Promise<AuthResponse> {
    return apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },
};

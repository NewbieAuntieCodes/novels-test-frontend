// 前端共享的类型定义
export interface Chapter {
  id: string;
  title: string;
  content: string;
  originalStartIndex: number;
  originalEndIndex: number;
}

export interface Storyline {
  id: string;
  name: string;
  color: string;
  parentId: string | null;
}

export interface PlotAnchor {
  id: string;
  position: number;
  description: string;
  storylineIds: string[];
}

// 请求和响应类型
export interface RegisterRequest {
  username: string;
  password: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    username: string;
  };
}

export interface CreateNovelRequest {
  title: string;
  text: string;
  chapters?: Chapter[];
  storylines?: Storyline[];
  plotAnchors?: PlotAnchor[];
}

export interface UpdateNovelRequest {
  title?: string;
  text?: string;
  chapters?: Chapter[];
  storylines?: Storyline[];
  plotAnchors?: PlotAnchor[];
}

export interface CreateTagRequest {
  name: string;
  color: string;
  parentId?: string | null;
}

export interface UpdateTagRequest {
  name?: string;
  color?: string;
  parentId?: string | null;
}

export interface CreateAnnotationRequest {
  novelId: string;
  text: string;
  startIndex: number;
  endIndex: number;
  tagIds: string[];
  isPotentiallyMisaligned?: boolean;
}

export interface UpdateAnnotationRequest {
  text?: string;
  startIndex?: number;
  endIndex?: number;
  tagIds?: string[];
  isPotentiallyMisaligned?: boolean;
}

// JWT Payload
export interface JwtPayload {
  id: string;
  username: string;
}

// Express Request 扩展
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

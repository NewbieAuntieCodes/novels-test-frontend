# 小说标注工具 - 后端开发文档

## 1. 技术栈

- **运行时**: Node.js 18+
- **框架**: Express.js
- **ORM**: Prisma
- **数据库**: PostgreSQL
- **认证**: JWT (jsonwebtoken + bcrypt)
- **语言**: TypeScript
- **开发工具**: ts-node-dev (热重载)

---

## 2. 项目结构

```
backend/
├── prisma/
│   └── schema.prisma          # 数据库模型定义
├── src/
│   ├── controllers/           # 控制器层
│   │   ├── authController.ts
│   │   ├── novelController.ts
│   │   ├── tagController.ts
│   │   └── annotationController.ts
│   ├── middleware/            # 中间件
│   │   ├── auth.ts            # JWT 验证
│   │   └── errorHandler.ts   # 错误处理
│   ├── routes/                # 路由定义
│   │   ├── auth.ts
│   │   ├── novels.ts
│   │   ├── tags.ts
│   │   └── annotations.ts
│   ├── types/                 # 类型定义
│   │   └── index.ts
│   ├── utils/                 # 工具函数
│   │   └── textProcessor.ts  # 文本处理
│   └── index.ts               # 入口文件
├── .env                       # 环境变量
├── package.json
└── tsconfig.json
```

---

## 3. 数据库设计 (Prisma Schema)

### 核心表结构

#### User (用户表)
```prisma
model User {
  id          String       @id @default(uuid())
  username    String       @unique
  password    String       // bcrypt 加密
  createdAt   DateTime     @default(now())
  novels      Novel[]
  tags        Tag[]
  annotations Annotation[]
}
```

#### Novel (小说表)
```prisma
model Novel {
  id          String       @id @default(uuid())
  title       String
  text        String       @db.Text
  chapters    Json?        // Chapter[] 存储为 JSON
  storylines  Json?        // Storyline[] 存储为 JSON
  plotAnchors Json?        // PlotAnchor[] 存储为 JSON
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  userId      String
  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  annotations Annotation[]
}
```

#### Tag (标签表)
```prisma
model Tag {
  id        String   @id @default(uuid())
  name      String
  color     String
  parentId  String?
  userId    String
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  parent    Tag?     @relation("TagHierarchy", fields: [parentId], references: [id])
  children  Tag[]    @relation("TagHierarchy")
  annotations AnnotationTag[]

  @@unique([userId, name]) // 同一用户不能有重名标签
}
```

#### Annotation (标注表)
```prisma
model Annotation {
  id                      String          @id @default(uuid())
  text                    String
  startIndex              Int
  endIndex                Int
  isPotentiallyMisaligned Boolean         @default(false)
  createdAt               DateTime        @default(now())
  novelId                 String
  userId                  String
  novel                   Novel           @relation(fields: [novelId], references: [id], onDelete: Cascade)
  user                    User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  tags                    AnnotationTag[]
}
```

#### AnnotationTag (标注-标签关联表)
```prisma
model AnnotationTag {
  annotationId String
  tagId        String
  annotation   Annotation @relation(fields: [annotationId], references: [id], onDelete: Cascade)
  tag          Tag        @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([annotationId, tagId])
}
```

---

## 4. API 接口设计

### 4.1 认证接口

#### POST /api/auth/register
注册新用户
```json
// Request
{
  "username": "user123",
  "password": "password123"
}

// Response
{
  "message": "注册成功"
}
```

#### POST /api/auth/login
用户登录
```json
// Request
{
  "username": "user123",
  "password": "password123"
}

// Response
{
  "token": "jwt_token_here",
  "user": {
    "id": "uuid",
    "username": "user123"
  }
}
```

---

### 4.2 小说接口

#### GET /api/novels
获取当前用户所有小说
```json
// Response
[
  {
    "id": "uuid",
    "title": "我的小说",
    "text": "小说内容...",
    "chapters": [...],
    "storylines": [...],
    "plotAnchors": [...],
    "createdAt": "2025-01-01T00:00:00Z"
  }
]
```

#### POST /api/novels
创建新小说
```json
// Request
{
  "title": "新小说",
  "text": "小说内容...",
  "chapters": [...],
  "storylines": [],
  "plotAnchors": []
}

// Response
{
  "id": "uuid",
  "title": "新小说",
  ...
}
```

#### PUT /api/novels/:id
更新小说
```json
// Request
{
  "title": "更新后的标题",
  "text": "更新后的内容",
  "chapters": [...],
  "storylines": [...],
  "plotAnchors": [...]
}
```

#### DELETE /api/novels/:id
删除小说（级联删除所有标注）

---

### 4.3 标签接口

#### GET /api/tags
获取当前用户所有标签
```json
// Response
[
  {
    "id": "uuid",
    "name": "角色",
    "color": "#FF5733",
    "parentId": null,
    "children": [...]
  }
]
```

#### POST /api/tags
创建标签
```json
// Request
{
  "name": "新标签",
  "color": "#FF5733",
  "parentId": null
}
```

#### PUT /api/tags/:id
更新标签
```json
// Request
{
  "name": "更新后的名称",
  "color": "#00FF00",
  "parentId": "parent_uuid"
}
```

#### DELETE /api/tags/:id
删除标签

---

### 4.4 标注接口

#### GET /api/annotations
获取当前用户所有标注（可按 novelId 或 tagId 筛选）
```
Query: ?novelId=uuid&tagId=uuid
```

#### POST /api/annotations
创建标注
```json
// Request
{
  "novelId": "uuid",
  "text": "标注的文本",
  "startIndex": 100,
  "endIndex": 150,
  "tagIds": ["tag_uuid_1", "tag_uuid_2"]
}
```

#### PUT /api/annotations/:id
更新标注
```json
// Request
{
  "text": "更新后的文本",
  "startIndex": 100,
  "endIndex": 150,
  "tagIds": ["tag_uuid_1"],
  "isPotentiallyMisaligned": false
}
```

#### DELETE /api/annotations/:id
删除标注

#### GET /api/annotations/search
全局搜索标注
```
Query: ?keyword=关键词
```

---

## 5. 中间件设计

### 5.1 认证中间件 (auth.ts)
```typescript
export const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '未登录' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id: 'uuid', username: 'xxx' }
    next();
  } catch (error) {
    res.status(401).json({ error: '无效的 token' });
  }
};
```

### 5.2 错误处理中间件 (errorHandler.ts)
```typescript
export const errorHandler = (err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: '服务器错误',
    message: err.message
  });
};
```

---

## 6. 开发步骤

### 阶段 1: 项目初始化 (Day 1)
1. ✅ 创建 backend 目录
2. ✅ 初始化 package.json
3. ✅ 安装依赖
4. ✅ 配置 TypeScript
5. ✅ 配置 Prisma
6. ✅ 创建数据库
7. ✅ 编写 Prisma Schema
8. ✅ 生成 Prisma Client

### 阶段 2: 基础框架搭建 (Day 1-2)
1. ✅ 创建 Express 服务器
2. ✅ 配置 CORS
3. ✅ 编写认证中间件
4. ✅ 编写错误处理中间件
5. ✅ 测试服务器启动

### 阶段 3: 用户认证功能 (Day 2)
1. ✅ 实现注册接口
2. ✅ 实现登录接口
3. ✅ 测试 JWT 生成和验证

### 阶段 4: 小说管理功能 (Day 2-3)
1. ✅ 实现创建小说
2. ✅ 实现获取小说列表
3. ✅ 实现更新小说
4. ✅ 实现删除小说
5. ✅ 测试所有接口

### 阶段 5: 标签管理功能 (Day 3)
1. ✅ 实现创建标签
2. ✅ 实现获取标签列表
3. ✅ 实现更新标签
4. ✅ 实现删除标签
5. ✅ 处理层级关系

### 阶段 6: 标注管理功能 (Day 3-4)
1. ✅ 实现创建标注
2. ✅ 实现获取标注列表
3. ✅ 实现标注筛选
4. ✅ 实现更新标注
5. ✅ 实现删除标注
6. ✅ 实现全局搜索

### 阶段 7: 前后端联调 (Day 4)
1. ✅ 修改前端 API 调用
2. ✅ 测试注册登录流程
3. ✅ 测试小说 CRUD
4. ✅ 测试标签 CRUD
5. ✅ 测试标注 CRUD
6. ✅ 测试全局搜索

### 阶段 8: 部署准备 (Day 4)
1. ✅ 配置生产环境变量
2. ✅ 测试构建
3. ✅ 编写启动脚本

---

## 7. 环境变量配置 (.env)

```env
DATABASE_URL="postgresql://username:password@localhost:5432/novel_tool"
JWT_SECRET="your-super-secret-key-change-in-production"
PORT=3001
NODE_ENV=development
```

---

## 8. 依赖包清单

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "jsonwebtoken": "^9.0.2",
    "bcrypt": "^5.1.1",
    "@prisma/client": "^5.8.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/bcrypt": "^5.0.2",
    "@types/node": "^20.10.6",
    "typescript": "^5.3.3",
    "ts-node-dev": "^2.0.0",
    "prisma": "^5.8.0"
  }
}
```

---

## 9. 注意事项

### 9.1 数据安全
- ✅ 密码必须使用 bcrypt 加密（salt rounds = 10）
- ✅ JWT Secret 必须使用强随机字符串
- ✅ 生产环境必须使用 HTTPS

### 9.2 数据完整性
- ✅ 使用 Prisma 的 onDelete: Cascade 确保级联删除
- ✅ 所有文本输入必须标准化换行符为 `\n`
- ✅ 标注的 startIndex/endIndex 必须严格验证

### 9.3 性能优化
- ✅ 对常用查询添加数据库索引
- ✅ 大文本使用 @db.Text 类型
- ✅ 分页查询避免一次性返回过多数据

### 9.4 错误处理
- ✅ 所有 async 函数必须包裹 try-catch
- ✅ 返回用户友好的错误信息
- ✅ 记录详细的服务器日志

---

## 10. 测试清单

### 手动测试（使用 Postman）
- [ ] 注册新用户
- [ ] 登录获取 token
- [ ] 使用 token 创建小说
- [ ] 获取小说列表
- [ ] 更新小说内容
- [ ] 创建标签
- [ ] 创建标注
- [ ] 按标签筛选标注
- [ ] 全局搜索标注
- [ ] 删除标注
- [ ] 删除小说（验证级联删除）

### 前端集成测试
- [ ] 前端注册登录流程
- [ ] 前端创建/编辑小说
- [ ] 前端标签管理
- [ ] 前端标注功能
- [ ] 前端全局搜索

---

## 11. 未来扩展功能

### Phase 2 功能
- [ ] 用户头像上传
- [ ] 小说导出（PDF/DOCX）
- [ ] 协作编辑（WebSocket）
- [ ] 版本历史记录

### Phase 3 功能
- [ ] AI 智能标注建议
- [ ] 情感分析
- [ ] 角色关系图谱
- [ ] 数据可视化分析

---

**文档版本**: v1.0
**最后更新**: 2025-10-01
**维护者**: Claude Code

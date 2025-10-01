import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import novelRoutes from './routes/novels';
import tagRoutes from './routes/tags';
import annotationRoutes from './routes/annotations';

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' })); // 支持大文本上传
app.use(express.urlencoded({ extended: true }));

// 健康检查路由
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '小说标注工具后端运行中' });
});

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/novels', novelRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/annotations', annotationRoutes);

// 错误处理中间件（必须放在最后）
app.use(errorHandler);

// 启动服务器
app.listen(PORT, () => {
  console.log(`✅ 服务器运行在 http://localhost:${PORT}`);
  console.log(`📊 健康检查: http://localhost:${PORT}/health`);
});

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('\n👋 正在关闭服务器...');
  process.exit(0);
});

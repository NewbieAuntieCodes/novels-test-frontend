import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getNovels,
  getNovel,
  createNovel,
  updateNovel,
  deleteNovel,
  getChapterContent,
  appendNovelContent,
} from '../controllers/novelController';

const router = Router();

// 所有路由都需要认证
router.use(authenticate);

router.get('/', getNovels);
router.get('/:id', getNovel);
router.get('/:novelId/chapters/:chapterId', getChapterContent); // 🆕 获取章节内容
router.post('/', createNovel);
router.post('/:id/append', appendNovelContent); // 🆕 追加内容
router.put('/:id', updateNovel);
router.delete('/:id', deleteNovel);

export default router;

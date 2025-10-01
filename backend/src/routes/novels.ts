import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getNovels,
  getNovel,
  createNovel,
  updateNovel,
  deleteNovel,
} from '../controllers/novelController';

const router = Router();

// 所有路由都需要认证
router.use(authenticate);

router.get('/', getNovels);
router.get('/:id', getNovel);
router.post('/', createNovel);
router.put('/:id', updateNovel);
router.delete('/:id', deleteNovel);

export default router;

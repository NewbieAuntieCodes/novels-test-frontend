import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getTags,
  createTag,
  updateTag,
  deleteTag,
} from '../controllers/tagController';

const router = Router();

// 所有路由都需要认证
router.use(authenticate);

router.get('/', getTags);
router.post('/', createTag);
router.put('/:id', updateTag);
router.delete('/:id', deleteTag);

export default router;

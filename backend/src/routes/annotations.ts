import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getAnnotations,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
  searchAnnotations,
} from '../controllers/annotationController';

const router = Router();

// 所有路由都需要认证
router.use(authenticate);

router.get('/', getAnnotations);
router.get('/search', searchAnnotations);
router.post('/', createAnnotation);
router.put('/:id', updateAnnotation);
router.delete('/:id', deleteAnnotation);

export default router;

import express from 'express';
import {
  getTagPlacements,
  createTagPlacement,
  createTagWithPlacement,
  updateTagPlacement,
  deleteTagPlacement,
  getDescendantPlacementIds,
} from '../controllers/tagPlacementController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

router.get('/', authenticate, getTagPlacements);
router.post('/', authenticate, createTagPlacement);
router.post('/with-tag', authenticate, createTagWithPlacement);
router.put('/:id', authenticate, updateTagPlacement);
router.delete('/:id', authenticate, deleteTagPlacement);
router.get('/:placementId/descendants', authenticate, getDescendantPlacementIds);

export default router;

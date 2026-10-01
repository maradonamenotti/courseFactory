import { Router } from 'express';
import { 
  getPortals, 
  getPortalById, 
  getPublicPortal, 
  createPortal, 
  updatePortal, 
  deletePortal 
} from '../controllers/portals.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Public / Unauthenticated embed endpoint for Moodle iFrame
router.get('/public/:idOrSlug', getPublicPortal);

// Authenticated admin endpoints
router.get('/', requireAuth, getPortals);
router.get('/:id', requireAuth, getPortalById);
router.post('/', requireAuth, createPortal);
router.put('/:id', requireAuth, updatePortal);
router.delete('/:id', requireAuth, deletePortal);

export default router;

import { Router } from 'express';
import { login, googleLogin, getMe, changePassword } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/login', login);
router.post('/google-login', googleLogin);
router.get('/me', requireAuth, getMe);
router.patch('/change-password', requireAuth, changePassword);

export default router;

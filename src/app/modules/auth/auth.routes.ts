import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
const ctrl = new AuthController();

router.post('/register', ctrl.register);
router.post('/login', ctrl.login);
router.post('/logout', authenticate, ctrl.logout);
router.post('/refresh', ctrl.refresh);

export { router as authRouter };

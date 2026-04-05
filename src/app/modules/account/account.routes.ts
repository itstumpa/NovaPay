import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth';
import { AccountController } from './account.controller';
import { UserRole } from '@prisma/client';

const router = Router();
const ctrl = new AccountController();

router.use(authenticate);

router.get('/me', ctrl.getMyProfile);
router.patch('/me', ctrl.updateMyProfile);
router.get('/wallets', ctrl.getMyWallets);
router.post('/wallets', ctrl.createWallet);
router.get('/wallets/:walletId', ctrl.getWallet);
router.get('/wallets/:walletId/balance', ctrl.getBalance);

router.get('/users', authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN), ctrl.listUsers);
router.get('/users/:userId', authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN), ctrl.getUserById);
router.patch('/users/:userId/status', authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN), ctrl.updateUserStatus);

export { router as accountRouter };

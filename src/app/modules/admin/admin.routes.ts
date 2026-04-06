import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth';
import { AdminController } from './admin.controller';
import { UserRole } from '@prisma/client';

const router = Router();
const ctrl = new AdminController();

router.use(authenticate);
router.use(authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN));

// Users
router.get('/users',  ctrl.listUsers);
router.get('/users/:userId',  ctrl.getUser);

// Transactions
router.get('/transactions', ctrl.listTransactions);
router.get('/transactions/:txId', ctrl.getTransaction);
router.post('/transactions/:txId/reverse', ctrl.reverseTransaction);

// Ledger health
router.get('/ledger/verify', ctrl.verifyLedgerBalance);

// System
router.get('/stats', ctrl.getStats);
router.get('/audit-logs', ctrl.getAuditLogs);

export { router as adminRouter };

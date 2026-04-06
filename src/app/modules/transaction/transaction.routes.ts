import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { idempotency } from '../../middlewares/idempotency';
import { TransactionController } from './transaction.controller';

const router = Router();
const ctrl = new TransactionController();

router.use(authenticate);

// idempotency middleware on transfer — prevents duplicate debits on retry
router.post('/transfer', idempotency, ctrl.transfer);
router.get('/history', ctrl.getHistory);
router.get('/:transactionId', ctrl.getById);

export { router as transactionRouter };

import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth';
import { PayrollController } from './payroll.controller';
import { UserRole } from '@prisma/client';

const router = Router();
const ctrl = new PayrollController();

router.use(authenticate);
router.use(authorize(UserRole.CORPORATE, UserRole.ADMIN, UserRole.SUPER_ADMIN));

router.post('/disburse', ctrl.disburse);
router.get('/jobs/:jobId', ctrl.getJobStatus);

export { router as payrollRouter };

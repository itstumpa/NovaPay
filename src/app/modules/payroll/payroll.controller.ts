import { Request, Response } from 'express';
import { PayrollService } from './payroll.service';
import { sendSuccess, ApiErrors } from '../../../utils/apiResponse';
import  catchAsync  from '../../../utils/catchAsync';
import { Currency } from '@prisma/client';
import { z } from 'zod';

const service = new PayrollService();

const disburseSchema = z.object({
  employerWalletId: z.string().uuid(),
  currency: z.nativeEnum(Currency),
  items: z.array(z.object({
    employeeEmail: z.string().email(),
    amount: z.number().positive(),
  })).min(1).max(10000),
});

export class PayrollController {
  disburse = catchAsync(async (req: Request, res: Response) => {
    const idempotencyKey = req.headers['idempotency-key'] as string;
    if (!idempotencyKey) {
      ApiErrors.VALIDATION(res, 'Idempotency-Key header is required for payroll');
      return;
    }
    const body = disburseSchema.parse(req.body);
    const job = await service.createJob({
      createdById: req.userId!,
      idempotencyKey,
      ...body,
    });
    sendSuccess(res, job, 202); // 202 Accepted — processing async
  });

  getJobStatus = catchAsync(async (req: Request, res: Response) => {
    const job = await service.getJobStatus(req.params.jobId as string, req.userId!);
    if (!job) {
      ApiErrors.NOT_FOUND(res, 'Payroll job');
      return;
    }
    sendSuccess(res, job);
  });
}

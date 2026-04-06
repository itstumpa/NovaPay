import { Request, Response } from 'express';
import { sendSuccess, ApiErrors } from '../../../utils/apiResponse';
import { Currency } from '@prisma/client';
import { z } from 'zod';
import { TransactionService } from './transaction.service';
import catchAsync from '../../../utils/catchAsync';

const service = new TransactionService();

const transferSchema = z.object({
  receiverEmail: z.string().email(),
  amount: z.number().positive().multipleOf(0.01),
  currency: z.nativeEnum(Currency),
});

export class TransactionController {
  transfer = catchAsync(async (req: Request, res: Response) => {
    const body = transferSchema.parse(req.body);
    const result = await service.transfer({
      senderId: req.userId!,
      requestId: req.requestId,
      ...body,
    });
    sendSuccess(res, result, 201);
  });

  getHistory = catchAsync(async (req: Request, res: Response) => {
    const cursor = req.query.cursor as string | undefined;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await service.getHistory(req.userId!, cursor, limit);
    sendSuccess(res, result.items, 200, {
      nextCursor: result.nextCursor,
      hasNextPage: result.hasNextPage,
    });
  });

  getById = catchAsync(async (req: Request, res: Response) => {
    const tx = await service.getById(req.params.transactionId as string, req.userId!);
    if (!tx) {
      ApiErrors.NOT_FOUND(res, 'Transaction');
      return;
    }
    sendSuccess(res, tx);
  });
}

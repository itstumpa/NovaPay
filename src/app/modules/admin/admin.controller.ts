import { Request, Response } from 'express';
import { AdminService } from './admin.service';
import { sendSuccess, ApiErrors } from '../../../utils/apiResponse';
import  catchAsync  from '../../../utils/catchAsync';
import { TransactionStatus, TransactionType, UserRole, UserStatus } from '@prisma/client';
import { z } from 'zod';

const service = new AdminService();

const reverseSchema = z.object({ reason: z.string().min(5) });
const statusSchema = z.object({ status: z.nativeEnum(UserStatus), reason: z.string().optional() });

export class AdminController {
  listUsers = catchAsync(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const role = req.query.role as UserRole | undefined;
    const status = req.query.status as UserStatus | undefined;
    const result = await service.listUsers(page, limit, role, status);
    sendSuccess(res, result.users, 200, { total: result.total, totalPages: result.totalPages, page, limit });
  });

  getUser = catchAsync(async (req: Request, res: Response) => {
    const user = await service.getUser(req.params.userId as string);
    if (!user) ApiErrors.NOT_FOUND(res, 'User');
    sendSuccess(res, user);
    return;
  });

  listTransactions = catchAsync(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const result = await service.listTransactions(page, limit, {
      status: req.query.status as TransactionStatus | undefined,
      type: req.query.type as TransactionType | undefined,
      userId: req.query.userId as string | undefined,
    });
    sendSuccess(res, result.transactions, 200, { total: result.total, totalPages: result.totalPages, page, limit });
  });

  getTransaction = catchAsync(async (req: Request, res: Response) => {
    const tx = await service.getTransaction(req.params.txId as string);
    if (!tx) ApiErrors.NOT_FOUND(res, 'Transaction');
    sendSuccess(res, tx);
    return;
  });

  reverseTransaction = catchAsync(async (req: Request, res: Response) => {
    const { reason } = reverseSchema.parse(req.body);
    const result = await service.reverseTransaction(req.params.txId as string, req.userId!, reason);
    sendSuccess(res, result);
  });

  verifyLedgerBalance = catchAsync(async (req: Request, res: Response) => {
    const result = await service.verifyLedgerBalance();
    sendSuccess(res, result, result.isBalanced ? 200 : 500);
  });

  getStats = catchAsync(async (req: Request, res: Response) => {
    const stats = await service.getStats();
    sendSuccess(res, stats);
  });

  getAuditLogs = catchAsync(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const result = await service.getAuditLogs(page, limit, req.query.resourceType as string | undefined);
    sendSuccess(res, result.logs, 200, { total: result.total, totalPages: result.totalPages, page, limit });
  });
}

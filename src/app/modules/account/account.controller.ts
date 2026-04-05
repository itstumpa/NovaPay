import { Request, Response, NextFunction } from 'express';
import { AccountService } from './account.service';
import { sendSuccess, ApiErrors } from '../../utils/apiResponse';
import { Currency, UserRole, UserStatus } from '@prisma/client';
import { z } from 'zod';

const service = new AccountService();

const createWalletSchema = z.object({
  currency: z.nativeEnum(Currency),
});

const updateStatusSchema = z.object({
  status: z.nativeEnum(UserStatus),
});

const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().min(7).max(20).optional(),
});

export class AccountController {
  getMyProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await service.getUserById(req.userId!);
      if (!user) return ApiErrors.NOT_FOUND(res, 'User');
      sendSuccess(res, user);
    } catch (err) { next(err); }
  };

  updateMyProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = updateProfileSchema.parse(req.body);
      const user = await service.updateProfile(req.userId!, body);
      sendSuccess(res, user);
    } catch (err) { next(err); }
  };

  getMyWallets = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const wallets = await service.getMyWallets(req.userId!);
      sendSuccess(res, wallets);
    } catch (err) { next(err); }
  };

  createWallet = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { currency } = createWalletSchema.parse(req.body);
      const wallet = await service.createWallet(req.userId!, currency);
      sendSuccess(res, wallet, 201);
    } catch (err) { next(err); }
  };

  getWallet = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const wallet = await service.getWallet(req.params.walletId, req.userId!);
      if (!wallet) return ApiErrors.NOT_FOUND(res, 'Wallet');
      sendSuccess(res, wallet);
    } catch (err) { next(err); }
  };

  getBalance = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const balance = await service.getBalance(req.params.walletId, req.userId!);
      if (!balance) return ApiErrors.NOT_FOUND(res, 'Wallet');
      sendSuccess(res, balance);
    } catch (err) { next(err); }
  };

  listUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const role = req.query.role as UserRole | undefined;
      const result = await service.listUsers(page, limit, role);
      sendSuccess(res, result.users, 200, {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      });
    } catch (err) { next(err); }
  };

  getUserById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await service.getUserById(req.params.userId);
      if (!user) return ApiErrors.NOT_FOUND(res, 'User');
      sendSuccess(res, user);
    } catch (err) { next(err); }
  };

  updateUserStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status } = updateStatusSchema.parse(req.body);
      const user = await service.updateUserStatus(req.params.userId, status, req.userId!);
      sendSuccess(res, user);
    } catch (err) { next(err); }
  };
}

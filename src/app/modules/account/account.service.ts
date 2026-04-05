import  prisma  from '../../config/prisma';
import { Currency, UserRole, UserStatus, WalletStatus } from '@prisma/client';
import { encrypt, decrypt } from '../../../utils/encryption';
import { logger } from '../../../utils/logger';

export class AccountService {
  // ─── User ───────────────────────────────────────

  async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        phoneEncrypted: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });
    if (!user) return null;
    return this.sanitizeUser(user);
  }

  async listUsers(page: number, limit: number, role?: UserRole) {
    const skip = (page - 1) * limit;
    const where = role ? { role } : {};
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, name: true, role: true, status: true, createdAt: true },
      }),
      prisma.user.count({ where }),
    ]);
    return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async updateUserStatus(userId: string, status: UserStatus, adminId: string) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { status },
      select: { id: true, email: true, status: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'USER_STATUS_UPDATED',
        resourceType: 'User',
        resourceId: userId,
        after: { status },
      },
    });

    logger.info('User status updated', { adminId, targetUserId: userId, newStatus: status });
    return user;
  }

  async updateProfile(userId: string, data: { name?: string; phone?: string }) {
    const updateData: Record<string, unknown> = {};
    if (data.name) updateData.name = data.name;
    if (data.phone) updateData.phoneEncrypted = encrypt(data.phone);

    return prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, email: true, name: true, role: true, status: true },
    });
  }

  // ─── Wallets ─────────────────────────────────────

  async getMyWallets(userId: string) {
    return prisma.wallet.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getWallet(walletId: string, userId: string) {
    return prisma.wallet.findFirst({
      where: { id: walletId, userId },
    });
  }

  async createWallet(userId: string, currency: Currency) {
    // Check duplicate
    const existing = await prisma.wallet.findUnique({
      where: { userId_currency: { userId, currency } },
    });
    if (existing) throw new Error(`You already have a ${currency} wallet`);

    return prisma.wallet.create({
      data: { userId, currency, balance: 0, status: WalletStatus.ACTIVE },
    });
  }

  async getBalance(walletId: string, userId: string) {
    const wallet = await prisma.wallet.findFirst({
      where: { id: walletId, userId },
      select: { id: true, currency: true, balance: true, status: true, updatedAt: true },
    });
    return wallet;
  }

  // ─── Helpers ─────────────────────────────────────

  private sanitizeUser(user: Record<string, unknown>) {
    const sanitized = { ...user };
    // Decrypt phone for owner — shown only to the user themselves
    if (sanitized.phoneEncrypted) {
      try {
        sanitized.phone = decrypt(sanitized.phoneEncrypted as string);
      } catch {
        sanitized.phone = null;
      }
      delete sanitized.phoneEncrypted;
    }
    return sanitized;
  }
}

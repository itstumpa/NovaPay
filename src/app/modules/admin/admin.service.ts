import  prisma  from '../../config/prisma';
import { Prisma, TransactionStatus, TransactionType, LedgerEntryType, UserStatus, UserRole } from '@prisma/client';
import { sha256 } from '../../../utils/encryption';
import { logger } from '../../../utils/logger';

export class AdminService {

  // ── Users ──────────────────────────────────────────────────────────
  async listUsers(page: number, limit: number, role?: UserRole, status?: UserStatus) {
    const skip = (page - 1) * limit;
    const where = {
      ...(role ? { role } : {}),
      ...(status ? { status } : {}),
    };
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, name: true, role: true, status: true, createdAt: true, lastLoginAt: true },
      }),
      prisma.user.count({ where }),
    ]);
    return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getUser(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, name: true, role: true, status: true,
        createdAt: true, lastLoginAt: true,
        wallets: { select: { id: true, currency: true, balance: true, status: true } },
        _count: { select: { sentTransactions: true, receivedTransactions: true } },
      },
    });
  }

  async updateUserStatus(userId: string, status: UserStatus, adminId: string, reason?: string) {
    const before = await prisma.user.findUnique({ where: { id: userId }, select: { status: true } });

    const user = await prisma.user.update({
      where: { id: userId },
      data: { status },
      select: { id: true, email: true, status: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'USER_STATUS_CHANGED',
        resourceType: 'User',
        resourceId: userId,
        before: before ?? undefined,
        after: { status, reason },
      },
    });

    logger.info('Admin updated user status', { adminId, userId, from: before?.status, to: status });
    return user;
  }

  // ── Transactions ───────────────────────────────────────────────────
  async listTransactions(page: number, limit: number, filters: {
    status?: TransactionStatus;
    type?: TransactionType;
    userId?: string;
  }) {
    const skip = (page - 1) * limit;
    const where: Prisma.TransactionWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.userId ? { OR: [{ senderId: filters.userId }, { receiverId: filters.userId }] } : {}),
    };
    const [txs, total] = await Promise.all([
      prisma.transaction.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, type: true, status: true, amount: true, currency: true,
          senderId: true, receiverId: true, feeAmount: true,
          createdAt: true, completedAt: true, failureReason: true,
        },
      }),
      prisma.transaction.count({ where }),
    ]);
    return { transactions: txs, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getTransaction(txId: string) {
    return prisma.transaction.findUnique({
      where: { id: txId },
      include: { ledgerEntries: { orderBy: { createdAt: 'asc' } } },
    });
  }

  // ── Reverse a completed transaction ────────────────────────────────
  // Creates mirror ledger entries — debits the receiver, credits the sender
  async reverseTransaction(txId: string, adminId: string, reason: string) {
    const original = await prisma.transaction.findUnique({
      where: { id: txId },
      include: { ledgerEntries: true },
    });

    if (!original) throw new Error('Transaction not found');
    if (original.status !== TransactionStatus.COMPLETED) throw new Error('Only COMPLETED transactions can be reversed');
    if (!original.senderId || !original.receiverId) throw new Error('Cannot reverse system transactions');

    const result = await prisma.$transaction(async (tx) => {
      // Lock both wallets
      await tx.$queryRaw`SELECT id FROM wallets WHERE id IN (${original.senderWalletId}, ${original.receiverWalletId}) FOR UPDATE`;

      const senderWallet = await tx.wallet.findUnique({ where: { id: original.senderWalletId! } });
      const receiverWallet = await tx.wallet.findUnique({ where: { id: original.receiverWalletId! } });
      if (!senderWallet || !receiverWallet) throw new Error('Wallets not found');

      // Reverse: debit receiver, credit sender
      await tx.wallet.update({ where: { id: receiverWallet.id }, data: { balance: { decrement: original.amount } } });
      await tx.wallet.update({ where: { id: senderWallet.id }, data: { balance: { increment: original.amount } } });

      // Reversal transaction record
      const reversal = await tx.transaction.create({
        data: {
          type: TransactionType.REFUND,
          status: TransactionStatus.COMPLETED,
          senderId: original.receiverId,
          receiverId: original.senderId,
          senderWalletId: original.receiverWalletId,
          receiverWalletId: original.senderWalletId,
          amount: original.amount,
          currency: original.currency,
          completedAt: new Date(),
          debitCompletedAt: new Date(),
          creditCompletedAt: new Date(),
          metadata: { reversalOf: txId, reason },
        },
      });

      // Reversal ledger entries
      const lastEntry = await tx.ledgerEntry.findFirst({ orderBy: { createdAt: 'desc' }, select: { entryHash: true } });
      const prevHash = lastEntry?.entryHash ?? null;

      const debitHash = sha256(`${prevHash}${reversal.id}${original.amount}${receiverWallet.id}REVERSAL_DEBIT`);
      await tx.ledgerEntry.create({
        data: {
          transactionId: reversal.id, walletId: receiverWallet.id,
          entryType: LedgerEntryType.DEBIT, amount: original.amount, currency: original.currency,
          balanceBefore: receiverWallet.balance, balanceAfter: receiverWallet.balance.minus(original.amount),
          entryHash: debitHash, prevEntryHash: prevHash,
          description: `Reversal of transaction ${txId}: ${reason}`,
        },
      });

      const creditHash = sha256(`${debitHash}${reversal.id}${original.amount}${senderWallet.id}REVERSAL_CREDIT`);
      await tx.ledgerEntry.create({
        data: {
          transactionId: reversal.id, walletId: senderWallet.id,
          entryType: LedgerEntryType.CREDIT, amount: original.amount, currency: original.currency,
          balanceBefore: senderWallet.balance, balanceAfter: senderWallet.balance.add(original.amount),
          entryHash: creditHash, prevEntryHash: debitHash,
          description: `Reversal credit for transaction ${txId}`,
        },
      });

      // Mark original as REVERSED
      await tx.transaction.update({ where: { id: txId }, data: { status: TransactionStatus.REVERSED } });

      await tx.auditLog.create({
        data: {
          userId: adminId, action: 'TRANSACTION_REVERSED',
          resourceType: 'Transaction', resourceId: txId,
          after: { reversalTransactionId: reversal.id, reason },
        },
      });

      return reversal;
    });

    logger.info('Transaction reversed', { adminId, originalTxId: txId, reversalId: result.id, reason });
    return result;
  }

  // ── Ledger invariant check ─────────────────────────────────────────
  // Sum of all DEBITs must equal sum of all CREDITs across the entire ledger.
  // If they don't match, money has been created or destroyed — critical alert.
  async verifyLedgerBalance() {
    const [debits, credits] = await Promise.all([
      prisma.ledgerEntry.aggregate({ where: { entryType: LedgerEntryType.DEBIT }, _sum: { amount: true } }),
      prisma.ledgerEntry.aggregate({ where: { entryType: LedgerEntryType.CREDIT }, _sum: { amount: true } }),
    ]);

    const totalDebits = debits._sum.amount ?? new Prisma.Decimal(0);
    const totalCredits = credits._sum.amount ?? new Prisma.Decimal(0);
    const isBalanced = totalDebits.equals(totalCredits);
    const variance = totalDebits.minus(totalCredits).abs();

    if (!isBalanced) {
      logger.error('LEDGER INVARIANT VIOLATION — money created or destroyed!', {
        totalDebits: totalDebits.toString(),
        totalCredits: totalCredits.toString(),
        variance: variance.toString(),
      });
    }

    return { isBalanced, totalDebits, totalCredits, variance, checkedAt: new Date() };
  }

  // ── Platform stats ─────────────────────────────────────────────────
  async getStats() {
    const [
      totalUsers, totalTransactions, completedTx, failedTx,
      totalVolume, pendingPayrolls,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.transaction.count(),
      prisma.transaction.count({ where: { status: TransactionStatus.COMPLETED } }),
      prisma.transaction.count({ where: { status: TransactionStatus.FAILED } }),
      prisma.transaction.aggregate({ where: { status: TransactionStatus.COMPLETED }, _sum: { amount: true } }),
      prisma.payrollJob.count({ where: { status: { in: ['QUEUED', 'PROCESSING'] } } }),
    ]);

    return {
      users: { total: totalUsers },
      transactions: {
        total: totalTransactions,
        completed: completedTx,
        failed: failedTx,
        successRate: totalTransactions > 0 ? ((completedTx / totalTransactions) * 100).toFixed(2) + '%' : '0%',
      },
      volume: { totalProcessed: totalVolume._sum.amount ?? 0 },
      payroll: { pendingJobs: pendingPayrolls },
      generatedAt: new Date(),
    };
  }

  // ── Audit logs ─────────────────────────────────────────────────────
  async getAuditLogs(page: number, limit: number, resourceType?: string) {
    const skip = (page - 1) * limit;
    const where = resourceType ? { resourceType } : {};
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);
    return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}

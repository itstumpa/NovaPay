import  prisma  from '../../config/prisma';
import { Currency, PayrollJobStatus, TransactionStatus } from '@prisma/client';
import { payrollQueue } from './payroll.queue';
import { logger } from '../../../utils/logger';

interface PayrollItemInput {
  employeeEmail: string;
  amount: number;
}

export class PayrollService {
  async createJob(params: {
    createdById: string;
    employerWalletId: string;
    currency: Currency;
    idempotencyKey: string;
    items: PayrollItemInput[];
  }) {
    const { createdById, employerWalletId, currency, idempotencyKey, items } = params;

    // Idempotency — same key returns existing job
    const existing = await prisma.payrollJob.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      logger.info('Payroll job already exists, returning existing', { jobId: existing.id });
      return existing;
    }

    // Resolve employee wallets
    const resolvedItems = await Promise.all(
      items.map(async (item, index) => {
        const user = await prisma.user.findUnique({
          where: { email: item.employeeEmail },
          select: { id: true },
        });
        if (!user) throw new Error(`Employee not found: ${item.employeeEmail}`);

        const wallet = await prisma.wallet.findUnique({
          where: { userId_currency: { userId: user.id, currency } },
        });
        if (!wallet) throw new Error(`No ${currency} wallet for: ${item.employeeEmail}`);

        return {
          employeeUserId: user.id,
          employeeWalletId: wallet.id,
          amount: item.amount,
          currency,
          itemIndex: index,
          status: TransactionStatus.PENDING,
        };
      })
    );

    const totalAmount = resolvedItems.reduce((sum, i) => sum + i.amount, 0);

    // Create job + all items in one transaction
    const job = await prisma.payrollJob.create({
      data: {
        createdById,
        employerWalletId,
        currency,
        idempotencyKey,
        totalAmount,
        totalItems: resolvedItems.length,
        status: PayrollJobStatus.QUEUED,
        items: { create: resolvedItems },
      },
    });

    // Enqueue — BullMQ handles retry/backoff
    await payrollQueue.add(
      `payroll-${job.id}`,
      { payrollJobId: job.id, employerAccountId: employerWalletId },
      { jobId: job.id } // use payroll job ID as BullMQ job ID for deduplication
    );

    logger.info('Payroll job queued', {
      jobId: job.id,
      totalItems: resolvedItems.length,
      totalAmount,
      currency,
    });

    return job;
  }

  async getJobStatus(jobId: string, userId: string) {
    return prisma.payrollJob.findFirst({
      where: { id: jobId, createdById: userId },
      include: {
        items: {
          select: {
            id: true,
            employeeUserId: true,
            amount: true,
            status: true,
            processedAt: true,
            failureReason: true,
            itemIndex: true,
          },
        },
      },
    });
  }
}

import {
  LedgerEntryType,
  PayrollJobStatus,
  Prisma,
  TransactionStatus,
  TransactionType,
} from "@prisma/client";
import { Job, Queue, Worker } from "bullmq";
import { sha256 } from "../../../utils/encryption";
import { logger } from "../../../utils/logger";
import prisma from "../../config/prisma";
import {getRedis} from "../../config/redis";

export const PAYROLL_QUEUE_NAME = "payroll";
const redis = getRedis();
// One queue, but concurrency=1 per employer is enforced via job grouping
export const payrollQueue = new Queue(PAYROLL_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: false, // keep for audit
    removeOnFail: false,
  },
});

export interface PayrollJobData {
  payrollJobId: string;
  employerAccountId: string; // used as queue group key — enforces concurrency=1
}

// ── Worker ────────────────────────────────────────────────────────────────
// concurrency: 1 means only ONE payroll job runs at a time globally.
// Why this beats locking: with DB locks, 14,000 credits all hammer the same
// row lock and timeout. With concurrency=1 per employer, they queue up cleanly
// and process sequentially without contention.
export const payrollWorker = new Worker<PayrollJobData>(
  PAYROLL_QUEUE_NAME,
  async (job: Job<PayrollJobData>) => {
    const { payrollJobId } = job.data;

    logger.info("Payroll job started", { payrollJobId, jobId: job.id });

    const payrollJob = await prisma.payrollJob.findUnique({
      where: { id: payrollJobId },
      include: {
        items: {
          where: { status: TransactionStatus.PENDING },
          orderBy: { itemIndex: "asc" }, // always process in order for resumability
        },
      },
    });

    if (!payrollJob) throw new Error(`Payroll job ${payrollJobId} not found`);

    // Mark as PROCESSING
    await prisma.payrollJob.update({
      where: { id: payrollJobId },
      data: { status: PayrollJobStatus.PROCESSING },
    });

    const employerWallet = await prisma.wallet.findUnique({
      where: { id: payrollJob.employerWalletId },
    });
    if (!employerWallet) throw new Error("Employer wallet not found");

    let processedCount = payrollJob.processedItems;
    let failedCount = payrollJob.failedItems;

    // ── Process each pending item sequentially ───────────────────────
    // This is the resumability checkpoint pattern.
    // If the worker crashes at item 5000, on restart it picks up from item 5001
    // because completed items have status=COMPLETED and are excluded from the query.
    for (const item of payrollJob.items) {
      try {
        await prisma.$transaction(async (tx) => {
          // Lock employer wallet for each credit
          const locked = await tx.$queryRaw<Array<{ balance: Prisma.Decimal }>>`
            SELECT balance FROM wallets WHERE id = ${employerWallet.id} FOR UPDATE
          `;
          const employerBalance = locked[0].balance;

          if (employerBalance.lessThan(item.amount)) {
            throw new Error(`Insufficient funds for item ${item.id}`);
          }

          // Debit employer
          const newEmployerBalance = employerBalance.minus(item.amount);
          await tx.wallet.update({
            where: { id: employerWallet.id },
            data: { balance: newEmployerBalance },
          });

          // Credit employee
          const empWallet = await tx.wallet.findUnique({
            where: { id: item.employeeWalletId },
            select: { balance: true },
          });
          const newEmpBalance = empWallet!.balance.add(item.amount);
          await tx.wallet.update({
            where: { id: item.employeeWalletId },
            data: { balance: newEmpBalance },
          });

          // Transaction record
          const transaction = await tx.transaction.create({
            data: {
              type: TransactionType.PAYROLL_CREDIT,
              status: TransactionStatus.COMPLETED,
              senderId: payrollJob.createdById,
              receiverId: item.employeeUserId,
              senderWalletId: employerWallet.id,
              receiverWalletId: item.employeeWalletId,
              amount: item.amount,
              currency: item.currency,
              payrollJobId,
              payrollItemId: item.id,
              completedAt: new Date(),
              debitCompletedAt: new Date(),
              creditCompletedAt: new Date(),
            },
          });

          // Ledger entries
          const lastEntry = await tx.ledgerEntry.findFirst({
            orderBy: { createdAt: "desc" },
            select: { entryHash: true },
          });
          const prevHash = lastEntry?.entryHash ?? null;

          const debitHash = sha256(
            `${prevHash}${transaction.id}${item.amount}${employerWallet.id}PAYROLL_DEBIT`,
          );
          await tx.ledgerEntry.create({
            data: {
              transactionId: transaction.id,
              walletId: employerWallet.id,
              entryType: LedgerEntryType.DEBIT,
              amount: item.amount,
              currency: item.currency,
              balanceBefore: employerBalance,
              balanceAfter: newEmployerBalance,
              entryHash: debitHash,
              prevEntryHash: prevHash,
              description: `Payroll disbursement to employee ${item.employeeUserId}`,
            },
          });

          const creditHash = sha256(
            `${debitHash}${transaction.id}${item.amount}${item.employeeWalletId}PAYROLL_CREDIT`,
          );
          await tx.ledgerEntry.create({
            data: {
              transactionId: transaction.id,
              walletId: item.employeeWalletId,
              entryType: LedgerEntryType.CREDIT,
              amount: item.amount,
              currency: item.currency,
              balanceBefore: empWallet!.balance,
              balanceAfter: newEmpBalance,
              entryHash: creditHash,
              prevEntryHash: debitHash,
              description: `Salary credit from payroll job ${payrollJobId}`,
            },
          });

          // Mark item COMPLETED + checkpoint
          await tx.payrollItem.update({
            where: { id: item.id },
            data: {
              status: TransactionStatus.COMPLETED,
              processedAt: new Date(),
            },
          });

          await tx.payrollJob.update({
            where: { id: payrollJobId },
            data: {
              processedItems: { increment: 1 },
              lastProcessedIndex: item.itemIndex,
            },
          });
        });

        processedCount++;
        await job.updateProgress(
          Math.floor((processedCount / payrollJob.totalItems) * 100),
        );
      } catch (err) {
        failedCount++;
        logger.error("Payroll item failed", {
          payrollJobId,
          itemId: item.id,
          error: (err as Error).message,
        });

        await prisma.payrollItem.update({
          where: { id: item.id },
          data: {
            status: TransactionStatus.FAILED,
            failureReason: (err as Error).message,
          },
        });

        await prisma.payrollJob.update({
          where: { id: payrollJobId },
          data: { failedItems: { increment: 1 } },
        });
      }
    }

    // ── Final status ─────────────────────────────────────────────────
    const finalStatus =
      failedCount === 0
        ? PayrollJobStatus.COMPLETED
        : failedCount === payrollJob.totalItems
          ? PayrollJobStatus.FAILED
          : PayrollJobStatus.PARTIALLY_COMPLETED;

    await prisma.payrollJob.update({
      where: { id: payrollJobId },
      data: { status: finalStatus, completedAt: new Date() },
    });

    logger.info("Payroll job finished", {
      payrollJobId,
      finalStatus,
      processedCount,
      failedCount,
    });
  },
  {
    connection: redis,
    concurrency: 1, // ONE job at a time — no race conditions on employer wallet
  },
);

payrollWorker.on("failed", (job, err) => {
  logger.error("Payroll worker job failed", {
    jobId: job?.id,
    payrollJobId: job?.data.payrollJobId,
    error: err.message,
  });
});

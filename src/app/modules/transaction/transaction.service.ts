import { Prisma, TransactionStatus, TransactionType, Currency, LedgerEntryType, WalletStatus } from '@prisma/client';
import  prisma  from '../../config/prisma';
import { sha256 } from '../../../utils/encryption';
import { logger } from '../../../utils/logger';

const PLATFORM_FEE = new Prisma.Decimal(2); // flat $2 fee
const FEE_CURRENCY = Currency.USD;

export class TransactionService {

  async transfer(params: {
    senderId: string;
    receiverEmail: string;
    amount: number;
    currency: Currency;
    requestId: string;
  }) {
    const { senderId, receiverEmail, amount, currency, requestId } = params;
    const transferAmount = new Prisma.Decimal(amount);

    // ── 1. Validate receiver exists ──────────────────────────────────
    const receiver = await prisma.user.findUnique({
      where: { email: receiverEmail },
      select: { id: true, email: true, name: true },
    });
    if (!receiver) throw new Error('Receiver not found');
    if (receiver.id === senderId) throw new Error('Cannot transfer to yourself');

    // ── 2. Get sender + receiver wallets ─────────────────────────────
    const senderWallet = await prisma.wallet.findUnique({
      where: { userId_currency: { userId: senderId, currency } },
    });
    if (!senderWallet) throw new Error(`You don't have a ${currency} wallet`);
    if (senderWallet.status !== WalletStatus.ACTIVE) throw new Error('Your wallet is frozen');

    const receiverWallet = await prisma.wallet.findUnique({
      where: { userId_currency: { userId: receiver.id, currency } },
    });
    if (!receiverWallet) throw new Error(`Receiver doesn't have a ${currency} wallet`);

    // Get NovaPay fee account
    const feeAccount = await prisma.systemAccount.findUnique({
      where: { name: 'novapay_fee_account' },
    });
    if (!feeAccount) throw new Error('System configuration error: fee account missing');

    // Total deducted from sender = transfer amount + $2 fee
    const totalDebit = transferAmount.add(PLATFORM_FEE);

    // ── 3. Atomic transaction block ──────────────────────────────────
    // Everything below is ONE db transaction. If anything throws,
    // Postgres rolls ALL of it back. No partial state ever.
    const result = await prisma.$transaction(async (tx) => {

      // LOCK sender wallet row — no other transaction can read/write this
      // row until we COMMIT. This prevents the overdraft race condition.
      const lockedSenderWallet = await tx.$queryRaw<Array<{ balance: Prisma.Decimal }>>`
        SELECT balance FROM wallets WHERE id = ${senderWallet.id} FOR UPDATE
      `;
      const currentBalance = lockedSenderWallet[0].balance;

      // ── 4. Balance check (inside lock) ──────────────────────────────
      if (currentBalance.lessThan(totalDebit)) {
        throw new Error(
          `Insufficient balance. Available: ${currentBalance} ${currency}, Required: ${totalDebit} ${currency} (including $${PLATFORM_FEE} fee)`
        );
      }

      // ── 5. Create the transaction record ────────────────────────────
      const transaction = await tx.transaction.create({
        data: {
          type: TransactionType.TRANSFER,
          status: TransactionStatus.PROCESSING,
          senderId,
          receiverId: receiver.id,
          senderWalletId: senderWallet.id,
          receiverWalletId: receiverWallet.id,
          amount: transferAmount,
          currency,
          feeAmount: PLATFORM_FEE,
          feeCurrency: FEE_CURRENCY,
        },
      });

      // ── 6. Debit sender ──────────────────────────────────────────────
      const newSenderBalance = currentBalance.minus(totalDebit);
      await tx.wallet.update({
        where: { id: senderWallet.id },
        data: { balance: newSenderBalance },
      });
      // Mark debit done (recovery checkpoint — Scenario C)
      await tx.transaction.update({
        where: { id: transaction.id },
        data: { debitCompletedAt: new Date() },
      });

      // ── 7. Credit receiver ───────────────────────────────────────────
      const receiverCurrentBalance = (await tx.wallet.findUnique({
        where: { id: receiverWallet.id },
        select: { balance: true },
      }))!.balance;

      const newReceiverBalance = receiverCurrentBalance.add(transferAmount);
      await tx.wallet.update({
        where: { id: receiverWallet.id },
        data: { balance: newReceiverBalance },
      });
      await tx.transaction.update({
        where: { id: transaction.id },
        data: { creditCompletedAt: new Date() },
      });

      // ── 8. Double-entry ledger entries ───────────────────────────────
      // Get last ledger hash for the chain
      const lastEntry = await tx.ledgerEntry.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { entryHash: true },
      });
      const prevHash = lastEntry?.entryHash ?? null;

      // DEBIT entry (sender)
      const debitData = `${prevHash}${transaction.id}${transferAmount}${senderWallet.id}DEBIT`;
      const debitHash = sha256(debitData);

      await tx.ledgerEntry.create({
        data: {
          transactionId: transaction.id,
          walletId: senderWallet.id,
          entryType: LedgerEntryType.DEBIT,
          amount: transferAmount,
          currency,
          balanceBefore: currentBalance,
          balanceAfter: newSenderBalance,
          entryHash: debitHash,
          prevEntryHash: prevHash,
          description: `Transfer to ${receiver.email}`,
        },
      });

      // CREDIT entry (receiver)
      const creditData = `${debitHash}${transaction.id}${transferAmount}${receiverWallet.id}CREDIT`;
      const creditHash = sha256(creditData);

      await tx.ledgerEntry.create({
        data: {
          transactionId: transaction.id,
          walletId: receiverWallet.id,
          entryType: LedgerEntryType.CREDIT,
          amount: transferAmount,
          currency,
          balanceBefore: receiverCurrentBalance,
          balanceAfter: newReceiverBalance,
          entryHash: creditHash,
          prevEntryHash: debitHash,
          description: `Transfer from ${senderId}`,
        },
      });

      // ── 9. Fee ledger entries (debit sender, credit novapay) ─────────
      const feeDebitData = `${creditHash}${transaction.id}${PLATFORM_FEE}${senderWallet.id}FEE_DEBIT`;
      const feeDebitHash = sha256(feeDebitData);

      await tx.ledgerEntry.create({
        data: {
          transactionId: transaction.id,
          walletId: senderWallet.id,
          entryType: LedgerEntryType.DEBIT,
          amount: PLATFORM_FEE,
          currency: FEE_CURRENCY,
          balanceBefore: newSenderBalance.add(PLATFORM_FEE),
          balanceAfter: newSenderBalance,
          entryHash: feeDebitHash,
          prevEntryHash: creditHash,
          description: 'NovaPay transfer fee',
        },
      });

      // Update system fee account balance
      await tx.systemAccount.update({
        where: { name: 'novapay_fee_account' },
        data: { balance: { increment: PLATFORM_FEE } },
      });

      // ── 10. Mark transaction COMPLETED ───────────────────────────────
      const completed = await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          status: TransactionStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      return { transaction: completed, senderBalance: newSenderBalance };
    });

    logger.info('Transfer completed', {
      requestId,
      transactionId: result.transaction.id,
      senderId,
      receiverId: receiver.id,
      amount: transferAmount.toString(),
      currency,
    });

    return result;
  }

  // ── History — cursor-based pagination, never OFFSET on 40M rows ────
  async getHistory(userId: string, cursor?: string, limit = 20) {
    const take = Math.min(limit, 100);

    const transactions = await prisma.transaction.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      take: take + 1, // take one extra to know if there's a next page
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        status: true,
        amount: true,
        currency: true,
        feeAmount: true,
        senderId: true,
        receiverId: true,
        createdAt: true,
        completedAt: true,
      },
    });

    const hasNextPage = transactions.length > take;
    const items = hasNextPage ? transactions.slice(0, -1) : transactions;
    const nextCursor = hasNextPage ? items[items.length - 1].id : null;

    return { items, nextCursor, hasNextPage };
  }

  async getById(transactionId: string, userId: string) {
    const tx = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      include: { ledgerEntries: true },
    });
    return tx;
  }
}

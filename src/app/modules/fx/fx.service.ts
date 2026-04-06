import { Prisma, Currency, FxQuoteStatus, TransactionStatus, TransactionType, LedgerEntryType } from '@prisma/client';
import  prisma  from '../../config/prisma';
import { env } from '../../config/env';
import { sha256 } from '../../../utils/encryption';
import { logger } from '../../../utils/logger';

export class FxService {

  // ── Fetch live rate from provider ────────────────────────────────────
  // NEVER silently use cached rates — if provider is down, we throw.
  private async fetchLiveRate(from: Currency, to: Currency): Promise<number> {
    const url = `${env.FX_PROVIDER_URL}/${from}`;

    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    } catch {
      // Provider unreachable — NEVER fall back silently
      throw new Error('FX_PROVIDER_UNAVAILABLE: Cannot fetch live rate. Please try again.');
    }

    if (!response.ok) {
      throw new Error(`FX_PROVIDER_ERROR: Provider returned ${response.status}`);
    }

    const data = await response.json() as { rates: Record<string, number> };
    const rate = data.rates[to];

    if (!rate) {
      throw new Error(`FX_UNSUPPORTED_PAIR: ${from}/${to} not supported`);
    }

    return rate;
  }

  // ── Issue a locked quote (60s TTL) ───────────────────────────────────
  async createQuote(params: {
    userId: string;
    fromCurrency: Currency;
    toCurrency: Currency;
    sourceAmount: number;
  }) {
    const { userId, fromCurrency, toCurrency, sourceAmount } = params;

    if (fromCurrency === toCurrency) {
      throw new Error('Source and target currency must be different');
    }

    // Fetch live rate — throws if provider is down
    const rate = await this.fetchLiveRate(fromCurrency, toCurrency);
    const rateDecimal = new Prisma.Decimal(rate);
    const sourceAmountDecimal = new Prisma.Decimal(sourceAmount);
    const targetAmount = sourceAmountDecimal.mul(rateDecimal).toDecimalPlaces(6);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + env.FX_QUOTE_TTL_SECONDS * 1000);

    const quote = await prisma.fxQuote.create({
      data: {
        userId,
        fromCurrency,
        toCurrency,
        rate: rateDecimal,
        inverseRate: new Prisma.Decimal(1).div(rateDecimal).toDecimalPlaces(8),
        sourceAmount: sourceAmountDecimal,
        targetAmount,
        status: FxQuoteStatus.ACTIVE,
        expiresAt,
        providerName: 'exchangerate-api',
      },
    });

    logger.info('FX quote issued', {
      userId,
      quoteId: quote.id,
      pair: `${fromCurrency}/${toCurrency}`,
      rate: rateDecimal.toString(),
      expiresAt,
    });

    return {
      ...quote,
      secondsRemaining: env.FX_QUOTE_TTL_SECONDS,
      expiresAt,
    };
  }

  // ── Check quote status ────────────────────────────────────────────────
  async getQuote(quoteId: string, userId: string) {
    const quote = await prisma.fxQuote.findFirst({
      where: { id: quoteId, userId },
    });
    if (!quote) throw new Error('Quote not found');

    const now = new Date();
    const secondsRemaining = Math.max(
      0,
      Math.floor((quote.expiresAt.getTime() - now.getTime()) / 1000)
    );

    // Auto-expire in DB if TTL passed
    if (quote.status === FxQuoteStatus.ACTIVE && quote.expiresAt < now) {
      await prisma.fxQuote.update({
        where: { id: quoteId },
        data: { status: FxQuoteStatus.EXPIRED },
      });
      return { ...quote, status: FxQuoteStatus.EXPIRED, secondsRemaining: 0 };
    }

    return { ...quote, secondsRemaining };
  }

  // ── Execute international transfer using a valid quote ────────────────
  async internationalTransfer(params: {
    userId: string;
    quoteId: string;
    receiverEmail: string;
    requestId: string;
  }) {
    const { userId, quoteId, receiverEmail, requestId } = params;

    // ── 1. Load + validate the quote ─────────────────────────────────
    const quote = await prisma.fxQuote.findFirst({
      where: { id: quoteId, userId },
    });
    if (!quote) throw new Error('Quote not found');

    // Single-use enforcement
    if (quote.status === FxQuoteStatus.USED) {
      throw new Error('FX_QUOTE_ALREADY_USED: This quote has already been consumed');
    }

    // Expiry enforcement
    if (quote.status === FxQuoteStatus.EXPIRED || quote.expiresAt < new Date()) {
      await prisma.fxQuote.update({
        where: { id: quoteId },
        data: { status: FxQuoteStatus.EXPIRED },
      });
      throw new Error('FX_QUOTE_EXPIRED: Quote has expired. Please request a new quote.');
    }

    // ── 2. Find receiver + wallets ────────────────────────────────────
    const receiver = await prisma.user.findUnique({
      where: { email: receiverEmail },
      select: { id: true, email: true },
    });
    if (!receiver) throw new Error('Receiver not found');

    const senderWallet = await prisma.wallet.findUnique({
      where: { userId_currency: { userId, currency: quote.fromCurrency } },
    });
    if (!senderWallet) throw new Error(`You don't have a ${quote.fromCurrency} wallet`);

    const receiverWallet = await prisma.wallet.findUnique({
      where: { userId_currency: { userId: receiver.id, currency: quote.toCurrency } },
    });
    if (!receiverWallet) throw new Error(`Receiver doesn't have a ${quote.toCurrency} wallet`);

    // ── 3. Atomic execution ───────────────────────────────────────────
    const result = await prisma.$transaction(async (tx) => {

      // Lock sender wallet
      const locked = await tx.$queryRaw<Array<{ balance: Prisma.Decimal }>>`
        SELECT balance FROM wallets WHERE id = ${senderWallet.id} FOR UPDATE
      `;
      const senderBalance = locked[0].balance;

      if (senderBalance.lessThan(quote.sourceAmount)) {
        throw new Error(`Insufficient balance. Need ${quote.sourceAmount} ${quote.fromCurrency}`);
      }

      // Mark quote as USED immediately (single-use enforcement inside tx)
      await tx.fxQuote.update({
        where: { id: quoteId },
        data: { status: FxQuoteStatus.USED, usedAt: new Date() },
      });

      // Create transaction record with locked rate
      const transaction = await tx.transaction.create({
        data: {
          type: TransactionType.FX_CONVERSION,
          status: TransactionStatus.PROCESSING,
          senderId: userId,
          receiverId: receiver.id,
          senderWalletId: senderWallet.id,
          receiverWalletId: receiverWallet.id,
          amount: quote.targetAmount,
          currency: quote.toCurrency,
          fxQuoteId: quoteId,
          fxRate: quote.rate,              // locked rate — never stale
          sourceCurrency: quote.fromCurrency,
          sourceAmount: quote.sourceAmount,
        },
      });

      // Debit sender (source currency)
      const newSenderBalance = senderBalance.minus(quote.sourceAmount);
      await tx.wallet.update({
        where: { id: senderWallet.id },
        data: { balance: newSenderBalance },
      });

      // Credit receiver (target currency)
      const receiverBalance = (await tx.wallet.findUnique({
        where: { id: receiverWallet.id },
        select: { balance: true },
      }))!.balance;

      const newReceiverBalance = receiverBalance.add(quote.targetAmount);
      await tx.wallet.update({
        where: { id: receiverWallet.id },
        data: { balance: newReceiverBalance },
      });

      // Double-entry ledger with locked rate recorded
      const lastEntry = await tx.ledgerEntry.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { entryHash: true },
      });
      const prevHash = lastEntry?.entryHash ?? null;

      const debitHash = sha256(`${prevHash}${transaction.id}${quote.sourceAmount}${senderWallet.id}FX_DEBIT`);
      await tx.ledgerEntry.create({
        data: {
          transactionId: transaction.id,
          walletId: senderWallet.id,
          entryType: LedgerEntryType.DEBIT,
          amount: quote.sourceAmount,
          currency: quote.fromCurrency,
          balanceBefore: senderBalance,
          balanceAfter: newSenderBalance,
          entryHash: debitHash,
          prevEntryHash: prevHash,
          description: `FX transfer ${quote.fromCurrency}→${quote.toCurrency} @ rate ${quote.rate}`,
        },
      });

      const creditHash = sha256(`${debitHash}${transaction.id}${quote.targetAmount}${receiverWallet.id}FX_CREDIT`);
      await tx.ledgerEntry.create({
        data: {
          transactionId: transaction.id,
          walletId: receiverWallet.id,
          entryType: LedgerEntryType.CREDIT,
          amount: quote.targetAmount,
          currency: quote.toCurrency,
          balanceBefore: receiverBalance,
          balanceAfter: newReceiverBalance,
          entryHash: creditHash,
          prevEntryHash: debitHash,
          description: `FX received ${quote.toCurrency} @ locked rate ${quote.rate}`,
        },
      });

      // Update quote with transaction reference
      await tx.fxQuote.update({
        where: { id: quoteId },
        data: { usedByTransactionId: transaction.id },
      });

      const completed = await tx.transaction.update({
        where: { id: transaction.id },
        data: { status: TransactionStatus.COMPLETED, completedAt: new Date() },
      });

      return completed;
    });

    logger.info('FX transfer completed', {
      requestId,
      transactionId: result.id,
      quoteId,
      pair: `${quote.fromCurrency}/${quote.toCurrency}`,
      lockedRate: quote.rate.toString(),
    });

    return result;
  }
}

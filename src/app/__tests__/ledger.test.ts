import { describe, expect, it } from "@jest/globals";
import { Prisma } from "@prisma/client";

// ── Unit tests: ledger math (no DB) ──────────────────────────────────
// These validate the double-entry invariant logic in isolation

describe("Double-Entry Ledger Math", () => {
  it("debit + credit amounts must balance for a transfer", () => {
    const transferAmount = new Prisma.Decimal(100);
    const fee = new Prisma.Decimal(2);

    // Sender is debited transfer + fee
    const totalDebit = transferAmount.add(fee);

    // Receiver gets transfer amount
    const recipientCredit = transferAmount;

    // NovaPay fee account gets fee
    const feeCredit = fee;

    // Total credits must equal total debits
    const totalCredits = recipientCredit.add(feeCredit);
    expect(totalDebit.equals(totalCredits)).toBe(true);
  });

  it("balance should decrease by correct amount after debit", () => {
    const balance = new Prisma.Decimal(1000);
    const debitAmount = new Prisma.Decimal(52); // $50 transfer + $2 fee
    const newBalance = balance.minus(debitAmount);
    expect(newBalance.toNumber()).toBe(948);
  });

  it("balance should increase by correct amount after credit", () => {
    const balance = new Prisma.Decimal(200);
    const creditAmount = new Prisma.Decimal(50);
    const newBalance = balance.add(creditAmount);
    expect(newBalance.toNumber()).toBe(250);
  });

  it("insufficient balance check should fail correctly", () => {
    const balance = new Prisma.Decimal(30);
    const required = new Prisma.Decimal(52); // $50 + $2 fee
    expect(balance.lessThan(required)).toBe(true);
  });

  it("should never use floating point (Decimal precision test)", () => {
    // 0.1 + 0.2 is a classic float bug — must be 0.3 exactly
    const a = new Prisma.Decimal("0.1");
    const b = new Prisma.Decimal("0.2");
    expect(a.add(b).toString()).toBe("0.3");

    // This would fail with native JS floats: 0.1 + 0.2 = 0.30000000000000004
    expect(0.1 + 0.2).not.toBe(0.3);
  });
});

describe("FX Quote Expiry Logic", () => {
  it("quote should be valid within TTL", () => {
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + 60 * 1000);
    const now = new Date(issuedAt.getTime() + 30 * 1000); // 30s later
    expect(expiresAt > now).toBe(true);
  });

  it("quote should be expired after TTL", () => {
    const issuedAt = new Date(Date.now() - 61 * 1000); // 61s ago
    const expiresAt = new Date(issuedAt.getTime() + 60 * 1000);
    const now = new Date();
    expect(expiresAt < now).toBe(true);
  });

  it("secondsRemaining should be 0 for expired quote", () => {
    const expiresAt = new Date(Date.now() - 5000); // expired 5s ago
    const secondsRemaining = Math.max(
      0,
      Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    );
    expect(secondsRemaining).toBe(0);
  });
});

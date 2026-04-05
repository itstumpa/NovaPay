-- RenameForeignKey
ALTER TABLE "ledger_entries" RENAME CONSTRAINT "ledger_entries_walletId_credit_fkey" TO "ledger_entries_walletId_debit_fkey";

-- RenameForeignKey
ALTER TABLE "ledger_entries" RENAME CONSTRAINT "ledger_entries_walletId_debit_fkey" TO "ledger_entries_walletId_credit_fkey";

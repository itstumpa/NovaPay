# NovaPay — Rebuilt Transaction Backend

> Rebuilt from the ground up after the year-end payroll crisis. Every failure is now a feature.

## Tech Stack

- **Runtime:** Node.js 20 + TypeScript
- **Framework:** Express.js (Modular Monolith)
- **ORM:** Prisma + PostgreSQL 16
- **Queue:** BullMQ + Redis 7
- **Auth:** JWT + bcrypt
- **Logging:** Winston (structured JSON)
- **Validation:** Zod
- **Tests:** Jest + ts-jest

---

## Quick Start

```bash
# 1. Install
npm install

# 2. Start DB + Redis
docker-compose up postgres redis -d

# 3. Run migrations
npm run prisma:migrate

# 4. Seed test data
npm run seed

# 5. Start dev server
npm run dev
# → http://localhost:3000
```

### Run with Docker (full stack)
```bash
cp .env.example .env   # fill in values
docker-compose up --build
```

### Run Tests
```bash
npm test
```

---

## Test Credentials (after seed)

| Role        | Email                    | Password        | Balance         |
|-------------|--------------------------|-----------------|-----------------|
| SUPER_ADMIN | superadmin@novapay.com   | SuperAdmin@123! | —               |
| ADMIN       | admin@novapay.com        | Admin@123!      | —               |
| CORPORATE   | corporate@acmecorp.com   | Corporate@123!  | $500,000 USD    |
| CUSTOMER    | alice@example.com        | Customer@123!   | $1,000 + €500   |
| CUSTOMER    | bob@example.com          | Customer@123!   | $1,000 + €500   |
| EMPLOYEE    | emp1@acmecorp.com        | Employee@123!   | $0              |
| EMPLOYEE    | emp2@acmecorp.com        | Employee@123!   | $0              |
| EMPLOYEE    | emp3@acmecorp.com        | Employee@123!   | $0              |

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login, get JWT |
| POST | /api/auth/logout | Invalidate session |

**Login example:**
```json
POST /api/auth/login
{ "email": "alice@example.com", "password": "Customer@123!" }

→ { "success": true, "data": { "token": "eyJ...", "user": { ... } } }
```

### Accounts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/accounts/me | My profile |
| PATCH | /api/accounts/me | Update profile |
| GET | /api/accounts/wallets | My wallets |
| POST | /api/accounts/wallets | Create wallet |
| GET | /api/accounts/wallets/:id/balance | Get balance |

### Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/transactions/transfer | Send money (requires Idempotency-Key) |
| GET | /api/transactions/history | Paginated history (cursor-based) |
| GET | /api/transactions/:id | Get single transaction |

**Transfer example:**
```json
POST /api/transactions/transfer
Headers: Authorization: Bearer <token>, Idempotency-Key: unique-key-001
{ "receiverEmail": "bob@example.com", "amount": 100, "currency": "USD" }

→ Sender loses $102 ($100 + $2 fee). Bob gains $100.
```

### FX
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/fx/quote | Get locked rate quote (60s TTL) |
| GET | /api/fx/quote/:id | Check quote validity |
| POST | /api/fx/transfer | Execute FX transfer (requires quoteId) |

**FX flow:**
```json
// Step 1: Get quote
POST /api/fx/quote
{ "fromCurrency": "USD", "toCurrency": "EUR", "sourceAmount": 200 }
→ { "quoteId": "abc-123", "rate": 0.92, "expiresAt": "...", "secondsRemaining": 60 }

// Step 2: Execute within 60 seconds
POST /api/fx/transfer
{ "quoteId": "abc-123", "receiverEmail": "bob@example.com" }
→ Transfer executed at locked rate. Quote marked USED. Cannot be reused.
```

### Payroll
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/payroll/disburse | Submit bulk payroll job |
| GET | /api/payroll/jobs/:id | Check job progress |

**Payroll example:**
```json
POST /api/payroll/disburse
Headers: Authorization: Bearer <corporate-token>, Idempotency-Key: payroll-nov-2024-batch-001
{
  "employerWalletId": "<wallet-uuid>",
  "currency": "USD",
  "items": [
    { "employeeEmail": "emp1@acmecorp.com", "amount": 1500 },
    { "employeeEmail": "emp2@acmecorp.com", "amount": 2000 }
  ]
}
→ 202 Accepted. Job queued. Poll /api/payroll/jobs/:id for progress.
```

### Admin (ADMIN / SUPER_ADMIN only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/admin/users | List all users |
| GET | /api/admin/users/:id | Get user detail |
| PATCH | /api/admin/users/:id/status | Suspend / activate user |
| GET | /api/admin/transactions | List all transactions |
| POST | /api/admin/transactions/:id/reverse | Reverse a completed transaction |
| GET | /api/admin/ledger/verify | Check double-entry invariant |
| GET | /api/admin/stats | Platform stats |
| GET | /api/admin/audit-logs | Audit trail |

---

## Five Idempotency Scenarios

See [decisions.md](./decisions.md) for the full explanation. Summary:

| Scenario | What happens |
|----------|-------------|
| A — Same key, sequential | Second request returns cached response. No second debit. |
| B — Three requests in 100ms | Postgres unique constraint ensures exactly one wins. Others poll and get cached response. |
| C — Crash mid-transfer | `prisma.$transaction` rolls everything back. `debitCompletedAt`/`creditCompletedAt` timestamps enable recovery detection. |
| D — Key used 30hrs later (expired) | Returns `410 GONE` with `IDEMPOTENCY_KEY_EXPIRED`. |
| E — Same key, different payload | SHA256 hash mismatch returns `409 CONFLICT` with `IDEMPOTENCY_KEY_MISMATCH`. |

---

## Double-Entry Invariant

Every transfer creates **exactly 2 ledger entries** per movement:
```
Transfer $100 from Alice to Bob + $2 fee:
  DEBIT  alice_wallet   $102
  CREDIT bob_wallet     $100
  CREDIT fee_account    $2
```

`SUM(DEBITs) = SUM(CREDITs)` always. Check anytime: `GET /api/admin/ledger/verify`

---

## FX Quote Strategy

1. Client calls `POST /api/fx/quote` → rate fetched live from provider → locked quote issued with 60s TTL
2. Client must call `POST /api/fx/transfer` within 60 seconds using the quoteId
3. Quote is marked `USED` atomically inside the same DB transaction as the transfer — impossible to reuse
4. If provider is unreachable → `FX_PROVIDER_UNAVAILABLE` error. Never silently applies a cached rate.
5. If quote expired → `FX_QUOTE_EXPIRED` error. Client must request a new quote.

---

## Payroll Resumability

The checkpoint pattern: each `PayrollItem` has a `status` field and `itemIndex`.

On crash/restart:
- Worker re-queries only `WHERE status = PENDING ORDER BY itemIndex ASC`
- Completed items are skipped automatically
- Failed items are logged but do not stop the job
- `PayrollJob.lastProcessedIndex` tracks the last successfully processed item

---

## Audit Hash Chain

Each `LedgerEntry.entryHash = SHA256(prevEntryHash + txId + amount + walletId + entryType)`.

If any record is tampered with, the hash chain breaks from that point forward — detectable by recomputing hashes and comparing.

---

## Logging

Every log line includes: `requestId`, `userId`, `timestamp`, `level`, `message`.
Sensitive fields (`password`, `token`, `secret`) are automatically redacted before logging.

Logs written to: `logs/combined.log` and `logs/error.log`

---

## What I Would Add Before Production

1. **Email verification + OTP** — users are auto-ACTIVE now
2. **Prometheus metrics** — transaction throughput, p95/p99 latency, ledger invariant violation counter
3. **Jaeger tracing** — OpenTelemetry spans per request
4. **Per-user rate limiting** — Redis sliding window per userId
5. **Refresh tokens** — short-lived access tokens + long-lived refresh
6. **Recovery worker** — cron job to detect and resolve REQUIRES_RECOVERY transactions
7. **Multi-region read replicas** — for transaction history queries
8. **Webhook system** — notify clients of payroll completion
9. **KYC integration** — verify identity before high-value transfers
10. **Secrets manager** — AWS Secrets Manager / Vault instead of .env for keys

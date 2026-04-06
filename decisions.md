# NovaPay — Decisions & Idempotency Scenarios

## Idempotency Implementation

Every mutating endpoint that handles money accepts an `Idempotency-Key` header.
The key is stored in the `idempotency_records` table with a SHA256 hash of the request body.

---

### Scenario A — Same key arrives twice (sequential)

**What happens:**
1. Request 1 arrives, creates an `PROCESSING` record, processes, updates to `COMPLETED` with cached response body.
2. Request 2 arrives, finds the `COMPLETED` record, returns the cached response immediately.
3. No second debit. No new transaction created.

**Mechanism:** `prisma.idempotencyRecord.findUnique({ where: { key } })` — if status is COMPLETED, response is replayed directly.

---

### Scenario B — Three identical requests arrive within 100ms (concurrent)

**What happens:**
1. All three hit the server simultaneously and try to `upsert` the idempotency record.
2. Only ONE succeeds in creating the record (Postgres `UNIQUE` constraint on `key` column is atomic).
3. The other two find the record in `PROCESSING` status and enter a polling loop (200ms interval, max 5s).
4. When the winner completes and sets status to `COMPLETED`, the pollers read the cached response and return it.
5. Exactly one disbursement is processed.

**Database-level detail:** The losing requests get a Prisma unique constraint error (`P2002`) on the upsert. They do not crash — they enter `pollUntilResolved()` and wait. This is why `maxRetriesPerRequest: null` is set on the Redis client (BullMQ requirement, not related).

---

### Scenario C — Debit written, server crashes before credit (atomicity)

**What happens:**
Because both debit and credit run inside `prisma.$transaction(async (tx) => { ... })`, if the server crashes mid-way, Postgres automatically rolls back the entire transaction. The wallet balance is never partially updated.

Additionally, the `Transaction` record has `debitCompletedAt` and `creditCompletedAt` timestamps. A recovery worker (to be added) can detect transactions where `debitCompletedAt IS NOT NULL AND creditCompletedAt IS NULL AND status = PROCESSING` — meaning the debit was written but the server crashed before credit. These can be safely completed or reversed.

**The idempotency record stays in `PROCESSING` state** if the server crashes. The recovery worker also resets these so clients can retry.

---

### Scenario D — Key expires after 24 hours, client retries 30 hours later

**What happens:**
The `idempotency_records` table has an `expiresAt` column set to `createdAt + 24 hours`.

When the retry arrives:
1. We find the existing record by key.
2. We check: `existing.expiresAt < now` → **true** (30hrs > 24hrs TTL).
3. We return `410 GONE` with code `IDEMPOTENCY_KEY_EXPIRED`.
4. The client is told to use a new key.

**Response:**
```json
{
  "success": false,
  "error": {
    "code": "IDEMPOTENCY_KEY_EXPIRED",
    "message": "This idempotency key has expired (24hr TTL). Use a new key."
  }
}
```

---

### Scenario E — Same key, different payload ($500 vs $800)

**What happens:**
On the first request, we store `requestHash = SHA256(JSON.stringify(body))` in the idempotency record.

When the second request arrives with the same key but `amount: 800`:
1. We find the existing record.
2. We compute `SHA256(JSON.stringify(newBody))` — this is a different hash.
3. We compare: `existing.requestHash !== newRequestHash` → **true**.
4. We return `409 CONFLICT` with code `IDEMPOTENCY_KEY_MISMATCH`.

**Response:**
```json
{
  "success": false,
  "error": {
    "code": "IDEMPOTENCY_KEY_MISMATCH",
    "message": "This idempotency key was used with a different request payload"
  }
}
```

---

## Why BullMQ concurrency=1 beats DB locking for payroll

With 14,000 salary credits against one employer account, two approaches exist:

**DB Locking approach (what NovaPay originally had — or worse, didn't have):**
- 14,000 concurrent requests all try `SELECT ... FOR UPDATE` on the same wallet row
- Postgres queues them internally — massive lock contention
- Requests timeout waiting for the lock
- Connection pool exhausted
- Under high load: deadlocks, timeouts, partial failures

**BullMQ concurrency=1 approach (what we use):**
- One job processes all 14,000 credits sequentially in one worker
- No lock contention — only one DB operation touches the employer wallet at a time
- Worker crashes? BullMQ retries the job. Already-completed items are skipped via `itemIndex` checkpoint (only PENDING items are queried).
- Resumable by design — `lastProcessedIndex` tracks progress
- Zero concurrent writes to the employer wallet

**The checkpoint pattern:**
```
PayrollItem.status = PENDING  → not yet processed
PayrollItem.status = COMPLETED → skip on resume
PayrollItem.status = FAILED   → logged, job continues
```
If worker crashes at item 5000, on restart it queries `WHERE status = PENDING ORDER BY itemIndex ASC` and resumes from item 5001.

---

## Double-Entry Invariant

Every money movement creates exactly 2 ledger entries:
- One DEBIT (money leaving a wallet)
- One CREDIT (money entering a wallet)

**Invariant:** `SUM(all DEBITs) = SUM(all CREDITs)` at all times.

Verified via: `GET /api/admin/ledger/verify`

If this check ever returns `isBalanced: false`, it means money was created or destroyed — a critical data integrity failure that must trigger an immediate alert.

---

## Audit Hash Chain

Each `LedgerEntry` has:
- `entryHash` = SHA256(prevHash + transactionId + amount + walletId + entryType)
- `prevEntryHash` = the hash of the previous entry

This creates a blockchain-like chain. If anyone manually edits a ledger row in the DB, the hash of that row will no longer match what the next row expects as `prevEntryHash` — the chain breaks and tampering is detectable.

---

## Tradeoffs Under Time Pressure

1. **No refresh tokens** — JWT is stateless with 7d expiry. Sessions table exists for future invalidation.
2. **No rate limiting per user** — only global rate limiting (200 req/15min). Per-user rate limiting needs Redis sorted sets.
3. **FX provider is a single point of failure** — no fallback provider. By design: never silently apply stale rates.
4. **Observability is logging-only** — Prometheus/Grafana/Jaeger are documented but not wired. Winston structured logs are in place.
5. **No email verification** — users are ACTIVE immediately. Production needs OTP/email flow.

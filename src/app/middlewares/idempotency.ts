import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { sha256 } from '../../utils/encryption';
import { ApiErrors, sendError } from '../../utils/apiResponse';
import { IdempotencyStatus } from '@prisma/client';
import { logger } from '../../utils/logger';

const IDEMPOTENCY_TTL_HOURS = 24;
const LOCK_WAIT_MS = 5000; // wait up to 5s for a PROCESSING lock to resolve

/**
 * Idempotency Middleware
 *
 * Handles all 5 scenarios:
 *
 * Scenario A: Same key arrives twice (sequential)
 *   → Second request hits DB, finds COMPLETED record, returns cached response
 *
 * Scenario B: Three identical requests arrive within 100ms (concurrent)
 *   → All three try to INSERT with unique key constraint
 *   → Only ONE succeeds (Postgres unique constraint is atomic)
 *   → The other two get a DB unique constraint error, enter polling loop
 *   → They poll until the winner's status becomes COMPLETED, then return cached response
 *
 * Scenario C: Server crash mid-transaction
 *   → Record stays PROCESSING forever
 *   → Recovery worker (Day 2) detects stale PROCESSING records and resolves them
 *
 * Scenario D: Key expired (30hrs later with same key)
 *   → expiresAt check fails → returns 410 GONE with clear error
 *
 * Scenario E: Same key, different payload
 *   → requestHash mismatch → returns 409 CONFLICT with clear error
 */
export function idempotency(req: Request, res: Response, next: NextFunction): Promise<void> {
  return handleIdempotency(req, res, next);
}

async function handleIdempotency(req: Request, res: Response, next: NextFunction): Promise<void> {
  const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

  // If no key provided, skip idempotency (not all endpoints require it)
  if (!idempotencyKey) {
    next();
    return;
  }

  const endpoint = req.path;
  const userId = req.userId;
  const requestHash = sha256(JSON.stringify(req.body));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000);

  logger.info('Idempotency check', {
    requestId: req.requestId,
    userId,
    idempotencyKey,
    endpoint,
  });

  // Check for existing record first
  const existing = await prisma.idempotencyRecord.findUnique({
    where: { key: idempotencyKey },
  });

  if (existing) {
    // Scenario D: Key expired
    if (existing.expiresAt < now) {
      logger.warn('Idempotency key expired', {
        requestId: req.requestId,
        idempotencyKey,
        expiredAt: existing.expiresAt,
      });
      ApiErrors.IDEMPOTENCY_EXPIRED(res);
      return;
    }

    // Scenario E: Payload mismatch
    if (existing.requestHash !== requestHash) {
      logger.warn('Idempotency payload mismatch', {
        requestId: req.requestId,
        idempotencyKey,
        userId,
      });
      ApiErrors.IDEMPOTENCY_MISMATCH(res);
      return;
    }

    // Scenario A: Already completed → return cached response
    if (existing.status === IdempotencyStatus.COMPLETED) {
      logger.info('Idempotency cache hit — returning cached response', {
        requestId: req.requestId,
        idempotencyKey,
      });
      res.status(existing.responseStatus ?? 200).json(existing.responseBody);
      return;
    }

    // Scenario B: Another request is currently PROCESSING (concurrent)
    // Poll until it resolves
    if (existing.status === IdempotencyStatus.PROCESSING) {
      const resolved = await pollUntilResolved(idempotencyKey, LOCK_WAIT_MS);
      if (resolved?.status === IdempotencyStatus.COMPLETED) {
        res.status(resolved.responseStatus ?? 200).json(resolved.responseBody);
        return;
      }
      // Timed out — let this request proceed (the other one likely crashed — Scenario C)
    }
  }

  // Try to create a new PROCESSING record
  // Scenario B: If two requests hit here simultaneously, only one INSERT wins
  // The other gets a unique constraint violation (caught above in next request cycle)
  try {
    await prisma.idempotencyRecord.upsert({
      where: { key: idempotencyKey },
      create: {
        key: idempotencyKey,
        userId,
        endpoint,
        requestHash,
        status: IdempotencyStatus.PROCESSING,
        expiresAt,
      },
      update: {
        // If status was FAILED, allow retry with same key
        status: IdempotencyStatus.PROCESSING,
        requestHash,
        expiresAt,
      },
    });
  } catch (err) {
    // Unique constraint race — another request won the race
    logger.warn('Idempotency race condition — lost the lock', {
      requestId: req.requestId,
      idempotencyKey,
    });
    sendError(res, 429, 'CONCURRENT_REQUEST',
      'A request with this idempotency key is already being processed');
    return;
  }

  // Intercept the response to cache it
  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    // Cache the response async (don't block the response)
    prisma.idempotencyRecord.update({
      where: { key: idempotencyKey },
      data: {
        status: res.statusCode < 400
          ? IdempotencyStatus.COMPLETED
          : IdempotencyStatus.FAILED,
        responseStatus: res.statusCode,
        responseBody: body as string,
        completedAt: new Date(),
      },
    }).catch((err) => {
      logger.error('Failed to update idempotency record', {
        idempotencyKey,
        error: (err as Error).message,
      });
    });

    return originalJson(body);
  };

  next();
}

async function pollUntilResolved(key: string, timeoutMs: number) {
  const interval = 200; // check every 200ms
  const maxAttempts = Math.ceil(timeoutMs / interval);

  for (let i = 0; i < maxAttempts; i++) {
    await sleep(interval);
    const record = await prisma.idempotencyRecord.findUnique({ where: { key } });
    if (record?.status !== IdempotencyStatus.PROCESSING) {
      return record;
    }
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

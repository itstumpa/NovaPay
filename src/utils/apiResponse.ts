import { Response } from 'express';

interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId?: string;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  meta?: Record<string, unknown>
): Response {
  const response: SuccessResponse<T> = { success: true, data };
  if (meta) response.meta = meta;
  return res.status(statusCode).json(response);
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown
): Response {
  const requestId = res.locals.requestId as string | undefined;
  const response: ErrorResponse = {
    success: false,
    error: { code, message, details },
    requestId,
  };
  return res.status(statusCode).json(response);
}

// Common error helpers
export const ApiErrors = {
  UNAUTHORIZED: (res: Response) =>
    sendError(res, 401, 'UNAUTHORIZED', 'Authentication required'),

  FORBIDDEN: (res: Response, msg = 'You do not have permission') =>
    sendError(res, 403, 'FORBIDDEN', msg),

  NOT_FOUND: (res: Response, resource = 'Resource') =>
    sendError(res, 404, 'NOT_FOUND', `${resource} not found`),

  VALIDATION: (res: Response, details: unknown) =>
    sendError(res, 422, 'VALIDATION_ERROR', 'Validation failed', details),

  CONFLICT: (res: Response, message: string) =>
    sendError(res, 409, 'CONFLICT', message),

  IDEMPOTENCY_MISMATCH: (res: Response) =>
    sendError(res, 409, 'IDEMPOTENCY_KEY_MISMATCH',
      'This idempotency key was used with a different request payload'),

  IDEMPOTENCY_EXPIRED: (res: Response) =>
    sendError(res, 410, 'IDEMPOTENCY_KEY_EXPIRED',
      'This idempotency key has expired (24hr TTL). Use a new key.'),

  INTERNAL: (res: Response) =>
    sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred'),
};

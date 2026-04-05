import { Response } from 'express';

interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
  requestId?: string;
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
  statusCode: number = 200,
  meta?: Record<string, unknown>
): Response {
  const requestId = res.locals.requestId as string | undefined;
  const response: SuccessResponse<T> = {
    success: true,
    data,
    ...(meta && { meta }),
    ...(requestId && { requestId }),
  };
  return res.status(statusCode).json(response);
}

export function sendError(
  res: Response,
  code: string,
  message: string,
  statusCode: number = 500,
  details?: unknown
): Response {
  const requestId = res.locals.requestId as string | undefined;
  const response: ErrorResponse = {
    success: false,
    error: { code, message, details },
    ...(requestId && { requestId }),
  };
  return res.status(statusCode).json(response);
}

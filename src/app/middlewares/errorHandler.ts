import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';
import { sendError } from '../../utils/apiResponse';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

export function globalErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const requestId = req.requestId;
  const userId = req.userId;

  // Zod validation errors
  if (err instanceof ZodError) {
    sendError(res, 422, 'VALIDATION_ERROR', 'Validation failed', err.issues);
    return;
  }

  // Prisma known errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      // Unique constraint violation
      const field = (err.meta?.target as string[])?.join(', ');
      sendError(res, 409, 'DUPLICATE_ENTRY', `${field} already exists`);
      return;
    }
    if (err.code === 'P2025') {
      sendError(res, 404, 'NOT_FOUND', 'Record not found');
      return;
    }
    if (err.code === 'P2003') {
      sendError(res, 422, 'FOREIGN_KEY_VIOLATION', 'Related record not found');
      return;
    }
  }

  // Log unexpected errors with full context
  logger.error('Unhandled error', {
    requestId,
    userId,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
}

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, 404, 'ROUTE_NOT_FOUND', `Route ${req.method} ${req.path} not found`);
}

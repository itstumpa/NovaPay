import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Attaches a unique requestId to every request.
 * This ties together all logs for a single request — essential for debugging.
 * Also stored in res.locals so it can be included in every API error response.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) ?? uuidv4();
  req.requestId = requestId;
  res.locals.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      userId?: string;
    }
  }
}

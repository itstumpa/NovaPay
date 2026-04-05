import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { sendSuccess, sendError } from '../../utils/apiResponse';
import { z } from 'zod';

const service = new AuthService();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export class AuthController {
  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = registerSchema.parse(req.body);
      const user = await service.register(body);
      sendSuccess(res, user, 201);
    } catch (err) {
      if (err instanceof Error && err.message === 'Email already registered') {
        sendError(res, 409, 'EMAIL_TAKEN', err.message);
        return;
      }
      next(err);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const result = await service.login(
        email,
        password,
        req.ip,
        req.headers['user-agent']
      );
      sendSuccess(res, result);
    } catch (err) {
      if (err instanceof Error && (
        err.message.includes('Invalid') ||
        err.message.includes('suspended') ||
        err.message.includes('pending')
      )) {
        sendError(res, 401, 'AUTH_FAILED', err.message);
        return;
      }
      next(err);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.headers.authorization?.split(' ')[1] ?? '';
      await service.logout(token);
      sendSuccess(res, { message: 'Logged out successfully' });
    } catch (err) { next(err); }
  };

  // Placeholder — full refresh token logic on Day 2 if needed
  refresh = async (req: Request, res: Response) => {
    sendError(res, 501, 'NOT_IMPLEMENTED', 'Token refresh not yet implemented');
  };
}

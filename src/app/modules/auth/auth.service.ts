import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { UserRole, UserStatus } from '@prisma/client';
import { logger } from '../../../utils/logger';

export class AuthService {
  async register(data: {
    email: string;
    password: string;
    name: string;
    role?: UserRole;
  }) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new Error('Email already registered');

    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase().trim(),
        passwordHash,
        name: data.name,
        role: data.role ?? UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
      },
      select: { id: true, email: true, name: true, role: true, status: true, createdAt: true },
    });

    // Auto-create a USD wallet on registration
    await prisma.wallet.create({
      data: { userId: user.id, currency: 'USD', balance: 0 },
    });

    logger.info('New user registered', { userId: user.id, email: user.email, role: user.role });
    return user;
  }

  async login(email: string, password: string, ipAddress?: string, userAgent?: string) {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

    if (!user) throw new Error('Invalid email or password');
    if (user.status === UserStatus.SUSPENDED) throw new Error('Account suspended. Contact support.');
    if (user.status === UserStatus.PENDING_VERIFICATION) throw new Error('Account pending verification');

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) throw new Error('Invalid email or password');

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
    );

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.session.create({
      data: { userId: user.id, token, expiresAt, ipAddress, userAgent },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    logger.info('User logged in', { userId: user.id, email: user.email });

    return {
      token,
      expiresAt,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
      },
    };
  }

  async logout(token: string) {
    await prisma.session.deleteMany({ where: { token } });
    logger.info('User logged out');
  }
}

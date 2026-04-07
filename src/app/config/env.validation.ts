// env.validation.ts

import { env } from './env';

export const validateEnv = () => {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  if (!env.JWT_SECRET) throw new Error('JWT_SECRET is required');
};
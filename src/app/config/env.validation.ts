import { env } from './env';

export const validateEnv = () => {
  const requiredVars = [
    'SUPER_ADMIN_EMAIL',
    'DATABASE_URL',
    'JWT_SECRET',
    'ENCRYPTION_MASTER_KEY',
  ] as const;

  for (const key of requiredVars) {
    if (!env[key]) {
      throw new Error(`Missing required env var: ${key}`);
    }
  }
};
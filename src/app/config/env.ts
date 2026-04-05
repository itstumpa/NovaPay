import dotenv from 'dotenv';
dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const env = {
  NODE_ENV: optional('NODE_ENV', 'development'),
  PORT: parseInt(optional('PORT', '3000')),
  DATABASE_URL: required('DATABASE_URL'),
  REDIS_URL: optional('REDIS_URL', 'redis://localhost:6379'),
FRONTEND_URL: optional('FRONTEND_URL', 'http://localhost:3000'),
  JWT_SECRET: required('JWT_SECRET'),
  JWT_EXPIRES_IN: optional('JWT_EXPIRES_IN', '7d'),

  ENCRYPTION_MASTER_KEY: required('ENCRYPTION_MASTER_KEY'),
  DATA_ENCRYPTION_KEY: required('DATA_ENCRYPTION_KEY'),

  SUPER_ADMIN_EMAIL: required('SUPER_ADMIN_EMAIL'),
  SUPER_ADMIN_PASSWORD: required('SUPER_ADMIN_PASSWORD'),
  SUPER_ADMIN_NAME: optional('SUPER_ADMIN_NAME', 'Super Admin'),

  FX_PROVIDER_URL: optional('FX_PROVIDER_URL', 'https://api.exchangerate-api.com/v4/latest'),
  FX_QUOTE_TTL_SECONDS: parseInt(optional('FX_QUOTE_TTL_SECONDS', '60')),

  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
};

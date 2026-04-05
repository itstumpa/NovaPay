import dotenv from 'dotenv';
dotenv.config();

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export const config = {
  app: {
    env: optional('NODE_ENV', 'development'),
    port: parseInt(optional('PORT', '3000')),
    url: optional('APP_URL', 'http://localhost:3000'),
  },
  db: {
    url: required('DATABASE_URL'),
  },
  redis: {
    url: optional('REDIS_URL', 'redis://localhost:6379'),
  },
  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: optional('JWT_EXPIRES_IN', '7d'),
  },
  encryption: {
    masterKey: required('ENCRYPTION_MASTER_KEY'),
  },
  superAdmin: {
    email: optional('SUPER_ADMIN_EMAIL', 'admin@novapay.com'),
    password: optional('SUPER_ADMIN_PASSWORD', 'Admin@123456'),
    name: optional('SUPER_ADMIN_NAME', 'Super Admin'),
  },
  fx: {
    providerUrl: optional('FX_PROVIDER_URL', 'http://localhost:3001/fx'),
    quoteTtlSeconds: parseInt(optional('FX_QUOTE_TTL_SECONDS', '60')),
  },
  idempotency: {
    keyTtlHours: parseInt(optional('IDEMPOTENCY_KEY_TTL_HOURS', '24')),
  },
  payroll: {
    queueConcurrency: parseInt(optional('PAYROLL_QUEUE_CONCURRENCY', '5')),
  },
} as const;

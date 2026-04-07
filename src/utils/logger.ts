import winston from 'winston';
import { env } from '../app/config/env';

const sensitiveFields = ['password', 'passwordHash', 'token', 'secret', 'cardNumber', 'cvv', 'pin'];

function redactSensitive(obj: Record<string, unknown>): Record<string, unknown> {
  const redacted = { ...obj };
  for (const field of sensitiveFields) {
    if (field in redacted) {
      redacted[field] = '[REDACTED]';
    }
  }
  return redacted;
}

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const safeMeta = redactSensitive(meta as Record<string, unknown>);
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...safeMeta,
    });
  })
);

// ✅ Conditionally create transports
const transports: winston.transport[] = [
  new winston.transports.Console({
    format: env.IS_DEVELOPMENT
      ? winston.format.combine(winston.format.colorize(), winston.format.simple())
      : jsonFormat,
  }),
];

// ❗ Only use file logs in local environment
if (!env.IS_PRODUCTION) {
  transports.push(
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  );
}

export const logger = winston.createLogger({
  level: env.IS_PRODUCTION ? 'info' : 'debug',
  format: jsonFormat,
  transports,
});
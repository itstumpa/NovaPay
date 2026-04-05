import crypto from 'crypto';
import { env } from '../app/config/env';

/**
 * Envelope Encryption — Two-key hierarchy
 *
 * Master Key (KEK - Key Encryption Key): Encrypts the Data Key
 * Data Key (DEK - Data Encryption Key): Encrypts the actual field values
 *
 * Why two keys?
 * - If you need to rotate keys, you only re-encrypt the DEK with the new Master Key
 * - You don't need to re-encrypt every single field in the DB
 * - Master Key lives in env/secrets manager, never touches the DB
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getMasterKey(): Buffer {
  return Buffer.from(env.MASTER_ENCRYPTION_KEY, 'hex');
}

function getDataKey(): Buffer {
  return Buffer.from(env.DATA_ENCRYPTION_KEY, 'hex');
}

/**
 * Encrypt a plain text value using the Data Encryption Key
 * Returns: iv:authTag:encryptedData (all base64, colon-separated)
 */
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getDataKey(), iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Format: base64(iv):base64(authTag):base64(encryptedData)
  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

/**
 * Decrypt a value that was encrypted with encrypt()
 */
export function decrypt(encryptedValue: string): string {
  const [ivBase64, authTagBase64, encryptedBase64] = encryptedValue.split(':');

  if (!ivBase64 || !authTagBase64 || !encryptedBase64) {
    throw new Error('Invalid encrypted value format');
  }

  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  const encrypted = Buffer.from(encryptedBase64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, getDataKey(), iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * Hash a value (one-way) — for things like phone lookup without decrypting
 * Uses HMAC so even the hash can't be brute-forced without the key
 */
export function hashForLookup(value: string): string {
  return crypto
    .createHmac('sha256', getMasterKey())
    .update(value.toLowerCase().trim())
    .digest('hex');
}

/**
 * Generate SHA256 hash — used for ledger audit chain and request hashing
 */
export function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

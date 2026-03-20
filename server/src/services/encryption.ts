import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const ENC_PREFIX = 'ENC:';

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length < 64) {
    // In dev, derive a deterministic key from JWT_SECRET so restarts don't break things
    const fallback = process.env.JWT_SECRET || 'fallback-secret';
    return Buffer.from(crypto.createHash('sha256').update(fallback).digest('hex'), 'hex');
  }
  return Buffer.from(key.substring(0, 64), 'hex');
}

export function encrypt(text: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${ENC_PREFIX}${iv.toString('hex')}:${tag}:${encrypted}`;
}

export function decrypt(value: string): string {
  if (!value.startsWith(ENC_PREFIX)) return value; // legacy plaintext
  const key = getKey();
  const parts = value.slice(ENC_PREFIX.length).split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted value format');
  const [ivHex, tagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function encryptField(value: string | null | undefined): string | null {
  if (!value) return null;
  return encrypt(value);
}

export function decryptField(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return decrypt(value);
  } catch {
    return value; // fallback to plaintext if decryption fails
  }
}

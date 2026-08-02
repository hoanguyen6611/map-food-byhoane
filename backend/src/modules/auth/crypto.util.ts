import { randomBytes, createHash } from 'crypto';
import * as bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 10;

// Passwords: slow, salted, one-way — verified via user-supplied plaintext
// compare, never looked up by hash. bcryptjs (pure JS) is used instead of
// native `bcrypt` to avoid node-gyp native compilation in this environment.
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Refresh/reset tokens: high-entropy random strings that must be looked up
// by exact-match, so a fast deterministic hash (not bcrypt) is correct here.
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

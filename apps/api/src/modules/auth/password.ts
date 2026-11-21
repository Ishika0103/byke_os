import bcrypt from 'bcryptjs';
import { env } from '../../config/env';

/** Hashes a plain-text password with bcrypt (cost from BCRYPT_COST). */
export function hashPlainPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

let dummyHash: Promise<string> | undefined;

/**
 * Spends the same time as a real password check. Used when the email doesn't exist,
 * so response timing doesn't reveal which emails are registered.
 */
export async function simulatePasswordCheck(plain: string): Promise<void> {
  dummyHash ??= bcrypt.hash('timing-equaliser-not-a-real-password', env.BCRYPT_COST);
  await bcrypt.compare(plain, await dummyHash);
}

import { createHash, randomBytes } from 'node:crypto';

/** 256 bits of randomness, base64url: 43 characters. */
export const newToken = () => randomBytes(32).toString('base64url');

/** Only this hash is stored. A token is high-entropy, so a fast hash is enough (no password stretching needed). */
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

const BEARER = /^Bearer ([A-Za-z0-9_-]{43})$/;

export function tokenFromHeader(header: string | undefined): string | null {
  return header?.match(BEARER)?.[1] ?? null;
}

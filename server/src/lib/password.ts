// Password hashing with node:crypto scrypt. Stored as "scrypt$<salt hex>$<hash hex>".
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const KEYLEN = 64;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, KEYLEN, { N: 16384, r: 8, p: 1 }, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

// A throwaway hash so unknown emails cost the same time as wrong passwords.
const DUMMY = hashPassword('not-a-real-password');

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  const hash = stored ?? (await DUMMY);
  const [scheme, saltHex, keyHex] = hash.split('$');
  if (scheme !== 'scrypt' || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = await derive(password, Buffer.from(saltHex, 'hex'));
  const ok = actual.length === expected.length && timingSafeEqual(actual, expected);
  return ok && stored !== null;
}

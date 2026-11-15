// Tiny in-memory fixed-window limiter (single Node process behind Caddy, so no shared store needed).
import { tooMany } from './errors.js';

const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    if (hits.size > 5000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    return;
  }
  h.count += 1;
  if (h.count > max) throw tooMany('too_many_attempts', 'Too many login attempts. Try again in a minute.');
}

/** Forget a key after a successful login. */
export function rateLimitReset(key: string) {
  hits.delete(key);
}

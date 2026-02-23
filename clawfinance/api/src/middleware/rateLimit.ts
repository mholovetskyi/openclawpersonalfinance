import { Request, Response, NextFunction } from "express";

interface RateLimitStore {
  [key: string]: { count: number; resetAt: number };
}

const stores: Record<string, RateLimitStore> = {};

interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  name?: string;
  keyGenerator?: (req: Request) => string;
}

/**
 * Simple in-memory rate limiter. For production, swap to redis-based.
 * No external dependencies needed — keeps the stack lean.
 */
export function rateLimit(options: RateLimitOptions = {}) {
  const {
    windowMs = 60_000,
    max = 100,
    name = "default",
    keyGenerator = (req) => req.ip ?? req.socket.remoteAddress ?? "unknown",
  } = options;

  if (!stores[name]) stores[name] = {};
  const store = stores[name];

  // Periodic cleanup to prevent memory leak
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const key of Object.keys(store)) {
      if (store[key].resetAt <= now) delete store[key];
    }
  }, windowMs * 2);
  cleanupInterval.unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const now = Date.now();

    if (!store[key] || store[key].resetAt <= now) {
      store[key] = { count: 1, resetAt: now + windowMs };
    } else {
      store[key].count++;
    }

    const entry = store[key];
    const remaining = Math.max(0, max - entry.count);

    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({
        error: "Too many requests",
        retry_after_seconds: retryAfter,
      });
      return;
    }

    next();
  };
}

/** Stricter rate limit for auth-sensitive endpoints */
export const authRateLimit = rateLimit({
  windowMs: 60_000,
  max: 10,
  name: "auth",
});

/** Standard API rate limit */
export const apiRateLimit = rateLimit({
  windowMs: 60_000,
  max: 200,
  name: "api",
});

/** Strict rate limit for file uploads */
export const uploadRateLimit = rateLimit({
  windowMs: 60_000,
  max: 10,
  name: "upload",
});

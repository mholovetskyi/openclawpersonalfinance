import { Request, Response, NextFunction } from "express";

/**
 * Security headers middleware. Lightweight alternative to helmet
 * that sets only the headers relevant for a local-first API.
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  // Prevent MIME-type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");

  // XSS protection (legacy browsers)
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Don't send referrer to external sites
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Prevent caching of API responses with sensitive data
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");

  // Content Security Policy for API responses
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; frame-ancestors 'none'"
  );

  // Strict Transport Security (only applies over HTTPS)
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

  // Permissions Policy — deny unnecessary browser features
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );

  next();
}

/**
 * Request ID middleware — adds a unique request ID for tracing.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = req.headers["x-request-id"] as string ?? crypto.randomUUID();
  res.setHeader("X-Request-Id", id);
  (req as any).requestId = id;
  next();
}

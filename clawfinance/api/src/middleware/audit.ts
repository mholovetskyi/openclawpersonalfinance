import { Request, Response, NextFunction } from "express";
import { pool } from "../services/db.js";

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001";

// Map HTTP methods to audit actions
const METHOD_TO_ACTION: Record<string, string> = {
  GET: "read",
  POST: "create",
  PUT: "update",
  PATCH: "update",
  DELETE: "delete",
};

// Routes that should be audited (resource_type extraction)
function extractResourceType(path: string): string | null {
  const match = path.match(/^\/api\/([a-z-]+)/);
  return match?.[1]?.replace(/-/g, "_") ?? null;
}

function extractResourceId(path: string): string | null {
  const match = path.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  return match?.[1] ?? null;
}

/**
 * Audit logging middleware. Logs all state-changing API requests
 * (POST, PUT, PATCH, DELETE) and optionally reads for sensitive resources.
 */
export function auditLog(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  const action = METHOD_TO_ACTION[method];

  // Only audit state-changing operations and certain reads
  if (!action || (action === "read" && !isSensitiveRead(req.path))) {
    next();
    return;
  }

  // Log after response is sent (non-blocking)
  const originalEnd = res.end;
  (res as any).end = function (...args: any[]) {
    // Only log successful operations
    if (res.statusCode < 400) {
      const resourceType = extractResourceType(req.path);
      if (resourceType) {
        logAuditEntry({
          action: getSpecificAction(req, action),
          resourceType,
          resourceId: extractResourceId(req.path),
          ip: req.ip ?? req.socket.remoteAddress ?? null,
          requestId: (req as any).requestId ?? null,
          details: buildDetails(req, res),
        }).catch((err) => console.error("[audit] log error:", err));
      }
    }
    return originalEnd.apply(res, args as any);
  };

  next();
}

function isSensitiveRead(path: string): boolean {
  return /\/(tax|data|preferences)/.test(path);
}

function getSpecificAction(req: Request, defaultAction: string): string {
  if (req.path.includes("/export")) return "export";
  if (req.path.includes("/import")) return "import";
  if (req.path.includes("/upload")) return "upload";
  return defaultAction;
}

function buildDetails(req: Request, res: Response): Record<string, unknown> {
  const details: Record<string, unknown> = {
    method: req.method,
    path: req.path,
    status: res.statusCode,
  };

  // Include query params for reads
  if (req.method === "GET" && Object.keys(req.query).length > 0) {
    details.query = req.query;
  }

  return details;
}

async function logAuditEntry(entry: {
  action: string;
  resourceType: string;
  resourceId: string | null;
  ip: string | null;
  requestId: string | null;
  details: Record<string, unknown>;
}): Promise<void> {
  await pool.query(
    `INSERT INTO audit_log (user_id, action, resource_type, resource_id, ip_address, request_id, details)
     VALUES ($1, $2, $3, $4, $5::inet, $6, $7)`,
    [
      DEFAULT_USER_ID,
      entry.action,
      entry.resourceType,
      entry.resourceId,
      entry.ip,
      entry.requestId,
      JSON.stringify(entry.details),
    ]
  );
}

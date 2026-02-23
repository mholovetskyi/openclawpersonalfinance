/**
 * Shared test helpers for ClawFinance API tests.
 *
 * Each test file mocks its own db/websocket dependencies via vi.mock (hoisted),
 * then uses these helpers to build a minimal Express app for the route under test.
 */
import express, { Router } from "express";

/**
 * Build a minimal Express app mounting `router` at `path`.
 * Auth middleware is NOT applied by default — add it explicitly in auth-specific tests.
 */
export function makeApp(path: string, router: Router) {
  const app = express();
  app.use(express.json());
  app.use(path, router);
  // 404 fallback
  app.use((_req: express.Request, res: express.Response) => {
    res.status(404).json({ error: "Not found" });
  });
  return app;
}

/** Stub DB result for pool.query: wraps rows in the expected pg QueryResult shape. */
export function dbResult<T>(rows: T[], rowCount?: number) {
  return { rows, rowCount: rowCount ?? rows.length, command: "SELECT", oid: 0, fields: [] };
}

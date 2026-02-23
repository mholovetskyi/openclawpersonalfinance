import express from "express";
import cors from "cors";
import { localAuth } from "./middleware/auth.js";
import { securityHeaders, requestId } from "./middleware/security.js";
import { apiRateLimit, uploadRateLimit } from "./middleware/rateLimit.js";
import { auditLog } from "./middleware/audit.js";
import accountsRouter from "./routes/accounts.js";
import transactionsRouter from "./routes/transactions.js";
import insightsRouter from "./routes/insights.js";
import networthRouter from "./routes/networth.js";
import budgetsRouter from "./routes/budgets.js";
import portfolioRouter from "./routes/portfolio.js";
import taxRouter from "./routes/tax.js";
import researchRouter from "./routes/research.js";
import chatRouter from "./routes/chat.js";
import healthRouter from "./routes/health.js";
import preferencesRouter from "./routes/preferences.js";
import goalsRouter from "./routes/goals.js";
import categoriesRouter from "./routes/categories.js";
import dataRouter from "./routes/data.js";
import flinksRouter from "./routes/connectors/flinks.js";

export function createApp() {
  const app = express();

  // Security: headers, request tracing, body parsing
  app.use(securityHeaders);
  app.use(requestId);
  app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173" }));
  app.use(express.json({ limit: "5mb" }));

  // Rate limiting (applied before auth)
  app.use("/api", apiRateLimit);
  app.use("/api/tax/documents/upload", uploadRateLimit);

  // Health check — no auth required
  app.get("/health", (_req, res) => res.json({ status: "ok", service: "clawfinance-api" }));
  app.use("/api/health", healthRouter);

  // All /api routes require auth
  app.use("/api", localAuth);

  // Audit logging (after auth, before routes)
  app.use("/api", auditLog);

  // Core finance routes
  app.use("/api/accounts", accountsRouter);
  app.use("/api/transactions", transactionsRouter);
  app.use("/api/insights", insightsRouter);
  app.use("/api/networth", networthRouter);
  app.use("/api/budgets", budgetsRouter);
  app.use("/api/portfolio", portfolioRouter);
  app.get("/api/holdings", (req, res, next) => {
    req.url = "/holdings";
    portfolioRouter(req, res, next);
  });
  app.use("/api/tax", taxRouter);
  app.use("/api/research", researchRouter);
  app.use("/api/chat", chatRouter);

  // Personalization & customization routes
  app.use("/api/preferences", preferencesRouter);
  app.use("/api/goals", goalsRouter);
  app.use("/api/categories", categoriesRouter);

  // Data management routes
  app.use("/api/data", dataRouter);

  // Custom connectors
  app.use("/api/connectors/flinks", flinksRouter);

  // 404 fallback
  app.use((_req, res) => res.status(404).json({ error: "Not found" }));

  return app;
}

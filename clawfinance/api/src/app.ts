import express from "express";
import cors from "cors";
import { localAuth } from "./middleware/auth.js";
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

export function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173" }));
  app.use(express.json());

  // Health check — no auth required
  app.get("/health", (_req, res) => res.json({ status: "ok", service: "clawfinance-api" }));
  app.use("/api/health", healthRouter);

  // All /api routes require auth
  app.use("/api", localAuth);
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

  // 404 fallback
  app.use((_req, res) => res.status(404).json({ error: "Not found" }));

  return app;
}

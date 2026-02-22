import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";
import { initWebSocket } from "./services/websocket.js";
import { localAuth } from "./middleware/auth.js";
import accountsRouter from "./routes/accounts.js";
import transactionsRouter from "./routes/transactions.js";
import insightsRouter from "./routes/insights.js";
import networthRouter from "./routes/networth.js";

const app = express();
const PORT = Number(process.env.API_PORT ?? 3001);

app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json());

// Health check — no auth required
app.get("/health", (_req, res) => res.json({ status: "ok", service: "clawfinance-api" }));

// All /api routes require auth
app.use("/api", localAuth);
app.use("/api/accounts", accountsRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/insights", insightsRouter);
app.use("/api/networth", networthRouter);

// Phase 1 stubs — return 501 with a helpful message
const STUB_ROUTES = ["/api/holdings", "/api/portfolio", "/api/budgets", "/api/tax", "/api/research"];
for (const path of STUB_ROUTES) {
  app.use(path, (_req, res) => res.status(501).json({ error: `${path} not yet implemented (Phase 2+)` }));
}

// 404 fallback
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

const server = http.createServer(app);
initWebSocket(server);

server.listen(PORT, () => {
  console.log(`[api] ClawFinance API listening on http://localhost:${PORT}`);
  console.log(`[api] WebSocket available at ws://localhost:${PORT}/ws`);
});

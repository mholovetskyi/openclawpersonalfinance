import { Router } from "express";
import net from "node:net";
import { pool } from "../services/db.js";

const router = Router();

/** Ping a TCP host:port. Resolves true/false within `timeout` ms. */
function tcpPing(host: string, port: number, timeout = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeout);
    socket.connect(port, host, () => finish(true));
    socket.on("error", () => finish(false));
    socket.on("timeout", () => finish(false));
  });
}

/** Check which integrations have their env vars configured. */
function integrationStatus(): Record<string, { configured: boolean; label: string }> {
  const check = (keys: string[]) => keys.every((k) => !!process.env[k]);

  return {
    anthropic: {
      configured: check(["ANTHROPIC_API_KEY"]),
      label: check(["ANTHROPIC_API_KEY"]) ? "Connected" : "Not configured",
    },
    plaid: {
      configured: check(["PLAID_CLIENT_ID", "PLAID_SECRET"]),
      label: check(["PLAID_CLIENT_ID", "PLAID_SECRET"])
        ? `${process.env.PLAID_ENV ?? "sandbox"} env`
        : "Not configured",
    },
    snaptrade: {
      configured: check(["SNAPTRADE_CLIENT_ID", "SNAPTRADE_CONSUMER_KEY"]),
      label: check(["SNAPTRADE_CLIENT_ID", "SNAPTRADE_CONSUMER_KEY"]) ? "Connected" : "Not configured",
    },
    finnhub: {
      configured: check(["FINNHUB_API_KEY"]),
      label: check(["FINNHUB_API_KEY"]) ? "Connected" : "Not configured",
    },
    azure_doc_intel: {
      configured: check(["AZURE_DOC_INTEL_ENDPOINT", "AZURE_DOC_INTEL_KEY"]),
      label: check(["AZURE_DOC_INTEL_ENDPOINT", "AZURE_DOC_INTEL_KEY"]) ? "Connected" : "Not configured",
    },
    taxbandits: {
      configured: check(["TAXBANDITS_API_KEY"]),
      label: check(["TAXBANDITS_API_KEY"]) ? "Connected" : "Not configured",
    },
    twitter: {
      configured: check(["TWITTER_API_KEY", "TWITTER_API_SECRET"]),
      label: check(["TWITTER_API_KEY", "TWITTER_API_SECRET"]) ? "Connected" : "Not configured",
    },
    serpapi: {
      configured: check(["SERPAPI_KEY"]),
      label: check(["SERPAPI_KEY"]) ? "Connected" : "Not configured",
    },
  };
}

// GET /api/health — detailed system status
router.get("/", async (_req, res) => {
  // DB check
  let dbStatus = "ok";
  try {
    await pool.query("SELECT 1");
  } catch (err) {
    dbStatus = "error";
  }

  // Redis check via TCP
  let redisStatus = "ok";
  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
  try {
    const url = new URL(redisUrl);
    const host = url.hostname;
    const port = parseInt(url.port || "6379", 10);
    const reachable = await tcpPing(host, port);
    if (!reachable) redisStatus = "unreachable";
  } catch {
    redisStatus = "error";
  }

  const overall = dbStatus === "ok" && redisStatus === "ok" ? "healthy" : "degraded";

  res.json({
    status: overall,
    service: "clawfinance-api",
    version: "1.0.0",
    db: dbStatus,
    redis: redisStatus,
    integrations: integrationStatus(),
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

export default router;

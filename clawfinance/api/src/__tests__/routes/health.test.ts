import { vi, describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

// ── Mocks (hoisted) ────────────────────────────────────────────────────────────

const mockQuery = vi.hoisted(() => vi.fn());
vi.mock("../../services/db.js", () => ({
  pool: { query: mockQuery, on: vi.fn() },
}));

// Mock node:net so the TCP Redis ping always resolves as reachable.
// health.ts does `import net from "node:net"` (default import), so the
// factory must expose the mocked Socket on the `default` export.
vi.mock("node:net", () => {
  class MockSocket {
    setTimeout() {}
    destroy() {}
    // Immediately invokes the connect callback → tcpPing resolves true
    connect(_port: number, _host: string, cb: () => void) {
      cb();
    }
    on() {}
  }
  return { default: { Socket: MockSocket }, Socket: MockSocket };
});

import healthRouter from "../../routes/health.js";

// ── App ────────────────────────────────────────────────────────────────────────

function makeApp() {
  const app = express();
  app.use(express.json());
  // Mirror production mounts
  app.get("/health", (_req, res) => res.json({ status: "ok", service: "clawfinance-api" }));
  app.use("/api/health", healthRouter);
  return app;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("GET /health", () => {
  it("returns 200 with basic ok shape (no auth required)", async () => {
    const res = await request(makeApp()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", service: "clawfinance-api" });
  });
});

describe("GET /api/health", () => {
  beforeEach(() => {
    mockQuery.mockResolvedValue({ rows: [{ "?column?": 1 }], rowCount: 1 });
  });

  it("returns 200 with healthy status when DB and Redis are reachable", async () => {
    const res = await request(makeApp()).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
    expect(res.body.db).toBe("ok");
    expect(res.body.redis).toBe("ok");
    expect(res.body.service).toBe("clawfinance-api");
    expect(res.body.version).toBe("1.0.0");
    expect(typeof res.body.uptime).toBe("number");
    expect(typeof res.body.timestamp).toBe("string");
  });

  it("returns all integration fields", async () => {
    const res = await request(makeApp()).get("/api/health");
    const integrations = res.body.integrations;
    expect(integrations).toHaveProperty("anthropic");
    expect(integrations).toHaveProperty("plaid");
    expect(integrations).toHaveProperty("snaptrade");
    expect(integrations).toHaveProperty("finnhub");
    expect(integrations).toHaveProperty("azure_doc_intel");
    expect(integrations).toHaveProperty("taxbandits");
    expect(integrations).toHaveProperty("twitter");
    expect(integrations).toHaveProperty("serpapi");
  });

  it("reports integrations as not configured when env keys are absent", async () => {
    const saved = {
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      PLAID_CLIENT_ID: process.env.PLAID_CLIENT_ID,
    };
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.PLAID_CLIENT_ID;

    const res = await request(makeApp()).get("/api/health");
    expect(res.body.integrations.anthropic.configured).toBe(false);
    expect(res.body.integrations.plaid.configured).toBe(false);

    Object.assign(process.env, saved);
  });

  it("reports integration as configured when env key is present", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    const res = await request(makeApp()).get("/api/health");
    expect(res.body.integrations.anthropic.configured).toBe(true);
    expect(res.body.integrations.anthropic.label).toBe("Connected");
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("returns degraded status when DB query fails", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB connection refused"));
    const res = await request(makeApp()).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("degraded");
    expect(res.body.db).toBe("error");
  });
});

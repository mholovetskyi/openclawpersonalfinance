import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import express from "express";
import { securityHeaders, requestId } from "../middleware/security.js";

vi.mock("../services/db.js", () => ({
  pool: { query: vi.fn(), on: vi.fn() },
}));

describe("securityHeaders middleware", () => {
  it("sets all required security headers", async () => {
    const app = express();
    app.use(securityHeaders);
    app.get("/", (_req, res) => res.json({ ok: true }));

    const res = await request(app).get("/");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["x-xss-protection"]).toBe("1; mode=block");
    expect(res.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(res.headers["cache-control"]).toContain("no-store");
    expect(res.headers["strict-transport-security"]).toContain("max-age=");
  });
});

describe("requestId middleware", () => {
  it("generates a request ID when none provided", async () => {
    const app = express();
    app.use(requestId);
    app.get("/", (_req, res) => res.json({ ok: true }));

    const res = await request(app).get("/");
    expect(res.headers["x-request-id"]).toBeDefined();
    expect(res.headers["x-request-id"].length).toBeGreaterThan(0);
  });

  it("passes through existing request ID", async () => {
    const app = express();
    app.use(requestId);
    app.get("/", (_req, res) => res.json({ ok: true }));

    const res = await request(app).get("/").set("x-request-id", "my-trace-123");
    expect(res.headers["x-request-id"]).toBe("my-trace-123");
  });
});

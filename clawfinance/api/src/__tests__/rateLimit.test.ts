import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import express from "express";
import { rateLimit } from "../middleware/rateLimit.js";

vi.mock("../services/db.js", () => ({
  pool: { query: vi.fn(), on: vi.fn() },
}));

describe("rateLimit middleware", () => {
  it("allows requests under the limit", async () => {
    const app = express();
    app.use(rateLimit({ windowMs: 60_000, max: 5, name: "test-allow" }));
    app.get("/", (_req, res) => res.json({ ok: true }));

    for (let i = 0; i < 5; i++) {
      const res = await request(app).get("/");
      expect(res.status).toBe(200);
    }
  });

  it("blocks requests over the limit with 429", async () => {
    const app = express();
    app.use(rateLimit({ windowMs: 60_000, max: 2, name: "test-block" }));
    app.get("/", (_req, res) => res.json({ ok: true }));

    await request(app).get("/");
    await request(app).get("/");
    const res = await request(app).get("/");
    expect(res.status).toBe(429);
    expect(res.body.error).toBe("Too many requests");
    expect(res.body.retry_after_seconds).toBeGreaterThan(0);
  });

  it("sets rate limit headers", async () => {
    const app = express();
    app.use(rateLimit({ windowMs: 60_000, max: 10, name: "test-headers" }));
    app.get("/", (_req, res) => res.json({ ok: true }));

    const res = await request(app).get("/");
    expect(res.headers["x-ratelimit-limit"]).toBe("10");
    expect(res.headers["x-ratelimit-remaining"]).toBe("9");
    expect(res.headers["x-ratelimit-reset"]).toBeDefined();
  });
});

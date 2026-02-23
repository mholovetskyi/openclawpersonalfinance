import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";

// localAuth reads CLAWFINANCE_API_KEY at call time — no db dependency
import { localAuth } from "../../middleware/auth.js";

function makeAuthApp() {
  const app = express();
  app.use(express.json());
  app.use(localAuth);
  app.get("/protected", (_req, res) => res.json({ ok: true }));
  return app;
}

describe("localAuth middleware", () => {
  const originalKey = process.env.CLAWFINANCE_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.CLAWFINANCE_API_KEY;
    } else {
      process.env.CLAWFINANCE_API_KEY = originalKey;
    }
  });

  it("passes through when no API key is configured", async () => {
    delete process.env.CLAWFINANCE_API_KEY;
    const res = await request(makeAuthApp()).get("/protected");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("passes through when the correct key is provided", async () => {
    process.env.CLAWFINANCE_API_KEY = "secret-key";
    const res = await request(makeAuthApp())
      .get("/protected")
      .set("x-api-key", "secret-key");
    expect(res.status).toBe(200);
  });

  it("returns 401 when the wrong key is provided", async () => {
    process.env.CLAWFINANCE_API_KEY = "secret-key";
    const res = await request(makeAuthApp())
      .get("/protected")
      .set("x-api-key", "wrong-key");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Unauthorized");
  });

  it("returns 401 when the key header is missing entirely", async () => {
    process.env.CLAWFINANCE_API_KEY = "secret-key";
    const res = await request(makeAuthApp()).get("/protected");
    expect(res.status).toBe(401);
  });

  it("is case-sensitive for the key value", async () => {
    process.env.CLAWFINANCE_API_KEY = "Secret-Key";
    const res = await request(makeAuthApp())
      .get("/protected")
      .set("x-api-key", "secret-key");
    expect(res.status).toBe(401);
  });
});

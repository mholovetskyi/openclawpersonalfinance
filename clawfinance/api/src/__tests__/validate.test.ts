import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { Router } from "express";
import { z } from "zod";
import { makeApp } from "./helpers.js";
import { validate } from "../middleware/validate.js";

vi.mock("../services/db.js", () => ({
  pool: { query: vi.fn(), on: vi.fn() },
}));

describe("validate middleware", () => {
  const schema = z.object({ name: z.string().min(1), amount: z.number().positive() });

  function buildTestApp() {
    const router = Router();
    router.post("/", validate({ body: schema }), (_req, res) => {
      res.json({ data: _req.body });
    });
    return makeApp("/test", router);
  }

  it("accepts valid body", async () => {
    const app = buildTestApp();
    const res = await request(app).post("/test").send({ name: "Rent", amount: 1500 });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Rent");
  });

  it("rejects missing required field", async () => {
    const app = buildTestApp();
    const res = await request(app).post("/test").send({ amount: 1500 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it("rejects invalid type", async () => {
    const app = buildTestApp();
    const res = await request(app).post("/test").send({ name: "Rent", amount: "not-a-number" });
    expect(res.status).toBe(400);
  });

  it("rejects negative amount", async () => {
    const app = buildTestApp();
    const res = await request(app).post("/test").send({ name: "Rent", amount: -100 });
    expect(res.status).toBe(400);
  });

  it("validates query parameters", async () => {
    const querySchema = z.object({ limit: z.coerce.number().int().min(1).max(100) });
    const router = Router();
    router.get("/", validate({ query: querySchema }), (req, res) => {
      res.json({ limit: req.query.limit });
    });
    const app = makeApp("/test", router);

    const valid = await request(app).get("/test?limit=50");
    expect(valid.status).toBe(200);

    const invalid = await request(app).get("/test?limit=999");
    expect(invalid.status).toBe(400);
  });

  it("validates params", async () => {
    const paramsSchema = z.object({ id: z.string().uuid() });
    const router = Router();
    router.get("/:id", validate({ params: paramsSchema }), (req, res) => {
      res.json({ id: req.params.id });
    });
    const app = makeApp("/test", router);

    const valid = await request(app).get("/test/550e8400-e29b-41d4-a716-446655440000");
    expect(valid.status).toBe(200);

    const invalid = await request(app).get("/test/not-a-uuid");
    expect(invalid.status).toBe(400);
  });
});

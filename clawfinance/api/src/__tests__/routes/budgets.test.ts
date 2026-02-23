import { vi, describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { makeApp, dbResult } from "../helpers.js";

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockQuery = vi.hoisted(() => vi.fn());
vi.mock("../../services/db.js", () => ({
  pool: { query: mockQuery, on: vi.fn() },
}));

import budgetsRouter from "../../routes/budgets.js";

const app = makeApp("/api/budgets", budgetsRouter);

// ── Fixtures ───────────────────────────────────────────────────────────────────

const BUDGET = {
  id: "bgt-1",
  category: "Groceries",
  monthly_limit: 500,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  spent_this_month: 312.5,
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("GET /api/budgets", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with budgets array", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([BUDGET]));
    const res = await request(app).get("/api/budgets");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].category).toBe("Groceries");
  });

  it("returns 200 with empty array when no budgets", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([]));
    const res = await request(app).get("/api/budgets");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("returns 500 on DB error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));
    const res = await request(app).get("/api/budgets");
    expect(res.status).toBe(500);
  });
});

describe("POST /api/budgets", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a budget and returns 201", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([BUDGET]));
    const res = await request(app)
      .post("/api/budgets")
      .send({ category: "Groceries", monthly_limit: 500 });
    expect(res.status).toBe(201);
    expect(res.body.data.category).toBe("Groceries");
    expect(res.body.data.monthly_limit).toBe(500);
  });

  it("returns 400 when category is missing", async () => {
    const res = await request(app).post("/api/budgets").send({ monthly_limit: 500 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/category/i);
  });

  it("returns 400 when monthly_limit is missing", async () => {
    const res = await request(app).post("/api/budgets").send({ category: "Groceries" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/monthly_limit/i);
  });

  it("returns 500 on DB error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));
    const res = await request(app)
      .post("/api/budgets")
      .send({ category: "Groceries", monthly_limit: 500 });
    expect(res.status).toBe(500);
  });
});

describe("PUT /api/budgets/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates and returns the budget", async () => {
    const updated = { ...BUDGET, monthly_limit: 600 };
    mockQuery.mockResolvedValueOnce(dbResult([updated], 1));
    const res = await request(app)
      .put("/api/budgets/bgt-1")
      .send({ monthly_limit: 600 });
    expect(res.status).toBe(200);
    expect(res.body.data.monthly_limit).toBe(600);
  });

  it("returns 400 when monthly_limit is missing", async () => {
    const res = await request(app).put("/api/budgets/bgt-1").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/monthly_limit/i);
  });

  it("returns 404 when budget does not exist", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([], 0));
    const res = await request(app)
      .put("/api/budgets/nonexistent")
      .send({ monthly_limit: 600 });
    expect(res.status).toBe(404);
  });

  it("returns 500 on DB error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));
    const res = await request(app).put("/api/budgets/bgt-1").send({ monthly_limit: 600 });
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/budgets/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("soft-deletes and returns 204", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([{ id: "bgt-1" }], 1));
    const res = await request(app).delete("/api/budgets/bgt-1");
    expect(res.status).toBe(204);
  });

  it("returns 404 when budget does not exist", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([], 0));
    const res = await request(app).delete("/api/budgets/nonexistent");
    expect(res.status).toBe(404);
  });

  it("returns 500 on DB error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));
    const res = await request(app).delete("/api/budgets/bgt-1");
    expect(res.status).toBe(500);
  });
});

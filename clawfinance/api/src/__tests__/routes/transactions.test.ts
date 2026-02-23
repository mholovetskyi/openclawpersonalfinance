import { vi, describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { makeApp, dbResult } from "../helpers.js";

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockQuery = vi.hoisted(() => vi.fn());
vi.mock("../../services/db.js", () => ({
  pool: { query: mockQuery, on: vi.fn() },
}));

import transactionsRouter from "../../routes/transactions.js";

const app = makeApp("/api/transactions", transactionsRouter);

// ── Tests ──────────────────────────────────────────────────────────────────────

const SAMPLE_TX = {
  id: "tx-1",
  account_id: "acc-1",
  institution_name: "Chase",
  account_name: "Checking",
  amount: 42.5,
  date: "2026-01-15",
  name: "Whole Foods",
  merchant_name: "Whole Foods Market",
  category: "Groceries",
  subcategory: null,
  pending: false,
  is_recurring: false,
  notes: null,
};

describe("GET /api/transactions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with transactions array", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([SAMPLE_TX]));
    const res = await request(app).get("/api/transactions");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].merchant_name).toBe("Whole Foods Market");
  });

  it("accepts date range query params", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([SAMPLE_TX]));
    const res = await request(app).get("/api/transactions?start=2026-01-01&end=2026-01-31");
    expect(res.status).toBe(200);
    // Verify query was called (date params were passed)
    expect(mockQuery).toHaveBeenCalledOnce();
    const [sql, params] = mockQuery.mock.calls[0];
    expect(params).toContain("2026-01-01");
    expect(params).toContain("2026-01-31");
  });

  it("accepts category filter", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([SAMPLE_TX]));
    const res = await request(app).get("/api/transactions?category=Groceries");
    expect(res.status).toBe(200);
    const [, params] = mockQuery.mock.calls[0];
    expect(params).toContain("Groceries");
  });

  it("accepts account_id filter", async () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    mockQuery.mockResolvedValueOnce(dbResult([SAMPLE_TX]));
    const res = await request(app).get(`/api/transactions?account_id=${uuid}`);
    expect(res.status).toBe(200);
    const [, params] = mockQuery.mock.calls[0];
    expect(params).toContain(uuid);
  });

  it("rejects invalid account_id format", async () => {
    const res = await request(app).get("/api/transactions?account_id=not-a-uuid");
    expect(res.status).toBe(400);
  });

  it("returns 200 with empty array when no transactions", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([]));
    const res = await request(app).get("/api/transactions");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("returns 500 on DB error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB down"));
    const res = await request(app).get("/api/transactions");
    expect(res.status).toBe(500);
  });
});

describe("GET /api/transactions/summary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with summary for a valid month", async () => {
    // summary route makes 2 queries: total + by_category
    mockQuery
      .mockResolvedValueOnce(dbResult([{ total_spend: "1500.00", total_income: "4000.00" }]))
      .mockResolvedValueOnce(dbResult([
        { category: "Groceries", total: "400.00" },
        { category: "Restaurants", total: "200.00" },
      ]));

    const res = await request(app).get("/api/transactions/summary?month=2026-01");
    expect(res.status).toBe(200);
    expect(res.body.data.month).toBe("2026-01");
    expect(res.body.data.total_spend).toBe(1500);
    expect(res.body.data.total_income).toBe(4000);
    expect(res.body.data.by_category.Groceries).toBe(400);
    expect(res.body.data.by_category.Restaurants).toBe(200);
  });

  it("returns 400 when month param is missing", async () => {
    const res = await request(app).get("/api/transactions/summary");
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("returns 500 on DB error", async () => {
    mockQuery.mockRejectedValue(new Error("DB error"));
    const res = await request(app).get("/api/transactions/summary?month=2026-01");
    expect(res.status).toBe(500);
    mockQuery.mockReset();
  });
});

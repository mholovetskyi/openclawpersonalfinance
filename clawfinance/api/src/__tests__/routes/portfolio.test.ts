import { vi, describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { makeApp, dbResult } from "../helpers.js";

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockQuery = vi.hoisted(() => vi.fn());
vi.mock("../../services/db.js", () => ({
  pool: { query: mockQuery, on: vi.fn() },
}));

import portfolioRouter from "../../routes/portfolio.js";

const app = makeApp("/api/portfolio", portfolioRouter);

// ── Fixtures ───────────────────────────────────────────────────────────────────

const PORTFOLIO_SUMMARY = {
  position_count: "5",
  total_value: "82400.00",
  total_cost_basis: "65000.00",
  total_unrealized_gl: "17400.00",
  equities_value: "61800.00",
  etf_value: "14420.00",
  fund_value: "0.00",
  bond_value: "2180.00",
};

const HOLDING = {
  id: "hld-1",
  ticker_symbol: "AAPL",
  security_name: "Apple Inc.",
  security_type: "equity",
  quantity: "10",
  cost_basis_per_share: "145.00",
  cost_basis_total: "1450.00",
  market_price: "178.50",
  market_value: "1785.00",
  unrealized_gain_loss: "335.00",
  unrealized_gain_loss_pct: "23.1",
  acquisition_date: "2024-01-15",
  last_updated: "2026-02-22T08:00:00Z",
  account_name: "Fidelity Brokerage",
  institution_name: "Fidelity",
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("GET /api/portfolio", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with portfolio summary", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([PORTFOLIO_SUMMARY]));
    const res = await request(app).get("/api/portfolio");
    expect(res.status).toBe(200);
    expect(res.body.data.total_value).toBe(82400);
    expect(res.body.data.total_cost_basis).toBe(65000);
    expect(res.body.data.position_count).toBe(5);
    expect(res.body.data.by_type).toBeDefined();
    expect(res.body.data.by_type.equities).toBe(61800);
  });

  it("calculates unrealized_gl_pct correctly", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([PORTFOLIO_SUMMARY]));
    const res = await request(app).get("/api/portfolio");
    // total_unrealized_gl / total_cost_basis * 100 = 17400 / 65000 * 100 ≈ 26.77
    expect(res.body.data.total_unrealized_gl_pct).toBeCloseTo(26.77, 1);
  });

  it("returns zero pct when cost basis is 0", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([{ ...PORTFOLIO_SUMMARY, total_cost_basis: "0.00" }]));
    const res = await request(app).get("/api/portfolio");
    expect(res.body.data.total_unrealized_gl_pct).toBe(0);
  });

  it("returns 500 on DB error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));
    const res = await request(app).get("/api/portfolio");
    expect(res.status).toBe(500);
  });
});

describe("GET /api/portfolio/holdings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with holdings array", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([HOLDING]));
    const res = await request(app).get("/api/portfolio/holdings");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].ticker_symbol).toBe("AAPL");
  });

  it("filters by security_type", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([HOLDING]));
    const res = await request(app).get("/api/portfolio/holdings?type=equity");
    expect(res.status).toBe(200);
    const [, params] = mockQuery.mock.calls[0];
    expect(params).toContain("equity");
  });

  it("filters by account_id", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([HOLDING]));
    const res = await request(app).get("/api/portfolio/holdings?account_id=acc-1");
    expect(res.status).toBe(200);
    const [, params] = mockQuery.mock.calls[0];
    expect(params).toContain("acc-1");
  });

  it("returns empty array when no holdings", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([]));
    const res = await request(app).get("/api/portfolio/holdings");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("returns 500 on DB error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));
    const res = await request(app).get("/api/portfolio/holdings");
    expect(res.status).toBe(500);
  });
});

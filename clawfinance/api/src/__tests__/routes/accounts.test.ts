import { vi, describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { makeApp, dbResult } from "../helpers.js";

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockQuery = vi.hoisted(() => vi.fn());
vi.mock("../../services/db.js", () => ({
  pool: { query: mockQuery, on: vi.fn() },
}));

import accountsRouter from "../../routes/accounts.js";

const app = makeApp("/api/accounts", accountsRouter);

// ── Tests ──────────────────────────────────────────────────────────────────────

const SAMPLE_ACCOUNT = {
  id: "acc-1",
  institution_name: "Chase",
  account_name: "Checking",
  type: "depository",
  subtype: "checking",
  mask: "4242",
  balance_current: 5000,
  balance_available: 4800,
  balance_limit: null,
  currency_code: "USD",
  api_source: "plaid",
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-02-01T00:00:00Z",
};

describe("GET /api/accounts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with accounts array", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([SAMPLE_ACCOUNT]));
    const res = await request(app).get("/api/accounts");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].institution_name).toBe("Chase");
  });

  it("returns 200 with empty array when no accounts exist", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([]));
    const res = await request(app).get("/api/accounts");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("returns 200 with multiple accounts", async () => {
    const accounts = [SAMPLE_ACCOUNT, { ...SAMPLE_ACCOUNT, id: "acc-2", account_name: "Savings" }];
    mockQuery.mockResolvedValueOnce(dbResult(accounts));
    const res = await request(app).get("/api/accounts");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it("returns 500 when database throws", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));
    const res = await request(app).get("/api/accounts");
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Internal server error");
  });
});

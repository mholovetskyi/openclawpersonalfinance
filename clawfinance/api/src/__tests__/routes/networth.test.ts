import { vi, describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { makeApp, dbResult } from "../helpers.js";

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockQuery = vi.hoisted(() => vi.fn());
vi.mock("../../services/db.js", () => ({
  pool: { query: mockQuery, on: vi.fn() },
}));

import networthRouter from "../../routes/networth.js";

const app = makeApp("/api/networth", networthRouter);

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("GET /api/networth", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with current net worth and history", async () => {
    mockQuery
      .mockResolvedValueOnce(dbResult([{ total_assets: "125000.00", total_liabilities: "18500.00" }]))
      .mockResolvedValueOnce(dbResult([
        { date: "2026-01-01", net_worth: "100000.00" },
        { date: "2026-02-01", net_worth: "106500.00" },
      ]));

    const res = await request(app).get("/api/networth");
    expect(res.status).toBe(200);
    expect(res.body.data.current.total_assets).toBe(125000);
    expect(res.body.data.current.total_liabilities).toBe(18500);
    expect(res.body.data.current.net_worth).toBe(106500);
    expect(res.body.data.history).toHaveLength(2);
  });

  it("correctly calculates net_worth as assets minus liabilities", async () => {
    mockQuery
      .mockResolvedValueOnce(dbResult([{ total_assets: "200000.00", total_liabilities: "50000.00" }]))
      .mockResolvedValueOnce(dbResult([]));

    const res = await request(app).get("/api/networth");
    expect(res.body.data.current.net_worth).toBe(150000);
  });

  it("returns net_worth of 0 when no accounts exist", async () => {
    mockQuery
      .mockResolvedValueOnce(dbResult([{ total_assets: "0", total_liabilities: "0" }]))
      .mockResolvedValueOnce(dbResult([]));

    const res = await request(app).get("/api/networth");
    expect(res.status).toBe(200);
    expect(res.body.data.current.net_worth).toBe(0);
    expect(res.body.data.history).toEqual([]);
  });

  it("returns 500 on DB error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));
    const res = await request(app).get("/api/networth");
    expect(res.status).toBe(500);
  });
});

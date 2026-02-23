import { vi, describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { makeApp, dbResult } from "../helpers.js";

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockQuery = vi.hoisted(() => vi.fn());
vi.mock("../../services/db.js", () => ({
  pool: { query: mockQuery, on: vi.fn() },
}));
vi.mock("../../services/websocket.js", () => ({ broadcast: vi.fn() }));

import insightsRouter from "../../routes/insights.js";

const app = makeApp("/api/insights", insightsRouter);

// ── Fixtures ───────────────────────────────────────────────────────────────────

const INSIGHT = {
  id: "ins-1",
  agent: "skill-budget",
  type: "budget_alert",
  severity: "warning",
  title: "Restaurants budget exceeded",
  description: "You've spent $287 of your $200 restaurant budget.",
  data: { category: "Restaurants", overage: 87 },
  status: "new",
  created_at: "2026-02-22T09:00:00Z",
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("GET /api/insights", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with insights array", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([INSIGHT]));
    const res = await request(app).get("/api/insights");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].type).toBe("budget_alert");
  });

  it("filters by status when provided", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([INSIGHT]));
    const res = await request(app).get("/api/insights?status=new");
    expect(res.status).toBe(200);
    const [, params] = mockQuery.mock.calls[0];
    expect(params).toContain("new");
  });

  it("returns 200 with empty array when no insights", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([]));
    const res = await request(app).get("/api/insights");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("returns 500 on DB error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));
    const res = await request(app).get("/api/insights");
    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/insights/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks insight as viewed", async () => {
    const updated = { ...INSIGHT, status: "viewed" };
    mockQuery.mockResolvedValueOnce(dbResult([updated], 1));
    const res = await request(app)
      .patch("/api/insights/ins-1")
      .send({ status: "viewed" });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("viewed");
  });

  it("marks insight as dismissed", async () => {
    const updated = { ...INSIGHT, status: "dismissed" };
    mockQuery.mockResolvedValueOnce(dbResult([updated], 1));
    const res = await request(app)
      .patch("/api/insights/ins-1")
      .send({ status: "dismissed" });
    expect(res.status).toBe(200);
  });

  it("marks insight as acted_on", async () => {
    const updated = { ...INSIGHT, status: "acted_on" };
    mockQuery.mockResolvedValueOnce(dbResult([updated], 1));
    const res = await request(app)
      .patch("/api/insights/ins-1")
      .send({ status: "acted_on" });
    expect(res.status).toBe(200);
  });

  it("returns 400 for invalid status value", async () => {
    const res = await request(app)
      .patch("/api/insights/ins-1")
      .send({ status: "deleted" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/viewed|dismissed|acted_on/);
  });

  it("returns 404 when insight does not exist", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([], 0));
    const res = await request(app)
      .patch("/api/insights/nonexistent")
      .send({ status: "viewed" });
    expect(res.status).toBe(404);
  });

  it("returns 500 on DB error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));
    const res = await request(app)
      .patch("/api/insights/ins-1")
      .send({ status: "viewed" });
    expect(res.status).toBe(500);
  });
});

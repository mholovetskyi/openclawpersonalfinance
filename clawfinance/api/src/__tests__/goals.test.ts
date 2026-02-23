import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { makeApp, dbResult } from "./helpers.js";

const mockQuery = vi.fn();
vi.mock("../services/db.js", () => ({
  pool: { query: (...args: unknown[]) => mockQuery(...args), on: vi.fn() },
}));

import goalsRouter from "../routes/goals.js";

describe("Goals API", () => {
  const app = makeApp("/api/goals", goalsRouter);

  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe("GET /api/goals", () => {
    it("returns list of goals with progress_pct", async () => {
      mockQuery.mockResolvedValueOnce(dbResult([
        { id: "1", name: "Emergency Fund", type: "emergency_fund", target_amount: "10000", current_amount: "5000", target_date: null, notes: null, is_active: true, completed_at: null, created_at: "2025-01-01" },
      ]));

      const res = await request(app).get("/api/goals");
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].progress_pct).toBe(50);
    });
  });

  describe("POST /api/goals", () => {
    it("creates a goal with valid data", async () => {
      const goal = { name: "Vacation Fund", type: "savings", target_amount: 5000 };
      mockQuery.mockResolvedValueOnce(dbResult([{ id: "new-id", ...goal }]));

      const res = await request(app).post("/api/goals").send(goal);
      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe("Vacation Fund");
    });

    it("rejects missing name", async () => {
      const res = await request(app).post("/api/goals").send({ type: "savings", target_amount: 5000 });
      expect(res.status).toBe(400);
    });

    it("rejects invalid type", async () => {
      const res = await request(app).post("/api/goals").send({ name: "Test", type: "invalid_type", target_amount: 5000 });
      expect(res.status).toBe(400);
    });

    it("rejects negative target_amount", async () => {
      const res = await request(app).post("/api/goals").send({ name: "Test", type: "savings", target_amount: -100 });
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /api/goals/:id", () => {
    it("soft-deletes with valid UUID", async () => {
      mockQuery.mockResolvedValueOnce(dbResult([{ id: "550e8400-e29b-41d4-a716-446655440000" }]));
      const res = await request(app).delete("/api/goals/550e8400-e29b-41d4-a716-446655440000");
      expect(res.status).toBe(204);
    });

    it("returns 400 for invalid UUID", async () => {
      const res = await request(app).delete("/api/goals/not-a-uuid");
      expect(res.status).toBe(400);
    });

    it("returns 404 for non-existent goal", async () => {
      mockQuery.mockResolvedValueOnce(dbResult([], 0));
      const res = await request(app).delete("/api/goals/550e8400-e29b-41d4-a716-446655440000");
      expect(res.status).toBe(404);
    });
  });
});

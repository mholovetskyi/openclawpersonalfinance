import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { makeApp, dbResult } from "./helpers.js";

const mockQuery = vi.fn();
vi.mock("../services/db.js", () => ({
  pool: { query: (...args: unknown[]) => mockQuery(...args), on: vi.fn() },
}));

import preferencesRouter from "../routes/preferences.js";

describe("Preferences API", () => {
  const app = makeApp("/api/preferences", preferencesRouter);

  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe("GET /api/preferences", () => {
    it("returns existing preferences", async () => {
      mockQuery.mockResolvedValueOnce(dbResult([{
        currency: "USD",
        locale: "en-US",
        date_format: "YYYY-MM-DD",
        theme: "dark",
        default_date_range_days: 30,
        dashboard_layout: "default",
      }]));

      const res = await request(app).get("/api/preferences");
      expect(res.status).toBe(200);
      expect(res.body.data.currency).toBe("USD");
    });
  });

  describe("PUT /api/preferences", () => {
    it("updates currency", async () => {
      mockQuery.mockResolvedValueOnce(dbResult([{ currency: "EUR" }]));

      const res = await request(app).put("/api/preferences").send({ currency: "EUR" });
      expect(res.status).toBe(200);
    });

    it("rejects invalid currency length", async () => {
      const res = await request(app).put("/api/preferences").send({ currency: "USDD" });
      expect(res.status).toBe(400);
    });

    it("rejects invalid theme", async () => {
      const res = await request(app).put("/api/preferences").send({ theme: "neon" });
      expect(res.status).toBe(400);
    });

    it("rejects invalid date format", async () => {
      const res = await request(app).put("/api/preferences").send({ date_format: "INVALID" });
      expect(res.status).toBe(400);
    });
  });
});

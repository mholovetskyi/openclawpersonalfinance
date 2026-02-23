import { vi, describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { makeApp, dbResult } from "../helpers.js";

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockQuery = vi.hoisted(() => vi.fn());
vi.mock("../../services/db.js", () => ({
  pool: { query: mockQuery, on: vi.fn() },
}));
// Mock mkdirSync to avoid creating directories during tests
vi.mock("node:fs", async (importOriginal) => {
  const mod = await importOriginal<typeof import("node:fs")>();
  return { ...mod, mkdirSync: vi.fn() };
});

import taxRouter from "../../routes/tax.js";

const app = makeApp("/api/tax", taxRouter);

// ── Fixtures ───────────────────────────────────────────────────────────────────

const TAX_ESTIMATE = {
  tax_year: 2025,
  filing_status: "single",
  estimated_income: 95000,
  estimated_tax: 16200,
  effective_rate: 17.05,
  marginal_rate: 22.0,
  quarterly_payment: 4050,
};

const TAX_DOC = {
  id: "doc-1",
  year: 2025,
  form_type: "W-2",
  issuer_name: "Acme Corp",
  file_path: "/uploads/w2.pdf",
  total_income: 95000,
  total_tax_withheld: 12000,
  state_tax: 4750,
  date_ingested: "2026-02-01T00:00:00Z",
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("GET /api/tax/estimate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with estimate data when available", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([{ metadata: TAX_ESTIMATE }]));
    const res = await request(app).get("/api/tax/estimate");
    expect(res.status).toBe(200);
    expect(res.body.data.tax_year).toBe(2025);
    expect(res.body.data.estimated_tax).toBe(16200);
  });

  it("returns 404 when no estimate exists", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([]));
    const res = await request(app).get("/api/tax/estimate");
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/No tax estimate/);
  });

  it("returns 500 on DB error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));
    const res = await request(app).get("/api/tax/estimate");
    expect(res.status).toBe(500);
  });
});

describe("GET /api/tax/documents", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with documents array", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([TAX_DOC]));
    const res = await request(app).get("/api/tax/documents");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].form_type).toBe("W-2");
  });

  it("filters by year when provided", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([TAX_DOC]));
    const res = await request(app).get("/api/tax/documents?year=2025");
    expect(res.status).toBe(200);
    const [, params] = mockQuery.mock.calls[0];
    expect(params).toContain(2025);
  });

  it("returns 500 on DB error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));
    const res = await request(app).get("/api/tax/documents");
    expect(res.status).toBe(500);
  });
});

describe("POST /api/tax/documents/upload", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when no file is uploaded", async () => {
    // Send without a file attachment
    const res = await request(app)
      .post("/api/tax/documents/upload")
      .field("form_type", "W-2");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/No file/i);
  });

  it("returns 400 when form_type is missing", async () => {
    // Send a buffer with valid PDF magic bytes but omit form_type
    const pdfBuffer = Buffer.from("%PDF-1.4 dummy pdf content");
    const res = await request(app)
      .post("/api/tax/documents/upload")
      .attach("file", pdfBuffer, { filename: "test.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/form_type/i);
  });
});

describe("GET /api/tax/deductions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with deductions and total", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([
      { id: "ded-1", year: 2025, type: "Home Office", amount: "2400.00", source: "manual", status: "claimed", created_at: "2026-01-01" },
      { id: "ded-2", year: 2025, type: "Charity", amount: "500.00", source: "manual", status: "claimed", created_at: "2026-01-02" },
    ]));
    const res = await request(app).get("/api/tax/deductions");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total_deductions).toBe(2900);
  });

  it("returns 0 total when no deductions", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([]));
    const res = await request(app).get("/api/tax/deductions");
    expect(res.status).toBe(200);
    expect(res.body.total_deductions).toBe(0);
  });
});

describe("GET /api/tax/withholding-check", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with withholding check data", async () => {
    mockQuery
      .mockResolvedValueOnce(dbResult([{ total: "12000.00" }]))  // withholding
      .mockResolvedValueOnce(dbResult([{ metadata: { tax: { total_federal: 16000 } } }]));  // estimate

    const res = await request(app).get("/api/tax/withholding-check");
    expect(res.status).toBe(200);
    expect(res.body.data.total_withheld).toBe(12000);
    expect(res.body.data.estimated_annual_tax).toBe(16000);
    expect(typeof res.body.data.safe_harbor_pct).toBe("number");
    expect(res.body.data.at_risk).toBe(true); // 12000/16000 = 75% < 90%
  });

  it("returns null for estimate fields when no estimate exists", async () => {
    mockQuery
      .mockResolvedValueOnce(dbResult([{ total: "0.00" }]))
      .mockResolvedValueOnce(dbResult([]));

    const res = await request(app).get("/api/tax/withholding-check");
    expect(res.status).toBe(200);
    expect(res.body.data.estimated_annual_tax).toBeNull();
    expect(res.body.data.at_risk).toBe(false);
  });
});

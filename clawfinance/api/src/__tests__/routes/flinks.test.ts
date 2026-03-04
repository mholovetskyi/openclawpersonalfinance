import { vi, describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { makeApp, dbResult } from "../helpers.js";

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockQuery = vi.hoisted(() => vi.fn());
vi.mock("../../services/db.js", () => ({
  pool: { query: mockQuery, on: vi.fn() },
}));

const mockAuthorize = vi.hoisted(() => vi.fn());
const mockGetAccountsDetail = vi.hoisted(() => vi.fn());
const mockGetAccountsDetailAsync = vi.hoisted(() => vi.fn());
vi.mock("../../services/flinks.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/flinks.js")>();
  return {
    ...actual,
    authorize: mockAuthorize,
    getAccountsDetail: mockGetAccountsDetail,
    getAccountsDetailAsync: mockGetAccountsDetailAsync,
  };
});

import flinksRouter from "../../routes/flinks.js";

const app = makeApp("/api/flinks", flinksRouter);

// ── Fixtures ────────────────────────────────────────────────────────────────────

const FLINKS_AUTH_OK = {
  HttpStatusCode: 200,
  RequestId: "req-abc-123",
  Login: { Id: "login-xyz", Username: "TestUser", IsScheduledRefresh: false, LastRefresh: "2026-01-01" },
  Institution: "FlinksCapital",
};

const FLINKS_ACCOUNTS = {
  HttpStatusCode: 200,
  RequestId: "req-abc-123",
  Accounts: [
    {
      Id: "acct-001",
      Title: "Chequing CAD",
      AccountNumber: "1234567890",
      Type: "Chequing",
      Currency: "CAD",
      Category: "Operations",
      Balance: { Available: 5000, Current: 5200, Limit: 0 },
      Transactions: [
        {
          TransactionId: "txn-001",
          Date: "2026/02/15",
          Description: "GROCERY STORE",
          Debit: 45.99,
          Credit: 0,
          Balance: 5154.01,
        },
      ],
    },
  ],
};

const SAMPLE_FLINKS_ACCOUNT = {
  id: "acc-f1",
  institution_name: "FlinksCapital",
  account_name: "Chequing CAD",
  type: "depository",
  subtype: "checking",
  mask: "7890",
  balance_current: 5200,
  balance_available: 5000,
  balance_limit: null,
  currency_code: "CAD",
  api_source: "flinks",
  is_active: true,
  flinks_login_id: "login-xyz",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-02-01T00:00:00Z",
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("POST /api/flinks/connect", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when login_id is missing", async () => {
    const res = await request(app).post("/api/flinks/connect").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/login_id/i);
  });

  it("returns mfa_required when Flinks sends security challenges", async () => {
    mockAuthorize.mockResolvedValueOnce({
      HttpStatusCode: 200,
      RequestId: "req-mfa",
      SecurityChallenges: [{ Prompt: "What is your favorite color?", Type: "QuestionAndAnswer" }],
    });

    const res = await request(app)
      .post("/api/flinks/connect")
      .send({ login_id: "login-xyz" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("mfa_required");
    expect(res.body.challenges).toHaveLength(1);
  });

  it("returns 502 when Flinks authorize fails", async () => {
    mockAuthorize.mockResolvedValueOnce({
      HttpStatusCode: 401,
      FlinksCode: "INVALID_LOGIN",
    });

    const res = await request(app)
      .post("/api/flinks/connect")
      .send({ login_id: "bad-login" });

    expect(res.status).toBe(502);
    expect(res.body.flinks_code).toBe("INVALID_LOGIN");
  });

  it("returns 201 with synced accounts on success", async () => {
    mockAuthorize.mockResolvedValueOnce(FLINKS_AUTH_OK);
    mockGetAccountsDetail.mockResolvedValueOnce(FLINKS_ACCOUNTS);
    // upsertAccounts: INSERT account + SELECT account ID + INSERT transaction
    mockQuery
      .mockResolvedValueOnce(dbResult([]))  // INSERT account
      .mockResolvedValueOnce(dbResult([{ id: "acc-f1" }]))  // SELECT account by external_id
      .mockResolvedValueOnce(dbResult([]));  // INSERT transaction

    const res = await request(app)
      .post("/api/flinks/connect")
      .send({ login_id: "login-xyz" });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("connected");
    expect(res.body.accounts_synced).toBe(1);
  });

  it("returns pending when data is still processing", async () => {
    mockAuthorize.mockResolvedValueOnce(FLINKS_AUTH_OK);
    mockGetAccountsDetail.mockResolvedValueOnce({ HttpStatusCode: 202, FlinksCode: "OPERATION_PENDING" });
    // 3 async poll attempts also return 202
    mockGetAccountsDetailAsync
      .mockResolvedValueOnce({ HttpStatusCode: 202 })
      .mockResolvedValueOnce({ HttpStatusCode: 202 })
      .mockResolvedValueOnce({ HttpStatusCode: 202 });

    const res = await request(app)
      .post("/api/flinks/connect")
      .send({ login_id: "login-xyz" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("pending");
    expect(res.body.request_id).toBe("req-abc-123");
  }, 45000);

  it("returns 500 on unexpected error", async () => {
    mockAuthorize.mockRejectedValueOnce(new Error("Network error"));

    const res = await request(app)
      .post("/api/flinks/connect")
      .send({ login_id: "login-xyz" });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Internal server error");
  });
});

describe("POST /api/flinks/poll", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when request_id is missing", async () => {
    const res = await request(app).post("/api/flinks/poll").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/request_id/i);
  });

  it("returns pending when still processing", async () => {
    mockGetAccountsDetailAsync.mockResolvedValueOnce({ HttpStatusCode: 202 });

    const res = await request(app)
      .post("/api/flinks/poll")
      .send({ request_id: "req-abc-123" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("pending");
  });

  it("returns connected when data is ready", async () => {
    mockGetAccountsDetailAsync.mockResolvedValueOnce(FLINKS_ACCOUNTS);
    mockQuery
      .mockResolvedValueOnce(dbResult([]))  // INSERT account
      .mockResolvedValueOnce(dbResult([{ id: "acc-f1" }]))  // SELECT account by external_id
      .mockResolvedValueOnce(dbResult([]));  // INSERT transaction

    const res = await request(app)
      .post("/api/flinks/poll")
      .send({ request_id: "req-abc-123", login_id: "login-xyz" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("connected");
    expect(res.body.accounts_synced).toBe(1);
  });
});

describe("GET /api/flinks/connections", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with Flinks accounts", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([SAMPLE_FLINKS_ACCOUNT]));

    const res = await request(app).get("/api/flinks/connections");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].institution_name).toBe("FlinksCapital");
  });

  it("returns 200 with empty array when no Flinks accounts", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([]));

    const res = await request(app).get("/api/flinks/connections");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("returns 500 on DB error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app).get("/api/flinks/connections");
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/flinks/connections/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 when connection is deactivated", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([{ id: "acc-f1" }], 1));

    const res = await request(app).delete("/api/flinks/connections/acc-f1");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("disconnected");
  });

  it("returns 404 when connection not found", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([], 0));

    const res = await request(app).delete("/api/flinks/connections/nonexistent");
    expect(res.status).toBe(404);
  });

  it("returns 500 on DB error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app).delete("/api/flinks/connections/acc-f1");
    expect(res.status).toBe(500);
  });
});

describe("POST /api/flinks/sync", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ok with message when no Flinks accounts exist", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([]));

    const res = await request(app).post("/api/flinks/sync");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.message).toMatch(/no flinks/i);
  });

  it("syncs accounts grouped by login_id", async () => {
    // First query: fetch all Flinks accounts
    mockQuery.mockResolvedValueOnce(dbResult([
      { id: "acc-f1", external_id: "flinks_acct-001", institution_name: "FlinksCapital", flinks_login_id: "login-xyz" },
    ]));

    mockAuthorize.mockResolvedValueOnce(FLINKS_AUTH_OK);
    mockGetAccountsDetail.mockResolvedValueOnce(FLINKS_ACCOUNTS);

    // upsertAccounts calls
    mockQuery
      .mockResolvedValueOnce(dbResult([]))  // INSERT account
      .mockResolvedValueOnce(dbResult([{ id: "acc-f1" }]))  // SELECT account by external_id
      .mockResolvedValueOnce(dbResult([]));  // INSERT transaction

    const res = await request(app).post("/api/flinks/sync");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.accounts_synced).toBe(1);
  });

  it("returns 500 on unexpected error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app).post("/api/flinks/sync");
    expect(res.status).toBe(500);
  });
});

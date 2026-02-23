import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { makeApp, dbResult } from "./helpers.js";

const mockQuery = vi.fn();
vi.mock("../services/db.js", () => ({
  pool: { query: (...args: unknown[]) => mockQuery(...args), on: vi.fn() },
}));

// Mock the Flinks connector API calls
const mockAuthorize = vi.fn();
const mockAuthorizeWithLogin = vi.fn();
const mockAnswerMfa = vi.fn();
const mockGetAccountsSummary = vi.fn();
const mockGetAccountsDetail = vi.fn();
const mockGetAccountsDetailAsync = vi.fn();

vi.mock("../connectors/flinks.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../connectors/flinks.js")>();
  return {
    ...actual,
    authorize: (...args: unknown[]) => mockAuthorize(...args),
    authorizeWithLogin: (...args: unknown[]) => mockAuthorizeWithLogin(...args),
    answerMfa: (...args: unknown[]) => mockAnswerMfa(...args),
    getAccountsSummary: (...args: unknown[]) => mockGetAccountsSummary(...args),
    getAccountsDetail: (...args: unknown[]) => mockGetAccountsDetail(...args),
    getAccountsDetailAsync: (...args: unknown[]) => mockGetAccountsDetailAsync(...args),
    encryptLoginId: (id: string) => `encrypted_${id}`,
    decryptLoginId: (enc: string) => enc.replace("encrypted_", ""),
  };
});

import flinksRouter from "../routes/connectors/flinks.js";

describe("Flinks Connector API", () => {
  const app = makeApp("/api/connectors/flinks", flinksRouter);

  beforeEach(() => {
    mockQuery.mockReset();
    mockAuthorize.mockReset();
    mockAuthorizeWithLogin.mockReset();
    mockAnswerMfa.mockReset();
    mockGetAccountsSummary.mockReset();
    mockGetAccountsDetail.mockReset();
    mockGetAccountsDetailAsync.mockReset();
  });

  // ── POST /authorize ─────────────────────────────────────────────────────

  describe("POST /api/connectors/flinks/authorize", () => {
    it("returns connected status on successful auth", async () => {
      mockAuthorize.mockResolvedValueOnce({
        RequestId: "req-123",
        Login: { Username: "user1", Id: "login-456", IsScheduledRefresh: false, LastRefresh: "", Type: "Personal" },
        Institution: "FlinksCapital",
        HttpStatusCode: 200,
      });
      mockQuery.mockResolvedValueOnce(dbResult([]));

      const res = await request(app)
        .post("/api/connectors/flinks/authorize")
        .send({ institution: "FlinksCapital", username: "Greatday", password: "Everyday" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("connected");
      expect(res.body.request_id).toBe("req-123");
      expect(res.body.login_id).toBe("login-456");
      expect(mockAuthorize).toHaveBeenCalledWith("FlinksCapital", "Greatday", "Everyday");
    });

    it("returns MFA challenges on HTTP 203", async () => {
      mockAuthorize.mockResolvedValueOnce({
        RequestId: "req-mfa",
        SecurityChallenges: [
          { Type: "QuestionAndAnswer", Prompt: "What is your favorite color?" },
        ],
        HttpStatusCode: 203,
      });
      mockQuery.mockResolvedValueOnce(dbResult([]));

      const res = await request(app)
        .post("/api/connectors/flinks/authorize")
        .send({ institution: "FlinksCapital", username: "Greatday", password: "Everyday" });

      expect(res.status).toBe(203);
      expect(res.body.status).toBe("mfa_required");
      expect(res.body.challenges).toHaveLength(1);
      expect(res.body.challenges[0].prompt).toBe("What is your favorite color?");
    });

    it("rejects missing institution", async () => {
      const res = await request(app)
        .post("/api/connectors/flinks/authorize")
        .send({ username: "user", password: "pass" });

      expect(res.status).toBe(400);
    });

    it("rejects missing password", async () => {
      const res = await request(app)
        .post("/api/connectors/flinks/authorize")
        .send({ institution: "FlinksCapital", username: "user" });

      expect(res.status).toBe(400);
    });
  });

  // ── POST /mfa ───────────────────────────────────────────────────────────

  describe("POST /api/connectors/flinks/mfa", () => {
    it("completes MFA successfully", async () => {
      mockAnswerMfa.mockResolvedValueOnce({
        RequestId: "req-after-mfa",
        Login: { Username: "user1", Id: "login-789" },
        Institution: "FlinksCapital",
        HttpStatusCode: 200,
      });
      mockQuery.mockResolvedValueOnce(dbResult([{ id: "conn-1" }]));

      const res = await request(app)
        .post("/api/connectors/flinks/mfa")
        .send({
          request_id: "550e8400-e29b-41d4-a716-446655440000",
          responses: { "What is your favorite color?": "Blue" },
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("connected");
    });

    it("rejects invalid request_id format", async () => {
      const res = await request(app)
        .post("/api/connectors/flinks/mfa")
        .send({ request_id: "not-a-uuid", responses: {} });

      expect(res.status).toBe(400);
    });
  });

  // ── GET /connections ────────────────────────────────────────────────────

  describe("GET /api/connectors/flinks/connections", () => {
    it("returns list of connections", async () => {
      mockQuery.mockResolvedValueOnce(dbResult([
        { id: "conn-1", institution: "FlinksCapital", status: "active", last_synced_at: "2026-02-01", error_message: null, created_at: "2026-01-01", updated_at: "2026-02-01" },
      ]));

      const res = await request(app).get("/api/connectors/flinks/connections");
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].institution).toBe("FlinksCapital");
    });
  });

  // ── DELETE /connections/:id ─────────────────────────────────────────────

  describe("DELETE /api/connectors/flinks/connections/:id", () => {
    it("disconnects a connection", async () => {
      mockQuery
        .mockResolvedValueOnce(dbResult([{ id: "550e8400-e29b-41d4-a716-446655440000", institution: "FlinksCapital" }]))
        .mockResolvedValueOnce(dbResult([]));

      const res = await request(app).delete("/api/connectors/flinks/connections/550e8400-e29b-41d4-a716-446655440000");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("disconnected");
    });

    it("returns 404 for non-existent connection", async () => {
      mockQuery.mockResolvedValueOnce(dbResult([]));

      const res = await request(app).delete("/api/connectors/flinks/connections/550e8400-e29b-41d4-a716-446655440000");
      expect(res.status).toBe(404);
    });

    it("rejects invalid UUID", async () => {
      const res = await request(app).delete("/api/connectors/flinks/connections/bad-id");
      expect(res.status).toBe(400);
    });
  });

  // ── POST /sync/:id ─────────────────────────────────────────────────────

  describe("POST /api/connectors/flinks/sync/:id", () => {
    const connId = "550e8400-e29b-41d4-a716-446655440000";

    it("syncs accounts and transactions", async () => {
      // Connection lookup
      mockQuery.mockResolvedValueOnce(dbResult([{
        id: connId,
        institution: "FlinksCapital",
        login_id_encrypted: "encrypted_login-123",
        last_request_id: "old-req",
        status: "active",
        last_synced_at: null,
      }]));

      // Re-authorize
      mockAuthorizeWithLogin.mockResolvedValueOnce({
        RequestId: "new-req",
        Login: { Username: "user1", Id: "login-123" },
        Institution: "FlinksCapital",
        HttpStatusCode: 200,
      });

      // Update last_request_id
      mockQuery.mockResolvedValueOnce(dbResult([]));

      // GetAccountsDetail
      mockGetAccountsDetail.mockResolvedValueOnce({
        RequestId: "new-req",
        Accounts: [{
          Id: "acc-1",
          Title: "Chequing",
          AccountNumber: "1234567890",
          Balance: { Current: 5000.50, Available: 4500.00 },
          Category: "Operations",
          Type: "Chequing",
          Currency: "CAD",
          Holder: "John Doe",
          Transactions: [
            { Id: "tx-1", Date: "2026-02-15T00:00:00", Debit: 50.00, Credit: null, Balance: 4950.50, Description: "Coffee Shop" },
            { Id: "tx-2", Date: "2026-02-14T00:00:00", Debit: null, Credit: 2000.00, Balance: 5000.50, Description: "Payroll Deposit" },
          ],
        }],
        Login: { Username: "user1", Id: "login-123" },
        Institution: "FlinksCapital",
        HttpStatusCode: 200,
      });

      // Account upsert + transaction upserts + final update
      mockQuery.mockResolvedValue(dbResult([{ id: "local-acc-1" }]));

      const res = await request(app)
        .post(`/api/connectors/flinks/sync/${connId}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("synced");
      expect(res.body.accounts_synced).toBe(1);
      expect(res.body.transactions_synced).toBe(2);
    });

    it("returns 404 for non-existent connection", async () => {
      mockQuery.mockResolvedValueOnce(dbResult([]));

      const res = await request(app)
        .post(`/api/connectors/flinks/sync/${connId}`)
        .send({});

      expect(res.status).toBe(404);
    });

    it("returns 400 for non-active connection", async () => {
      mockQuery.mockResolvedValueOnce(dbResult([{
        id: connId,
        institution: "FlinksCapital",
        login_id_encrypted: "encrypted_login-123",
        last_request_id: "old-req",
        status: "error",
        last_synced_at: null,
      }]));

      const res = await request(app)
        .post(`/api/connectors/flinks/sync/${connId}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });
});

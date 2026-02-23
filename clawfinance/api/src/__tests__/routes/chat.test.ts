import { vi, describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { makeApp, dbResult } from "../helpers.js";

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockQuery = vi.hoisted(() => vi.fn());
vi.mock("../../services/db.js", () => ({
  pool: { query: mockQuery, on: vi.fn() },
}));
vi.mock("../../services/websocket.js", () => ({
  broadcast: vi.fn(),
  initWebSocket: vi.fn(),
}));

import chatRouter from "../../routes/chat.js";

const app = makeApp("/api/chat", chatRouter);

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // chat route does 2 inserts (user msg + assistant msg)
    mockQuery.mockResolvedValue(dbResult([]));
  });

  it("returns 200 with session_id and processing status", async () => {
    const res = await request(app)
      .post("/api/chat")
      .send({ message: "How much did I spend on restaurants?" });
    expect(res.status).toBe(200);
    expect(res.body.session_id).toBeDefined();
    expect(res.body.status).toBe("processing");
  });

  it("accepts an explicit session_id", async () => {
    const res = await request(app)
      .post("/api/chat")
      .send({ message: "Check my budget", session_id: "sess-abc" });
    expect(res.status).toBe(200);
    expect(res.body.session_id).toBe("sess-abc");
  });

  it("returns 400 when message is missing", async () => {
    const res = await request(app).post("/api/chat").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/message/i);
  });

  it("returns 400 when message is blank whitespace", async () => {
    const res = await request(app).post("/api/chat").send({ message: "   " });
    expect(res.status).toBe(400);
  });

  it("routes budget keywords to skill-budget", async () => {
    await request(app).post("/api/chat").send({ message: "How is my spending?" });
    // Second query should persist the assistant message with the budget agent
    const calls = mockQuery.mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(2);
    const assistantInsert = calls[1];
    expect(assistantInsert[1]).toContain("skill-budget");
  });

  it("routes portfolio keywords to skill-investment", async () => {
    await request(app).post("/api/chat").send({ message: "How is my portfolio performing?" });
    const calls = mockQuery.mock.calls;
    const assistantInsert = calls[1];
    expect(assistantInsert[1]).toContain("skill-investment");
  });

  it("routes tax keywords to skill-tax", async () => {
    await request(app).post("/api/chat").send({ message: "How much tax do I owe?" });
    const calls = mockQuery.mock.calls;
    const assistantInsert = calls[1];
    expect(assistantInsert[1]).toContain("skill-tax");
  });

  it("routes research keywords to skill-research", async () => {
    await request(app).post("/api/chat").send({ message: "Any news about AAPL?" });
    const calls = mockQuery.mock.calls;
    const assistantInsert = calls[1];
    expect(assistantInsert[1]).toContain("skill-research");
  });

  it("defaults to orchestrator for unrecognized queries", async () => {
    await request(app).post("/api/chat").send({ message: "Hello there!" });
    const calls = mockQuery.mock.calls;
    const assistantInsert = calls[1];
    expect(assistantInsert[1]).toContain("skill-finance-orchestrator");
  });
});

describe("GET /api/chat/history/:sessionId", () => {
  beforeEach(() => vi.clearAllMocks());

  const MESSAGES = [
    { id: "msg-1", role: "user", content: "Hello", agent: null, metadata: null, created_at: "2026-02-22T10:00:00Z" },
    { id: "msg-2", role: "assistant", content: "Hi!", agent: "skill-finance-orchestrator", metadata: null, created_at: "2026-02-22T10:00:01Z" },
  ];

  it("returns 200 with message history for a session", async () => {
    mockQuery.mockResolvedValueOnce(dbResult(MESSAGES));
    const res = await request(app).get("/api/chat/history/sess-abc");
    expect(res.status).toBe(200);
    expect(res.body.session_id).toBe("sess-abc");
    expect(res.body.data).toHaveLength(2);
  });

  it("returns empty history for a session with no messages", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([]));
    const res = await request(app).get("/api/chat/history/sess-empty");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("returns 500 on DB error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));
    const res = await request(app).get("/api/chat/history/sess-abc");
    expect(res.status).toBe(500);
  });
});

describe("GET /api/chat/sessions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with list of sessions", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([
      { session_id: "sess-1", started_at: "2026-02-20T10:00:00Z", last_message_at: "2026-02-20T10:05:00Z", message_count: "4", first_user_message: "Check my budget" },
    ]));
    const res = await request(app).get("/api/chat/sessions");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].session_id).toBe("sess-1");
  });

  it("returns 500 on DB error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));
    const res = await request(app).get("/api/chat/sessions");
    expect(res.status).toBe(500);
  });
});

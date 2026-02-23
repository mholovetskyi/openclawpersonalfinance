import { vi, describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { makeApp, dbResult } from "../helpers.js";

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockQuery = vi.hoisted(() => vi.fn());
vi.mock("../../services/db.js", () => ({
  pool: { query: mockQuery, on: vi.fn() },
}));

import researchRouter from "../../routes/research.js";

const app = makeApp("/api/research", researchRouter);

// ── Fixtures ───────────────────────────────────────────────────────────────────

const NEWS_ITEM = {
  headline: "Apple reports record iPhone sales",
  summary: "Q1 earnings beat expectations.",
  source: "Reuters",
  url: "https://reuters.com/apple",
  published_at: "2026-02-20T14:00:00Z",
  sentiment_score: 0.8,
  source_type: "news",
};

const SENTIMENT_ROW = {
  snapshot_date: "2026-02-20",
  twitter_sentiment: 0.72,
  composite_score: 0.72,
  tweet_volume: 124500,
  bull_tweets: 89424,
  bear_tweets: 34776,
  article_count: 42,
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("GET /api/research/:ticker", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with research data for a ticker", async () => {
    // Expects 3 parallel queries: news, sentiment, alt_data
    mockQuery
      .mockResolvedValueOnce(dbResult([NEWS_ITEM]))
      .mockResolvedValueOnce(dbResult([SENTIMENT_ROW]))
      .mockResolvedValueOnce(dbResult([]));

    const res = await request(app).get("/api/research/AAPL");
    expect(res.status).toBe(200);
    expect(res.body.data.ticker).toBe("AAPL");
    expect(res.body.data.news).toHaveLength(1);
    expect(res.body.data.sentiment.latest).toBeDefined();
    expect(res.body.data.sentiment.label).toBe("bullish"); // score 0.72 > 0.2
    expect(res.body.data.alt_data).toEqual([]);
  });

  it("uppercases the ticker symbol", async () => {
    mockQuery
      .mockResolvedValueOnce(dbResult([]))
      .mockResolvedValueOnce(dbResult([]))
      .mockResolvedValueOnce(dbResult([]));

    const res = await request(app).get("/api/research/aapl");
    expect(res.body.data.ticker).toBe("AAPL");
  });

  it("returns bearish label when composite_score < -0.2", async () => {
    mockQuery
      .mockResolvedValueOnce(dbResult([]))
      .mockResolvedValueOnce(dbResult([{ ...SENTIMENT_ROW, composite_score: -0.5 }]))
      .mockResolvedValueOnce(dbResult([]));

    const res = await request(app).get("/api/research/TSLA");
    expect(res.body.data.sentiment.label).toBe("bearish");
  });

  it("returns neutral label when composite_score is near zero", async () => {
    mockQuery
      .mockResolvedValueOnce(dbResult([]))
      .mockResolvedValueOnce(dbResult([{ ...SENTIMENT_ROW, composite_score: 0.1 }]))
      .mockResolvedValueOnce(dbResult([]));

    const res = await request(app).get("/api/research/MSFT");
    expect(res.body.data.sentiment.label).toBe("neutral");
  });

  it("handles ticker with no data gracefully", async () => {
    mockQuery
      .mockResolvedValueOnce(dbResult([]))
      .mockResolvedValueOnce(dbResult([]))
      .mockResolvedValueOnce(dbResult([]));

    const res = await request(app).get("/api/research/UNKN");
    expect(res.status).toBe(200);
    expect(res.body.data.news).toEqual([]);
    expect(res.body.data.sentiment.avg_30d).toBeNull();
    expect(res.body.data.sentiment.label).toBe("neutral");
  });

  it("returns 500 on DB error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));
    const res = await request(app).get("/api/research/AAPL");
    expect(res.status).toBe(500);
  });
});

describe("GET /api/research/portfolio-news", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with portfolio news (route not shadowed by :ticker)", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([
      { ticker_symbol: "AAPL", headline: "Apple news", security_name: "Apple Inc.", ...NEWS_ITEM },
    ]));
    const res = await request(app).get("/api/research/portfolio-news");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].ticker_symbol).toBe("AAPL");
  });

  it("returns empty array when no portfolio news", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([]));
    const res = await request(app).get("/api/research/portfolio-news");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("returns 500 on DB error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));
    const res = await request(app).get("/api/research/portfolio-news");
    expect(res.status).toBe(500);
  });
});

describe("GET /api/research/sentiment/:ticker", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with sentiment history", async () => {
    mockQuery.mockResolvedValueOnce(dbResult([SENTIMENT_ROW]));
    const res = await request(app).get("/api/research/sentiment/AAPL");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].composite_score).toBe(0.72);
  });

  it("returns 500 on DB error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));
    const res = await request(app).get("/api/research/sentiment/AAPL");
    expect(res.status).toBe(500);
  });
});

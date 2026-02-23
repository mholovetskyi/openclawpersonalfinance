import { Router } from "express";
import { pool } from "../services/db.js";

const router = Router();

// GET /api/research/portfolio-news — recent news for all active holdings
// NOTE: must be declared before /:ticker to avoid being shadowed
router.get("/portfolio-news", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT cn.ticker_symbol, cn.headline, cn.source, cn.url,
             cn.published_at, cn.sentiment_score, cn.source_type,
             h.security_name
      FROM company_news cn
      JOIN holdings h ON h.ticker_symbol = cn.ticker_symbol
      JOIN accounts a ON h.account_id = a.id
      WHERE a.is_active = true
        AND cn.published_at > NOW() - INTERVAL '7 days'
      ORDER BY cn.published_at DESC
      LIMIT 50
    `);
    res.json({ data: result.rows });
  } catch (err) {
    console.error("[research/portfolio-news] error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/research/sentiment/:ticker — sentiment history
router.get("/sentiment/:ticker", async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  try {
    const result = await pool.query(
      `SELECT snapshot_date, twitter_sentiment, composite_score,
              tweet_volume, bull_tweets, bear_tweets
       FROM sentiment_snapshots
       WHERE ticker_symbol = $1
       ORDER BY snapshot_date DESC
       LIMIT 90`,
      [ticker]
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error("[research/sentiment] error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/research/:ticker — aggregated research data for a ticker
// NOTE: must be declared LAST — all static routes must come before this
router.get("/:ticker", async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  try {
    const [newsResult, sentimentResult, altResult] = await Promise.all([
      pool.query(
        `SELECT headline, summary, source, url, published_at, sentiment_score, source_type
         FROM company_news
         WHERE ticker_symbol = $1
         ORDER BY published_at DESC NULLS LAST
         LIMIT 30`,
        [ticker]
      ),
      pool.query(
        `SELECT snapshot_date, twitter_sentiment, composite_score,
                tweet_volume, bull_tweets, bear_tweets, article_count
         FROM sentiment_snapshots
         WHERE ticker_symbol = $1
         ORDER BY snapshot_date DESC
         LIMIT 30`,
        [ticker]
      ),
      pool.query(
        `SELECT metric_date, metric_type, metric_value, metric_label
         FROM alt_data_metrics
         WHERE ticker_symbol = $1
         ORDER BY metric_date DESC
         LIMIT 20`,
        [ticker]
      ),
    ]);

    const sentimentRows = sentimentResult.rows;
    const scores = sentimentRows.map((r) => Number(r.composite_score)).filter(Boolean);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const latestSentiment = sentimentRows[0] ?? null;

    res.json({
      data: {
        ticker,
        news: newsResult.rows,
        sentiment: {
          latest: latestSentiment,
          avg_30d: avgScore ? Math.round(avgScore * 1000) / 1000 : null,
          label:
            (avgScore ?? 0) > 0.2
              ? "bullish"
              : (avgScore ?? 0) < -0.2
              ? "bearish"
              : "neutral",
          history: sentimentRows.slice(0, 14),
        },
        alt_data: altResult.rows,
      },
    });
  } catch (err) {
    console.error("[research] error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

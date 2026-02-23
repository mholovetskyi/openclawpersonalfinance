import { Router } from "express";
import { pool } from "../services/db.js";
import { validate } from "../middleware/validate.js";
import { transactionsQuerySchema, transactionsSummaryQuerySchema } from "../schemas.js";

const router = Router();

// GET /api/transactions?start=YYYY-MM-DD&end=YYYY-MM-DD&category=Food&limit=50&offset=0
router.get("/", validate({ query: transactionsQuerySchema }), async (req, res) => {
  try {
    const { start, end, category, account_id, limit = 50, offset = 0 } = req.query as any;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    if (start) { conditions.push(`t.date >= $${p++}`); params.push(start); }
    if (end)   { conditions.push(`t.date <= $${p++}`); params.push(end); }
    if (category) { conditions.push(`t.category = $${p++}`); params.push(category); }
    if (account_id) { conditions.push(`t.account_id = $${p++}`); params.push(account_id); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(Number(limit), Number(offset));

    const result = await pool.query(
      `SELECT t.id, t.account_id, a.institution_name, a.account_name,
              t.amount, t.date, t.name, t.merchant_name,
              t.category, t.subcategory, t.pending, t.is_recurring, t.notes
       FROM transactions t
       JOIN accounts a ON t.account_id = a.id
       ${where}
       ORDER BY t.date DESC
       LIMIT $${p} OFFSET $${p + 1}`,
      params
    );

    res.json({ data: result.rows });
  } catch (err) {
    console.error("[transactions] query error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/transactions/summary?month=2026-02
router.get("/summary", validate({ query: transactionsSummaryQuerySchema }), async (req, res) => {
  try {
    const month = req.query.month as string;

    const [year, mon] = month.split("-").map(Number);
    const startDate = new Date(year, mon - 1, 1).toISOString().slice(0, 10);
    const endDate = new Date(year, mon, 0).toISOString().slice(0, 10);

    const totalResult = await pool.query(
      `SELECT
         SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS total_spend,
         SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS total_income
       FROM transactions
       WHERE date BETWEEN $1 AND $2 AND pending = false`,
      [startDate, endDate]
    );

    const categoryResult = await pool.query(
      `SELECT category, SUM(amount) AS total
       FROM transactions
       WHERE date BETWEEN $1 AND $2 AND pending = false AND amount > 0
       GROUP BY category
       ORDER BY total DESC`,
      [startDate, endDate]
    );

    const byCategory: Record<string, number> = {};
    for (const row of categoryResult.rows) {
      byCategory[row.category || "Uncategorized"] = Number(row.total);
    }

    res.json({
      data: {
        month,
        total_spend: Number(totalResult.rows[0]?.total_spend ?? 0),
        total_income: Number(totalResult.rows[0]?.total_income ?? 0),
        by_category: byCategory,
      },
    });
  } catch (err) {
    console.error("[transactions/summary] error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

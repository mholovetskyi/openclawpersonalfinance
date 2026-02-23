import { Router } from "express";
import { pool } from "../services/db.js";
import { validate } from "../middleware/validate.js";
import { createBudgetSchema, updateBudgetSchema, budgetParamsSchema } from "../schemas.js";

const router = Router();

// GET /api/budgets — return all budgets with current month spend
router.get("/", async (_req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10);

    const result = await pool.query(
      `SELECT
         b.id,
         b.category,
         b.monthly_limit,
         b.is_active,
         b.created_at,
         COALESCE(SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END), 0) AS spent_this_month
       FROM budgets b
       LEFT JOIN transactions t
         ON t.category = b.category
        AND t.date BETWEEN $1 AND $2
        AND t.pending = false
       WHERE b.is_active = true
       GROUP BY b.id
       ORDER BY b.category`,
      [startOfMonth, endOfMonth]
    );

    res.json({ data: result.rows });
  } catch (err) {
    console.error("[budgets] get error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/budgets — create a budget
router.post("/", validate({ body: createBudgetSchema }), async (req, res) => {
  try {
    const { category, monthly_limit } = req.body;

    const result = await pool.query(
      `INSERT INTO budgets (category, monthly_limit)
       VALUES ($1, $2)
       ON CONFLICT (user_id, category)
       DO UPDATE SET monthly_limit = EXCLUDED.monthly_limit, is_active = true
       RETURNING *`,
      [category, monthly_limit]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    console.error("[budgets] post error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/budgets/:id — update monthly limit
router.put("/:id", validate({ params: budgetParamsSchema, body: updateBudgetSchema }), async (req, res) => {
  try {
    const { id } = req.params;
    const { monthly_limit } = req.body;

    const result = await pool.query(
      `UPDATE budgets SET monthly_limit = $1 WHERE id = $2 RETURNING *`,
      [monthly_limit, id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "Budget not found" });
      return;
    }

    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error("[budgets] put error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/budgets/:id — soft-delete
router.delete("/:id", validate({ params: budgetParamsSchema }), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE budgets SET is_active = false WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "Budget not found" });
      return;
    }

    res.status(204).end();
  } catch (err) {
    console.error("[budgets] delete error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

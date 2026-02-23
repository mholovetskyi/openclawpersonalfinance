import { Router } from "express";
import { pool } from "../services/db.js";
import { validate } from "../middleware/validate.js";
import { createGoalSchema, updateGoalSchema, goalParamsSchema } from "../schemas.js";

const router = Router();

// GET /api/goals
router.get("/", async (req, res) => {
  try {
    const { active } = req.query;
    const conditions = active === "true" ? "WHERE is_active = true" : "";

    const result = await pool.query(
      `SELECT id, name, type, target_amount, current_amount,
              target_date, notes, is_active, completed_at, created_at, updated_at
       FROM financial_goals
       ${conditions}
       ORDER BY is_active DESC, created_at DESC`
    );

    const goals = result.rows.map((g) => ({
      ...g,
      target_amount: Number(g.target_amount),
      current_amount: Number(g.current_amount),
      progress_pct: Number(g.target_amount) > 0
        ? Math.min(100, (Number(g.current_amount) / Number(g.target_amount)) * 100)
        : 0,
    }));

    res.json({ data: goals });
  } catch (err) {
    console.error("[goals] get error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/goals
router.post("/", validate({ body: createGoalSchema }), async (req, res) => {
  try {
    const { name, type, target_amount, current_amount, target_date, notes } = req.body;

    const result = await pool.query(
      `INSERT INTO financial_goals (name, type, target_amount, current_amount, target_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, type, target_amount, current_amount ?? 0, target_date ?? null, notes ?? null]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    console.error("[goals] post error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/goals/:id
router.put("/:id", validate({ params: goalParamsSchema, body: updateGoalSchema }), async (req, res) => {
  try {
    const { id } = req.params;
    const fields = req.body;
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        setClauses.push(`${key} = $${p++}`);
        values.push(value);
      }
    }

    if (setClauses.length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    setClauses.push(`updated_at = NOW()`);

    // Auto-mark as completed if current_amount >= target_amount
    if (fields.current_amount !== undefined) {
      setClauses.push(`completed_at = CASE WHEN $${p} >= target_amount THEN NOW() ELSE completed_at END`);
      values.push(fields.current_amount);
      p++;
    }

    values.push(id);

    const result = await pool.query(
      `UPDATE financial_goals SET ${setClauses.join(", ")} WHERE id = $${p} RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }

    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error("[goals] put error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/goals/:id — soft-delete
router.delete("/:id", validate({ params: goalParamsSchema }), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE financial_goals SET is_active = false WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }

    res.status(204).end();
  } catch (err) {
    console.error("[goals] delete error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

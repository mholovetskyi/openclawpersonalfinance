import { Router } from "express";
import { pool } from "../services/db.js";
import { validate } from "../middleware/validate.js";
import { createCategorySchema, updateCategorySchema, categoryParamsSchema } from "../schemas.js";

const router = Router();

// GET /api/categories
router.get("/", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, color, icon, parent_category, match_patterns, is_active, created_at
       FROM custom_categories
       WHERE is_active = true
       ORDER BY parent_category NULLS FIRST, name`
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error("[categories] get error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/categories
router.post("/", validate({ body: createCategorySchema }), async (req, res) => {
  try {
    const { name, color, icon, parent_category, match_patterns } = req.body;

    const result = await pool.query(
      `INSERT INTO custom_categories (name, color, icon, parent_category, match_patterns)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, name) DO UPDATE SET
         color = EXCLUDED.color, icon = EXCLUDED.icon,
         parent_category = EXCLUDED.parent_category,
         match_patterns = EXCLUDED.match_patterns,
         is_active = true, updated_at = NOW()
       RETURNING *`,
      [name, color, icon ?? null, parent_category ?? null, match_patterns ?? null]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    console.error("[categories] post error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/categories/:id
router.put("/:id", validate({ params: categoryParamsSchema, body: updateCategorySchema }), async (req, res) => {
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
    values.push(id);

    const result = await pool.query(
      `UPDATE custom_categories SET ${setClauses.join(", ")} WHERE id = $${p} RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "Category not found" });
      return;
    }

    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error("[categories] put error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/categories/:id — soft-delete
router.delete("/:id", validate({ params: categoryParamsSchema }), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE custom_categories SET is_active = false WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "Category not found" });
      return;
    }

    res.status(204).end();
  } catch (err) {
    console.error("[categories] delete error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

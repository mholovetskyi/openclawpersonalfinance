import { Router } from "express";
import { pool } from "../services/db.js";
import { validate } from "../middleware/validate.js";
import { updatePreferencesSchema } from "../schemas.js";

const router = Router();
const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001";

// GET /api/preferences
router.get("/", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT currency, locale, date_format, theme, default_date_range_days,
              dashboard_layout, notification_email, notification_budget_alerts,
              notification_insight_alerts, notification_goal_alerts,
              created_at, updated_at
       FROM user_preferences WHERE user_id = $1`,
      [DEFAULT_USER_ID]
    );

    if (result.rowCount === 0) {
      // Auto-create default preferences
      const insert = await pool.query(
        `INSERT INTO user_preferences (user_id) VALUES ($1)
         ON CONFLICT (user_id) DO NOTHING
         RETURNING *`,
        [DEFAULT_USER_ID]
      );
      res.json({ data: insert.rows[0] ?? {} });
      return;
    }

    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error("[preferences] get error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/preferences
router.put("/", validate({ body: updatePreferencesSchema }), async (req, res) => {
  try {
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
    values.push(DEFAULT_USER_ID);

    const result = await pool.query(
      `UPDATE user_preferences SET ${setClauses.join(", ")} WHERE user_id = $${p} RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "Preferences not found" });
      return;
    }

    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error("[preferences] put error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

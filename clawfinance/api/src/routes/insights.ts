import { Router } from "express";
import { pool } from "../services/db.js";
import { broadcast } from "../services/websocket.js";
import { validate } from "../middleware/validate.js";
import { insightsQuerySchema, patchInsightSchema, insightParamsSchema } from "../schemas.js";

const router = Router();

// GET /api/insights?status=new
router.get("/", validate({ query: insightsQuerySchema }), async (req, res) => {
  try {
    const { status } = req.query;
    const params: unknown[] = [];
    let where = "";
    if (status) { where = "WHERE status = $1"; params.push(status); }

    const result = await pool.query(
      `SELECT id, agent, type, severity, title, description, data, status, created_at
       FROM insights
       ${where}
       ORDER BY created_at DESC
       LIMIT 100`,
      params
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error("[insights] query error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/insights/:id
router.patch("/:id", validate({ params: insightParamsSchema, body: patchInsightSchema }), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const timestampCol = status === "viewed" ? ", viewed_at = NOW()" : status === "dismissed" ? ", dismissed_at = NOW()" : "";

    const result = await pool.query(
      `UPDATE insights
       SET status = $1${timestampCol}
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "Insight not found" });
      return;
    }

    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error("[insights] patch error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

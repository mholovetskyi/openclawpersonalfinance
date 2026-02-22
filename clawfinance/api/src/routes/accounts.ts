import { Router } from "express";
import { pool } from "../services/db.js";

const router = Router();

// GET /api/accounts
router.get("/", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, institution_name, account_name, type, subtype, mask,
              balance_current, balance_available, balance_limit,
              currency_code, api_source, is_active, created_at, updated_at
       FROM accounts
       WHERE is_active = true
       ORDER BY institution_name, account_name`
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error("[accounts] query error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

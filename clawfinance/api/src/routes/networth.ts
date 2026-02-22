import { Router } from "express";
import { pool } from "../services/db.js";

const router = Router();

// GET /api/networth
router.get("/", async (_req, res) => {
  try {
    // Current net worth from latest account balances
    const currentResult = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN type IN ('depository','investment') THEN balance_current ELSE 0 END), 0) AS total_assets,
         COALESCE(SUM(CASE WHEN type IN ('credit','loan','mortgage') THEN ABS(balance_current) ELSE 0 END), 0) AS total_liabilities
       FROM accounts
       WHERE is_active = true`
    );

    const { total_assets, total_liabilities } = currentResult.rows[0];
    const net_worth = Number(total_assets) - Number(total_liabilities);

    // Historical snapshots (last 365 days)
    const historyResult = await pool.query(
      `SELECT date, total_assets, total_liabilities, net_worth, breakdown
       FROM net_worth_snapshots
       ORDER BY date ASC
       LIMIT 365`
    );

    res.json({
      data: {
        current: {
          total_assets: Number(total_assets),
          total_liabilities: Number(total_liabilities),
          net_worth,
        },
        history: historyResult.rows,
      },
    });
  } catch (err) {
    console.error("[networth] query error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

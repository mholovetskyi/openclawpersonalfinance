import { Router } from "express";
import { pool } from "../services/db.js";

const router = Router();

// GET /api/portfolio — aggregate portfolio summary
router.get("/", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(DISTINCT h.ticker_symbol) AS position_count,
        COALESCE(SUM(h.market_value), 0) AS total_value,
        COALESCE(SUM(h.cost_basis_total), 0) AS total_cost_basis,
        COALESCE(SUM(h.unrealized_gain_loss), 0) AS total_unrealized_gl,
        COALESCE(SUM(h.market_value) FILTER (WHERE h.security_type = 'equity'), 0) AS equities_value,
        COALESCE(SUM(h.market_value) FILTER (WHERE h.security_type = 'etf'), 0) AS etf_value,
        COALESCE(SUM(h.market_value) FILTER (WHERE h.security_type = 'mutual_fund'), 0) AS fund_value,
        COALESCE(SUM(h.market_value) FILTER (WHERE h.security_type = 'bond'), 0) AS bond_value
      FROM holdings h
      JOIN accounts a ON h.account_id = a.id
      WHERE a.is_active = true
    `);

    const summary = result.rows[0];
    const totalValue = Number(summary.total_value);
    const totalCost = Number(summary.total_cost_basis);

    res.json({
      data: {
        total_value: totalValue,
        total_cost_basis: totalCost,
        total_unrealized_gl: Number(summary.total_unrealized_gl),
        total_unrealized_gl_pct: totalCost > 0 ? Number(summary.total_unrealized_gl) / totalCost * 100 : 0,
        position_count: Number(summary.position_count),
        by_type: {
          equities: Number(summary.equities_value),
          etfs: Number(summary.etf_value),
          funds: Number(summary.fund_value),
          bonds: Number(summary.bond_value),
        },
      },
    });
  } catch (err) {
    console.error("[portfolio] error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/holdings — all positions
router.get("/holdings", async (req, res) => {
  try {
    const { type, account_id } = req.query;
    const conditions: string[] = ["a.is_active = true"];
    const params: unknown[] = [];
    let p = 1;
    if (type) { conditions.push(`LOWER(h.security_type) = $${p++}`); params.push((type as string).toLowerCase()); }
    if (account_id) { conditions.push(`h.account_id = $${p++}`); params.push(account_id); }

    const result = await pool.query(`
      SELECT h.id, h.ticker_symbol, h.security_name, h.security_type,
             h.quantity, h.cost_basis_per_share, h.cost_basis_total,
             h.market_price, h.market_value,
             h.unrealized_gain_loss, h.unrealized_gain_loss_pct,
             h.acquisition_date, h.last_updated,
             a.account_name, a.institution_name
      FROM holdings h
      JOIN accounts a ON h.account_id = a.id
      WHERE ${conditions.join(" AND ")}
      ORDER BY h.market_value DESC NULLS LAST
    `, params);

    res.json({ data: result.rows });
  } catch (err) {
    console.error("[holdings] error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

import { Router } from "express";
import { pool } from "../services/db.js";
import { validate } from "../middleware/validate.js";
import { dataExportSchema } from "../schemas.js";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const router = Router();

const EXPORT_TABLES: Record<string, string> = {
  accounts: "SELECT id, institution_name, account_name, type, subtype, mask, balance_current, balance_available, currency_code, api_source, is_active, created_at FROM accounts",
  transactions: "SELECT t.id, t.amount, t.date, t.name, t.merchant_name, t.category, t.subcategory, t.pending, t.is_recurring, t.notes, a.account_name FROM transactions t JOIN accounts a ON t.account_id = a.id ORDER BY t.date DESC",
  budgets: "SELECT id, category, monthly_limit, is_active, created_at FROM budgets WHERE is_active = true",
  holdings: "SELECT h.id, h.ticker_symbol, h.security_name, h.security_type, h.quantity, h.cost_basis_per_share, h.market_price, h.market_value, a.account_name FROM holdings h JOIN accounts a ON h.account_id = a.id",
  goals: "SELECT id, name, type, target_amount, current_amount, target_date, notes, is_active, created_at FROM financial_goals",
  preferences: "SELECT currency, locale, date_format, theme, default_date_range_days, dashboard_layout FROM user_preferences LIMIT 1",
  categories: "SELECT id, name, color, icon, parent_category, match_patterns, is_active FROM custom_categories",
};

function encryptData(data: string, passphrase: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(passphrase, salt, 32);
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(data, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();
  return JSON.stringify({
    _encrypted: true,
    algorithm: "aes-256-gcm",
    salt: salt.toString("hex"),
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
    data: encrypted,
  });
}

function decryptData(payload: string, passphrase: string): string {
  const parsed = JSON.parse(payload);
  if (!parsed._encrypted) return payload;

  const salt = Buffer.from(parsed.salt, "hex");
  const key = scryptSync(passphrase, salt, 32);
  const iv = Buffer.from(parsed.iv, "hex");
  const authTag = Buffer.from(parsed.authTag, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(parsed.data, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// POST /api/data/export
router.post("/export", validate({ body: dataExportSchema }), async (req, res) => {
  try {
    const { format, sections, encrypt, passphrase } = req.body;
    const tablesToExport = sections ?? Object.keys(EXPORT_TABLES);

    const exportData: Record<string, unknown[]> = {};
    for (const table of tablesToExport) {
      const query = EXPORT_TABLES[table];
      if (!query) continue;
      const result = await pool.query(query);
      exportData[table] = result.rows;
    }

    const metadata = {
      exported_at: new Date().toISOString(),
      version: "1.0.0",
      format,
      sections: tablesToExport,
    };

    if (format === "csv") {
      // CSV: return the first section as CSV
      const section = tablesToExport[0];
      const rows = exportData[section] ?? [];
      if (rows.length === 0) {
        res.json({ data: "", metadata });
        return;
      }
      const headers = Object.keys(rows[0] as Record<string, unknown>);
      const csvLines = [
        headers.join(","),
        ...rows.map((row: any) =>
          headers.map((h) => {
            const val = String(row[h] ?? "");
            return val.includes(",") || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
          }).join(",")
        ),
      ];
      const csvData = csvLines.join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=clawfinance-${section}-${new Date().toISOString().slice(0, 10)}.csv`);
      res.send(csvData);
      return;
    }

    // JSON export
    let jsonString = JSON.stringify({ metadata, ...exportData }, null, 2);

    if (encrypt && passphrase) {
      jsonString = encryptData(jsonString, passphrase);
    }

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename=clawfinance-export-${new Date().toISOString().slice(0, 10)}.json`);
    res.send(jsonString);
  } catch (err) {
    console.error("[data/export] error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/data/verify — verify an encrypted backup can be decrypted
router.post("/verify", async (req, res) => {
  try {
    const { payload, passphrase } = req.body;
    if (!payload || !passphrase) {
      res.status(400).json({ error: "payload and passphrase required" });
      return;
    }

    const decrypted = decryptData(payload, passphrase);
    const parsed = JSON.parse(decrypted);

    res.json({
      valid: true,
      metadata: parsed.metadata,
      sections: Object.keys(parsed).filter((k) => k !== "metadata"),
    });
  } catch {
    res.status(400).json({ valid: false, error: "Decryption failed — wrong passphrase or corrupted data" });
  }
});

export default router;

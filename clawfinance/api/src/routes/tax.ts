import { Router } from "express";
import { pool } from "../services/db.js";
import multer from "multer";
import path from "node:path";
import { mkdirSync } from "node:fs";

const router = Router();
const uploadDir = process.env.TAX_UPLOAD_DIR ?? "./uploads/tax";
mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir, limits: { fileSize: 20 * 1024 * 1024 } });

// GET /api/tax/estimate — latest cached estimate from agent_state
router.get("/estimate", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT metadata FROM agent_state
      WHERE agent_name = 'skill-tax' AND task_name = 'tax_estimate' AND status = 'success'
      ORDER BY started_at DESC LIMIT 1
    `);
    if (result.rowCount === 0) {
      res.status(404).json({ error: "No tax estimate available. Run estimate_liability.py first." });
      return;
    }
    res.json({ data: result.rows[0].metadata });
  } catch (err) {
    console.error("[tax/estimate] error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/tax/documents
router.get("/documents", async (req, res) => {
  try {
    const { year } = req.query;
    const params: unknown[] = [];
    let where = "";
    if (year) { where = "WHERE year = $1"; params.push(Number(year)); }
    const result = await pool.query(
      `SELECT id, year, form_type, issuer_name, file_path, total_income,
              total_tax_withheld, state_tax, date_ingested
       FROM tax_documents ${where} ORDER BY year DESC, form_type`,
      params
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error("[tax/documents] error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/tax/documents/upload — multipart PDF upload
router.post("/documents/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
    const { form_type, year } = req.body;
    if (!form_type) { res.status(400).json({ error: "form_type is required" }); return; }

    const taxYear = year ? Number(year) : new Date().getFullYear() - 1;
    const result = await pool.query(
      `INSERT INTO tax_documents (year, form_type, file_path, extracted_data)
       VALUES ($1, $2, $3, $4) RETURNING id, year, form_type, file_path, date_ingested`,
      [taxYear, form_type, req.file.path, JSON.stringify({ _status: "pending_extraction" })]
    );
    res.status(201).json({
      data: result.rows[0],
      message: "File uploaded. Run extract_tax_doc.py to extract structured data.",
    });
  } catch (err) {
    console.error("[tax/documents/upload] error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/tax/deductions
router.get("/deductions", async (req, res) => {
  try {
    const { year } = req.query;
    const params: unknown[] = [year ? Number(year) : new Date().getFullYear()];
    const result = await pool.query(
      `SELECT id, year, type, amount, source, status, created_at
       FROM deductions WHERE year = $1 ORDER BY amount DESC`,
      params
    );
    const total = result.rows.reduce((s, r) => s + Number(r.amount), 0);
    res.json({ data: result.rows, total_deductions: total });
  } catch (err) {
    console.error("[tax/deductions] error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/tax/withholding-check
router.get("/withholding-check", async (_req, res) => {
  try {
    const year = new Date().getFullYear();
    const [wDoc, estDoc] = await Promise.all([
      pool.query(
        "SELECT COALESCE(SUM(total_tax_withheld), 0) AS total FROM tax_documents WHERE year = $1",
        [year]
      ),
      pool.query(
        "SELECT metadata FROM agent_state WHERE agent_name='skill-tax' AND task_name='tax_estimate' AND status='success' ORDER BY started_at DESC LIMIT 1"
      ),
    ]);
    const total_withheld = Number(wDoc.rows[0]?.total ?? 0);
    const est = estDoc.rows[0]?.metadata;
    const estimated_annual_tax = est ? Number(est.tax?.total_federal ?? 0) : null;
    const safe_harbor_pct = estimated_annual_tax ? (total_withheld / estimated_annual_tax * 100) : null;
    const shortfall = estimated_annual_tax ? Math.max(estimated_annual_tax - total_withheld, 0) : null;

    res.json({
      data: {
        year,
        total_withheld,
        estimated_annual_tax,
        safe_harbor_pct: safe_harbor_pct ? Number(safe_harbor_pct.toFixed(1)) : null,
        shortfall,
        at_risk: safe_harbor_pct !== null && safe_harbor_pct < 90,
      },
    });
  } catch (err) {
    console.error("[tax/withholding-check] error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

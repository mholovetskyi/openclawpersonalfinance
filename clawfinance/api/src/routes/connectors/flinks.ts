import { Router } from "express";
import { pool } from "../../services/db.js";
import { validate } from "../../middleware/validate.js";
import {
  flinksAuthorizeSchema,
  flinksMfaSchema,
  flinksSyncSchema,
  flinksConnectionParamsSchema,
} from "../../schemas.js";
import {
  authorize,
  authorizeWithLogin,
  answerMfa,
  getAccountsSummary,
  getAccountsDetail,
  getAccountsDetailAsync,
  encryptLoginId,
  decryptLoginId,
  mapAccountType,
  mapAccountSubtype,
  normalizeTransaction,
  type FlinksAuthorizeResponse,
  type FlinksMfaResponse,
  type FlinksAccountsDetailResponse,
  type FlinksAccount,
} from "../../connectors/flinks.js";

const router = Router();

// ─── POST /api/connectors/flinks/authorize ─────────────────────────────────
// Start a new Flinks connection by authenticating with a financial institution.
router.post("/authorize", validate({ body: flinksAuthorizeSchema }), async (req, res) => {
  try {
    const { institution, username, password } = req.body;

    const result = await authorize(institution, username, password);

    // MFA required (HTTP 203)
    if ("SecurityChallenges" in result) {
      const mfa = result as FlinksMfaResponse;

      // Store partial connection
      await pool.query(
        `INSERT INTO flinks_connections (institution, login_id_encrypted, last_request_id, status)
         VALUES ($1, $2, $3, 'mfa_required')
         ON CONFLICT (user_id, institution) DO UPDATE
           SET last_request_id = $3, status = 'mfa_required', updated_at = NOW()`,
        [institution, encryptLoginId("pending"), mfa.RequestId]
      );

      res.status(203).json({
        status: "mfa_required",
        request_id: mfa.RequestId,
        challenges: mfa.SecurityChallenges.map((c) => ({
          type: c.Type,
          prompt: c.Prompt,
          options: c.Iterables,
        })),
      });
      return;
    }

    // Success
    const auth = result as FlinksAuthorizeResponse;
    await pool.query(
      `INSERT INTO flinks_connections (institution, login_id_encrypted, last_request_id, status)
       VALUES ($1, $2, $3, 'active')
       ON CONFLICT (user_id, institution) DO UPDATE
         SET login_id_encrypted = $2, last_request_id = $3, status = 'active', updated_at = NOW()`,
      [institution, encryptLoginId(auth.Login.Id), auth.RequestId]
    );

    res.json({
      status: "connected",
      request_id: auth.RequestId,
      institution: auth.Institution,
      login_id: auth.Login.Id,
    });
  } catch (err: any) {
    console.error("[flinks/authorize] error:", err);
    res.status(err.status ?? 500).json({
      error: err.message ?? "Failed to authorize with Flinks",
      flinks_code: err.flinksCode,
    });
  }
});

// ─── POST /api/connectors/flinks/mfa ───────────────────────────────────────
// Answer MFA challenges returned from /authorize.
router.post("/mfa", validate({ body: flinksMfaSchema }), async (req, res) => {
  try {
    const { request_id, responses } = req.body;

    const result = await answerMfa(request_id, responses);

    // Another round of MFA
    if ("SecurityChallenges" in result) {
      const mfa = result as FlinksMfaResponse;
      res.status(203).json({
        status: "mfa_required",
        request_id: mfa.RequestId,
        challenges: mfa.SecurityChallenges.map((c) => ({
          type: c.Type,
          prompt: c.Prompt,
          options: c.Iterables,
        })),
      });
      return;
    }

    // MFA passed
    const auth = result as FlinksAuthorizeResponse;
    await pool.query(
      `UPDATE flinks_connections
       SET login_id_encrypted = $1, last_request_id = $2, status = 'active', updated_at = NOW()
       WHERE last_request_id = $3`,
      [encryptLoginId(auth.Login.Id), auth.RequestId, request_id]
    );

    res.json({
      status: "connected",
      request_id: auth.RequestId,
      institution: auth.Institution,
    });
  } catch (err: any) {
    console.error("[flinks/mfa] error:", err);
    res.status(err.status ?? 500).json({
      error: err.message ?? "MFA verification failed",
    });
  }
});

// ─── GET /api/connectors/flinks/connections ─────────────────────────────────
// List all Flinks connections for the current user.
router.get("/connections", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, institution, status, last_synced_at, error_message, created_at, updated_at
       FROM flinks_connections
       ORDER BY created_at DESC`
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error("[flinks/connections] error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/connectors/flinks/sync/:id ──────────────────────────────────
// Sync accounts and transactions from a Flinks connection.
router.post(
  "/sync/:id",
  validate({ params: flinksConnectionParamsSchema, body: flinksSyncSchema }),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { force } = req.body;

      // Fetch connection
      const connResult = await pool.query(
        `SELECT id, institution, login_id_encrypted, last_request_id, status, last_synced_at
         FROM flinks_connections WHERE id = $1`,
        [id]
      );

      if (connResult.rows.length === 0) {
        res.status(404).json({ error: "Connection not found" });
        return;
      }

      const conn = connResult.rows[0];

      if (conn.status !== "active") {
        res.status(400).json({ error: `Connection status is '${conn.status}' — re-authorize first` });
        return;
      }

      // Re-authorize with cached LoginId to get a fresh session
      const loginId = decryptLoginId(conn.login_id_encrypted);
      const authResult = await authorizeWithLogin(loginId);

      if ("SecurityChallenges" in authResult) {
        await pool.query(
          `UPDATE flinks_connections SET status = 'mfa_required', updated_at = NOW() WHERE id = $1`,
          [id]
        );
        res.status(203).json({
          status: "mfa_required",
          request_id: (authResult as FlinksMfaResponse).RequestId,
          message: "Institution requires re-authentication",
        });
        return;
      }

      const auth = authResult as FlinksAuthorizeResponse;
      const requestId = auth.RequestId;

      // Update last request id
      await pool.query(
        `UPDATE flinks_connections SET last_request_id = $1, updated_at = NOW() WHERE id = $2`,
        [requestId, id]
      );

      // Fetch account details (includes transactions)
      let detail: FlinksAccountsDetailResponse & { HttpStatusCode: number };
      detail = await getAccountsDetail(requestId);

      // Poll if pending (HTTP 202)
      if (detail.HttpStatusCode === 202) {
        const maxPolls = 18; // 18 * 10s = 3 minutes
        for (let i = 0; i < maxPolls; i++) {
          await new Promise((r) => setTimeout(r, 10_000));
          detail = await getAccountsDetailAsync(requestId);
          if (detail.HttpStatusCode === 200) break;
        }

        if (detail.HttpStatusCode !== 200) {
          res.status(202).json({
            status: "pending",
            request_id: requestId,
            message: "Data retrieval still in progress. Try again shortly.",
          });
          return;
        }
      }

      // Upsert accounts and transactions
      const syncResults = await syncAccountsAndTransactions(
        detail.Accounts,
        conn.institution,
        id
      );

      // Mark synced
      await pool.query(
        `UPDATE flinks_connections
         SET last_synced_at = NOW(), status = 'active', error_message = NULL, updated_at = NOW()
         WHERE id = $1`,
        [id]
      );

      res.json({
        status: "synced",
        accounts_synced: syncResults.accountCount,
        transactions_synced: syncResults.transactionCount,
        synced_at: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error("[flinks/sync] error:", err);

      // Mark connection as errored
      if (req.params.id) {
        await pool.query(
          `UPDATE flinks_connections SET status = 'error', error_message = $1, updated_at = NOW() WHERE id = $2`,
          [err.message, req.params.id]
        ).catch(() => {});
      }

      res.status(err.status ?? 500).json({
        error: err.message ?? "Sync failed",
      });
    }
  }
);

// ─── DELETE /api/connectors/flinks/connections/:id ──────────────────────────
// Disconnect a Flinks connection (soft delete).
router.delete(
  "/connections/:id",
  validate({ params: flinksConnectionParamsSchema }),
  async (req, res) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `UPDATE flinks_connections SET status = 'disconnected', updated_at = NOW()
         WHERE id = $1 AND status != 'disconnected'
         RETURNING id, institution`,
        [id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: "Connection not found or already disconnected" });
        return;
      }

      // Deactivate associated accounts
      await pool.query(
        `UPDATE accounts SET is_active = false, updated_at = NOW()
         WHERE api_source = 'flinks' AND institution_name = $1`,
        [result.rows[0].institution]
      );

      res.json({
        status: "disconnected",
        institution: result.rows[0].institution,
      });
    } catch (err) {
      console.error("[flinks/connections] delete error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ─── GET /api/connectors/flinks/accounts/:id ────────────────────────────────
// Get a quick account summary from Flinks for a connection.
router.get(
  "/accounts/:id",
  validate({ params: flinksConnectionParamsSchema }),
  async (req, res) => {
    try {
      const { id } = req.params;

      const connResult = await pool.query(
        `SELECT login_id_encrypted, last_request_id, status FROM flinks_connections WHERE id = $1`,
        [id]
      );

      if (connResult.rows.length === 0) {
        res.status(404).json({ error: "Connection not found" });
        return;
      }

      const conn = connResult.rows[0];
      if (conn.status !== "active") {
        res.status(400).json({ error: `Connection status is '${conn.status}'` });
        return;
      }

      // Use cached login to get a fresh session
      const loginId = decryptLoginId(conn.login_id_encrypted);
      const authResult = await authorizeWithLogin(loginId);

      if ("SecurityChallenges" in authResult) {
        res.status(203).json({ status: "mfa_required" });
        return;
      }

      const auth = authResult as FlinksAuthorizeResponse;
      const summary = await getAccountsSummary(auth.RequestId);

      res.json({
        data: summary.Accounts.map((a) => ({
          id: a.Id,
          title: a.Title,
          account_number: a.AccountNumber,
          balance_current: a.Balance.Current,
          balance_available: a.Balance.Available,
          category: a.Category,
          type: a.Type,
          currency: a.Currency,
          eft_eligible: a.EftEligibleRatio,
        })),
      });
    } catch (err: any) {
      console.error("[flinks/accounts] error:", err);
      res.status(err.status ?? 500).json({ error: err.message ?? "Failed to get accounts" });
    }
  }
);

// ─── Helpers ────────────────────────────────────────────────────────────────

async function syncAccountsAndTransactions(
  flinksAccounts: FlinksAccount[],
  institution: string,
  connectionId: string
): Promise<{ accountCount: number; transactionCount: number }> {
  let transactionCount = 0;

  for (const fa of flinksAccounts) {
    const externalId = `flinks_${fa.Id}`;

    // Upsert account
    const accResult = await pool.query(
      `INSERT INTO accounts (institution_name, account_name, type, subtype, mask, balance_current,
                             balance_available, balance_limit, currency_code, api_source, external_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'flinks', $10)
       ON CONFLICT (external_id) DO UPDATE SET
         balance_current = EXCLUDED.balance_current,
         balance_available = EXCLUDED.balance_available,
         balance_limit = EXCLUDED.balance_limit,
         is_active = true,
         updated_at = NOW()
       RETURNING id`,
      [
        institution,
        fa.Title,
        mapAccountType(fa.Category),
        mapAccountSubtype(fa.Type),
        fa.AccountNumber.slice(-4),
        fa.Balance.Current,
        fa.Balance.Available ?? null,
        fa.Balance.Limit ?? null,
        fa.Currency || "CAD",
        externalId,
      ]
    );

    const accountId = accResult.rows[0].id;

    // Upsert transactions
    if (fa.Transactions && fa.Transactions.length > 0) {
      for (const tx of fa.Transactions) {
        const normalized = normalizeTransaction(tx, accountId);

        await pool.query(
          `INSERT INTO transactions (account_id, amount, date, name, merchant_name, category, pending, api_source, external_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (external_id) DO UPDATE SET
             amount = EXCLUDED.amount,
             name = EXCLUDED.name`,
          [
            normalized.account_id,
            normalized.amount,
            normalized.date,
            normalized.name,
            normalized.merchant_name,
            normalized.category,
            normalized.pending,
            normalized.api_source,
            normalized.external_id,
          ]
        );

        transactionCount++;
      }
    }
  }

  return { accountCount: flinksAccounts.length, transactionCount };
}

export default router;

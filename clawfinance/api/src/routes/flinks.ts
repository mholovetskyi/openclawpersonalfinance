import { Router } from "express";
import { pool } from "../services/db.js";
import {
  authorize,
  getAccountsDetail,
  getAccountsDetailAsync,
  mapAccountType,
  toClawAmount,
  type FlinksAccount,
  type FlinksTransaction,
} from "../services/flinks.js";

const router = Router();

// ── POST /api/flinks/connect ────────────────────────────────────────────────
// Called after the user completes Flinks Connect (iframe). The frontend sends
// the loginId it received, and we authorize + pull accounts into our DB.

router.post("/connect", async (req, res) => {
  try {
    const { login_id, institution } = req.body;
    if (!login_id || typeof login_id !== "string") {
      res.status(400).json({ error: "login_id is required" });
      return;
    }

    // Authorize with Flinks
    const auth = await authorize(login_id);
    if (auth.SecurityChallenges && auth.SecurityChallenges.length > 0) {
      res.status(200).json({
        status: "mfa_required",
        request_id: auth.RequestId,
        challenges: auth.SecurityChallenges,
      });
      return;
    }

    if (auth.HttpStatusCode !== 200 || !auth.RequestId) {
      res.status(502).json({
        error: "Flinks authorization failed",
        flinks_code: auth.FlinksCode,
      });
      return;
    }

    // Fetch account details
    let detail = await getAccountsDetail(auth.RequestId);

    // If 202, poll async endpoint (up to 3 attempts server-side, client can retry)
    if (detail.HttpStatusCode === 202) {
      for (let i = 0; i < 3; i++) {
        await new Promise((r) => setTimeout(r, 10_000));
        detail = await getAccountsDetailAsync(auth.RequestId);
        if (detail.HttpStatusCode === 200) break;
      }
    }

    if (detail.HttpStatusCode !== 200 || !detail.Accounts) {
      res.status(200).json({
        status: "pending",
        request_id: auth.RequestId,
        message: "Data is still processing. Poll /api/flinks/poll with the request_id.",
      });
      return;
    }

    const saved = await upsertAccounts(detail.Accounts, login_id, institution ?? auth.Institution ?? "");
    res.status(201).json({ status: "connected", accounts_synced: saved });
  } catch (err) {
    console.error("[flinks/connect] error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/flinks/poll ───────────────────────────────────────────────────
// Poll for pending Flinks data when the initial /connect returned status: pending.

router.post("/poll", async (req, res) => {
  try {
    const { request_id, login_id, institution } = req.body;
    if (!request_id || typeof request_id !== "string") {
      res.status(400).json({ error: "request_id is required" });
      return;
    }

    const detail = await getAccountsDetailAsync(request_id);
    if (detail.HttpStatusCode !== 200 || !detail.Accounts) {
      res.status(200).json({ status: "pending", request_id });
      return;
    }

    const saved = await upsertAccounts(detail.Accounts, login_id ?? "", institution ?? detail.Institution ?? "");
    res.status(200).json({ status: "connected", accounts_synced: saved });
  } catch (err) {
    console.error("[flinks/poll] error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/flinks/sync ───────────────────────────────────────────────────
// Re-sync accounts and transactions for all active Flinks connections.

router.post("/sync", async (req, res) => {
  try {
    const accounts = await pool.query(
      `SELECT id, external_id, institution_name, flinks_login_id
       FROM accounts
       WHERE api_source = 'flinks' AND is_active = true AND flinks_login_id IS NOT NULL`
    );

    if (accounts.rows.length === 0) {
      res.json({ status: "ok", message: "No Flinks accounts to sync" });
      return;
    }

    // Group by login_id (one login covers multiple accounts at same institution)
    const byLogin = new Map<string, typeof accounts.rows>();
    for (const row of accounts.rows) {
      const list = byLogin.get(row.flinks_login_id) ?? [];
      list.push(row);
      byLogin.set(row.flinks_login_id, list);
    }

    let totalSynced = 0;
    const errors: string[] = [];

    for (const [loginId, _rows] of byLogin) {
      try {
        const auth = await authorize(loginId);
        if (auth.HttpStatusCode !== 200 || !auth.RequestId) {
          errors.push(`Authorize failed for loginId ${loginId}: ${auth.FlinksCode}`);
          continue;
        }

        let detail = await getAccountsDetail(auth.RequestId);
        // Poll up to 6 times (60s)
        for (let i = 0; i < 6 && detail.HttpStatusCode === 202; i++) {
          await new Promise((r) => setTimeout(r, 10_000));
          detail = await getAccountsDetailAsync(auth.RequestId);
        }

        if (detail.HttpStatusCode === 200 && detail.Accounts) {
          const synced = await upsertAccounts(detail.Accounts, loginId, _rows[0].institution_name);
          totalSynced += synced;
        } else {
          errors.push(`Data fetch incomplete for loginId ${loginId}`);
        }
      } catch (err) {
        errors.push(`Error syncing loginId ${loginId}: ${(err as Error).message}`);
      }
    }

    res.json({ status: "ok", accounts_synced: totalSynced, errors: errors.length ? errors : undefined });
  } catch (err) {
    console.error("[flinks/sync] error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/flinks/connections ─────────────────────────────────────────────
// List all Flinks-sourced accounts.

router.get("/connections", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, institution_name, account_name, type, subtype, mask,
              balance_current, balance_available, balance_limit,
              currency_code, is_active, created_at, updated_at
       FROM accounts
       WHERE api_source = 'flinks'
       ORDER BY institution_name, account_name`
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error("[flinks/connections] error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── DELETE /api/flinks/connections/:id ───────────────────────────────────────
// Deactivate a Flinks connection.

router.delete("/connections/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE accounts SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND api_source = 'flinks' RETURNING id`,
      [req.params.id]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: "Flinks connection not found" });
      return;
    }
    res.json({ status: "disconnected", id: req.params.id });
  } catch (err) {
    console.error("[flinks/connections/delete] error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function upsertAccounts(
  flinksAccounts: FlinksAccount[],
  loginId: string,
  institution: string,
): Promise<number> {
  let count = 0;

  for (const acct of flinksAccounts) {
    const { type, subtype } = mapAccountType(acct.Type);
    const mask = acct.AccountNumber ? acct.AccountNumber.slice(-4) : null;

    // Upsert account
    await pool.query(
      `INSERT INTO accounts
         (institution_name, account_name, type, subtype, mask,
          balance_current, balance_available, balance_limit,
          currency_code, api_source, external_id, flinks_login_id, is_active, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'flinks', $10, $11, true, NOW())
       ON CONFLICT (external_id) DO UPDATE SET
         balance_current = EXCLUDED.balance_current,
         balance_available = EXCLUDED.balance_available,
         balance_limit = EXCLUDED.balance_limit,
         updated_at = NOW()`,
      [
        institution,
        acct.Title,
        type,
        subtype,
        mask,
        acct.Balance?.Current ?? null,
        acct.Balance?.Available ?? null,
        acct.Balance?.Limit ?? null,
        acct.Currency ?? "CAD",
        `flinks_${acct.Id}`,
        loginId,
      ]
    );

    // Upsert transactions if present
    if (acct.Transactions && acct.Transactions.length > 0) {
      await upsertTransactions(acct.Id, acct.Transactions);
    }

    count++;
  }

  return count;
}

async function upsertTransactions(
  flinksAccountId: string,
  transactions: FlinksTransaction[],
): Promise<void> {
  // Look up the internal account id
  const acctResult = await pool.query(
    `SELECT id FROM accounts WHERE external_id = $1`,
    [`flinks_${flinksAccountId}`]
  );
  if (acctResult.rows.length === 0) return;
  const accountId = acctResult.rows[0].id;

  for (const txn of transactions) {
    const externalId = txn.TransactionId
      ? `flinks_${txn.TransactionId}`
      : `flinks_${flinksAccountId}_${txn.Date}_${txn.Description}_${txn.Debit}_${txn.Credit}`;

    const amount = toClawAmount(txn.Debit, txn.Credit);
    const txDate = txn.Date.replace(/\//g, "-").slice(0, 10);

    await pool.query(
      `INSERT INTO transactions
         (account_id, amount, date, name, merchant_name, api_source, external_id)
       VALUES ($1, $2, $3, $4, $4, 'flinks', $5)
       ON CONFLICT (external_id) DO NOTHING`,
      [accountId, amount, txDate, txn.Description, externalId]
    );
  }
}

export default router;

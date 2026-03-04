/**
 * Flinks API client — wraps the Flinks v3 Aggregation API.
 *
 * Flinks is a Canadian open-banking platform (Montreal) that connects to 15,000+
 * financial institutions across North America. It provides account data, balances,
 * transactions, and bank statements via a REST API.
 *
 * Integration flow:
 *   1. User connects bank via Flinks Connect iframe → receives a loginId
 *   2. Server calls /Authorize with loginId → receives requestId
 *   3. Server calls /GetAccountsDetail with requestId → accounts + transactions
 *   4. If 202 (processing), poll /GetAccountsDetailAsync until 200
 */

const FLINKS_CUSTOMER_ID = process.env.FLINKS_CUSTOMER_ID ?? "";
const FLINKS_INSTANCE = process.env.FLINKS_INSTANCE ?? "toolbox";
const FLINKS_AUTH_KEY = process.env.FLINKS_AUTH_KEY ?? "";

function baseUrl(): string {
  return `https://${FLINKS_INSTANCE}-api.private.fin.ag/v3/${FLINKS_CUSTOMER_ID}/BankingServices`;
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (FLINKS_AUTH_KEY) h["flinks-auth-key"] = FLINKS_AUTH_KEY;
  return h;
}

export interface FlinksAuthorizeResponse {
  HttpStatusCode: number;
  Login?: { Id: string; Username: string; IsScheduledRefresh: boolean; LastRefresh: string };
  Institution?: string;
  RequestId: string;
  SecurityChallenges?: Array<{ Prompt: string; Type: string }>;
  FlinksCode?: string;
  Links?: Array<{ rel: string; href: string }>;
}

export interface FlinksBalance {
  Available: number;
  Current: number;
  Limit: number;
}

export interface FlinksTransaction {
  TransactionId?: string;
  Date: string;
  Description: string;
  Debit: number;
  Credit: number;
  Balance: number;
}

export interface FlinksAccount {
  Id: string;
  Title: string;
  AccountNumber?: string;
  TransitNumber?: string;
  InstitutionNumber?: string;
  Category: string;
  Type: string;
  Currency: string;
  Balance: FlinksBalance;
  Holder?: { Name?: string };
  Transactions?: FlinksTransaction[];
}

export interface FlinksAccountsDetailResponse {
  HttpStatusCode: number;
  Accounts?: FlinksAccount[];
  Login?: { Id: string };
  Institution?: string;
  RequestId: string;
  FlinksCode?: string;
}

/**
 * Authorize a Flinks session using a saved loginId.
 * Returns a requestId for subsequent data calls, or MFA challenges.
 */
export async function authorize(loginId: string): Promise<FlinksAuthorizeResponse> {
  const res = await fetch(`${baseUrl()}/Authorize`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ LoginId: loginId, MostRecentCached: true }),
  });
  return (await res.json()) as FlinksAuthorizeResponse;
}

/**
 * Get full account details (including transactions) for a request.
 * Returns 202 / OPERATION_PENDING if still processing.
 */
export async function getAccountsDetail(
  requestId: string,
): Promise<FlinksAccountsDetailResponse> {
  const res = await fetch(`${baseUrl()}/GetAccountsDetail`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ RequestId: requestId }),
  });
  const data = (await res.json()) as FlinksAccountsDetailResponse;
  data.HttpStatusCode = res.status;
  return data;
}

/**
 * Poll for pending GetAccountsDetail results.
 */
export async function getAccountsDetailAsync(
  requestId: string,
): Promise<FlinksAccountsDetailResponse> {
  const res = await fetch(`${baseUrl()}/GetAccountsDetailAsync/${requestId}`, {
    method: "GET",
    headers: headers(),
  });
  const data = (await res.json()) as FlinksAccountsDetailResponse;
  data.HttpStatusCode = res.status;
  return data;
}

/**
 * Authorize and fetch accounts with automatic async polling.
 * Retries up to maxPollAttempts when the API returns 202.
 */
export async function fetchAccountsWithPolling(
  loginId: string,
  maxPollAttempts = 18,
  pollIntervalMs = 10_000,
): Promise<FlinksAccountsDetailResponse> {
  const auth = await authorize(loginId);
  if (auth.HttpStatusCode !== 200 || !auth.RequestId) {
    throw new Error(`Flinks authorize failed: ${auth.FlinksCode ?? "unknown error"}`);
  }

  let detail = await getAccountsDetail(auth.RequestId);
  if (detail.HttpStatusCode === 200) return detail;

  // Poll async endpoint
  for (let i = 0; i < maxPollAttempts; i++) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));
    detail = await getAccountsDetailAsync(auth.RequestId);
    if (detail.HttpStatusCode === 200) return detail;
  }

  throw new Error("Flinks GetAccountsDetail timed out after polling");
}

/**
 * Map a Flinks account type string to the ClawFinance account type taxonomy.
 */
export function mapAccountType(flinksType: string): { type: string; subtype: string } {
  const t = flinksType.toLowerCase();
  if (t.includes("chequ") || t.includes("check")) return { type: "depository", subtype: "checking" };
  if (t.includes("saving")) return { type: "depository", subtype: "savings" };
  if (t.includes("credit") && t.includes("card")) return { type: "credit", subtype: "credit_card" };
  if (t.includes("credit") || t.includes("line")) return { type: "credit", subtype: "line_of_credit" };
  if (t.includes("loan") || t.includes("mortgage")) return { type: "loan", subtype: t.includes("mortgage") ? "mortgage" : "loan" };
  if (t.includes("invest") || t.includes("rrsp") || t.includes("tfsa") || t.includes("rrif")) {
    return { type: "investment", subtype: t };
  }
  return { type: "depository", subtype: "other" };
}

/**
 * Convert Flinks Debit/Credit to ClawFinance amount convention.
 * ClawFinance: positive = spending/debit, negative = income/credit.
 */
export function toClawAmount(debit: number, credit: number): number {
  if (debit > 0) return debit;
  if (credit > 0) return -credit;
  return 0;
}

import { getEncryption } from "../services/encryption.js";

// ─── Configuration ──────────────────────────────────────────────────────────

export interface FlinksConfig {
  baseUrl: string;
  customerId: string;
  instanceName: string;
}

function getConfig(): FlinksConfig {
  const customerId = process.env.FLINKS_CUSTOMER_ID;
  const instanceName = process.env.FLINKS_INSTANCE ?? "sandbox";

  if (!customerId) {
    throw new Error("FLINKS_CUSTOMER_ID environment variable is required");
  }

  // sandbox → https://sandbox.flinks.com
  // production → https://{instance}-api.private.fin.ag
  const baseUrl =
    instanceName === "sandbox"
      ? "https://sandbox.flinks.com"
      : `https://${instanceName}-api.private.fin.ag`;

  return { baseUrl, customerId, instanceName };
}

function apiUrl(path: string): string {
  const { baseUrl, customerId } = getConfig();
  return `${baseUrl}/v3/${customerId}/BankingServices${path}`;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FlinksAuthorizeRequest {
  Institution: string;
  Username: string;
  Password: string;
  MostRecentCached?: boolean;
  Save?: boolean;
}

export interface FlinksAuthorizeWithLoginRequest {
  LoginId: string;
  MostRecentCached: boolean;
}

export interface FlinksMfaResponse {
  RequestId: string;
  SecurityChallenges: Array<{
    Type: "QuestionAndAnswer" | "TextOrCall" | "WaitUntilEUAccept";
    Prompt: string;
    Iterables?: string[];
  }>;
  HttpStatusCode: number;
}

export interface FlinksAuthorizeResponse {
  RequestId: string;
  Login: {
    Username: string;
    Id: string;
    IsScheduledRefresh: boolean;
    LastRefresh: string;
    Type: string;
  };
  Institution: string;
  HttpStatusCode: number;
  Links?: Array<{ rel: string; href: string }>;
}

export interface FlinksSecurityResponse {
  RequestId: string;
  SecurityResponses: Record<string, string>;
}

export interface FlinksAccount {
  Id: string;
  TransitNumber?: string;
  InstitutionNumber?: string;
  OverdraftLimit?: number;
  Title: string;
  AccountNumber: string;
  Balance: { Current: number; Available?: number; Limit?: number };
  Category: string;
  Type: string;
  Currency: string;
  Holder: string;
  Transactions?: FlinksTransaction[];
}

export interface FlinksTransaction {
  Id: string;
  Date: string;
  Debit?: number;
  Credit?: number;
  Balance: number;
  Description: string;
  Code?: string;
}

export interface FlinksAccountsDetailResponse {
  RequestId: string;
  Accounts: FlinksAccount[];
  Login: { Username: string; Id: string };
  Institution: string;
  HttpStatusCode: number;
}

export interface FlinksAccountsSummaryResponse {
  RequestId: string;
  Accounts: Array<{
    Id: string;
    Title: string;
    AccountNumber: string;
    Balance: { Current: number; Available?: number };
    Category: string;
    Type: string;
    Currency: string;
    EftEligibleRatio?: number;
  }>;
  Institution: string;
  HttpStatusCode: number;
}

// ─── API Client ─────────────────────────────────────────────────────────────

async function flinksRequest<T>(path: string, body: unknown): Promise<T> {
  const url = apiUrl(path);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok && res.status !== 203) {
    const msg = (data as any)?.Message ?? (data as any)?.FlinksCode ?? "Flinks API error";
    const error = new Error(msg) as Error & { status: number; flinksCode?: string };
    error.status = res.status;
    error.flinksCode = (data as any)?.FlinksCode;
    throw error;
  }

  return data as T;
}

async function flinksGet<T>(path: string): Promise<T> {
  const url = apiUrl(path);
  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  const data = await res.json();

  if (!res.ok && res.status !== 202) {
    const msg = (data as any)?.Message ?? "Flinks API error";
    const error = new Error(msg) as Error & { status: number };
    error.status = res.status;
    throw error;
  }

  return data as T;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Start a new authorize session with user credentials.
 * Returns a RequestId (and possibly MFA challenges if HTTP 203).
 */
export async function authorize(
  institution: string,
  username: string,
  password: string,
  save = true
): Promise<FlinksAuthorizeResponse | FlinksMfaResponse> {
  return flinksRequest("/Authorize", {
    Institution: institution,
    Username: username,
    Password: password,
    MostRecentCached: false,
    Save: save,
  });
}

/**
 * Re-authorize using a stored LoginId (cached session).
 */
export async function authorizeWithLogin(
  loginId: string
): Promise<FlinksAuthorizeResponse | FlinksMfaResponse> {
  return flinksRequest("/Authorize", {
    LoginId: loginId,
    MostRecentCached: true,
  });
}

/**
 * Answer MFA security challenges.
 */
export async function answerMfa(
  requestId: string,
  securityResponses: Record<string, string>
): Promise<FlinksAuthorizeResponse | FlinksMfaResponse> {
  return flinksRequest("/Authorize", {
    RequestId: requestId,
    SecurityResponses: securityResponses,
  });
}

/**
 * Get a summary of all accounts for the session.
 */
export async function getAccountsSummary(
  requestId: string
): Promise<FlinksAccountsSummaryResponse> {
  return flinksRequest("/GetAccountsSummary", { RequestId: requestId });
}

/**
 * Get full account details including transactions.
 * May return HTTP 202 (pending); use getAccountsDetailAsync to poll.
 */
export async function getAccountsDetail(
  requestId: string
): Promise<FlinksAccountsDetailResponse & { HttpStatusCode: number }> {
  return flinksRequest("/GetAccountsDetail", {
    RequestId: requestId,
    WithTransactions: true,
  });
}

/**
 * Poll for pending account detail data (async retrieval).
 */
export async function getAccountsDetailAsync(
  requestId: string
): Promise<FlinksAccountsDetailResponse & { HttpStatusCode: number }> {
  return flinksGet(`/GetAccountsDetailAsync/${requestId}`);
}

/**
 * Encrypt and store a Flinks LoginId for later re-authorization.
 */
export function encryptLoginId(loginId: string): string {
  return getEncryption().encrypt(loginId);
}

/**
 * Decrypt a stored Flinks LoginId.
 */
export function decryptLoginId(encrypted: string): string {
  return getEncryption().decrypt(encrypted);
}

/**
 * Map Flinks account category to our internal account type.
 */
export function mapAccountType(flinksCategory: string): string {
  const mapping: Record<string, string> = {
    Operations: "depository",
    Credits: "credit",
    Investments: "investment",
    Loans: "loan",
    Mortgages: "mortgage",
    Lines: "credit",
  };
  return mapping[flinksCategory] ?? "depository";
}

/**
 * Map Flinks account type to our internal subtype.
 */
export function mapAccountSubtype(flinksType: string): string {
  const mapping: Record<string, string> = {
    Chequing: "checking",
    Savings: "savings",
    CreditCard: "credit_card",
    RRSP: "rrsp",
    TFSA: "tfsa",
    RESP: "resp",
    PersonalLoan: "personal_loan",
    Mortgage: "mortgage",
    LineOfCredit: "line_of_credit",
    GIC: "gic",
  };
  return mapping[flinksType] ?? flinksType.toLowerCase();
}

/**
 * Normalize a single Flinks transaction into our internal format.
 */
export function normalizeTransaction(
  tx: FlinksTransaction,
  accountId: string
): {
  account_id: string;
  amount: number;
  date: string;
  name: string;
  merchant_name: string | null;
  category: string | null;
  pending: boolean;
  api_source: string;
  external_id: string;
} {
  // Flinks uses separate Debit/Credit fields.
  // Debit = money out (positive in our system), Credit = money in (negative)
  const amount = (tx.Debit ?? 0) - (tx.Credit ?? 0);

  return {
    account_id: accountId,
    amount,
    date: tx.Date.slice(0, 10),
    name: tx.Description,
    merchant_name: null,
    category: null,
    pending: false,
    api_source: "flinks",
    external_id: `flinks_${tx.Id}`,
  };
}

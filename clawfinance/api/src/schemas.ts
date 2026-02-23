import { z } from "zod";

// ─── Shared ─────────────────────────────────────────────────────────────────

const uuidParam = z.object({ id: z.string().uuid() });
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const monthString = z.string().regex(/^\d{4}-\d{2}$/, "Expected YYYY-MM");
const positiveInt = z.coerce.number().int().positive();
const nonNegativeInt = z.coerce.number().int().nonnegative();
const tickerSymbol = z.string().min(1).max(10).regex(/^[A-Za-z0-9.^-]+$/, "Invalid ticker");

// ─── Transactions ───────────────────────────────────────────────────────────

export const transactionsQuerySchema = z.object({
  start: dateString.optional(),
  end: dateString.optional(),
  category: z.string().max(100).optional(),
  account_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: nonNegativeInt.default(0),
});

export const transactionsSummaryQuerySchema = z.object({
  month: monthString,
});

// ─── Budgets ────────────────────────────────────────────────────────────────

export const createBudgetSchema = z.object({
  category: z.string().min(1).max(100).trim(),
  monthly_limit: z.number().positive().max(1_000_000),
});

export const updateBudgetSchema = z.object({
  monthly_limit: z.number().positive().max(1_000_000),
});

export const budgetParamsSchema = uuidParam;

// ─── Insights ───────────────────────────────────────────────────────────────

export const insightsQuerySchema = z.object({
  status: z.enum(["new", "active", "viewed", "dismissed", "acted_on"]).optional(),
});

export const patchInsightSchema = z.object({
  status: z.enum(["viewed", "dismissed", "acted_on"]),
});

export const insightParamsSchema = uuidParam;

// ─── Tax ────────────────────────────────────────────────────────────────────

export const taxDocsQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const taxUploadBodySchema = z.object({
  form_type: z.enum(["W-2", "1099-INT", "1099-DIV", "1099-B", "1099-MISC", "1040", "1099-R", "1099-NEC", "1099-K"]),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const taxDeductionsQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

// ─── Research ───────────────────────────────────────────────────────────────

export const researchTickerParamsSchema = z.object({
  ticker: tickerSymbol,
});

// ─── Chat ───────────────────────────────────────────────────────────────────

export const chatPostSchema = z.object({
  message: z.string().trim().min(1).max(10_000),
  session_id: z.string().uuid().optional(),
});

export const chatHistoryParamsSchema = z.object({
  sessionId: z.string().uuid(),
});

// ─── Portfolio ──────────────────────────────────────────────────────────────

export const holdingsQuerySchema = z.object({
  type: z.enum(["equity", "etf", "mutual_fund", "bond", "option", "crypto"]).optional(),
  account_id: z.string().uuid().optional(),
});

// ─── Preferences ────────────────────────────────────────────────────────────

export const updatePreferencesSchema = z.object({
  currency: z.string().length(3).toUpperCase().optional(),
  locale: z.string().min(2).max(10).optional(),
  date_format: z.enum(["YYYY-MM-DD", "MM/DD/YYYY", "DD/MM/YYYY", "DD.MM.YYYY"]).optional(),
  theme: z.enum(["dark", "light", "system"]).optional(),
  default_date_range_days: z.number().int().min(7).max(365).optional(),
  dashboard_layout: z.enum(["default", "compact", "detailed"]).optional(),
});

// ─── Goals ──────────────────────────────────────────────────────────────────

export const createGoalSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.enum(["savings", "debt_payoff", "investment", "emergency_fund", "custom"]),
  target_amount: z.number().positive().max(100_000_000),
  current_amount: z.number().nonnegative().default(0),
  target_date: dateString.optional(),
  notes: z.string().max(2000).optional(),
});

export const updateGoalSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  target_amount: z.number().positive().max(100_000_000).optional(),
  current_amount: z.number().nonnegative().optional(),
  target_date: dateString.nullable().optional(),
  notes: z.string().max(2000).optional(),
  is_active: z.boolean().optional(),
});

export const goalParamsSchema = uuidParam;

// ─── Custom Categories ──────────────────────────────────────────────────────

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be hex color like #ff5500"),
  icon: z.string().max(50).optional(),
  parent_category: z.string().max(100).optional(),
  match_patterns: z.array(z.string().max(200)).max(50).optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(50).optional(),
  match_patterns: z.array(z.string().max(200)).max(50).optional(),
  is_active: z.boolean().optional(),
});

export const categoryParamsSchema = uuidParam;

// ─── Data Export/Import ─────────────────────────────────────────────────────

export const dataExportSchema = z.object({
  format: z.enum(["json", "csv"]).default("json"),
  sections: z.array(z.enum(["accounts", "transactions", "budgets", "holdings", "goals", "preferences", "categories"])).optional(),
  encrypt: z.boolean().default(false),
  passphrase: z.string().min(8).max(128).optional(),
}).refine(
  (data) => !data.encrypt || data.passphrase,
  { message: "passphrase is required when encrypt is true", path: ["passphrase"] }
);

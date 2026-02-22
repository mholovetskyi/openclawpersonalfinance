import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { api } from "../lib/api.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

type Transaction = {
  id: string;
  account_name: string;
  institution_name: string;
  amount: number;
  date: string;
  name: string;
  merchant_name: string | null;
  category: string | null;
  subcategory: string | null;
  pending: boolean;
  is_recurring: boolean;
};

type SummaryMonth = {
  month: string;
  total_spend: number;
  total_income: number;
  by_category: Record<string, number>;
};

type Budget = {
  id: string;
  category: string;
  monthly_limit: number;
  spent_this_month: number;
  is_active: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.abs(n));
}

function last6Months(): string[] {
  const months = [];
  const d = new Date();
  for (let i = 5; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    months.push(
      `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`
    );
  }
  return months;
}

const CATEGORY_COLORS: Record<string, string> = {
  "Food & Dining": "#f97316",
  Shopping: "#8b5cf6",
  Transportation: "#06b6d4",
  Entertainment: "#ec4899",
  "Bills & Utilities": "#eab308",
  Health: "#22c55e",
  Housing: "#6366f1",
  Transfer: "#94a3b8",
  Uncategorized: "#475569",
};
function colorFor(cat: string) {
  return CATEGORY_COLORS[cat] ?? "#64748b";
}

// ── Budget Card ────────────────────────────────────────────────────────────────

function BudgetCard({ budget }: { budget: Budget }) {
  const qc = useQueryClient();
  const pct =
    budget.monthly_limit > 0
      ? (budget.spent_this_month / budget.monthly_limit) * 100
      : 0;
  const [editing, setEditing] = useState(false);
  const [limitValue, setLimitValue] = useState(String(budget.monthly_limit));

  const mutation = useMutation({
    mutationFn: (monthly_limit: number) =>
      api.patch<{ data: Budget }>(`/api/budgets/${budget.id}`, { monthly_limit }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budgets"] });
      setEditing(false);
    },
  });

  const barColor =
    pct > 100 ? "#ef4444" : pct >= 80 ? "#eab308" : "#22c55e";

  return (
    <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-white">{budget.category}</span>
        {editing ? (
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400">$</span>
            <input
              className="w-20 bg-gray-800 text-white text-xs px-1 py-0.5 rounded border border-gray-600"
              value={limitValue}
              onChange={(e) => setLimitValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") mutation.mutate(Number(limitValue));
                if (e.key === "Escape") setEditing(false);
              }}
              autoFocus
            />
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            {fmt(budget.monthly_limit)} limit
          </button>
        )}
      </div>

      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(pct, 100)}%`,
            backgroundColor: barColor,
          }}
        />
      </div>

      <div className="flex justify-between mt-1.5 text-xs text-gray-400">
        <span style={{ color: barColor }}>
          {fmt(budget.spent_this_month)} spent
        </span>
        <span>{Math.round(pct)}%</span>
      </div>
    </div>
  );
}

// ── Add Budget ─────────────────────────────────────────────────────────────────

function AddBudgetRow() {
  const qc = useQueryClient();
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState("");
  const [open, setOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/api/budgets", { category, monthly_limit: Number(limit) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budgets"] });
      setCategory("");
      setLimit("");
      setOpen(false);
    },
  });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-2 border border-dashed border-gray-700 rounded-xl text-xs text-gray-500 hover:text-gray-300 hover:border-gray-500 transition-colors"
      >
        + Add budget category
      </button>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl p-4 border border-gray-700 flex gap-2">
      <input
        placeholder="Category"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="flex-1 bg-gray-800 text-white text-xs px-2 py-1.5 rounded border border-gray-600 placeholder-gray-500"
      />
      <input
        placeholder="Monthly $"
        value={limit}
        onChange={(e) => setLimit(e.target.value)}
        className="w-24 bg-gray-800 text-white text-xs px-2 py-1.5 rounded border border-gray-600 placeholder-gray-500"
        type="number"
        min="0"
      />
      <button
        onClick={() => mutation.mutate()}
        disabled={!category || !limit || mutation.isPending}
        className="text-xs bg-claw-700 hover:bg-claw-600 text-white px-3 py-1.5 rounded disabled:opacity-50"
      >
        Save
      </button>
      <button
        onClick={() => setOpen(false)}
        className="text-xs text-gray-500 hover:text-gray-300"
      >
        Cancel
      </button>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function TransactionsBudget() {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [activeTab, setActiveTab] = useState<"transactions" | "budgets">(
    "transactions"
  );

  const months = last6Months();

  const { data: txnData, isLoading: txnLoading } = useQuery({
    queryKey: ["transactions", filterCategory],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterCategory) params.set("category", filterCategory);
      params.set("limit", "200");
      return api.get<{ data: Transaction[] }>(
        `/api/transactions?${params}`
      );
    },
  });

  const summaryQuery = useQuery({
    queryKey: ["summaries", months.join(",")],
    queryFn: async () => {
      const results = await Promise.all(
        months.map((m) =>
          api
            .get<{ data: SummaryMonth }>(
              `/api/transactions/summary?month=${m}`
            )
            .then((r) => r.data)
            .catch(
              (): SummaryMonth => ({
                month: m,
                total_spend: 0,
                total_income: 0,
                by_category: {},
              })
            )
        )
      );
      return results;
    },
  });

  const { data: budgetData, isLoading: budgetLoading } = useQuery({
    queryKey: ["budgets"],
    queryFn: () => api.get<{ data: Budget[] }>("/api/budgets"),
  });

  const transactions = txnData?.data ?? [];
  const budgets = budgetData?.data ?? [];

  const filtered = transactions.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      (t.merchant_name ?? "").toLowerCase().includes(q) ||
      (t.category ?? "").toLowerCase().includes(q)
    );
  });

  const allCategories = [
    ...new Set(
      (summaryQuery.data ?? []).flatMap((m) => Object.keys(m.by_category))
    ),
  ].slice(0, 8);

  const chartData = (summaryQuery.data ?? []).map((m) => ({
    month: m.month.slice(5),
    ...Object.fromEntries(
      allCategories.map((c) => [c, m.by_category[c] ?? 0])
    ),
  }));

  const recurring = transactions.filter((t) => t.is_recurring);

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 rounded-lg p-1 w-fit border border-gray-800">
        {(["transactions", "budgets"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? "bg-gray-700 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "transactions" && (
        <>
          {/* Spending Chart */}
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <h2 className="text-sm font-semibold text-white mb-4">
              Monthly Spending by Category — last 6 months
            </h2>
            {summaryQuery.isLoading ? (
              <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
                Loading chart...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={chartData}
                  margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                >
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "#9ca3af", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${v}`}
                    width={55}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: 8,
                    }}
                    labelStyle={{ color: "#e5e7eb" }}
                    formatter={(value: number, name: string) => [
                      `$${value.toLocaleString()}`,
                      name,
                    ]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, color: "#9ca3af" }}
                  />
                  {allCategories.map((cat) => (
                    <Bar
                      key={cat}
                      dataKey={cat}
                      stackId="a"
                      fill={colorFor(cat)}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Search + Filter */}
          <div className="flex gap-3">
            <input
              placeholder="Search transactions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-gray-900 border border-gray-800 text-white text-sm px-3 py-2 rounded-lg placeholder-gray-500 focus:outline-none focus:border-gray-600"
            />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-gray-900 border border-gray-800 text-gray-300 text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-gray-600"
            >
              <option value="">All categories</option>
              {[
                ...new Set(
                  transactions.map((t) => t.category).filter(Boolean)
                ),
              ]
                .sort()
                .map((c) => (
                  <option key={c!} value={c!}>
                    {c}
                  </option>
                ))}
            </select>
          </div>

          {/* Transaction Table */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            {txnLoading ? (
              <div className="p-6 text-center text-gray-500 text-sm">
                Loading transactions...
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">
                No transactions yet. Sync your accounts to get started.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400">
                    <th className="text-left px-4 py-3 font-medium">Date</th>
                    <th className="text-left px-4 py-3 font-medium">
                      Description
                    </th>
                    <th className="text-left px-4 py-3 font-medium">
                      Category
                    </th>
                    <th className="text-left px-4 py-3 font-medium">
                      Account
                    </th>
                    <th className="text-right px-4 py-3 font-medium">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 100).map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                    >
                      <td className="px-4 py-2.5 text-gray-400">{t.date}</td>
                      <td className="px-4 py-2.5 text-white">
                        {t.merchant_name ?? t.name}
                        {t.pending && (
                          <span className="ml-2 text-xs text-yellow-500">
                            Pending
                          </span>
                        )}
                        {t.is_recurring && (
                          <span className="ml-2 text-xs text-blue-400">↻</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {t.category ? (
                          <span
                            className="px-2 py-0.5 rounded-full text-xs"
                            style={{
                              background: colorFor(t.category) + "33",
                              color: colorFor(t.category),
                            }}
                          >
                            {t.category}
                          </span>
                        ) : (
                          <span className="text-gray-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">
                        {t.account_name}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-mono font-medium ${
                          t.amount < 0 ? "text-green-400" : "text-white"
                        }`}
                      >
                        {t.amount < 0 ? `+${fmt(t.amount)}` : fmt(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Recurring Charges */}
          {recurring.length > 0 && (
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <h2 className="text-sm font-semibold text-white mb-3">
                Recurring Charges
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {recurring.slice(0, 9).map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2"
                  >
                    <span className="text-xs text-gray-300 truncate">
                      {t.merchant_name ?? t.name}
                    </span>
                    <span className="text-xs text-white ml-2 shrink-0">
                      {fmt(t.amount)}/mo
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "budgets" && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {budgetLoading ? (
              <div className="col-span-3 text-center text-gray-500 text-sm py-8">
                Loading budgets...
              </div>
            ) : budgets.length === 0 ? (
              <div className="col-span-3 text-center text-gray-500 text-sm py-8">
                No budgets set. Add your first budget below.
              </div>
            ) : (
              budgets.map((b) => <BudgetCard key={b.id} budget={b} />)
            )}
          </div>
          <AddBudgetRow />
        </>
      )}
    </div>
  );
}

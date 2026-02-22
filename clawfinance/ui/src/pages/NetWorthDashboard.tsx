import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { TrendingUp, TrendingDown, AlertCircle, Info, CheckCircle, CreditCard, Building2 } from "lucide-react";
import { api } from "../lib/api.ts";

type NetWorthResponse = {
  data: {
    current: { total_assets: number; total_liabilities: number; net_worth: number };
    history: { date: string; net_worth: number }[];
  };
};

type AccountsResponse = {
  data: Array<{
    id: string;
    account_name: string;
    institution_name: string;
    account_type: string;
    current_balance: number;
    is_active: boolean;
  }>;
};

type InsightsResponse = {
  data: Array<{
    id: string;
    type: string;
    severity: string;
    title: string;
    description: string;
    created_at: string;
    status: string;
  }>;
};

function fmt(n: number, compact = false) {
  if (compact && Math.abs(n) >= 1_000_000)
    return `$${(n / 1_000_000).toFixed(1)}M`;
  if (compact && Math.abs(n) >= 1_000)
    return `$${(n / 1_000).toFixed(0)}K`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const ACCOUNT_COLORS: Record<string, string> = {
  checking: "#10b981",
  savings: "#3b82f6",
  investment: "#8b5cf6",
  credit: "#ef4444",
  loan: "#f97316",
  mortgage: "#f59e0b",
  other: "#6b7280",
};

const SEVERITY_CONFIG = {
  info: { icon: Info, cls: "text-blue-400 bg-blue-900/30 border-blue-800" },
  warning: { icon: AlertCircle, cls: "text-yellow-400 bg-yellow-900/30 border-yellow-800" },
  critical: { icon: AlertCircle, cls: "text-red-400 bg-red-900/30 border-red-800" },
  success: { icon: CheckCircle, cls: "text-emerald-400 bg-emerald-900/30 border-emerald-800" },
};

export default function NetWorthDashboard() {
  const { data: nwData, isLoading: nwLoading } = useQuery({
    queryKey: ["networth"],
    queryFn: () => api.get<NetWorthResponse>("/api/networth"),
    staleTime: 60_000,
  });

  const { data: acctData } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => api.get<AccountsResponse>("/api/accounts"),
    staleTime: 60_000,
  });

  const { data: insightData } = useQuery({
    queryKey: ["insights", "active"],
    queryFn: () => api.get<InsightsResponse>("/api/insights?status=active"),
    staleTime: 30_000,
  });

  const current = nwData?.data.current;
  const history = nwData?.data.history ?? [];
  const accounts = acctData?.data ?? [];
  const insights = insightData?.data ?? [];

  const chartData = history.map((h) => ({
    date: fmtDate(h.date),
    value: Number(h.net_worth),
  }));

  const firstVal = chartData[0]?.value;
  const lastVal = chartData[chartData.length - 1]?.value;
  const nwChange = firstVal != null && lastVal != null ? lastVal - firstVal : null;
  const nwChangePct =
    firstVal != null && firstVal !== 0 && nwChange != null
      ? (nwChange / Math.abs(firstVal)) * 100
      : null;

  const assetAccounts = accounts.filter(
    (a) => !["credit", "loan", "mortgage"].includes(a.account_type) && Number(a.current_balance) > 0
  );
  const liabilityAccounts = accounts.filter((a) =>
    ["credit", "loan", "mortgage"].includes(a.account_type)
  );

  const assetPie = Object.entries(
    assetAccounts.reduce((acc, a) => {
      const t = a.account_type ?? "other";
      acc[t] = (acc[t] ?? 0) + Number(a.current_balance);
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm text-gray-400 mb-1">Total Net Worth</p>
            {nwLoading ? (
              <p className="text-4xl font-bold text-white animate-pulse">—</p>
            ) : current ? (
              <>
                <p className="text-4xl font-bold text-white">{fmt(current.net_worth)}</p>
                <div className="flex items-center gap-4 mt-2 text-sm flex-wrap">
                  <span className="text-emerald-400">Assets: {fmt(current.total_assets)}</span>
                  <span className="text-red-400">Liabilities: {fmt(current.total_liabilities)}</span>
                  {nwChange !== null && (
                    <span className={`flex items-center gap-1 ${nwChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {nwChange >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      {nwChange >= 0 ? "+" : ""}{fmt(nwChange)} ({nwChangePct?.toFixed(1)}%)
                      <span className="text-gray-500 text-xs"> all time</span>
                    </span>
                  )}
                </div>
              </>
            ) : (
              <p className="text-gray-500 text-sm mt-2">Connect an account to see your net worth.</p>
            )}
          </div>
          <div className="flex gap-4">
            <div className="text-right">
              <p className="text-xs text-gray-500">Accounts</p>
              <p className="text-xl font-bold text-white">{accounts.filter((a) => a.is_active).length}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Alerts</p>
              <p className="text-xl font-bold text-white">
                {insights.filter((i) => i.severity !== "info").length}
              </p>
            </div>
          </div>
        </div>

        {chartData.length > 1 && (
          <div className="mt-5 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5ba4a4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#5ba4a4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6b7280" }} tickLine={false} axisLine={false} />
                <YAxis
                  tickFormatter={(v) => fmt(v, true)}
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                  tickLine={false}
                  axisLine={false}
                  width={60}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(v: number) => [fmt(v), "Net Worth"]}
                />
                <Area type="monotone" dataKey="value" stroke="#5ba4a4" fill="url(#nwGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        {chartData.length === 0 && !nwLoading && (
          <div className="mt-4 h-32 flex items-center justify-center border border-dashed border-gray-800 rounded-lg">
            <p className="text-gray-600 text-sm">Net worth history appears here after your first sync.</p>
          </div>
        )}
      </div>

      {/* Accounts + Asset Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">Accounts</h2>
          </div>
          {accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Building2 className="w-8 h-8 text-gray-700" />
              <p className="text-gray-500 text-sm">No accounts linked yet.</p>
              <p className="text-gray-600 text-xs text-center max-w-xs px-4">
                Use the Plaid MCP server to connect your bank accounts and investments.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {accounts.map((a) => (
                <div key={a.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${ACCOUNT_COLORS[a.account_type] ?? "#6b7280"}20` }}
                    >
                      <CreditCard
                        className="w-4 h-4"
                        style={{ color: ACCOUNT_COLORS[a.account_type] ?? "#6b7280" }}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{a.account_name}</p>
                      <p className="text-xs text-gray-500">
                        {a.institution_name} · {a.account_type}
                      </p>
                    </div>
                  </div>
                  <p
                    className={`text-sm font-semibold ${
                      ["credit", "loan", "mortgage"].includes(a.account_type)
                        ? "text-red-400"
                        : "text-white"
                    }`}
                  >
                    {["credit", "loan", "mortgage"].includes(a.account_type) ? "−" : ""}
                    {fmt(Math.abs(Number(a.current_balance)))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-white">Asset Breakdown</h2>
          {assetPie.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={160}>
                <PieChart>
                  <Pie
                    data={assetPie}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {assetPie.map((entry) => (
                      <Cell key={entry.name} fill={ACCOUNT_COLORS[entry.name] ?? "#6b7280"} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: "8px", fontSize: "11px" }}
                    formatter={(v: number) => [fmt(v), ""]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {assetPie.map((entry) => (
                  <div key={entry.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: ACCOUNT_COLORS[entry.name] ?? "#6b7280" }}
                      />
                      <span className="text-gray-400 capitalize">{entry.name}</span>
                    </div>
                    <span className="text-white">{fmt(entry.value, true)}</span>
                  </div>
                ))}
                {liabilityAccounts.length > 0 && (
                  <div className="pt-2 border-t border-gray-800 flex items-center justify-between text-xs">
                    <span className="text-gray-500">Total liabilities</span>
                    <span className="text-red-400">
                      −{fmt(liabilityAccounts.reduce((s, a) => s + Number(a.current_balance), 0), true)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center border border-dashed border-gray-800 rounded-lg">
              <p className="text-gray-600 text-xs text-center px-4">
                Asset breakdown appears after accounts are linked.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Insight Feed */}
      {insights.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-white">Alerts & Insights</h2>
          <div className="space-y-2">
            {insights.slice(0, 5).map((ins) => {
              const cfg =
                SEVERITY_CONFIG[ins.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.info;
              const Icon = cfg.icon;
              return (
                <div key={ins.id} className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${cfg.cls}`}>
                  <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{ins.title}</p>
                    {ins.description && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{ins.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-600 flex-shrink-0">
                    {new Date(ins.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!current && !nwLoading && insights.length === 0 && (
        <div className="bg-gray-900 rounded-xl p-8 border border-dashed border-gray-700 text-center space-y-2">
          <p className="text-gray-400 text-sm font-medium">No data yet</p>
          <p className="text-gray-600 text-xs max-w-sm mx-auto">
            Connect your accounts via the Plaid MCP server, then ask the AI assistant (bottom-right) to run a sync.
          </p>
        </div>
      )}
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.ts";

type NetWorthResponse = {
  data: {
    current: { total_assets: number; total_liabilities: number; net_worth: number };
    history: { date: string; net_worth: number }[];
  };
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export default function NetWorthDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["networth"],
    queryFn: () => api.get<NetWorthResponse>("/api/networth"),
  });

  const current = data?.data.current;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <p className="text-sm text-gray-400 mb-1">Net Worth</p>
        {isLoading && <p className="text-3xl font-bold text-white animate-pulse">—</p>}
        {error && <p className="text-red-400 text-sm">Failed to load — is the API running?</p>}
        {current && (
          <>
            <p className="text-4xl font-bold text-white">{fmt(current.net_worth)}</p>
            <div className="flex gap-6 mt-3 text-sm text-gray-400">
              <span>Assets: <span className="text-green-400">{fmt(current.total_assets)}</span></span>
              <span>Liabilities: <span className="text-red-400">{fmt(current.total_liabilities)}</span></span>
            </div>
          </>
        )}
      </div>

      {/* Phase notice */}
      <div className="bg-gray-900 rounded-xl p-6 border border-dashed border-gray-700 text-center">
        <p className="text-gray-500 text-sm">
          📊 Charts, account cards, and insight feed coming in Phase 2.<br />
          Link your first account via the Plaid MCP server to see real data.
        </p>
      </div>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, AreaChart, Area, XAxis, YAxis } from "recharts";
import { api } from "../lib/api.ts";

type Holding = {
  id: string; ticker_symbol: string; security_name: string; security_type: string;
  quantity: number; cost_basis_total: number; market_price: number; market_value: number;
  unrealized_gain_loss: number; unrealized_gain_loss_pct: number;
  acquisition_date: string | null; account_name: string; institution_name: string;
};
type PortfolioSummary = {
  total_value: number; total_cost_basis: number;
  total_unrealized_gl: number; total_unrealized_gl_pct: number;
  position_count: number;
  by_type: { equities: number; etfs: number; funds: number; bonds: number };
};
type NWHistory = { date: string; net_worth: number };

const fmt = (n: number, d = 0) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: d }).format(n);
const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

const TYPE_COLORS: Record<string, string> = {
  equities: "#6366f1", etfs: "#22c55e", funds: "#f97316", bonds: "#06b6d4",
};

export default function PortfolioView() {
  const { data: portfolioData, isLoading: pLoading } = useQuery({
    queryKey: ["portfolio"],
    queryFn: () => api.get<{ data: PortfolioSummary }>("/api/portfolio"),
  });
  const { data: holdingsData, isLoading: hLoading } = useQuery({
    queryKey: ["holdings"],
    queryFn: () => api.get<{ data: Holding[] }>("/api/portfolio/holdings"),
  });
  const { data: nwData } = useQuery({
    queryKey: ["networth"],
    queryFn: () => api.get<{ data: { current: unknown; history: NWHistory[] } }>("/api/networth"),
  });

  const p = portfolioData?.data;
  const holdings = holdingsData?.data ?? [];
  const history = nwData?.data.history ?? [];

  const pieData = p ? [
    { name: "Equities", value: p.by_type.equities, color: TYPE_COLORS.equities },
    { name: "ETFs",     value: p.by_type.etfs,     color: TYPE_COLORS.etfs },
    { name: "Funds",    value: p.by_type.funds,     color: TYPE_COLORS.funds },
    { name: "Bonds",    value: p.by_type.bonds,     color: TYPE_COLORS.bonds },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="space-y-6">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Portfolio Value", value: p ? fmt(p.total_value) : "—" },
          { label: "Unrealized G/L",  value: p ? fmt(p.total_unrealized_gl) : "—",
            sub: p ? pct(p.total_unrealized_gl_pct) : "", green: (p?.total_unrealized_gl ?? 0) >= 0 },
          { label: "Positions",       value: p ? String(p.position_count) : "—" },
        ].map(c => (
          <div key={c.label} className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <p className="text-xs text-gray-400 mb-1">{c.label}</p>
            <p className="text-2xl font-bold text-white">{pLoading ? "—" : c.value}</p>
            {c.sub != null && (
              <p className={`text-xs mt-1 ${c.green === false ? "text-red-400" : c.green ? "text-green-400" : "text-gray-500"}`}>{c.sub}</p>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Pie */}
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <h2 className="text-sm font-semibold text-white mb-3">Allocation</h2>
          {pieData.length === 0 ? (
            <p className="text-gray-500 text-xs text-center py-10">No holdings</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={42} outerRadius={65} dataKey="value" paddingAngle={2}>
                    {pieData.map(e => <Cell key={e.name} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background:"#1f2937", border:"1px solid #374151", borderRadius:8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1">
                {pieData.map(d => (
                  <div key={d.name} className="flex justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-gray-400"><span className="w-2 h-2 rounded-full" style={{background:d.color}}/>{d.name}</span>
                    <span className="text-white">{p ? Math.round(d.value/p.total_value*100) : 0}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Area chart */}
        <div className="col-span-2 bg-gray-900 rounded-xl p-5 border border-gray-800">
          <h2 className="text-sm font-semibold text-white mb-3">Net Worth History</h2>
          {history.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-gray-500 text-sm">Sync accounts to start tracking.</div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={history} margin={{top:0,right:0,left:0,bottom:0}}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{fill:"#9ca3af",fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>v.slice(5)}/>
                <YAxis tick={{fill:"#9ca3af",fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`} width={45}/>
                <Tooltip formatter={(v:number)=>fmt(v)} contentStyle={{background:"#1f2937",border:"1px solid #374151",borderRadius:8}}/>
                <Area type="monotone" dataKey="net_worth" stroke="#22c55e" fill="url(#g)" strokeWidth={2} dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Holdings table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800 flex justify-between items-center">
          <h2 className="text-sm font-semibold text-white">Holdings</h2>
          <span className="text-xs text-gray-500">{holdings.length} positions</span>
        </div>
        {hLoading ? (
          <p className="p-6 text-center text-gray-500 text-sm">Loading...</p>
        ) : holdings.length === 0 ? (
          <p className="p-6 text-center text-gray-500 text-sm">No holdings. Link a brokerage account to get started.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-xs">
                {["Ticker","Name","Qty","Price","Value","Cost","G/L","G/L%","Account"].map(h=>(
                  <th key={h} className={`px-3 py-2.5 font-medium ${["Ticker","Name","Account"].includes(h)?"text-left":"text-right"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {holdings.map(h => {
                const gl = h.unrealized_gain_loss;
                const c = gl >= 0 ? "text-green-400" : "text-red-400";
                return (
                  <tr key={h.id} className="border-b border-gray-800/40 hover:bg-gray-800/30">
                    <td className="px-3 py-2 font-mono font-semibold text-white">{h.ticker_symbol}</td>
                    <td className="px-3 py-2 text-gray-300 max-w-[140px] truncate">{h.security_name}</td>
                    <td className="px-3 py-2 text-right text-gray-400">{Number(h.quantity).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-gray-300">{fmt(h.market_price,2)}</td>
                    <td className="px-3 py-2 text-right font-medium text-white">{fmt(h.market_value)}</td>
                    <td className="px-3 py-2 text-right text-gray-400">{fmt(h.cost_basis_total)}</td>
                    <td className={`px-3 py-2 text-right ${c}`}>{gl>=0?"+":""}{fmt(gl)}</td>
                    <td className={`px-3 py-2 text-right ${c}`}>{pct(h.unrealized_gain_loss_pct)}</td>
                    <td className="px-3 py-2 text-gray-400 text-xs">{h.account_name}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

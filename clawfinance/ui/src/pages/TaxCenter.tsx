import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Upload } from "lucide-react";
import { api } from "../lib/api.ts";

type TaxEstimate = {
  year: number; filing_status: string;
  income: { w2_wages: number; interest: number; dividends: number; capital_gains: number; gross_income: number };
  deduction: { amount: number; type: string };
  taxable_income: number;
  tax: { federal_ordinary: number; ltcg: number; niit: number; total_federal: number };
  effective_rate_pct: number; marginal_rate_pct: number;
  withholding: number; estimated_payments_paid: number;
  balance_due: number; quarterly_payment: number; quarters_remaining: number;
};
type TaxDoc = { id: string; year: number; form_type: string; issuer_name: string; file_path: string; total_income: number; total_tax_withheld: number; date_ingested: string };
type Deduction = { id: string; year: number; type: string; amount: number; source: string; status: string };
type Withholding = { year: number; total_withheld: number; estimated_annual_tax: number | null; safe_harbor_pct: number | null; shortfall: number | null; at_risk: boolean };

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export default function TaxCenter() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [formType, setFormType] = useState("W-2");
  const [activeTab, setActiveTab] = useState<"overview"|"documents"|"deductions">("overview");

  const { data: estData } = useQuery({ queryKey: ["tax-estimate"], queryFn: () => api.get<{data:TaxEstimate}>("/api/tax/estimate").catch(() => null) });
  const { data: docsData, isLoading: docsLoading } = useQuery({ queryKey: ["tax-docs"], queryFn: () => api.get<{data:TaxDoc[]}>("/api/tax/documents") });
  const { data: dedsData } = useQuery({ queryKey: ["deductions"], queryFn: () => api.get<{data:Deduction[];total_deductions:number}>("/api/tax/deductions") });
  const { data: wData } = useQuery({ queryKey: ["withholding"], queryFn: () => api.get<{data:Withholding}>("/api/tax/withholding-check") });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("form_type", formType);
      return fetch("/api/tax/documents/upload", { method: "POST", body: fd }).then(r => r.json());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tax-docs"] }),
  });

  const est = estData?.data;
  const docs = docsData?.data ?? [];
  const deds = dedsData?.data ?? [];
  const wh = wData?.data;

  const incomeChartData = est ? [
    { name: "W-2 Wages",      value: est.income.w2_wages,      color: "#6366f1" },
    { name: "Interest",        value: est.income.interest,       color: "#06b6d4" },
    { name: "Dividends",       value: est.income.dividends,      color: "#22c55e" },
    { name: "Capital Gains",   value: est.income.capital_gains,  color: "#f97316" },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 rounded-lg p-1 w-fit border border-gray-800">
        {(["overview","documents","deductions"] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-1.5 rounded text-sm font-medium capitalize transition-colors ${activeTab===t?"bg-gray-700 text-white":"text-gray-400 hover:text-white"}`}>{t}</button>
        ))}
      </div>

      {activeTab === "overview" && (
        <>
          {/* Tax Estimate Hero */}
          <div className="grid grid-cols-4 gap-4">
            {est ? [
              { label: "Total Federal Tax",  value: fmt(est.tax.total_federal), sub: `${est.effective_rate_pct}% effective` },
              { label: "Marginal Rate",       value: `${est.marginal_rate_pct}%`, sub: "bracket" },
              { label: "Balance Due",         value: fmt(Math.abs(est.balance_due)), sub: est.balance_due >= 0 ? "owed" : "refund", red: est.balance_due > 0 },
              { label: "Quarterly Payment",   value: fmt(est.quarterly_payment), sub: `${est.quarters_remaining} left` },
            ].map(c => (
              <div key={c.label} className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                <p className="text-xs text-gray-400 mb-1">{c.label}</p>
                <p className={`text-2xl font-bold ${c.red ? "text-red-400" : "text-white"}`}>{c.value}</p>
                <p className="text-xs text-gray-500 mt-1">{c.sub}</p>
              </div>
            )) : (
              <div className="col-span-4 bg-gray-900 rounded-xl p-6 border border-dashed border-gray-700 text-center text-gray-500 text-sm">
                No tax estimate yet — upload tax documents and run <code className="text-gray-400 bg-gray-800 px-1 rounded">estimate_liability.py</code>
              </div>
            )}
          </div>

          {est && (
            <div className="grid grid-cols-2 gap-4">
              {/* Income breakdown */}
              <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                <h2 className="text-sm font-semibold text-white mb-4">Income Breakdown</h2>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={incomeChartData} layout="vertical" margin={{top:0,right:20,left:0,bottom:0}}>
                    <XAxis type="number" tick={{fill:"#9ca3af",fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/>
                    <YAxis type="category" dataKey="name" tick={{fill:"#9ca3af",fontSize:11}} axisLine={false} tickLine={false} width={90}/>
                    <Tooltip formatter={(v:number)=>fmt(v)} contentStyle={{background:"#1f2937",border:"1px solid #374151",borderRadius:8}}/>
                    <Bar dataKey="value" radius={[0,4,4,0]}>
                      {incomeChartData.map(e=><Cell key={e.name} fill={e.color}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Withholding check */}
              <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                <h2 className="text-sm font-semibold text-white mb-4">Withholding Check</h2>
                {wh ? (
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">YTD Withheld</span>
                      <span className="text-white font-medium">{fmt(wh.total_withheld)}</span>
                    </div>
                    {wh.estimated_annual_tax != null && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Estimated Annual Tax</span>
                          <span className="text-white font-medium">{fmt(wh.estimated_annual_tax)}</span>
                        </div>
                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{width:`${Math.min(wh.safe_harbor_pct??0,100)}%`, background: wh.at_risk?"#ef4444":"#22c55e"}}/>
                        </div>
                        <p className={`text-xs ${wh.at_risk?"text-red-400":"text-green-400"}`}>
                          {wh.safe_harbor_pct}% of target — {wh.at_risk ? `⚠ ${fmt(wh.shortfall??0)} shortfall` : "✓ Safe harbor met"}
                        </p>
                      </>
                    )}
                  </div>
                ) : <p className="text-gray-500 text-sm">Upload W-2 documents to check withholding.</p>}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "documents" && (
        <>
          {/* Upload */}
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <h2 className="text-sm font-semibold text-white mb-4">Upload Tax Document</h2>
            <div className="flex gap-3 items-center">
              <select value={formType} onChange={e=>setFormType(e.target.value)} className="bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 rounded-lg">
                {["W-2","1099-INT","1099-DIV","1099-B","1099-MISC","1040"].map(f=><option key={f}>{f}</option>)}
              </select>
              <button onClick={()=>fileRef.current?.click()} disabled={uploadMutation.isPending} className="flex items-center gap-2 bg-claw-700 hover:bg-claw-600 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50 transition-colors">
                <Upload size={14}/>{uploadMutation.isPending?"Uploading...":"Choose PDF"}
              </button>
              <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={e=>{if(e.target.files?.[0])uploadMutation.mutate(e.target.files[0])}}/>
            </div>
            {uploadMutation.isSuccess && <p className="text-green-400 text-xs mt-2">✓ Uploaded. Run extract_tax_doc.py to process.</p>}
          </div>

          {/* Document list */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            {docsLoading ? <p className="p-6 text-center text-gray-500 text-sm">Loading...</p>
            : docs.length === 0 ? <p className="p-6 text-center text-gray-500 text-sm">No tax documents uploaded yet.</p>
            : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-xs">
                    {["Year","Form","Issuer","Income","Withheld","Uploaded"].map(h=>(
                      <th key={h} className={`px-4 py-3 font-medium ${["Income","Withheld"].includes(h)?"text-right":"text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {docs.map(doc=>(
                    <tr key={doc.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="px-4 py-2.5 text-white">{doc.year}</td>
                      <td className="px-4 py-2.5"><span className="px-2 py-0.5 bg-gray-800 rounded text-gray-300 text-xs">{doc.form_type}</span></td>
                      <td className="px-4 py-2.5 text-gray-300">{doc.issuer_name || "—"}</td>
                      <td className="px-4 py-2.5 text-right text-white">{doc.total_income ? fmt(doc.total_income) : "—"}</td>
                      <td className="px-4 py-2.5 text-right text-gray-400">{doc.total_tax_withheld ? fmt(doc.total_tax_withheld) : "—"}</td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">{new Date(doc.date_ingested).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {activeTab === "deductions" && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800 flex justify-between">
            <h2 className="text-sm font-semibold text-white">Deductions</h2>
            {dedsData && <span className="text-sm text-green-400">{fmt(dedsData.total_deductions)} total</span>}
          </div>
          {deds.length === 0 ? (
            <p className="p-6 text-center text-gray-500 text-sm">No deductions tracked yet. The TaxAgent identifies deductions automatically from your transactions.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-xs">
                  {["Type","Amount","Source","Status"].map(h=><th key={h} className={`px-4 py-3 font-medium ${h==="Amount"?"text-right":"text-left"}`}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {deds.map(d=>(
                  <tr key={d.id} className="border-b border-gray-800/50">
                    <td className="px-4 py-2.5 text-white capitalize">{d.type.replace(/_/g," ")}</td>
                    <td className="px-4 py-2.5 text-right text-green-400">{fmt(d.amount)}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{d.source}</td>
                    <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded text-xs ${d.status==="confirmed"?"bg-green-900/50 text-green-400":"bg-gray-800 text-gray-400"}`}>{d.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

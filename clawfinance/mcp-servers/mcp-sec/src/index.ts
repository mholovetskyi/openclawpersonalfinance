import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const BASE = "https://data.sec.gov";
const HEADERS = { "User-Agent": "ClawFinance/1.0 (personal-finance-app)" };

async function secFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`SEC API error ${res.status}: ${path}`);
  return res.json();
}

// Convert ticker to CIK via EDGAR company_tickers.json
async function tickerToCik(ticker: string): Promise<string | null> {
  const data: Record<string, { cik_str: number; ticker: string }> = await fetch(
    "https://www.sec.gov/files/company_tickers.json", { headers: HEADERS }
  ).then(r => r.json());
  const entry = Object.values(data).find(e => e.ticker.toLowerCase() === ticker.toLowerCase());
  if (!entry) return null;
  return String(entry.cik_str).padStart(10, "0");
}

const server = new Server({ name: "mcp-sec", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: "get_company_filings", description: "Get recent SEC filings for a ticker (10-K, 10-Q, 8-K, etc.)", inputSchema: { type: "object", properties: { ticker: { type: "string" }, form_type: { type: "string", description: "e.g. 10-K, 10-Q, 8-K" }, limit: { type: "number" } }, required: ["ticker"] } },
    { name: "search_filings", description: "Full-text search of SEC EDGAR filings", inputSchema: { type: "object", properties: { query: { type: "string" }, date_range: { type: "string" }, form_type: { type: "string" } }, required: ["query"] } },
    { name: "get_insider_transactions", description: "Section 16 insider transactions for a company", inputSchema: { type: "object", properties: { ticker: { type: "string" } }, required: ["ticker"] } },
    { name: "get_company_facts", description: "Structured XBRL financial facts for a company", inputSchema: { type: "object", properties: { ticker: { type: "string" } }, required: ["ticker"] } },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = args as Record<string, string & number>;

  switch (name) {
    case "get_company_filings": {
      const cik = await tickerToCik(a.ticker);
      if (!cik) throw new Error(`CIK not found for ticker: ${a.ticker}`);
      const data = await secFetch(`/submissions/CIK${cik}.json`);
      const filings = data.filings?.recent ?? {};
      const limit = Number(a.limit ?? 20);
      const results = (filings.form ?? []).slice(0, limit).map((_:string, i:number) => ({
        form: filings.form[i], filed: filings.filingDate[i],
        accession: filings.accessionNumber[i], primary_doc: filings.primaryDocument[i],
      })).filter((f:{form:string}) => !a.form_type || f.form === a.form_type);
      return { content: [{ type: "text", text: JSON.stringify({ cik, ticker: a.ticker, filings: results }) }] };
    }
    case "search_filings": {
      const url = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(a.query)}&dateRange=${a.date_range ?? "custom"}&forms=${a.form_type ?? ""}`;
      const data = await fetch(url, { headers: HEADERS }).then(r => r.json());
      return { content: [{ type: "text", text: JSON.stringify(data.hits?.hits ?? []) }] };
    }
    case "get_insider_transactions": {
      const cik = await tickerToCik(a.ticker);
      if (!cik) throw new Error(`CIK not found for ticker: ${a.ticker}`);
      // Section 16 filings (Form 4)
      const data = await secFetch(`/submissions/CIK${cik}.json`);
      const filings = data.filings?.recent ?? {};
      const form4 = (filings.form ?? []).map((_:string,i:number)=>({ form:filings.form[i],filed:filings.filingDate[i],accession:filings.accessionNumber[i] })).filter((f:{form:string})=>f.form==="4").slice(0,20);
      return { content: [{ type: "text", text: JSON.stringify({ ticker: a.ticker, insider_filings: form4 }) }] };
    }
    case "get_company_facts": {
      const cik = await tickerToCik(a.ticker);
      if (!cik) throw new Error(`CIK not found for ticker: ${a.ticker}`);
      const data = await secFetch(`/api/xbrl/companyfacts/CIK${cik}.json`);
      // Return just the most recent year of key facts to avoid overwhelming output
      const usgaap = data.facts?.["us-gaap"] ?? {};
      const summary: Record<string, unknown> = {};
      for (const key of ["Revenues","NetIncomeLoss","Assets","Liabilities","StockholdersEquity","EarningsPerShareBasic"]) {
        if (usgaap[key]) { const vals = usgaap[key].units?.USD ?? usgaap[key].units?.shares ?? []; summary[key] = vals.slice(-4); }
      }
      return { content: [{ type: "text", text: JSON.stringify({ ticker: a.ticker, cik, facts: summary }) }] };
    }
    default: throw new Error(`Unknown tool: ${name}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[mcp-sec] running on stdio");

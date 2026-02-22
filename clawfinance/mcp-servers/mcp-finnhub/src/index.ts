import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import Finnhub from "finnhub";

const API_KEY = process.env.FINNHUB_API_KEY!;
if (!API_KEY) { console.error("[mcp-finnhub] FINNHUB_API_KEY required"); process.exit(1); }

const finnhubClient = new Finnhub.DefaultApi();
Finnhub.ApiClient.instance.authentications["api_key"].apiKey = API_KEY;

function finnhubCall<T>(fn: (cb: (e: unknown, d: T) => void) => void): Promise<T> {
  return new Promise((resolve, reject) => fn((err, data) => err ? reject(err) : resolve(data)));
}

const server = new Server({ name: "mcp-finnhub", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: "get_quote", description: "Real-time stock quote", inputSchema: { type: "object", properties: { symbol: { type: "string" } }, required: ["symbol"] } },
    { name: "get_company_news", description: "Latest news for a ticker", inputSchema: { type: "object", properties: { symbol: { type: "string" }, from: { type: "string" }, to: { type: "string" } }, required: ["symbol","from","to"] } },
    { name: "get_company_profile", description: "Company fundamentals", inputSchema: { type: "object", properties: { symbol: { type: "string" } }, required: ["symbol"] } },
    { name: "get_earnings_calendar", description: "Upcoming earnings dates", inputSchema: { type: "object", properties: { from: { type: "string" }, to: { type: "string" }, symbol: { type: "string" } }, required: ["from","to"] } },
    { name: "get_earnings_transcript", description: "Earnings call transcript", inputSchema: { type: "object", properties: { symbol: { type: "string" }, year: { type: "number" }, quarter: { type: "number" } }, required: ["symbol","year","quarter"] } },
    { name: "get_financials", description: "Latest financial statements", inputSchema: { type: "object", properties: { symbol: { type: "string" }, statement: { type: "string", enum: ["bs","ic","cf"] }, freq: { type: "string", enum: ["annual","quarterly"] } }, required: ["symbol","statement"] } },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = args as Record<string, string & number>;
  let data: unknown;

  switch (name) {
    case "get_quote":
      data = await finnhubCall(cb => finnhubClient.quote(a.symbol, cb)); break;
    case "get_company_news":
      data = await finnhubCall(cb => finnhubClient.companyNews(a.symbol, a.from, a.to, cb)); break;
    case "get_company_profile":
      data = await finnhubCall(cb => finnhubClient.companyProfile2({ symbol: a.symbol }, cb)); break;
    case "get_earnings_calendar":
      data = await finnhubCall(cb => finnhubClient.earningsCalendar({ from: a.from, to: a.to, symbol: a.symbol }, cb)); break;
    case "get_earnings_transcript":
      data = await finnhubCall(cb => finnhubClient.earningsCallTranscripts(a.symbol, Number(a.year), Number(a.quarter), cb)); break;
    case "get_financials":
      data = await finnhubCall(cb => finnhubClient.financials(a.symbol, a.statement ?? "bs", a.freq ?? "annual", cb)); break;
    default: throw new Error(`Unknown tool: ${name}`);
  }

  return { content: [{ type: "text", text: JSON.stringify(data) }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[mcp-finnhub] running on stdio");

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import Snaptrade from "snaptrade-typescript-sdk";

const CLIENT_ID = process.env.SNAPTRADE_CLIENT_ID!;
const CONSUMER_KEY = process.env.SNAPTRADE_CONSUMER_KEY!;

if (!CLIENT_ID || !CONSUMER_KEY) {
  console.error("[mcp-snaptrade] SNAPTRADE_CLIENT_ID and SNAPTRADE_CONSUMER_KEY required");
  process.exit(1);
}

const snaptrade = new Snaptrade({ clientId: CLIENT_ID, consumerKey: CONSUMER_KEY });

const server = new Server(
  { name: "mcp-snaptrade", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_accounts",
      description: "Get all brokerage accounts linked via SnapTrade",
      inputSchema: {
        type: "object",
        properties: { user_id: { type: "string" }, user_secret: { type: "string" } },
        required: ["user_id", "user_secret"],
      },
    },
    {
      name: "get_holdings",
      description: "Get all holdings (positions) across all brokerage accounts",
      inputSchema: {
        type: "object",
        properties: { user_id: { type: "string" }, user_secret: { type: "string" } },
        required: ["user_id", "user_secret"],
      },
    },
    {
      name: "get_account_positions",
      description: "Get positions for a specific brokerage account",
      inputSchema: {
        type: "object",
        properties: {
          user_id: { type: "string" }, user_secret: { type: "string" },
          account_id: { type: "string", description: "SnapTrade account ID" },
        },
        required: ["user_id", "user_secret", "account_id"],
      },
    },
    {
      name: "get_portfolio_performance",
      description: "Get portfolio-level performance metrics (returns, allocation)",
      inputSchema: {
        type: "object",
        properties: { user_id: { type: "string" }, user_secret: { type: "string" } },
        required: ["user_id", "user_secret"],
      },
    },
    {
      name: "get_transaction_history",
      description: "Get brokerage transaction history (buys, sells, dividends)",
      inputSchema: {
        type: "object",
        properties: {
          user_id: { type: "string" }, user_secret: { type: "string" },
          start_date: { type: "string" }, end_date: { type: "string" },
        },
        required: ["user_id", "user_secret"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = args as Record<string, string>;

  switch (name) {
    case "get_accounts": {
      const res = await snaptrade.accountInformation.listUserAccounts({
        userId: a.user_id, userSecret: a.user_secret,
      });
      return { content: [{ type: "text", text: JSON.stringify(res.data) }] };
    }
    case "get_holdings": {
      const res = await snaptrade.accountInformation.getUserHoldings({
        userId: a.user_id, userSecret: a.user_secret,
      });
      return { content: [{ type: "text", text: JSON.stringify(res.data) }] };
    }
    case "get_account_positions": {
      const res = await snaptrade.accountInformation.getUserAccountPositions({
        userId: a.user_id, userSecret: a.user_secret, accountId: a.account_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(res.data) }] };
    }
    case "get_portfolio_performance": {
      const res = await snaptrade.portfolioManagement.portfolioGroups({
        userId: a.user_id, userSecret: a.user_secret,
      });
      return { content: [{ type: "text", text: JSON.stringify(res.data) }] };
    }
    case "get_transaction_history": {
      const res = await snaptrade.transactionsAndReporting.getActivities({
        userId: a.user_id, userSecret: a.user_secret,
        startDate: a.start_date, endDate: a.end_date,
      });
      return { content: [{ type: "text", text: JSON.stringify(res.data) }] };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[mcp-snaptrade] running on stdio");

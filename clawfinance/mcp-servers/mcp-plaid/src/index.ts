import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID!;
const PLAID_SECRET = process.env.PLAID_SECRET!;
const PLAID_ENV = (process.env.PLAID_ENV ?? "sandbox") as keyof typeof PlaidEnvironments;

if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
  console.error("[mcp-plaid] PLAID_CLIENT_ID and PLAID_SECRET are required");
  process.exit(1);
}

const config = new Configuration({
  basePath: PlaidEnvironments[PLAID_ENV],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": PLAID_CLIENT_ID,
      "PLAID-SECRET": PLAID_SECRET,
    },
  },
});
const plaidClient = new PlaidApi(config);

const server = new Server(
  { name: "mcp-plaid", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_accounts",
      description: "Get all linked bank accounts with current balances",
      inputSchema: {
        type: "object",
        properties: {
          access_token: { type: "string", description: "Plaid access token for the linked institution" },
        },
        required: ["access_token"],
      },
    },
    {
      name: "get_transactions",
      description: "Get transactions for a date range",
      inputSchema: {
        type: "object",
        properties: {
          access_token: { type: "string", description: "Plaid access token" },
          start_date: { type: "string", description: "Start date in YYYY-MM-DD format" },
          end_date: { type: "string", description: "End date in YYYY-MM-DD format" },
        },
        required: ["access_token", "start_date", "end_date"],
      },
    },
    {
      name: "get_liabilities",
      description: "Get credit card and loan liability details",
      inputSchema: {
        type: "object",
        properties: {
          access_token: { type: "string", description: "Plaid access token" },
        },
        required: ["access_token"],
      },
    },
    {
      name: "get_investments",
      description: "Get investment holdings and securities for a brokerage account",
      inputSchema: {
        type: "object",
        properties: {
          access_token: { type: "string", description: "Plaid access token" },
        },
        required: ["access_token"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "get_accounts": {
      const response = await plaidClient.accountsGet({
        access_token: args!.access_token as string,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(response.data.accounts) }],
      };
    }

    case "get_transactions": {
      const response = await plaidClient.transactionsGet({
        access_token: args!.access_token as string,
        start_date: args!.start_date as string,
        end_date: args!.end_date as string,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(response.data.transactions) }],
      };
    }

    case "get_liabilities": {
      const response = await plaidClient.liabilitiesGet({
        access_token: args!.access_token as string,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(response.data.liabilities) }],
      };
    }

    case "get_investments": {
      const response = await plaidClient.investmentsHoldingsGet({
        access_token: args!.access_token as string,
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              holdings: response.data.holdings,
              securities: response.data.securities,
            }),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[mcp-plaid] server running on stdio");
}

main().catch((err) => {
  console.error("[mcp-plaid] fatal:", err);
  process.exit(1);
});

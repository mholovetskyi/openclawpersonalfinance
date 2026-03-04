import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// ── Configuration ────────────────────────────────────────────────────────────

const FLINKS_CUSTOMER_ID = process.env.FLINKS_CUSTOMER_ID!;
const FLINKS_INSTANCE = process.env.FLINKS_INSTANCE ?? "toolbox";
const FLINKS_AUTH_KEY = process.env.FLINKS_AUTH_KEY ?? "";

if (!FLINKS_CUSTOMER_ID) {
  console.error("[mcp-flinks] FLINKS_CUSTOMER_ID is required");
  process.exit(1);
}

function baseUrl(): string {
  return `https://${FLINKS_INSTANCE}-api.private.fin.ag/v3/${FLINKS_CUSTOMER_ID}/BankingServices`;
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (FLINKS_AUTH_KEY) h["flinks-auth-key"] = FLINKS_AUTH_KEY;
  return h;
}

async function flinksPost(endpoint: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${baseUrl()}/${endpoint}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  return res.json();
}

async function flinksGet(endpoint: string): Promise<unknown> {
  const res = await fetch(`${baseUrl()}/${endpoint}`, {
    method: "GET",
    headers: headers(),
  });
  return res.json();
}

// ── MCP Server ───────────────────────────────────────────────────────────────

const server = new Server(
  { name: "mcp-flinks", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "authorize",
      description:
        "Start a Flinks session. For a first-time connection, provide institution/username/password. " +
        "For a returning user, provide login_id to refresh. Returns a request_id for subsequent calls.",
      inputSchema: {
        type: "object",
        properties: {
          login_id: {
            type: "string",
            description: "LoginId from a previous connection (for refresh). Omit for first-time auth.",
          },
          institution: {
            type: "string",
            description: "Bank institution code (e.g. 'FlinksCapital' for sandbox). Required for first-time auth.",
          },
          username: { type: "string", description: "Bank login username. Required for first-time auth." },
          password: { type: "string", description: "Bank login password. Required for first-time auth." },
          save: {
            type: "boolean",
            description: "Whether to save the connection for future refreshes. Defaults to true.",
          },
          most_recent_cached: {
            type: "boolean",
            description: "Return cached data if available. Defaults to true for refreshes.",
          },
          security_responses: {
            type: "object",
            description:
              "MFA challenge responses. Keys are the security question text, values are arrays of answers.",
            additionalProperties: { type: "array", items: { type: "string" } },
          },
          request_id: {
            type: "string",
            description: "RequestId from a previous authorize call (needed when answering MFA challenges).",
          },
        },
        required: [],
      },
    },
    {
      name: "get_accounts_summary",
      description:
        "Get a quick overview of connected accounts: holder name, balance, category, and EFT eligibility.",
      inputSchema: {
        type: "object",
        properties: {
          request_id: { type: "string", description: "RequestId from a successful /Authorize call" },
        },
        required: ["request_id"],
      },
    },
    {
      name: "get_accounts_detail",
      description:
        "Get full account details including transactions. May return 202 if still processing — " +
        "use get_accounts_detail_async to poll for results.",
      inputSchema: {
        type: "object",
        properties: {
          request_id: { type: "string", description: "RequestId from a successful /Authorize call" },
          with_transactions: {
            type: "boolean",
            description: "Include transaction history. Defaults to true.",
          },
        },
        required: ["request_id"],
      },
    },
    {
      name: "get_accounts_detail_async",
      description:
        "Poll for pending GetAccountsDetail results. Call this when get_accounts_detail returns 202.",
      inputSchema: {
        type: "object",
        properties: {
          request_id: { type: "string", description: "RequestId from the original GetAccountsDetail call" },
        },
        required: ["request_id"],
      },
    },
    {
      name: "get_statements",
      description: "Retrieve bank statements for the connected accounts.",
      inputSchema: {
        type: "object",
        properties: {
          request_id: { type: "string", description: "RequestId from a successful /Authorize call" },
          number_of_statements: {
            type: "string",
            description: "How many statements to retrieve (e.g. 'MostRecent', 'Months3', 'Months12')",
          },
          accounts_filter: {
            type: "array",
            items: { type: "string" },
            description: "Array of account IDs to filter. Omit for all accounts.",
          },
        },
        required: ["request_id"],
      },
    },
    {
      name: "delete_card",
      description: "Delete a saved connection (LoginId). Removes all cached data for this user.",
      inputSchema: {
        type: "object",
        properties: {
          login_id: { type: "string", description: "The LoginId of the connection to delete" },
        },
        required: ["login_id"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = (args ?? {}) as Record<string, unknown>;

  switch (name) {
    case "authorize": {
      const body: Record<string, unknown> = {};
      if (a.login_id) {
        body.LoginId = a.login_id;
        body.MostRecentCached = a.most_recent_cached ?? true;
      } else {
        body.Institution = a.institution;
        body.Username = a.username;
        body.Password = a.password;
        body.Save = a.save ?? true;
        body.MostRecentCached = a.most_recent_cached ?? false;
      }
      if (a.security_responses) body.SecurityResponses = a.security_responses;
      if (a.request_id) body.RequestId = a.request_id;

      const result = await flinksPost("Authorize", body);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }

    case "get_accounts_summary": {
      const result = await flinksPost("GetAccountsSummary", {
        RequestId: a.request_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }

    case "get_accounts_detail": {
      const body: Record<string, unknown> = {
        RequestId: a.request_id,
      };
      if (a.with_transactions !== undefined) body.WithTransactions = a.with_transactions;
      const result = await flinksPost("GetAccountsDetail", body);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }

    case "get_accounts_detail_async": {
      const result = await flinksGet(`GetAccountsDetailAsync/${a.request_id}`);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }

    case "get_statements": {
      const body: Record<string, unknown> = {
        RequestId: a.request_id,
      };
      if (a.number_of_statements) body.NumberOfStatements = a.number_of_statements;
      if (a.accounts_filter) body.AccountsFilter = a.accounts_filter;
      const result = await flinksPost("GetStatements", body);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }

    case "delete_card": {
      const result = await flinksPost("DeleteCard", { LoginId: a.login_id });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[mcp-flinks] server running on stdio");
}

main().catch((err) => {
  console.error("[mcp-flinks] fatal:", err);
  process.exit(1);
});
